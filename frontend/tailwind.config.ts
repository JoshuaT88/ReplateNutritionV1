import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#FAFAF9',
        foreground: '#0F172A',
        primary: {
          DEFAULT: '#3B82F6',
          dark: '#0F172A',
          mid: '#1E293B',
          deep: '#2563EB',
          light: '#93C5FD',
        },
        accent: {
          gold: '#F59E0B',
          success: '#10B981',
          warning: '#F97316',
          danger: '#EF4444',
          green: '#16A34A',
          'green-light': '#DCFCE7',
          'green-mid': '#4ADE80',
        },
        muted: {
          DEFAULT: '#64748B',
          foreground: '#94A3B8',
        },
        card: {
          DEFAULT: '#FFFFFF',
          border: '#E2E8F0',
        },
        sidebar: {
          bg: '#0F172A',
          'bg-end': '#1E293B',
          text: '#CBD5E1',
          hover: 'rgba(255,255,255,0.06)',
          active: '#3B82F6',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.10)',
        soft: '0 2px 12px rgba(0,0,0,0.04)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'toast-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'slide-in': 'slide-in-right 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'toast-in': 'toast-in 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
