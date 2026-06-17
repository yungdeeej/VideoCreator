/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0b0f",
          900: "#0e1015",
          850: "#13161d",
          800: "#181c25",
          700: "#222734",
          600: "#2e3543",
        },
        accent: {
          DEFAULT: "#f5a623",
          soft: "#ffcf6b",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
