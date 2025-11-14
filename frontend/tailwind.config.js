/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-background': {
          DEFAULT: '#0e121d',
        },
        'custom-gray-verylight': {
          DEFAULT: '#DBD4D3',
        },
        'custom-gray-light': {
          DEFAULT: '#67697C',
        },
        'custom-gray-dark': {
          DEFAULT: '#303030',
        },
        'beige': {
          DEFAULT: '#F9D3A5',
          hover: '#F9D3A5',
          active: '#F9D3A5'
        },
        'green-btn': {
          DEFAULT: '#054A29',
          hover: '#00cca4',
          'border-default': '#054A29',
          'border-hover': '#00cca4',
        },
        'red-btn': {
          DEFAULT: '#D00000',
          hover: '#FF8484',
          'border-default': '#D00000',
          'border-hover': '#FF8484',
        },
        'gold-btn': {
          DEFAULT: '#FFC107',
          hover: '#FFC107',
          active: '#FFC107',
        },
        'neutral-btn': {
          DEFAULT: '#8A1C7C',
          hover: '#8A1C7C',
          active: '#8A1C7C',
        },
        'primary-pink': {
          DEFAULT: '#F72585',
        },
        'info-blue': {
          DEFAULT: '#17a2b8',
        },
        'warning-orange': {
          DEFAULT: '#ffc107',
        },
      },
      fontFamily: {
        body: ['var(--font-space-grotesk)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-clash-grotesk)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Roboto Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        'space-grotesk': ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'clash-grotesk': ['Clash Grotesk', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      fontSize: {
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['14px', { lineHeight: '20px' }],
        md: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '30px' }],
        'display-xs': ['24px', { lineHeight: '32px' }],
        'display-sm': ['30px', { lineHeight: '38px', letterSpacing: '-0.72px' }],
        'display-md': ['36px', { lineHeight: '44px', letterSpacing: '-0.72px' }],
        'display-lg': ['48px', { lineHeight: '60px', letterSpacing: '-0.96px' }],
        'display-xl': ['60px', { lineHeight: '72px', letterSpacing: '-1.2px' }],
        'display-2xl': ['72px', { lineHeight: '90px', letterSpacing: '-1.44px' }],
      },
      borderRadius: {
        'none': '0',
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
        'full': '9999px',
        'badge': '12px',
      },
      boxShadow: {
        xs: '0px 1px 2px rgba(10, 13, 18, 0.05)',
        sm: '0px 1px 3px rgba(10, 13, 18, 0.1), 0px 1px 2px -1px rgba(10, 13, 18, 0.1)',
        md: '0px 4px 6px -1px rgba(10, 13, 18, 0.1), 0px 2px 4px -2px rgba(10, 13, 18, 0.06)',
        lg: '0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)',
        xl: '0px 20px 24px -4px rgba(10, 13, 18, 0.08), 0px 8px 8px -4px rgba(10, 13, 18, 0.03), 0px 3px 3px -1.5px rgba(10, 13, 18, 0.04)',
        '2xl': '0px 24px 48px -12px rgba(10, 13, 18, 0.18), 0px 4px 4px -2px rgba(10, 13, 18, 0.04)',
        '3xl': '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      },
      spacing: {
        'sidebar': '8rem', // more rem means sidebar thicker
      },
      zIndex: {
        'sidebar': 40, // higher number means more on top
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};
