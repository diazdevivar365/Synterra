#!/usr/bin/env bash
# Forgentic brand-purity gate.
#
# The public brand is **Forgentic**. The internal codename "Synterra" must
# never appear in anything that ships to customers — rendered HTML, UI copy,
# emails, docs in `docs/`, marketing pages. The npm scope `@synterra/*` is a
# namespace identifier, not public branding, so we exclude it from the grep.
#
# This script is run locally (contributors can invoke it directly) and in
# CI (as a step in `.github/workflows/ci.yml`). Exit 1 on any violation so
# the gate is strict.

set -euo pipefail

# Paths to scan. Extend carefully — anything added here becomes brand-enforced.
SCAN_PATHS=(
  "apps/web/src"
  "apps/web/public"
  "packages/ui/src"
  "packages/emails/src"
)

# Patterns considered BRAND violations (case-insensitive).
#
# We match the bare word "synterra" but exclude the `@synterra/…` npm scope,
# which is explicitly allowed (workspace package names, tsconfig extends,
# transpilePackages, etc.).
FORBIDDEN_PATTERN='synterra'
ALLOWED_EXCEPTION='@synterra/'

echo "→ checking for forbidden brand leakage in:"
for p in "${SCAN_PATHS[@]}"; do
  echo "  · $p"
done
echo

# Use grep -r with -i (case-insensitive), filter out the allowed npm-scope
# form, and fail if anything remains.
violations=$(
  grep -rniI "$FORBIDDEN_PATTERN" "${SCAN_PATHS[@]}" 2>/dev/null \
    | grep -v "$ALLOWED_EXCEPTION" \
    || true
)

if [[ -n "$violations" ]]; then
  echo "✖ brand-leak check FAILED. The internal codename \"Synterra\" appeared in"
  echo "  customer-facing paths. Replace every occurrence with \"Forgentic\" (or"
  echo "  remove it). @synterra/* npm-scope references are OK; anything else is"
  echo "  not. Offending lines:"
  echo
  echo "$violations"
  exit 1
fi

echo "✓ brand-leak check passed — no \"Synterra\" leakage in customer paths."
