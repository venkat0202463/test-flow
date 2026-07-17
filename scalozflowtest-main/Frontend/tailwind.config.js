/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#020617',
          950: '#010413',
        },
        royal: {
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
        }
      },
      fontFamily: {
        sans: ['"Wix Madefor Display"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.03)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backgroundImage: {
        'login-gradient': 'radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.15) 0%, rgba(2, 6, 23, 1) 40%)',
      }
    },
  },
  plugins: [],
}
