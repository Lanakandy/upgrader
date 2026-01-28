/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'grid-bg': '#F9F6C8', // The pale yellow background
        'paper': '#FFFFFF',
        'ink': '#1a1a1a',     // High contrast black
      },
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'serif'],
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      boxShadow: {
        'hard': '4px 4px 0px 0px #1a1a1a',       // The "stacked" paper look
        'hard-hover': '6px 6px 0px 0px #1a1a1a', // Hover state
      }
    },
  },
  plugins: [],
}