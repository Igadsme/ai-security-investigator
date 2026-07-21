/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFBFA",
        ink: "#12201E",
        muted: "#4E635F",
        panel: "#F0F3F2",
        "panel-alt": "#E7EBEA",
        accent: {
          DEFAULT: "#2B6E6A",
          hover: "#1F5551",
          soft: "#DEEAE8",
        },
        border: "#D6DCDA",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
