// Serving smaller images.
//
// Event photos are full-resolution uploads (up to 10 MB) sitting in a Supabase
// Storage bucket. Pulling those at their native size to fill a ~176px card is
// slow and wasteful, so we route them through Supabase's image render endpoint,
// which resizes on the fly and returns a small WEBP.
//
// The trick is a URL rewrite: a public object URL
//   .../storage/v1/object/public/events/123.jpg
// becomes a render URL
//   .../storage/v1/render/image/public/events/123.jpg?width=800&quality=70&resize=cover
//
// Image transforms are a paid Supabase feature; if the project doesn't have
// them enabled the render URL 400s. Callers pass the result to expo-image with
// an onError that falls back to the original URL, so a disabled transform
// degrades to "load the full image" instead of a broken image. Non-Supabase
// URLs (external images) are returned untouched.
const SB_PUBLIC = '/storage/v1/object/public/';
const SB_RENDER = '/storage/v1/render/image/public/';

export function isSupabasePublicImage(url: string): boolean {
  return url.includes(SB_PUBLIC);
}

// A resized variant of a Supabase public image, or the original URL unchanged
// when it isn't one (or already carries query params we shouldn't clobber).
export function resizedImage(url: string, width: number, quality = 70): string {
  if (!isSupabasePublicImage(url) || url.includes('?')) return url;
  return `${url.replace(SB_PUBLIC, SB_RENDER)}?width=${width}&quality=${quality}&resize=cover`;
}
