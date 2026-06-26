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
        // Neo-arcade pop redesign palette
        arcade: {
          ink: '#14110F',       // outlines + hard shadows + dark text
          bg: '#1B1525',        // aubergine-ink table backdrop
          coral: '#FF5C38',     // primary action / energy
          sun: '#FFC94D',       // highlight / "power-greed" gold
          teal: '#2EC4B6',      // cool secondary accent
          cream: '#FFF4E0',     // light surfaces / card faces / text on dark
        },
      },
      fontFamily: {
        // Default UI font — condensed, gaming feel (overrides Tailwind's default sans)
        sans: ['Rajdhani', 'system-ui', 'sans-serif'],
        // Display font for big titles/logo
        game: ['"Bebas Neue"', 'Rajdhani', 'sans-serif'],
        // Neo-arcade redesign: chunky display + technical UI grotesque
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        ui: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Soft, borderless depth for play-area containers
        soft: '0 14px 40px -16px rgba(0, 0, 0, 0.6), 0 2px 8px -4px rgba(0, 0, 0, 0.4)',
        // Subtle amber glow for the active player's panel (no hard border)
        'soft-amber': '0 12px 36px -12px rgba(245, 158, 11, 0.45), 0 0 16px -6px rgba(245, 158, 11, 0.3)',
        // Neo-arcade hard offset "sticker" shadows
        hard: '6px 6px 0 0 #14110F',
        'hard-sm': '4px 4px 0 0 #14110F',
      },
    },
  },
  plugins: [],
};
