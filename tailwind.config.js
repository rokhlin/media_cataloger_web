/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme-mode="dark"]'],
  content: [
    "./index.html",
    "./src/App.tsx",
    "./src/AppRouter.tsx",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/screens/**/*.{js,ts,jsx,tsx}",
    "./src/packages/**/*.{js,ts,jsx,tsx}",
    "!./src/**/__tests__/**",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border-color)",
        input: "var(--input-bg)",
        ring: "var(--primary-color)",
        background: "var(--bg-color)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--primary-color)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--card-bg-solid)",
          foreground: "var(--text-primary)",
        },
        destructive: {
          DEFAULT: "#e74040",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "var(--nav-tab-bg)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent-color)",
          foreground: "#ffffff",
        },
        popover: {
          DEFAULT: "var(--modal-bg)",
          foreground: "var(--text-primary)",
        },
        card: {
          DEFAULT: "var(--card-bg)",
          foreground: "var(--text-primary)",
        },
      },
      borderRadius: {
        lg: "var(--radius, 12px)",
        md: "calc(var(--radius, 12px) - 2px)",
        sm: "calc(var(--radius, 12px) - 4px)",
      },
      fontFamily: {
        sans: ['Montserrat', 'Outfit', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}


