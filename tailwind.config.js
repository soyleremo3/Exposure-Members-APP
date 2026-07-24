/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  // Not actually used for switching — this app drives theme via a `vars()`
  // provider keyed off its own React state, not NativeWind's colorScheme/
  // `.dark` class toggle (see lib/theme.tsx for why). Left as 'class' rather
  // than 'media' only so no `dark:` variant could accidentally follow the OS
  // scheme behind the provider's back.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The two brand colors. Theme-invariant: brand-blue is the same on a
        // cream or a black background (it's the button/accent fill), and
        // brand-cream is the label color that sits on brand-blue.
        'brand-blue': '#0339A6',
        'brand-cream': '#FFFCF6',

        // Semantic tokens, backed by the CSS variables in global.css. These
        // flip automatically between light and dark — screens reference these
        // names instead of raw zinc/white/black shades.
        background: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        chip: 'rgb(var(--chip) / <alpha-value>)',
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        body: 'rgb(var(--body) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        'accent-link': 'rgb(var(--accent-link) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
