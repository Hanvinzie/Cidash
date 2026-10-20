/** @type {import('tailwindcss').Config} */

// Warna semantik dibaca dari CSS variable (lihat src/index.css) sehingga satu class
// otomatis berganti nilai di light / dark mode. Format "R G B" agar opacity (/50) tetap jalan.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        cidash: {
          primary: token('primary'),
          'primary-hover': token('primary-hover'),
          'on-primary': token('on-primary'),
          // Alias lama — dipetakan ke token baru.
          dark: token('inset'),
          surface: token('surface'),
        },
        canvas: token('canvas'),
        surface: token('surface'),
        inset: token('inset'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        subtle: token('subtle'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.04)',
        nav: '0 -4px 24px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
};
