/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#01696f', hover: '#0c4e54', light: '#cedcd8' },
        bull: '#437a22', bear: '#a12c7b', neutral: '#d19900',
        surface: { DEFAULT: '#1c1b19', 2: '#201f1d', 3: '#262523' },
      },
      fontFamily: { sans: ['Satoshi', 'Inter', 'sans-serif'] },
    },
  },
  plugins: [],
};
