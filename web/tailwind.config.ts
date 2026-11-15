import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        card: {
          DEFAULT: '#111827',
          hover: '#182234',
        },
        surface: {
          primary: '#0B0F19',
          secondary: '#1F2937',
          tertiary: '#374151',
        },
        brand: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          light: '#EEF2FF',
          dark: '#312E81',
        },
        border: {
          DEFAULT: '#1F2937',
          light: '#374151',
        },
      },
    },
  },
  plugins: [],
};

export default config;
