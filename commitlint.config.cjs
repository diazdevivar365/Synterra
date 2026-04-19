// Forgentic (codename: Synterra) — commitlint config.
//
// Enforced both in-session (via lefthook `commit-msg`) and in CI (via the
// `commitlint` job on pull_request). Range-scope keeps the history
// diffable + Renovate's semantic-commit grouping working.

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Types allowed — superset of `config-conventional`'s defaults, with
    // `release` (version bumps) added and `style` kept (Prettier catches
    // most of it but some low-noise style changes slip through).
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'docs',
        'test',
        'build',
        'ci',
        'chore',
        'style',
        'release',
      ],
    ],

    // Scopes must come from this enum — keeps the history searchable and
    // forces authors to think about which surface they're touching.
    // Update this list when adding a new package/app/surface; PR review
    // enforces it.
    'scope-enum': [
      2,
      'always',
      [
        // apps
        'web',
        'api',
        'workers',
        // packages
        'db',
        'auth',
        'billing',
        'aquila-client',
        'ui',
        'emails',
        'telemetry',
        'shared',
        // cross-cutting
        'infra',
        'ci',
        'docs',
        'deps',
        'tooling',
        'tests',
        'release',
      ],
    ],
    'scope-empty': [2, 'never'],
    'scope-case': [2, 'always', 'kebab-case'],

    // Subject: no trailing period, keep it tight. `subject-case` intentionally
    // disabled so proper nouns (Next, RSC, BullMQ, Drizzle, Stripe, …) can keep
    // their canonical capitalisation — forcing lower-case or sentence-case
    // would butcher framework/product names and train authors to ignore them.
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 100],

    // Header total length — leave room for GitHub UI truncation (72 is
    // tight for monorepo commits with `feat(aquila-client): …`; 100 is
    // more honest).
    'header-max-length': [2, 'always', 100],

    // Body + footer formatting — enforce a blank line separator so tools
    // parse them cleanly.
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 120],
  },
  helpUrl: 'https://www.conventionalcommits.org/ — see also CONTRIBUTING.md in this repo.',
};
