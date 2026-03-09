/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ghost: {
          bg:       '#07070f',
          surface:  '#0f0f1a',
          card:     '#14142a',
          border:   '#1e1e3a',
          muted:    '#2a2a4a',
          text:     '#e2e0ff',
          subtle:   '#9890cc',
          accent:   '#7c3aed',
          accent2:  '#6d28d9',
          glow:     '#a78bfa',
          danger:   '#ef4444',
          success:  '#10b981',
          warn:     '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'float':       'float 3s ease-in-out infinite',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'fade-in':     'fadeIn 0.3s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-in-r':  'slideInR 0.25s ease-out',
        'slide-in-l':  'slideInL 0.25s ease-out',
        'shimmer':     'shimmer 1.5s infinite',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124, 58, 237, 0.3)' },
          '50%':      { boxShadow: '0 0 40px rgba(124, 58, 237, 0.7)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideInR: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideInL: {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%':      { transform: 'scaleY(0.6)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
