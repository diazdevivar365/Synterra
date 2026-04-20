#!/usr/bin/env bash
# Deploy script for the Forgentic (Synterra) control plane.
# Modeled on: Aquila/Backend/infra/deploy-aquila.sh
#
# Deployed copy: /opt/deploy-synterra.sh on forgentic-app.lan
# To sync after editing this file:
#   sudo cp ~/Forgentic/Synterra/infra/deploy-synterra.sh /opt/deploy-synterra.sh
#   sudo chmod +x /opt/deploy-synterra.sh
#
# Infisical credentials live OUTSIDE the repo in /etc/forgentic/deploy.secret
# (mode 600, owned by the user running the deploy — typically `forgentic`).
# Format:
#   INFISICAL_CLIENT_SECRET=<secret-from-infisical-machine-identity>
#
# Bootstrap on a fresh LXC (after running bootstrap-lxc.sh):
#   sudo mkdir -p /etc/forgentic
#   echo 'INFISICAL_CLIENT_SECRET=<secret>' | sudo tee /etc/forgentic/deploy.secret
#   sudo chown forgentic:forgentic /etc/forgentic/deploy.secret
#   sudo chmod 600 /etc/forgentic/deploy.secret
set -euo pipefail

# ── Infisical config (non-secret identifiers OK in script) ──────────────────
SECRET_FILE="/etc/forgentic/deploy.secret"
INFISICAL_CLIENT_ID="${INFISICAL_CLIENT_ID:-}"          # override via env or fill in here after registering machine identity
INFISICAL_PROJECT_ID="${INFISICAL_PROJECT_ID:-}"        # Infisical project: "forgentic-prod"
INFISICAL_DOMAIN="http://192.168.10.30:8080"            # self-hosted Infisical on LAN
INFISICAL_ENV="${INFISICAL_ENV:-prod}"

REPO_DIR="${REPO_DIR:-/home/forgentic/Forgentic/Synterra}"
COMPOSE_FILE="$REPO_DIR/infra/lxc-app/docker-compose.yml"

# ── Validate deploy.secret exists ───────────────────────────────────────────
if [[ ! -f "$SECRET_FILE" ]]; then
  echo "ERROR: $SECRET_FILE not found." >&2
  echo "Create it with:" >&2
  echo "  sudo mkdir -p /etc/forgentic" >&2
  echo "  echo 'INFISICAL_CLIENT_SECRET=<secret>' | sudo tee $SECRET_FILE > /dev/null" >&2
  echo "  sudo chown \$USER:\$USER $SECRET_FILE && sudo chmod 600 $SECRET_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$SECRET_FILE"
: "${INFISICAL_CLIENT_SECRET:?INFISICAL_CLIENT_SECRET must be set in $SECRET_FILE}"
: "${INFISICAL_CLIENT_ID:?INFISICAL_CLIENT_ID must be set (env or $SECRET_FILE)}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID must be set (env or $SECRET_FILE)}"

# ── Pull latest code ─────────────────────────────────────────────────────────
# Skips if no remote configured (e.g. first deploy via rsync bootstrap).
echo "→ Pulling latest code..."
cd "$REPO_DIR"
if git remote get-url origin &>/dev/null; then
  git pull --ff-only
else
  echo "  (no git remote — skipping pull, using current working tree)"
fi

# ── Authenticate to Infisical ────────────────────────────────────────────────
echo "→ Authenticating to Infisical (domain=$INFISICAL_DOMAIN)..."
INFISICAL_TOKEN=$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --domain="$INFISICAL_DOMAIN" \
  --plain --silent)
export INFISICAL_TOKEN

# ── Export secrets to .env ───────────────────────────────────────────────────
echo "→ Exporting $INFISICAL_ENV secrets → $REPO_DIR/.env"
infisical export \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --domain="$INFISICAL_DOMAIN" \
  --token="$INFISICAL_TOKEN" \
  --format=dotenv > "$REPO_DIR/.env"
# Infisical CLI wraps values in single-quotes; strip them so docker compose
# and shell export both receive bare values without literal quote characters.
sed -i "s/='\(.*\)'\s*\$/=\1/" "$REPO_DIR/.env"
sed -i 's/="\(.*\)"\s*$/=\1/' "$REPO_DIR/.env"

# ── Validate required env vars ───────────────────────────────────────────────
echo "→ Validating env vars..."
REQUIRED_VARS=(
  DATABASE_URL
  REDIS_URL
  BETTER_AUTH_SECRET
  NEXT_PUBLIC_APP_URL
  AQUILA_BASE_URL
  AQUILA_API_KEY
  AQUILA_PROVISIONER_SECRET
  AQUILA_ENCRYPT_KEY
  RESEND_API_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  CLOUDFLARE_TUNNEL_TOKEN
)
MISSING=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  export "$line" 2>/dev/null || true
done < "$REPO_DIR/.env"
for var in "${REQUIRED_VARS[@]}"; do
  [[ -z "${!var:-}" ]] && MISSING+=("$var")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing required env vars: ${MISSING[*]}" >&2
  exit 1
fi
echo "✓ All required env vars present."

# ── Install Node deps ────────────────────────────────────────────────────────
echo "→ Installing dependencies..."
cd "$REPO_DIR"
pnpm install --frozen-lockfile

# ── Build apps ───────────────────────────────────────────────────────────────
# Re-source .env with set -a so every variable is exported to child processes
# (the validation loop above uses `export "$line"` which can silently fail for
# values containing shell metacharacters; set -a + source is more reliable).
echo "→ Building apps..."
set -a
# shellcheck disable=SC1090,SC1091
source "$REPO_DIR/.env"
set +a
pnpm build --filter='@synterra/web' --filter='@synterra/api' --filter='@synterra/workers'

# ── Rebuild + recreate containers ────────────────────────────────────────────
# --force-recreate ensures .env changes propagate even when image hash is same.
echo "→ Rebuilding and recreating containers..."
docker compose \
  --env-file "$REPO_DIR/.env" \
  -f "$COMPOSE_FILE" \
  up -d --build --force-recreate

# ── Apply DB migrations ───────────────────────────────────────────────────────
echo "→ Applying database migrations..."
cd "$REPO_DIR"
DATABASE_URL="${DATABASE_URL}" pnpm --filter='@synterra/db' db:migrate

echo "✓ Deploy complete (env=$INFISICAL_ENV)."
