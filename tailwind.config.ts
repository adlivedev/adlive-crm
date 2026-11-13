import type { Config } from "tailwindcss";

/**
 * Tokens de diseño ADlive (context/03-reglas-diseno-adlive.md).
 * Los valores puntuales viven en src/app/globals.css como variables CSS;
 * aquí se exponen como utilidades de Tailwind.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        adlive: {
          primary: "var(--adlive-primary)",
          "primary-hover": "var(--adlive-primary-hover)",
          "primary-light": "var(--adlive-primary-light)",
          cyan: "var(--adlive-cyan)",
          "cyan-light": "var(--adlive-cyan-light)",
          lime: "var(--adlive-lime)",
          "sidebar-bg": "var(--adlive-sidebar-bg)",
          "sidebar-card": "var(--adlive-sidebar-card)",
          "canvas-bg": "var(--adlive-canvas-bg)",
          "card-bg": "var(--adlive-card-bg)",
          border: "var(--adlive-border)",
          "text-main": "var(--adlive-text-main)",
          "text-muted": "var(--adlive-text-muted)",
          "text-inverse": "var(--adlive-text-inverse)",
          success: "var(--adlive-success)",
          warning: "var(--adlive-warning)",
          danger: "var(--adlive-danger)",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 17, 26, 0.04), 0 4px 16px rgba(15, 17, 26, 0.06)",
        sidebar: "4px 0 24px rgba(10, 10, 18, 0.35)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
