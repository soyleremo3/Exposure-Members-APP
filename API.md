> Not: Bu dosya, ana projenin ("Exposure Members Mobile") API.md dosyasından değişiklik yapılmadan taşınmıştır — backend AYNI, bu proje de aynı `https://exposureai.org/api/members/...` uç noktalarını kullanıyor.

# Exposure Member API Reference

Base URL: `https://exposureai.org` (all paths below are relative to it).

This is the API the mobile app talks to. It's the same API the website uses. If something here doesn't match what the server actually returns, **ask the backend owner — don't guess.**

## Authentication

Every endpoint except `POST /api/members/auth` requires this header:

```
Authorization: Bearer <supabase access_token>
```

`lib/api.ts` adds it automatically — use `apiFetch`/`apiJson` and you never have to think about it.

Server-side rules (you can't bypass these from the app):

- The token must belong to an email that exists in the members table. Past members (`is_past_member = true`) are rejected → **401**.
- Most routes also require `onboarding_complete = true`; `/api/members/events` additionally requires `subscription_status = 'active'`.
- A **401** response means "not logged in / no longer a member" — the app reacts by signing out.
- **Read-only test accounts.** An account whose `member_category` is `'test'`
  is a mobile-app tester: the backend (`proxy.ts`) lets it GET anything but
  returns **403 `{ "error": "Test accounts are read-only" }`** for *every*
  non-GET to `/api/members/*` — profile edits, avatar upload, match opt-in,
  job posts/applications/referrals, notification settings, everything. This is
  not a failure; it's the whole point of the test account. The app has no
  special handling for it — the 403 surfaces through the normal
  `readableError`/`ErrorNotice` path like any other write failure (decided
  2026-07-24, see PROJECT.md §4.11).

## Common error responses

| Status | Meaning | Body |
|---|---|---|
| 400 | Bad input (missing/too-long field) | `{ "error": "<message>" }` |
| 401 | Unauthorized (bad/expired token, past member, not onboarded) | `{ "error": "Unauthorized" }` |
| 403 | Read-only test account tried to write (see below) | `{ "error": "Test accounts are read-only" }` |
| 404 | Thing doesn't exist (or isn't yours) | `{ "error": "<message>" }` |
| 409 | Conflict — e.g. applying twice to the same job, post already closed | `{ "error": "<message>" }` |
| 429 | Rate limited — too many requests, wait and retry | `{ "error": "<message>" }` |
| 500/502 | Server-side failure | `{ "error": "<message>" }` |

---

## Auth

### POST `/api/members/auth` — request a login code
**No auth header.** Sends the member an email with a magic link (for web) and a 6-digit code (for the app).

Request: `{ "email": "member@example.com" }`

Response: `200 { "ok": true }` — **always**, even if the email isn't a member (so the endpoint can't be used to check who's a member). Tell the user to check their inbox.

Errors: `400` invalid/missing email; `429` too many attempts (limits: 8 per IP / 5 per email per 15 min).

The app then verifies the code with Supabase directly (`supabase.auth.verifyOtp({ email, token, type: 'email' })`) — that call does not go through this API.

---

## Profile

### ⚠️ Four columns don't mean what they're named

The website reuses four member columns for something completely different from
what the column name suggests. This is not a guess — it's how the site itself
reads and writes them (`app/members/dashboard/DashboardClient.tsx` in
`github.com/onurrcelik/Exposure`, verified 2026-07-23):

| Column | What it actually holds | Evidence |
|---|---|---|
| `instagram` | **Educational Background** — e.g. "BSc Computer Science, Stanford" | form label at `:2049`, onboarding maps `instagram: form.education` |
| `twitter` | **Area of Interest** — e.g. "AI, GTM, Vibe Coding" | form label at `:2048` |
| `bio` | **Current Occupation** — e.g. "Building a SaaS product" | form label at `:2046` |
| `website` | **Refer a Friend payload** — a JSON *string* holding an array of referrals | written at `:886`, read back at `:736` |

None of these four are social links or URLs. Never pass `instagram`, `twitter`
or `website` to something that opens a URL, and never show `website` as an
editable text field — a member typing into it destroys their referrals.

Only `linkedin`, `github` and `occupation_link` ("Relevant Link") are real URLs.

### GET `/api/members/profile` — your own profile
Response: `200 { "member": { ... } }` with fields:
`id, email, name, bio, avatar_url, member_types, linkedin, location, instagram, twitter, website, github, favorite_resource, occupation_link, phone, member_category, subscription_status, is_past_member, onboarding_complete, auto_opt_in, batch, created_at`

### PATCH `/api/members/profile` — update your profile
Request: JSON with any of these fields (strings unless noted):
`name` (≤120), `bio` (≤280), `linkedin`, `location`, `instagram`, `twitter`, `website`, `member_types`, `github`, `favorite_resource`, `occupation_link`, `phone` (≤40), `auto_opt_in` (boolean).

Send `null` or `""` to clear a field. **`avatar_url` is rejected** — use upload-avatar instead. `email` and `subscription_status` cannot be changed.

