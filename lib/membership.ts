// "Is this signed-in account allowed into the app?"
//
// The server already answers this: GET /api/members/profile is allow-listed by
// the website's middleware even while a subscription is inactive, and its body
// carries subscription_status + onboarding_complete. So one request tells us
// everything, and there is nothing to keep in sync on the backend.
//
// Deliberately NOT using lib/api.ts: apiFetch signs the user out on 401, which
// fires SIGNED_OUT and resets the tree — that would wipe the screen we are
// about to show. Here a 401 is an answer, not an accident.
import { API_BASE } from './config';
import { supabase } from './supabase';

export type Access =
  | 'ok' // active, onboarded member — let them in
  | 'denied' // not a member / past member / not active — show NoAccess
  | 'unknown'; // couldn't ask (offline, server down) — see note below

// The decision itself, split out so it can be reasoned about (and tested)
// without a network or a Supabase session.
export function decideAccess(status: number, member: unknown): Access {
  // 401 = no member row for this email, or a past member.
  if (status === 401) return 'denied';
  if (status < 200 || status >= 300) return 'unknown';
  if (!member || typeof member !== 'object') return 'denied';

  // Same two flags the website's own gate uses (requireActiveMember).
  const m = member as { subscription_status?: unknown; onboarding_complete?: unknown };
  return m.subscription_status === 'active' && m.onboarding_complete === true ? 'ok' : 'denied';
}

export async function checkAccess(): Promise<Access> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'denied';

  try {
    const res = await fetch(`${API_BASE}/api/members/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return decideAccess(401, null);

    const body = await res.json().catch(() => null);
    return decideAccess(res.status, body?.member);
  } catch {
    // Network failure. We fail OPEN (callers treat 'unknown' like 'ok'):
    // locking a paying member out of the app because their train went into a
    // tunnel is worse than letting them in to screens that show their own
    // "couldn't load" errors.
    return 'unknown';
  }
}
