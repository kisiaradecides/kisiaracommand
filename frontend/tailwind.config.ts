import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0f3460', 900: '#0a1f3d', 800: '#0f3460', 700: '#1a4a8a' },
        'purple-brand': '#533483',
        gold: { DEFAULT: '#c17e1a', light: '#d4982e', dark: '#9a6412' },
        crimson: { DEFAULT: '#e94560', light: '#f05a73', dark: '#c73050' },
        'emerald-brand': '#1a936f',
        surface: {
          bg: '#0a0a14',
          panel: '#111827',
          card: '#1a2035',
          elevated: '#1e2846',
          border: 'rgba(255,255,255,0.08)',
          'border-light': 'rgba(255,255,255,0.14)',
        },
        r1: '#e94560',
        r2: '#0f3460',
        r3: '#533483',
        r4: '#1a936f',
        r5: '#c17e1a',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
