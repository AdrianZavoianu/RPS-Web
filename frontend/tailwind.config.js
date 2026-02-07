/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background layers (from RPS_desktop/DESIGN.md)
        'bg-primary': '#0a0c10',
        'bg-secondary': '#161b22',
        'bg-tertiary': '#1c2128',
        'bg-hover': 'rgba(255, 255, 255, 0.03)',

        // Text
        'text-primary': '#d1d5db',
        'text-secondary': '#9ca3af',
        'text-muted': '#7f8b9a',
        'text-accent': '#67e8f9',

        // Accent
        'accent-primary': '#4a7d89',
        'accent-secondary': '#67e8f9',
        'accent-hover': 'rgba(74, 125, 137, 0.18)',
        'accent-selected': 'rgba(74, 125, 137, 0.12)',

        // Borders
        'border-default': '#2c313a',
        'border-subtle': 'rgba(255, 255, 255, 0.05)',

        // Semantic
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444',
        'info': '#3b82f6',
      },
      fontSize: {
        'xs': '12px',
        'sm': '13px',
        'base': '14px',
        'md': '16px',
        'lg': '18px',
        'xl': '24px',
        '2xl': '32px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '12px',
        'full': '999px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
