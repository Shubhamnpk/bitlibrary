/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bit: {
          bg: 'rgb(var(--bit-bg) / <alpha-value>)',
          panel: 'rgb(var(--bit-panel) / <alpha-value>)',
          border: 'rgb(var(--bit-border) / <alpha-value>)',
          accent: 'rgb(var(--bit-accent) / <alpha-value>)',
          accentDim: 'rgb(var(--bit-accent-rgb) / 0.1)',
          text: 'rgb(var(--bit-text) / <alpha-value>)',
          muted: 'rgb(var(--bit-muted) / <alpha-value>)'
        }
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, rgba(var(--bit-grid), 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(var(--bit-grid), 0.28) 1px, transparent 1px)",
      }
    },
  },
  plugins: [],
}
