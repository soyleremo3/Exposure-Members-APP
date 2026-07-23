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
//
// NOTE on `instagram` / `twitter` / `bio`: these three columns are NOT what
// their names say. The website stores education, interests and occupation in
// them (see the table at the top of API.md's Profile section). They are plain
// text — never hand them to Linking.openURL. The only real URLs on a member
// are `linkedin`, `github` and `occupation_link`.
export type Member = {
  id: string;
  name: string;
  // "Current Occupation" on the site — e.g. "Building a SaaS product".
  bio: string;
  avatar_url?: string | null;
  member_types?: string | string[] | null;
  linkedin?: string | null;
  location?: string | null;
  // "Area of Interest" — plain text, not a Twitter handle.
  twitter?: string | null;
  // "Educational Background" — plain text, not an Instagram handle.
  instagram?: string | null;
  github?: string | null;
  favorite_resource?: string | null;
  occupation_link?: string | null;
  // Cohort number. Rendered as `E{batch}` — batch 2 shows as "E2".
  batch?: number | null;
  is_past_member?: boolean;
  created_at: string;
};

// Your OWN profile (GET /api/members/profile) — includes private fields
// the directory never exposes.
export type SelfMember = Member & {
  email: string;
  phone?: string | null;
  // NOT a website. The site stores the Refer a Friend form here as a JSON
  // string (see API.md → "Refer a Friend — there is no referral endpoint").
  // Read it with parseReferrals(); never show it as an editable text field.
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

// Events are raw rows from the exposure_events table (the endpoint does
// `select('*')`). The website reads the fields below; an older schema used
// `image_url`/`attendee_count`/`is_past`, so those are kept as fallbacks and
// the screen normalizes them. Index signature stays for anything unexpected.
export type EventRecord = {
  id?: string;
  title?: string;
  description?: string;
  date?: string;
  location?: string;
  // 'In-person' (green badge) or 'Online' (blue). Older rows: 'in-person'.
  type?: string;
  attendees?: number;
  attendee_count?: number; // legacy column name
  images?: string[];
  image_url?: string | null; // legacy single-image column
  upcoming?: boolean;
  is_past?: boolean; // legacy inverse of `upcoming`
  created_at?: string;
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
  // Known values: "open" (opt-in window), "matched" (partners assigned,
  // myCurrentMatch is set), "closed" (round over). Kept as a string in case
  // the backend adds more.
  status: string;
  created_at: string;
};

export type MatchMyResponse = {
  // Can be null: the row exists but the member hasn't answered yet.
  opted_in: boolean | null;
  confirmed_met?: boolean | null;
  [key: string]: unknown;
};

// The matched partner carries private contact fields the directory never
// exposes — the round has "introduced" you, so email/phone come through.
export type MatchPartner = Member & {
  email?: string | null;
  phone?: string | null;
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
  myCurrentMatch: MatchPartner | null;
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
  // Beehiiv sends this as a UNIX timestamp in SECONDS (a number), not a date
  // string — the website multiplies by 1000 before `new Date()`. Kept loose
  // because older/other sources might send an ISO string.
  publish_date?: number | string | null;
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
