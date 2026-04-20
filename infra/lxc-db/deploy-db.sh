#!/usr/bin/env bash
# Deploy script for forgentic-db.lan (192.168.10.50)
# Manages: Postgres 16 + WAL archive + nightly B2 backup + exporters
#
# Deployed copy: /opt/deploy-db.sh on forgentic-db.lan
# To sync after editing:
#   sudo cp ~/Forgentic/Synterra/infra/lxc-db/deploy-db.sh /opt/deploy-db.sh
#   sudo chmod +x /opt/deploy-db.sh
#
# Bootstrap on a fresh LXC:
#   sudo mkdir -p /etc/forgentic
#   sudo tee /etc/forgentic/deploy.secret > /dev/null <<EOF
#   INFISICAL_CLIENT_ID=<db-machine-identity-client-id>
#   INFISICAL_CLIENT_SECRET=<db-machine-identity-client-secret>
#   INFISICAL_PROJECT_ID=<forgentic-infisical-project-id>
#   EOF
#   sudo chown forgentic:forgentic /etc/forgentic/deploy.secret
#   sudo chmod 600 /etc/forgentic/deploy.secret
set -euo pipefail

SECRET_FILE="/etc/forgentic/deploy.secret"
INFISICAL_CLIENT_ID="${INFISICAL_CLIENT_ID:-}"
INFISICAL_PROJECT_ID="${INFISICAL_PROJECT_ID:-}"
INFISICAL_DOMAIN="http://192.168.10.30:8080"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"

INFRA_DIR="/home/forgentic/infra"
COMPOSE_FILE="$INFRA_DIR/lxc-db/docker-compose.yml"
ENV_FILE="$INFRA_DIR/lxc-db/.env"

if [[ ! -f "$SECRET_FILE" ]]; then
  echo "ERROR: $SECRET_FILE not found." >&2
  echo "Create it with INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$SECRET_FILE"
: "${INFISICAL_CLIENT_SECRET:?must be set in $SECRET_FILE}"
: "${INFISICAL_CLIENT_ID:?must be set in $SECRET_FILE}"
: "${INFISICAL_PROJECT_ID:?must be set in $SECRET_FILE}"

echo "→ Authenticating to Infisical..."
INFISICAL_TOKEN=$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --domain="$INFISICAL_DOMAIN" \
  --plain --silent)
export INFISICAL_TOKEN

echo "→ Exporting $INFISICAL_ENV secrets → $ENV_FILE"
mkdir -p "$(dirname "$ENV_FILE")"
infisical export \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --domain="$INFISICAL_DOMAIN" \
  --token="$INFISICAL_TOKEN" \
  --format=dotenv > "$ENV_FILE"
sed -i "s/='\(.*\)'\s*\$/=\1/" "$ENV_FILE"
sed -i 's/="\(.*\)"\s*$/=\1/' "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "→ Validating env vars..."
REQUIRED_VARS=(POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB B2_BUCKET_NAME)
set -a
# shellcheck disable=SC1090,SC1091
source "$ENV_FILE"
set +a
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  [[ -z "${!var:-}" ]] && MISSING+=("$var")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing required env vars: ${MISSING[*]}" >&2
  exit 1
fi
echo "✓ All required env vars present."

echo "→ Recreating containers..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d --force-recreate

echo "✓ Deploy complete (env=$INFISICAL_ENV)."
