/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/react");

// Chord Reaper Cyberpunk Theme - Neon Blue/Purple
const LIGHT_WARM_BACKGROUND = "#F0F0F8";
const LIGHT_WARM_SURFACE = "#F5F3FA";
const LIGHT_WARM_SURFACE_SECONDARY = "#EBE8F5";
const LIGHT_WARM_SURFACE_TERTIARY = "#DDD8EE";
const LIGHT_WARM_SURFACE_QUATERNARY = "#CFC8E5";
const LIGHT_WARM_DIVIDER = "#BEB5D9";

module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Grid column classes for different time signatures
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'grid-cols-5',
    'grid-cols-6',
    'grid-cols-7',
    'grid-cols-8',
    'grid-cols-9',
    'grid-cols-10',
    'grid-cols-11',
    'grid-cols-12',
  ],
  theme: {
    extend: {
      keyframes: {
        slideDown: {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        slideUp: {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        slideDown: 'slideDown 300ms cubic-bezier(0.87, 0, 0.13, 1)',
        slideUp: 'slideUp 300ms cubic-bezier(0.87, 0, 0.13, 1)',
      },
      colors: {
        gray: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#eeeeee",
          300: "#e0e0e0",
          400: "#bdbdbd",
          500: "#9e9e9e",
          600: "#757575",
          700: "#616161",
          800: "#424242",
          900: "#212121",
          950: "#121212",
        },
        // Chord Reaper cyberpunk dark backgrounds
        'dark-bg': '#0a0a1a',
        'content-bg': '#12122a',
        // Neon accent colors
        'neon-blue': '#00d4ff',
        'neon-purple': '#a855f7',
        'neon-magenta': '#e040fb',
        'neon-cyan': '#22d3ee',
      },
      fontFamily: {
        sans: ["var(--font-brand-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
        display: ["var(--font-brand-sans)", "system-ui", "sans-serif"],
        nunito: ["var(--font-brand-sans)", "system-ui", "sans-serif"],
        varela: ["var(--font-varela-round)", "Varela Round", "system-ui", "sans-serif"],
      },
      boxShadow: {
        'card': '0 2px 10px rgba(0, 0, 0, 0.08)',
        'button': '0 1px 3px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        'xl': '1rem',
      },
    },
  },
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          background: LIGHT_WARM_BACKGROUND,
          foreground: "#000000",
          content1: LIGHT_WARM_SURFACE,
          content2: LIGHT_WARM_SURFACE_SECONDARY,
          content3: LIGHT_WARM_SURFACE_TERTIARY,
          content4: LIGHT_WARM_SURFACE_QUATERNARY,
          divider: LIGHT_WARM_DIVIDER,
          primary: {
            50: "#eef2ff",
            100: "#dbe4ff",
            200: "#bac8ff",
            300: "#91a7ff",
            400: "#748ffc",
            500: "#5c7cfa",
            600: "#4c6ef5",
            700: "#4263eb",
            800: "#3b5bdb",
            900: "#364fc7",
            DEFAULT: "#6c3ce0",
            foreground: "#ffffff",
          },
          default: {
            50: "#f8f9fc",
            100: "#f1f3f9",
            200: "#e2e5f0",
            300: "#c8cde1",
            400: "#9098b8",
            500: "#636d8c",
            600: "#475069",
            700: "#333d55",
            800: "#1e273b",
            900: "#0d1225",
            DEFAULT: "#f1f3f9",
            foreground: "#0d1225",
          },
          secondary: {
            50: "#f3f0ff",
            100: "#e9e0ff",
            200: "#d5c4fe",
            300: "#bfa0fd",
            400: "#a87bfb",
            500: "#9061f9",
            600: "#7c3aed",
            700: "#6d28d9",
            800: "#5b21b6",
            900: "#4c1d95",
            DEFAULT: "#7c3aed",
            foreground: "#ffffff",
          },
        },
      },
      dark: {
        colors: {
          background: "#0a0a1a",   // Deep cyberpunk dark
          foreground: "#e8e8ff",
          content1: "#12122a",     // Content containers
          content2: "#1a1a3e",     // Secondary content
          content3: "#252550",     // Tertiary content
          content4: "#303060",     // Quaternary content
          divider: "#2a2a5a",      // Neon-tinted borders
          primary: {
            50: "#0d1033",
            100: "#141866",
            200: "#1e2899",
            300: "#2838cc",
            400: "#3d50ff",
            500: "#6366f1",
            600: "#818cf8",
            700: "#a5b4fc",
            800: "#c7d2fe",
            900: "#e0e7ff",
            DEFAULT: "#7c3aed",    // Neon purple accent
            foreground: "#ffffff",
          },
          default: {
            50: "#f0f0ff",
            100: "#e0e0ff",
            200: "#c8c8ee",
            300: "#a0a0cc",
            400: "#7878aa",
            500: "#505088",
            600: "#383866",
            700: "#282850",
            800: "#1a1a3e",
            900: "#0d0d25",
            DEFAULT: "#252550",
            foreground: "#e8e8ff",
          },
          secondary: {
            50: "#1a0833",
            100: "#2d1066",
            200: "#3d1899",
            300: "#5b21b6",
            400: "#7c3aed",
            500: "#8b5cf6",
            600: "#a78bfa",
            700: "#c4b5fd",
            800: "#ddd6fe",
            900: "#ede9fe",
            DEFAULT: "#a855f7",    // Neon purple
            foreground: "#ffffff",
          },
        },
      },
    },
  })],
};
