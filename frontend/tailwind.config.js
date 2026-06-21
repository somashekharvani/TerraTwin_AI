/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0b0f19',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
        },
        eco: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981', // emerald green focus
          600: '#059669',
          700: '#047857',
        }
      }
    },
  },
  plugins: [],
}
