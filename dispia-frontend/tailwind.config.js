/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}", 
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        'dispia-dark': '#0a0a0a',
        'dispia-card': '#111111',
        'dispia-purple': '#7c3aed',
      }
    },
  },
  plugins: [],
};