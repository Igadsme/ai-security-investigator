/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: "#0a0e17",
          800: "#111827",
          700: "#1a2332",
          600: "#243044",
        },
        accent: {
          DEFAULT: "#3b82f6",
          glow: "#60a5fa",
        },
        alert: {
          warning: "#f59e0b",
          danger: "#ef4444",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
