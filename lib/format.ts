// Small display helpers. No API or navigation logic here.

// The API is inconsistent about "list of short strings" fields: `member_types`
// arrives as a comma-separated STRING for most members, `tags` is documented
// as an array. Either can also be null or missing. Reading them directly is
// what crashed the directory in the previous project (`.join` on a string).
//
// Everything list-ish goes through here, so a shape change on the server
// degrades to an empty list instead of a white screen.
export function toTypeList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// Up to two initials for the avatar placeholder. Returns '?' for empty names.
export function initialsOf(name: string | null | undefined): string {
  const initials = (name ?? '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials || '?';
}

// Friendly date, falling back to the raw string when it doesn't parse —
// better to show something odd than nothing at all.
export function formatDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// "3 gün önce" style relative time for job posts and match history.
export function timeAgo(raw: string | null | undefined): string {
  if (!raw) return '';
  const then = new Date(raw).getTime();
  if (isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
