// Tailwind CSS v4 wires its compiler through a single PostCSS plugin.
// No autoprefixer or cssnano entry is needed — Tailwind v4 handles
// vendor prefixing and minification internally via Lightning CSS.

export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
