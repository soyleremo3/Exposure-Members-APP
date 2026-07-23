// Shapes of the data the Exposure API returns.
// See API.md for the full endpoint reference.
//
// Fields marked `?` may be missing or null — always render defensively
// (e.g. `member.location ?? ''`) because old accounts have sparse profiles.

// ---------------------------------------------------------------- members

// A member as everyone else sees them (GET /api/members/directory).
//
// NOTE on `member_types`: API.md describes it as a list, but the server
// actually sends a COMMA-SEPARATED STRING for most members (and omits it
// for some). Typing it as `string[]` is what crashed the directory in the
// previous project — a string has `.length` but no `.join`. The type below
// is deliberately loose; always read it through `toTypeList()` in
// lib/format.ts, never touch it directly.
export type Member = {
  id: string;
  name: string;
  bio: string;
  avatar_url?: string | null;
  member_types?: string | string[] | null;
  linkedin?: string | null;
  location?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  github?: string | null;
  favorite_resource?: string | null;
  occupation_link?: string | null;
  batch?: number | null;
  is_past_member?: boolean;
  created_at: string;
};

// Your OWN profile (GET /api/members/profile) — includes private fields
// the directory never exposes.
export type SelfMember = Member & {
  email: string;
  phone?: string | null;
  website?: string | null;
  member_category?: string | null;
  subscription_status: string;
  onboarding_complete: boolean;
  auto_opt_in?: boolean | null;
};

// The subset of profile fields PATCH /api/members/profile accepts.
// `avatar_url` is deliberately absent — the server rejects it; use
// uploadAvatar() instead. `email` and `subscription_status` are read-only.
export type ProfilePatch = Partial<{
  name: string | null;
  bio: string | null;
  linkedin: string | null;
  location: string | null;
  instagram: string | null;
  twitter: string | null;
  website: string | null;
  member_types: string | null;
  github: string | null;
  favorite_resource: string | null;
  occupation_link: string | null;
  phone: string | null;
  auto_opt_in: boolean;
}>;

// ----------------------------------------------------------------- events

// Events come from an external calendar, so the shape isn't guaranteed.
// We define it loosely and let the screen render whatever fields exist.
export type EventRecord = {
  id?: string;
  title?: string;
  name?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  url?: string;
  description?: string;
  [key: string]: unknown;
};

// -------------------------------------------------------------- job board

export type JobType = 'job' | 'need';
export type JobStatus = 'open' | 'closed';

export type JobAuthor = {
  id: string;
  name: string;
  avatar_url?: string | null;
  company_name?: string | null;
};

export type IncomingReferral = {
  referrer_name: string;
  note?: string | null;
};

export type JobPost = {
  id: string;
  // "job" = this member is offering work. "need" = they're looking for help.
  type: JobType;
  title: string;
  description: string;
  location?: string | null;
  // API.md says string[]; kept loose for the same reason as member_types.
  // Read it through toTypeList().
  tags?: string | string[] | null;
  status: JobStatus;
  closed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  author: JobAuthor;
  is_own: boolean;
  viewer_applied: boolean;
  // Only meaningful on your own posts; 0 on everyone else's.
  application_count: number;
  share_token?: string | null;
  // Set when another member referred YOU to this post.
  incoming_referral?: IncomingReferral | null;
};

// What you send to create or edit a post.
export type JobDraft = {
  type: JobType;
  title: string;
  description: string;
  location?: string | null;
  tags?: string[];
};

// One applicant on YOUR post (GET .../applications).
export type JobApplication = {
  id: string;
  applicant: {
    member_id?: string | null;
    name: string;
    avatar_url?: string | null;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedin?: string | null;
    bio?: string | null;
    // True for applicants who aren't Exposure members (came via share link).
    is_external?: boolean;
  };
  pitch: string;
  link?: string | null;
  referred_by_name?: string | null;
  created_at: string;
};

export type JobNotificationSettings = {
  notify_jobs: boolean;
  notify_needs: boolean;
};

// ------------------------------------------------------------------ match

export type MatchRound = {
  id: string;
  week_of: string;
  // "matched" means partners have been assigned and myCurrentMatch is set.
  status: string;
  created_at: string;
};

export type MatchMyResponse = {
  opted_in: boolean;
  confirmed_met?: boolean | null;
  [key: string]: unknown;
};

export type PendingConfirmation = {
  round_id: string;
  member: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
};

export type MatchHistoryEntry = {
  round_id: string;
  week_of: string;
  partner: Member;
  confirmed_met?: boolean | null;
};

// Everything GET /api/members/match returns, in one object.
export type MatchData = {
  currentRound: MatchRound | null;
  myResponse: MatchMyResponse | null;
  myCurrentMatch: Member | null;
  // Whether YOU are the one expected to send the first message.
  isOpener: boolean | null;
  // Last round's partner you haven't confirmed meeting yet.
  pendingConfirmation: PendingConfirmation | null;
  matchHistory: MatchHistoryEntry[];
  // Your current partner's past matches (no confirmed_met on these).
  currentMatchHistory: MatchHistoryEntry[];
};

// ---------------------------------------------------------------- content

export type SharedLink = {
  url: string;
  type?: string | null;
  label?: string | null;
  title?: string | null;
  notes?: string | null;
  description?: string | null;
};

export type LinkGroup = {
  id: string;
  date_from?: string | null;
  date_to?: string | null;
  links: SharedLink[];
};

export type NewsletterPost = {
  id: string;
  title: string;
  subtitle?: string | null;
  publish_date?: string | null;
  web_url: string;
  thumbnail_url?: string | null;
};

export type YoutubeVideo = {
  id: string;
  title: string;
  published_at?: string | null;
  thumbnail_urls?: string[];
  is_short: boolean;
  youtube_url: string;
};

// ------------------------------------------------------- response wrappers
// The API wraps every list/object in a named key.

export type DirectoryResponse = { members: Member[] };
export type ProfileResponse = { member: SelfMember };
export type EventsResponse = { events: EventRecord[] };
export type JobBoardResponse = { posts: JobPost[] };
export type JobPostResponse = { post: JobPost };
export type JobApplicationsResponse = { applications: JobApplication[] };
export type JobNotificationsResponse = { subscription: JobNotificationSettings };
export type AvatarUploadResponse = { url: string };
export type LinksResponse = { groups: LinkGroup[] };
export type NewsletterResponse = { posts: NewsletterPost[] };
export type YoutubeResponse = { longForm: YoutubeVideo[]; shorts: YoutubeVideo[] };
export type OkResponse = { ok: true };
