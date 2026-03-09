/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ghost: {
          bg:       '#000000',
          surface:  '#050d05',
          card:     '#0a150a',
          border:   '#0d2a0d',
          muted:    '#1a3a1a',
          text:     '#00ff41',
          subtle:   '#3d8c40',
          accent:   '#00ff41',
          accent2:  '#00cc33',
          glow:     '#00ff41',
          danger:   '#ff0000',
          success:  '#00ff41',
          warn:     '#ffff00',
        },
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
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
        'glitch':      'glitch 3s infinite',
        'scanline':    'scanline 8s linear infinite',
        'blink':       'blink 1s step-end infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 255, 65, 0.3)' },
          '50%':      { boxShadow: '0 0 40px rgba(0, 255, 65, 0.7)' },
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
        glitch: {
          '0%, 90%, 100%': { transform: 'translate(0)' },
          '92%': { transform: 'translate(-2px, 1px)', filter: 'hue-rotate(90deg)' },
          '94%': { transform: 'translate(2px, -1px)' },
          '96%': { transform: 'translate(-1px, 2px)', filter: 'hue-rotate(-90deg)' },
          '98%': { transform: 'translate(1px, -2px)' },
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
