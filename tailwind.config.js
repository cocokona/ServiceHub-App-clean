/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#003d9b',
        'primary-container': '#d8e2ff',
        secondary: '#006c47',
        'secondary-container': '#89f8c0',
        tertiary: '#7c5800',
        'tertiary-container': '#ffdea6',
        surface: '#fffbff',
        'surface-variant': '#e0e2ec',
      },
    },
  },
  plugins: [],
};
