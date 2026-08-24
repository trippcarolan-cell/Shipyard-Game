/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        steel: {
          950: '#121417',
          900: '#1a1d21',
          800: '#2a3038',
          700: '#3a424c',
          500: '#7a7f86',
          400: '#c4c0b4',
          300: '#d8d4c8',
        },
        oxide: '#b33b2f',
        amberurg: '#d4a017',
      },
      fontFamily: {
        ledger: ['"IBM Plex Sans Condensed"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
