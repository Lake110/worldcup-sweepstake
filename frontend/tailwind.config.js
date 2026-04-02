/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
          900: '#7c2d12',
        }
      }
    }
  },
  plugins: []
}