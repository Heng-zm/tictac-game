import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        app: 'rgb(var(--app-bg-rgb) / <alpha-value>)',
        surface: 'rgb(var(--app-surface-rgb) / <alpha-value>)',
        elevated: 'rgb(var(--app-elevated-rgb) / <alpha-value>)',
        ink: 'rgb(var(--app-text-rgb) / <alpha-value>)',
        muted: 'rgb(var(--app-muted-rgb) / <alpha-value>)',
        accent: 'rgb(var(--app-accent-rgb) / <alpha-value>)',
        'accent-ink': 'rgb(var(--app-accent-text-rgb) / <alpha-value>)',
        line: 'rgb(var(--app-border-rgb) / <alpha-value>)',
        danger: 'rgb(var(--app-danger-rgb) / <alpha-value>)',
        success: 'rgb(var(--app-success-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Outfit',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Outfit',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 10px 35px -18px rgba(0, 0, 0, 0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 14px 34px -20px rgba(0,0,0,0.4)',
        glow: '0 0 24px -4px rgba(37, 99, 235, 0.35)',
        'glow-danger': '0 0 24px -4px rgba(239, 68, 68, 0.35)',
        'glow-gold': '0 0 24px -4px rgba(234, 179, 8, 0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.7)', opacity: '0.55' },
          '80%, 100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'thinking-dot': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-3px)', opacity: '1' },
        },
        'reaction-pop': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.75)' },
          '60%': { opacity: '1', transform: 'translateY(-2px) scale(1.04)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sheet-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out both',
        'fade-up': 'fade-up 240ms ease-out both',
        'pop-in': 'pop-in 200ms ease-out both',
        'draw-line': 'draw-line 260ms ease-out both',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'thinking-dot': 'thinking-dot 1.2s ease-in-out infinite',
        'reaction-pop': 'reaction-pop 240ms cubic-bezier(0.2, 0.8, 0.3, 1) both',
        'sheet-up': 'sheet-up 220ms cubic-bezier(0.2, 0.8, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
