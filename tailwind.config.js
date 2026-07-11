module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}','./components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1F57F5',
        bg: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E5E7EB'
      },
      borderRadius: {
        DEFAULT: '8px',
        'sm': '6px',
        'xs': '4px'
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'md': '0 6px 12px rgba(0, 0, 0, 0.08)'
      },
      fontFamily: {
        sans: ['"Satoshi"', '"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
}
