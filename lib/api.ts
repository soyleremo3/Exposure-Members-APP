// All talk with the Exposure API goes through this file.
//
// Why one shared function? Every request needs the same three things:
//   1. the full URL (API_BASE + path)
//   2. the Authorization header with the current access token
//   3. consistent error handling (especially 401 = "you're logged out")
// Centralizing them means screens never worry about auth plumbing.
//
// See API.md for the endpoint reference. If a response shape here disagrees
// with what the server actually sends, fix API.md too — don't guess.
import { API_BASE } from './config';
import { supabase } from './supabase';
import type {
  AvatarUploadResponse,
  DirectoryResponse,
  EventsResponse,
  JobApplicationsResponse,
  JobBoardResponse,
  JobDraft,
  JobNotificationSettings,
  JobNotificationsResponse,
  JobPostResponse,
  LinksResponse,
  MatchData,
  NewsletterResponse,
  OkResponse,
  ProfilePatch,
  ProfileResponse,
  YoutubeResponse,
} from '../types';

export class ApiError extends Error {
  status: number;
  // Set when the server answered 401 but the session is actually fine —
  // i.e. this endpoint needs an active membership the member doesn't have.
  // Screens use this to show "membership required" instead of a login screen.
  subscriptionRequired: boolean;
  // Set when the server rejected a write because this is a test account.
  // The backend (proxy.ts) makes `member_category === 'test'` accounts
  // GET-only: every non-GET to /api/members/* returns 403 "Test accounts are
  // read-only". These are mobile-app testers who should be able to browse
  // everything without side effects, so screens treat this as an expected,
  // non-alarming condition rather than a failure.
  readOnly: boolean;

  constructor(status: number, message: string, subscriptionRequired = false) {
    super(message);
    this.status = status;
    this.subscriptionRequired = subscriptionRequired;
    this.readOnly = status === 403 && /read-only/i.test(message);
  }
}

// True when an error is the backend's "test accounts are read-only" 403.
// Screens use it to swallow the red error strip and show a gentle notice
// instead — the write was never going to persist for a test account.
export function isReadOnlyError(e: unknown): boolean {
  return e instanceof ApiError && e.readOnly;
}

// Shown once per screen when the signed-in account is a read-only tester.
export const READ_ONLY_NOTICE =
  "You're on a read-only test account — changes here won't be saved.";

// Turn anything thrown by the helpers below into a sentence a member can
// read. The server's own `error` message is usually the most specific thing
// available (409 tells you WHICH conflict), so we pass it through and only
// override where it isn't self-explanatory.
export function readableError(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof ApiError) {
    if (e.readOnly) return READ_ONLY_NOTICE;
    if (e.status === 429) return 'Too many requests — wait a few minutes and try again.';
    if (e.status >= 500) return 'The server had a problem. Please try again shortly.';
    return e.message;
  }
  // A network failure surfaces as a plain TypeError from fetch.
  if (e instanceof TypeError) return 'Could not reach the server. Check your connection.';
  return e instanceof Error ? e.message : fallback;
}

type FetchOptions = {
  // Default true. Pass false when a 401 might mean something other than
  // "logged out" and you want to decide for yourself (see getEvents).
  signOutOn401?: boolean;
};

// Low-level fetch wrapper. Prefer the typed helpers below in screens.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts: FetchOptions = {},
): Promise<Response> {
  const { signOutOn401 = true } = opts;

  // Ask supabase for the CURRENT session on every call (it refreshes tokens
  // in the background, so caching the token ourselves would go stale).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // 401 means the server no longer accepts our token (revoked, expired
  // beyond refresh, membership ended). Signing out fires SIGNED_OUT, which
  // App.tsx listens for and swaps the tree back to the login screen.
  if (res.status === 401 && signOutOn401) {
    await supabase.auth.signOut();
    throw new ApiError(401, 'Session expired — please sign in again.');
  }

  return res;
}

