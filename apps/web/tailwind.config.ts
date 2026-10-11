import type { Config } from 'tailwindcss';

// Every token maps to a CSS variable defined in app/globals.css (see DESIGN.md).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: { DEFAULT: v('surface'), muted: v('surface-muted') },
        border: v('border'),
        sidebar: { DEFAULT: v('sidebar'), text: v('sidebar-text'), muted: v('sidebar-muted'), line: v('sidebar-line') },
        ink: { DEFAULT: v('text'), muted: v('text-muted'), subtle: v('text-subtle') },
        accent: { DEFAULT: v('accent'), hover: v('accent-hover'), soft: v('accent-soft'), soft2: v('accent-soft-2'), line: v('accent-line') },
        success: { DEFAULT: v('success'), soft: v('success-soft'), table: v('success-table') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
        info: { DEFAULT: v('info'), soft: v('info-soft') },
        violet: { DEFAULT: v('violet'), soft: v('violet-soft') },
        teal: { DEFAULT: v('teal'), soft: v('teal-soft') },
        neutral: { DEFAULT: v('neutral'), soft: v('neutral-soft') },
        floor: { DEFAULT: v('floor'), wall: v('floor-wall') },
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
        md: ['16px', '22px'],
        lg: ['18px', '24px'],
        xl: ['22px', '28px'],
        '2xl': ['28px', '34px'],
        '3xl': ['34px', '40px'],
      },
      borderRadius: { sm: '6px', DEFAULT: '8px', md: '10px', lg: '12px', xl: '14px' },
      boxShadow: {
        card: '0 1px 2px rgb(20 16 10 / 0.04)',
        pop: '0 12px 32px -8px rgb(20 16 10 / 0.18)',
        accent: '0 6px 14px -6px rgb(248 101 29 / 0.55)',
      },
      transitionDuration: { fast: '120ms', DEFAULT: '200ms' },
    },
  },
  plugins: [],
} satisfies Config;
