/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#052e87", // deep blue
        accent: "#057501",  // green
        white: "#ffffff",
        black: "#000000",
      },
    },
  },
  plugins: [],
};