// JSON helper: apiFetch + parse + throw a readable error on non-2xx.
export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  opts: FetchOptions = {},
): Promise<T> {
  const res = await apiFetch(path, init, opts);
  if (!res.ok) {
    // The API usually returns { error: "message" } — surface it if present.
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

// Shorthand for the many endpoints that just return { ok: true }.
function apiSend(path: string, method: string, body?: unknown): Promise<OkResponse> {
  return apiJson<OkResponse>(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}

// ------------------------------------------------------------------ profile

export function getProfile(): Promise<ProfileResponse> {
  return apiJson<ProfileResponse>('/api/members/profile');
}

export function updateProfile(patch: ProfilePatch): Promise<ProfileResponse> {
  return apiJson<ProfileResponse>('/api/members/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

// Avatar upload is multipart, not JSON. Pass the asset straight from
// expo-image-picker. Note we do NOT set Content-Type — fetch has to add it
// itself so it can append the multipart boundary.
export function uploadAvatar(asset: {
  uri: string;
  name: string;
  type: string;
}): Promise<AvatarUploadResponse> {
  const form = new FormData();
  // React Native's FormData accepts this {uri,name,type} shape; TypeScript's
  // DOM lib only knows about Blob, hence the cast.
  form.append('file', asset as unknown as Blob);
  return apiJson<AvatarUploadResponse>('/api/members/upload-avatar', {
    method: 'POST',
    body: form,
  });
}

// ---------------------------------------------------------------- directory

export function getDirectory(): Promise<DirectoryResponse> {
  return apiJson<DirectoryResponse>('/api/members/directory');
}

// ------------------------------------------------------------------- events

// Events is the one endpoint that also requires subscription_status='active',
// and the server signals that with 401 — the same status it uses for "your
// token is bad". If we treated it the same way, a member whose subscription
// lapsed would get kicked out of the WHOLE app just by opening this tab.
//
// So: on 401 we don't sign out yet. We probe /profile first. If that works,
// the token is fine and the problem is the membership — report that instead.
export async function getEvents(): Promise<EventsResponse> {
  try {
    return await apiJson<EventsResponse>('/api/members/events', {}, { signOutOn401: false });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;

    const probe = await apiFetch('/api/members/profile', {}, { signOutOn401: false });
    if (probe.ok) {
      throw new ApiError(401, 'Events are only available to members with an active membership.', true);
    }

    // Profile said no too — the session really is dead.
    await supabase.auth.signOut();
    throw new ApiError(401, 'Session expired — please sign in again.');
  }
}

// ---------------------------------------------------------------- job board

export function getJobPosts(): Promise<JobBoardResponse> {
  return apiJson<JobBoardResponse>('/api/members/job-board');
}

export function createJobPost(draft: JobDraft): Promise<JobPostResponse> {
  return apiJson<JobPostResponse>('/api/members/job-board', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
}

export function updateJobPost(id: string, draft: JobDraft): Promise<OkResponse> {
  return apiSend(`/api/members/job-board/${id}`, 'PATCH', draft);
}

export function closeJobPost(id: string): Promise<OkResponse> {
  return apiSend(`/api/members/job-board/${id}`, 'PATCH', { action: 'close' });
}

export function deleteJobPost(id: string): Promise<OkResponse> {
  return apiSend(`/api/members/job-board/${id}`, 'DELETE');
}

// 409 here means "post is closed" or "you already applied" — screens should
// show the server's message rather than a generic failure.
export function applyToJob(
  id: string,
  application: { pitch: string; link?: string },
): Promise<OkResponse> {
  return apiSend(`/api/members/job-board/${id}/apply`, 'POST', application);
}

export function withdrawApplication(id: string): Promise<OkResponse> {
  return apiSend(`/api/members/job-board/${id}/apply`, 'DELETE');
}

// Your own posts only — 404 on anyone else's.
export function getJobApplications(id: string): Promise<JobApplicationsResponse> {
  return apiJson<JobApplicationsResponse>(`/api/members/job-board/${id}/applications`);
}

export function referMember(
  id: string,
  referral: { referred_member_id: string; note?: string },
): Promise<OkResponse> {
  return apiSend(`/api/members/job-board/${id}/refer`, 'POST', referral);
}

export function getJobNotifications(): Promise<JobNotificationsResponse> {
  return apiJson<JobNotificationsResponse>('/api/members/job-board/notifications');
}

export function updateJobNotifications(
  patch: Partial<JobNotificationSettings>,
): Promise<JobNotificationsResponse> {
  return apiJson<JobNotificationsResponse>('/api/members/job-board/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

// -------------------------------------------------------------------- match

export function getMatch(): Promise<MatchData> {
  return apiJson<MatchData>('/api/members/match');
}

// Used for both "count me in this week" and "yes, we met".
export function postMatch(payload: {
  round_id: string;
  opted_in?: boolean;
  confirmed_met?: boolean;
}): Promise<OkResponse> {
  return apiSend('/api/members/match', 'POST', payload);
}

// ------------------------------------------------------------------ content

export function getLinks(): Promise<LinksResponse> {
  return apiJson<LinksResponse>('/api/members/links');
}

export function getNewsletter(): Promise<NewsletterResponse> {
  return apiJson<NewsletterResponse>('/api/members/newsletter');
}

// Note: on upstream failure this returns 200 with empty arrays, not an error.
export function getYoutube(): Promise<YoutubeResponse> {
  return apiJson<YoutubeResponse>('/api/members/youtube');
}
