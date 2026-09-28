import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "../../template/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd7ff",
          300: "#8ebdff",
          400: "#5998ff",
          500: "#2f72f7",
          600: "#1b54e0",
          700: "#1642b8",
          800: "#173a91",
          900: "#183573",
          950: "#122148",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
