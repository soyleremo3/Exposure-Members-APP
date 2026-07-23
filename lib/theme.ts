// The brand colors as plain strings.
//
// Styling is done with NativeWind classes (`bg-brand-blue`, `text-brand-cream`
// — see tailwind.config.js). But a few React Native props take a raw color
// value and can't be styled with a class: ActivityIndicator's `color`,
// RefreshControl's `tintColor`, navigator screenOptions. Those import from
// here so the hex codes still live in exactly two places.
export const BRAND_BLUE = '#0339A6';
export const BRAND_CREAM = '#FFFCF6';
