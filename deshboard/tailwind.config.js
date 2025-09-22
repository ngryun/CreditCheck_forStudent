/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50:  '#f4f6f4',
          100: '#e7ece7',
          200: '#cfd9cf',
          300: '#b4c4b6',
          400: '#9aaf9c',
          500: '#829a84',
          600: '#6a826c',
          700: '#566a58',
          800: '#455347',
          900: '#38453a',
        },
      },
    },
  },
  plugins: [],
}

