// Forgentic (codename: Synterra) — root Prettier config.
//
// Conventions:
// - 100-col width, 2-space indent, single quotes, trailing commas everywhere.
// - LF line endings (matches .gitattributes + .editorconfig).
// - Tailwind CSS class sorting is loaded ONLY for apps/web files via an
//   `overrides` block, so api/workers/packages don't try to load the plugin.

/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  proseWrap: 'preserve',
  embeddedLanguageFormatting: 'auto',

  overrides: [
    {
      // Tailwind class sorting — scoped to the web app surface.
      files: ['apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs,css,mdx}'],
      options: {
        plugins: ['prettier-plugin-tailwindcss'],
      },
    },
    {
      // Markdown: wider lines + prose wrapping off (ADRs, runbooks, docs).
      files: ['*.md', '*.mdx'],
      options: {
        printWidth: 120,
        proseWrap: 'preserve',
      },
    },
    {
      // JSON/JSONC: Prettier defaults are fine; just pin parser explicitly
      // so mixed-ext files (e.g. .eslintrc) don't get misidentified.
      files: ['*.json', '*.jsonc'],
      options: {
        trailingComma: 'none',
        printWidth: 120,
      },
    },
    {
      files: ['*.yml', '*.yaml'],
      options: {
        singleQuote: false,
      },
    },
  ],
};
