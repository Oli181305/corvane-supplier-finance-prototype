/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      white: '#FFFFFF',
      ink: '#0B0F1A',
      grey: '#5B6479',
      border: '#E3E6EC',
      page: '#F5F6F8',
      panel: '#FFFFFF',
      teal: { DEFAULT: '#00C2B8', dark: '#00897F' },
      purple: { DEFAULT: '#7C4DFF', dark: '#6D28D9' },
      blue: '#3B82F6',
      green: '#16A34A',
      amber: '#D97706',
      red: '#DC2626',
      hover: '#F0F1F4',
      tint: '#F9FAFB',
      'amber-tint': '#FFF7E6',
      'red-tint': '#FEF2F2',
      'teal-tint': '#E6F7F6',
      'purple-tint': '#F3EEFF',
    },
    borderRadius: {
      none: '0',
      sm: '1px',
      DEFAULT: '4px',
      md: '4px',
      lg: '4px',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['13px', '18px'],
      base: ['14px', '20px'],
      md: ['15px', '20px'],
      lg: ['20px', '28px'],
      xl: ['24px', '32px'],
      '2xl': ['28px', '36px'],
    },
    extend: {
      boxShadow: {
        modal: '0 8px 24px rgba(11, 15, 26, 0.12)',
      },
    },
  },
  plugins: [],
};
