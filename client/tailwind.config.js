/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#7C3AED',   // mor - ana renk
          secondary: '#F59E0B', // sarı/altın - vurgu
          dark: '#1E1B4B',      // koyu lacivert - arka plan
          card: '#2D2A5E',      // kart arka planı
        },
      },
      fontFamily: {
        // Default UI font — condensed, gaming feel (overrides Tailwind's default sans)
        sans: ['Rajdhani', 'system-ui', 'sans-serif'],
        // Display font for big titles/logo
        game: ['"Bebas Neue"', 'Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        // Soft, borderless depth for play-area containers
        soft: '0 14px 40px -16px rgba(0, 0, 0, 0.6), 0 2px 8px -4px rgba(0, 0, 0, 0.4)',
        // Subtle amber glow for the active player's panel (no hard border)
        'soft-amber': '0 12px 36px -12px rgba(245, 158, 11, 0.45), 0 0 16px -6px rgba(245, 158, 11, 0.3)',
      },
    },
  },
  plugins: [],
};