Response: `200 { "member": { ... } }` (updated profile). Errors: `400` with a validation message.

### POST `/api/members/upload-avatar` — change your photo
Request: `multipart/form-data` with one field named **`file`**.
Constraints: JPG/PNG/WEBP only, max 5 MB (the server also checks the real file bytes, not just the extension).

Response: `200 { "url": "https://..." }` — the new avatar URL (also saved to your profile automatically).

### Refer a Friend — there is no referral endpoint

The "Refer a Friend" screen has **no route of its own**. The website stores
referrals inside the `website` profile column as a JSON string:

Read: `GET /api/members/profile` → `JSON.parse(member.website)`, expecting an
array. If it isn't valid JSON, the site silently ignores it and shows an empty
form — do the same.

Write: `PATCH /api/members/profile` with

```json
{ "website": "[{\"name\":\"…\",\"email\":\"…\",\"linkedin\":\"…\",\"notes\":\"…\"}]" }
```

Exactly two referrals are collected, and only entries with a non-empty `name`
are saved. Note the second field is keyed `email` but its input is labelled
**"Phone number"** on the site — a quirk in the website, mirrored as-is.

---

## Directory

### GET `/api/members/directory` — all members
Response: `200 { "members": [ ... ] }`, each member:
`id, name, bio, avatar_url, member_types, linkedin, location, instagram, twitter, github, favorite_resource, occupation_link, batch, is_past_member, created_at`

Notes: no email/phone/website here (privacy). Only onboarded members with a name appear. No query params; filter/search client-side.

`member_types` arrives as a **comma-separated string**, not an array — read it
through `toTypeList()` (see the note in `types.ts`).

**Past members ARE included** (`is_past_member: true`). The website does not
hide them: it lists current members first, then a separate "Past Members"
heading with the count and the same cards at 60% opacity and a "Past" badge.
The member count shown above the grid counts **current members only**.

`batch` renders as a cohort badge in the form `E{batch}` — e.g. `batch: 2` → `E2`.

`favorite_resource` is shown prefixed with `✦`, italic, and is **not**
clickable even when it contains a URL.

---

## Events

### GET `/api/members/events` — upcoming/past events
Requires **active** subscription (server-checked). Response: `200 { "events": [ ... ] }` — rows straight from the events table, ordered by date descending. Fields are not guaranteed; expect things like `id, title/name, date, location, url, description` and render defensively (see `EventsScreen.tsx`).

---

## Job Board

All job-board routes require an onboarded member. Rate limits: creating posts 10/hour, applying 30/hour, referring 30/hour → `429`.

### GET `/api/members/job-board` — list posts
Returns open posts plus posts closed within the last 7 days.

Response: `200 { "posts": [ ... ] }`, each post:
- `id`, `type` (`"job"` = offering work, `"need"` = looking for help), `title`, `description`, `location` (string|null), `tags` (string[]), `status` (`"open"`|`"closed"`), `closed_at`, `created_at`, `updated_at`
- `author`: `{ id, name, avatar_url, company_name }`
- `is_own` (boolean — you wrote it), `viewer_applied` (boolean — you already applied)
- `application_count` (number; only meaningful on your own posts, otherwise 0)
- `share_token` (string|null), `incoming_referral` (`{ referrer_name, note }` | null — someone referred YOU to this post)

### POST `/api/members/job-board` — create a post
Request: `{ "type": "job"|"need", "title": "...", "description": "...", "location": "...", "tags": ["..."] }`
- `type`, `title` (≤140), `description` (≤5000) required; `location` (≤120) only used for `type: "job"`; `tags` max 12, each ≤30 chars.

Response: `201 { "post": { ... } }`. Errors: `400` validation, `429` rate limit.

### PATCH `/api/members/job-board/[id]` — edit or close (your own post)
Two request variants:
- Close: `{ "action": "close" }`
- Edit: same fields as create.

Response: `200 { "ok": true }`. Errors: `404` not found / not yours, `400` validation.

### DELETE `/api/members/job-board/[id]` — delete your own post
Response: `200 { "ok": true }`.

### POST `/api/members/job-board/[id]/apply` — apply to a post
Request: `{ "pitch": "why I'm a fit", "link": "https://..." }` — `pitch` required (≤1500), `link` optional (≤500, must be a valid URL).

Response: `200 { "ok": true }`.
Errors: `400` (own post / bad pitch/link), `404` post not found, **`409` post closed or you already applied**, `429`.

### DELETE `/api/members/job-board/[id]/apply` — withdraw your application
Response: `200 { "ok": true }`.

### GET `/api/members/job-board/[id]/applications` — applicants (your own post only)
Response: `200 { "applications": [ ... ] }`, each:
`id, applicant: { member_id, name, avatar_url, company_name, email, phone, linkedin, bio, is_external }, pitch, link, referred_by_name, created_at`
Errors: `404` if the post isn't yours.

### POST `/api/members/job-board/[id]/refer` — refer another member
Request: `{ "referred_member_id": "<member id>", "note": "optional, ≤500" }`

Response: `200 { "ok": true }`.
Errors: `400` (self-referral, referring the author, ...), `404`, **`409` post closed or person already referred**, `429`.

