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
        // Delight Experience Color System
        primary: '#FF4F8B',
        'primary-soft': '#FFE2EC',
        'primary-tint': '#FFF1F6',
        'primary-deep': '#E03572',
        success: '#10B981',
        'success-soft': '#D1FAE5',
        accent: '#F59E0B',
        'accent-soft': '#FEF3C7',
        ink: '#0F172A',
        muted: '#64748B',
        surface: '#FFFFFF',
        canvas: '#FAFBFC',
        'border-light': '#F1F5F9',
        border: '#E5E7EB',
        error: '#EF4444',
        'error-soft': '#FEF2F2',
        // Legacy aliases (向后兼容)
        'primary-container': '#FFE2EC',
        secondary: '#10B981',
        'secondary-container': '#D1FAE5',
        tertiary: '#D97706',
        'tertiary-container': '#FEF3C7',
        'surface-variant': '#F1F5F9',
        info: '#3B82F6',
        'info-soft': '#DBEAFE',
      },
    },
  },
  plugins: [],
};
