/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // The two Exposure brand colors. Everything else comes from
        // Tailwind's default palette (zinc/red for text and errors).
        'brand-blue': '#0339A6',
        'brand-cream': '#FFFCF6',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
