/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      colors: {
        background: '#f9f9f9', // Off-white
        surface: '#ffffff',
        border: '#e5e5e5',     // Light gray for lines
        primary: '#1a1a1a',    // Dark charcoal for text
        secondary: '#666666',  // Medium gray for subtitles
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
