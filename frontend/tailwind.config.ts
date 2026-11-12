import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#F8F9FA",
          subtle: "#F1F3F5"
        },
        surface: {
          DEFAULT: "#FFFFFF",
          hover: "#F8F9FA",
          active: "#F1F3F5"
        },
        border: {
          DEFAULT: "#E4E7EC",
          strong: "#D0D5DD"
        },
        ink: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#94A3B8"
        },
        emerald: {
          brand: "#065F46",
          light: "#ECFDF5",
          border: "#A7F3D0",
          text: "#065F46"
        },
        cobalt: {
          brand: "#1E293B",
          teal: "#0D9488"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"]
      },
      boxShadow: {
        hairline: "0 0 0 1px #E4E7EC",
        subtle: "0 1px 2px 0 rgba(15, 23, 42, 0.04)"
      }
    }
  },
  plugins: []
};

export default config;

