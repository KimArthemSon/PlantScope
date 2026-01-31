/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      xs: "360px", // small phones
      sm: "640px", // phones
      md: "768px", // tablets
      lg: "1024px", // laptops
      xl: "1280px", // desktops
      "2xl": "1536px", // large screens
    },
    extend: {
      colors: {
        primary: "rgb(var(--clr-primary) / <alpha-value>)", //btn
        white: "rgb(var(--clr--white) / <alpha-value>)", //bg
        black: "rgb(var(--clr--black) / <alpha-value>)", // text
      },
    },
  },
  plugins: [],
};
