/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#0057B7',
        accentLight: '#2B8CED',
      },
      fontFamily: {
        inter: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'SF Pro', 'Segoe UI', 'Roboto']
      }
    },
  },
  plugins: [],
}
