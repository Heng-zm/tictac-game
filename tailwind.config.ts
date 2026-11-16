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
          'Google Sans',
          'Google Sans Text',
          'Kantumruy Pro',
          'Noto Sans Khmer',
          'Outfit',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        khmer: [
          'Google Sans',
          'Google Sans Text',
          'Kantumruy Pro',
          'Noto Sans Khmer',
          'sans-serif',
        ],
        display: [
          'Google Sans',
          'Google Sans Text',
          'Kantumruy Pro',
          'Noto Sans Khmer',
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
        'glow-sm': '0 0 16px -2px rgba(37, 99, 235, 0.25)',
        'glow-lg': '0 0 32px 0 rgba(37, 99, 235, 0.35)',
        'glow-danger': '0 0 24px -4px rgba(239, 68, 68, 0.35)',
        'glow-gold': '0 0 24px -4px rgba(234, 179, 8, 0.35)',
        'glow-success': '0 0 24px -4px rgba(16, 185, 129, 0.35)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        'inner-highlight': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'inner-highlight-subtle': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
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
        'countdown-tick': {
          '0%': { opacity: '0.15', transform: 'scale(1.35)' },
          '55%': { opacity: '1', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'celebration-burst': {
          '0%': { transform: 'scale(0.4) rotate(-14deg)', opacity: '0' },
          '60%': { transform: 'scale(1.18) rotate(6deg)', opacity: '1' },
          '80%': { transform: 'scale(0.94) rotate(-2deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-subtle': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        'icon-pop': {
          '0%': { transform: 'scale(0.85)' },
          '60%': { transform: 'scale(1.18) rotate(4deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        'icon-wiggle': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-8deg)' },
          '75%': { transform: 'rotate(8deg)' },
        },
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-4px) rotate(1.5deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', filter: 'drop-shadow(0 0 6px rgba(37, 99, 235, 0.35))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 16px rgba(37, 99, 235, 0.75))' },
        },
        'shake-subtle': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-3px)' },
          '40%, 80%': { transform: 'translateX(3px)' },
        },
        'scale-bounce': {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '65%': { opacity: '1', transform: 'scale(1.08)' },
          '85%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'heartbeat-urgent': {
          '0%, 100%': { transform: 'scale(1)' },
          '15%': { transform: 'scale(1.12)' },
          '30%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.08)' },
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
        'countdown-tick': 'countdown-tick 450ms cubic-bezier(0.2, 0.8, 0.3, 1) both',
        'celebration-burst': 'celebration-burst 650ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pulse-subtle': 'pulse-subtle 2.2s ease-in-out infinite',
        'icon-pop': 'icon-pop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'icon-wiggle': 'icon-wiggle 400ms ease-in-out both',
        'float-gentle': 'float-gentle 3.2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shake-subtle': 'shake-subtle 400ms ease-in-out both',
        'scale-bounce': 'scale-bounce 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'radar-sweep': 'radar-sweep 2.8s linear infinite',
        'heartbeat-urgent': 'heartbeat-urgent 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
