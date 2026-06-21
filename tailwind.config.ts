import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0e17",
        surface: "#101827",
        "surface-light": "#1b2536",
        primary: "#3f83f8",
        // Darker shade for solid buttons so white text meets WCAG AA (≥4.5:1).
        "primary-dark": "#2563eb",
        muted: "#9ba1a6",
        accent: "#acc2ec",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "pop-in": "pop-in 0.16s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