### GET `/api/members/job-board/notifications` — your email notification settings
Response: `200 { "subscription": { "notify_jobs": boolean, "notify_needs": boolean } }`

### PUT `/api/members/job-board/notifications` — update them
Request: `{ "notify_jobs"?: boolean, "notify_needs"?: boolean }`
Response: same shape as GET.

---

## Match (weekly 1:1 member matching)

### GET `/api/members/match` — everything about your matches
Response: `200` with:
- `currentRound` — the active round (`id, week_of, status, created_at`) or null
- `myResponse` — your opt-in row for the current round (includes `opted_in`, `confirmed_met`) or null
- `myCurrentMatch` — your partner's member profile (only when the round's `status` is `"matched"`) or null
- `isOpener` — boolean|null; whether you're the one expected to reach out
- `pendingConfirmation` — `{ round_id, member: { id, name, avatar_url } }` | null — last round's match you haven't confirmed meeting yet
- `matchHistory` — `[{ round_id, week_of, partner: { ...member fields }, confirmed_met }]`
- `currentMatchHistory` — your current partner's past matches, same shape without `confirmed_met`

### POST `/api/members/match` — opt in / confirm
Request: `{ "round_id": "<uuid>", "opted_in"?: boolean, "confirmed_met"?: boolean }`
Response: `200 { "ok": true }`. Errors: `400` invalid/missing round_id or non-boolean values.

### How the website derives the screen states

There is no state field — the UI is computed from the three values above:

| Shown when | UI |
|---|---|
| `currentRound` is null | nothing to join yet |
| `status !== 'matched'`, not opted in | opt-in prompt |
| `status !== 'matched'`, opted in | "you're in, waiting for pairing" |
| `status === 'matched'` and `myCurrentMatch` set | partner card, `isOpener` decides who messages first |
| `status === 'matched'` and `myCurrentMatch` **null** | **"Missed this round?"** + a **"Late opt-in"** button |

"Late opt-in" is not a separate endpoint — it is the ordinary
`POST /match { round_id, opted_in: true }`. The site tracks the click in local
state only, so a page reload shows the button again.

`week_of` is rendered without a year: `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })` → "Jul 20".

**Auto opt-in** is `PATCH /api/members/profile { auto_opt_in }`. Copy on the
site: on → `"On — You will join every round automatically."`, off →
`"Off — you choose each week."` (the capital Y is the site's own typo).

---

## Content

### GET `/api/members/links` — shared links from the community
Response: `200 { "groups": [ ... ] }`, each group:
`{ id, date_from, date_to, links: [{ url, type, label, title, notes, description? }] }`

Link `type` values seen on the site, each with its own icon:
`repo` · `youtube` · `linkedin` · `twitter` · `instagram` · `paper` · `article`,
and anything else falls back to a generic globe icon.

### GET `/api/members/newsletter` — newsletter posts
Response: `200 { "posts": [{ id, title, subtitle, publish_date, web_url, thumbnail_url }] }`
Errors: `500` (not configured), `502` (upstream failed).

There is no "subscribe URL" field. The site derives it from the newest post:
`new URL(posts[0].web_url).origin + '/subscribe'`, and hides the Subscribe
button entirely when there are no posts.

### GET `/api/members/youtube` — channel videos
Response: `200 { "longForm": [...], "shorts": [...] }`, each video:
`{ id, title, published_at, thumbnail_urls: string[], is_short: boolean, youtube_url: string }`
Note: on upstream failure this returns `200` with empty arrays, not an error.

### GET `/api/members/community-graph` — meeting connection graphs
Response: `200 { "graphs": [ ... ] }` — each graph has `people[]`, `edges[]`, `metadata`, `meeting_date`, `source_file`. Sorted by meeting date.

---

## Community Brain (AI search over community knowledge)

> **Not launched yet.** The website gates this section behind a hard-coded
> allowlist of two email addresses; everyone else sees a blurred "Coming Soon"
> panel. The routes below are real but there's no point wiring them up until
> the allowlist goes away — the app shows the same "Coming Soon" message.

These routes proxy an upstream AI service; response bodies come from that service mostly unmodified.

### POST `/api/members/brain-query` — ask a question
Request: `{ "query": "your question", "community"?: "RCEB" }`
Response: the brain service's answer JSON (pass-through). Errors: `400` missing query, `502` brain unavailable. Can take a long time (up to ~120 s) — prefer the stream endpoint for UX.

### GET `/api/members/brain-query` — recent query history
Response: pass-through list of the last 8 queries.

### GET `/api/members/brain-query/[id]` — one past query
`id` must be numeric. Response: `200 { ...answer, id }`. Errors: `400` bad id, `404`-ish upstream error, `502`.

### GET `/api/members/brain-query/[id]/stream` — live answer stream (SSE)
`Content-Type: text/event-stream`. Emits Server-Sent Events whose payloads are the same answer shape as the GET above, sent incrementally. Note: React Native's `fetch` doesn't support SSE well — you'll need an SSE client library (e.g. `react-native-sse`) when you build this screen.
