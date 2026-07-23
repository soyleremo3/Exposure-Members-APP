// Theme: colors, the light/dark preference, and a hook for the few places a
// raw color value is needed instead of a class.
//
// Most styling flips automatically: screens use semantic NativeWind classes
// (bg-background, text-body, …) backed by CSS variables that swap in `.dark`
// (see global.css + tailwind.config.js). But some React Native props take a
// color value and can't be a class — ActivityIndicator's `color`,
// RefreshControl's `tintColor`, navigator screenOptions, StatusBar. Those read
// the matching hex from `useThemeColors()` so they track the theme too.
import { useColorScheme, vars } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Brand colors — the same in both themes. brand-blue is the accent/button
// fill; brand-cream is the label that sits on it. Kept as named exports
// because a handful of call sites still use them directly.
export const BRAND_BLUE = '#0339A6';
export const BRAND_CREAM = '#FFFCF6';

export type ThemeColors = {
  isDark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  chip: string;
  hairline: string;
  body: string;
  muted: string;
  faint: string;
  accent: string;
  accentLink: string;
  cream: string;
};

// Runtime equivalents of the CSS variables in global.css. Keep these in sync
// with that file — they're the same palette, just consumable from JS.
const LIGHT: ThemeColors = {
  isDark: false,
  bg: '#FFFCF6',
  surface: '#FFFFFF',
  surface2: '#FAFAFA',
  chip: '#F4F4F5',
  hairline: '#E4E4E7',
  body: '#18181B',
  muted: '#52525B',
  faint: '#A1A1AA',
  accent: BRAND_BLUE,
  accentLink: '#0339A6',
  cream: BRAND_CREAM,
};

const DARK: ThemeColors = {
  isDark: true,
  bg: '#0A0C14',
  surface: '#18181B',
  surface2: '#09090B',
  chip: '#27272A',
  hairline: '#27272A',
  body: '#FFFFFF',
  muted: '#D4D4D8',
  faint: '#71717A',
  accent: BRAND_BLUE,
  accentLink: '#60A5FA',
  cream: BRAND_CREAM,
};

// Raw colors for the current scheme. Re-renders when the scheme changes.
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}

// The CSS variables that back the semantic Tailwind classes (bg-background,
// text-body, …), supplied at runtime by a root wrapper in App.tsx. This is the
// reliable way to switch a NativeWind theme on native — a `vars()` provider,
// rather than relying on a `.dark {}` stylesheet block. Channel values must
// match global.css / the LIGHT + DARK palettes above.
export const LIGHT_VARS = vars({
  '--bg': '255 252 246',
  '--surface': '255 255 255',
  '--surface-2': '250 250 250',
  '--chip': '244 244 245',
  '--hairline': '228 228 231',
  '--body': '24 24 27',
  '--muted': '82 82 91',
  '--faint': '161 161 170',
  '--accent-link': '3 57 166',
});

export const DARK_VARS = vars({
  '--bg': '10 12 20',
  '--surface': '24 24 27',
  '--surface-2': '9 9 11',
  '--chip': '39 39 42',
  '--hairline': '39 39 42',
  '--body': '255 255 255',
  '--muted': '212 212 216',
  '--faint': '113 113 122',
  '--accent-link': '96 165 250',
});

// ------------------------------------------------------------- preference

// 'system' follows the phone; 'light'/'dark' pin it. Default is 'dark' — the
// app opens black on first launch (there is no stored preference yet).
export type ThemePref = 'light' | 'dark' | 'system';

const THEME_PREF_KEY = 'exposure.themePref';
export const DEFAULT_THEME_PREF: ThemePref = 'dark';

export async function loadThemePref(): Promise<ThemePref> {
  try {
    const saved = await AsyncStorage.getItem(THEME_PREF_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // storage unavailable — fall back to the default
  }
  return DEFAULT_THEME_PREF;
}

export async function saveThemePref(pref: ThemePref): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREF_KEY, pref);
  } catch {
    // best effort; the in-memory scheme is already applied by the caller
  }
}
