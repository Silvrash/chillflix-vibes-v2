import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // A neutral near-black ground rather than a navy one. Artwork is the
        // only colour on a streaming page, and a blue-tinted ground competes
        // with every poster on the screen.
        background: "#0a0a0a",
        surface: "#141414",
        "surface-light": "#1f1f1f",
        primary: "#3f83f8",
        // Darker shade for solid buttons so white text meets WCAG AA (≥4.5:1).
        "primary-dark": "#2563eb",
        muted: "#a1a1aa",
        accent: "#d4d4d8",
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
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "pop-in": "pop-in 0.16s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
