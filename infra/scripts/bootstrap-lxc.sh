#!/usr/bin/env bash
# First-boot provisioner for forgentic-app.lan (Debian 12, unprivileged LXC).
# Run once as root after OS install:
#   bash bootstrap-lxc.sh [--role app|db|cache|metering|observability]
#
# What it installs:
#   - Docker CE + Compose plugin
#   - Infisical CLI
#   - Node 22 + pnpm (app role only)
#   - fnm (app role only)
#   - rclone (db role only, for B2 backups)
#   - Creates `forgentic` system user + sudo group
#   - Clones Forgentic repo
#   - Writes /etc/forgentic/deploy.secret stub
set -euo pipefail

ROLE="${1:-app}"
REPO_URL="git@github.com:diazdevivar365/Forgentic.git"
APP_USER="forgentic"
HOME_DIR="/home/$APP_USER"

echo "=== Forgentic LXC bootstrap — role: $ROLE ==="

# ── System update ─────────────────────────────────────────────────────────────
apt-get update -qq && apt-get upgrade -y -qq

# ── Essential packages ────────────────────────────────────────────────────────
apt-get install -y -qq \
  curl git wget ca-certificates gnupg lsb-release \
  htop vim jq unzip sudo

# ── Docker CE ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker CE..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/debian $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  echo "✓ Docker installed"
fi

# ── Infisical CLI ─────────────────────────────────────────────────────────────
if ! command -v infisical &>/dev/null; then
  echo "→ Installing Infisical CLI..."
  curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | bash
  apt-get install -y -qq infisical
  echo "✓ Infisical CLI installed: $(infisical --version)"
fi

# ── App user ──────────────────────────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
  usermod -aG docker,sudo "$APP_USER"
  echo "✓ User $APP_USER created"
fi

# ── Role-specific installs ────────────────────────────────────────────────────
case "$ROLE" in
  app)
    # Node 22 + pnpm via fnm
    if ! command -v fnm &>/dev/null; then
      echo "→ Installing fnm..."
      curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir /usr/local/bin
    fi
    su - "$APP_USER" -c "fnm install 22 && fnm default 22"
    su - "$APP_USER" -c "corepack enable && corepack prepare pnpm@10.33.0 --activate"
    echo "✓ Node 22 + pnpm installed for $APP_USER"
    ;;
  db)
    # rclone for B2 backup uploads
    if ! command -v rclone &>/dev/null; then
      echo "→ Installing rclone..."
      curl -fsSL https://rclone.org/install.sh | bash
    fi
    # Directories for Postgres data and WAL archive
    mkdir -p /opt/forgentic/postgres/data /san/forgentic-db/wal-archive /san/forgentic-db/base-backups
    chown -R 999:999 /opt/forgentic/postgres/data   # postgres container UID
    echo "✓ DB data directories created"
    ;;
  cache)
    mkdir -p /opt/forgentic/redis/data /san/forgentic-cache/rdb-backups
    chown -R 999:999 /opt/forgentic/redis/data
    echo "✓ Cache data directories created"
    ;;
  metering)
    mkdir -p /opt/metering/postgres/data /opt/metering/redis/data /opt/metering/storage /opt/metering/backups
    chown -R 999:999 /opt/metering/postgres/data /opt/metering/redis/data
    echo "✓ Metering data directories created"
    ;;
  observability)
    mkdir -p /opt/observability/prometheus/data /opt/observability/loki/data \
             /opt/observability/tempo/data /opt/observability/grafana/data \
             /opt/observability/cachet-postgres
    chown -R 65534:65534 /opt/observability/prometheus/data  # nobody (prometheus)
    chown -R 10001:10001 /opt/observability/loki/data        # loki
    chown -R 472:472     /opt/observability/grafana/data     # grafana
    echo "✓ Observability data directories created"
    ;;
esac

# ── Clone repo ────────────────────────────────────────────────────────────────
REPO_DIR="$HOME_DIR/Forgentic"
if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "→ Cloning Forgentic repo..."
  su - "$APP_USER" -c "git clone $REPO_URL $REPO_DIR"
  echo "✓ Repo cloned to $REPO_DIR"
else
  echo "→ Repo already present at $REPO_DIR"
fi

# ── deploy.secret stub ────────────────────────────────────────────────────────
mkdir -p /etc/forgentic
SECRET_FILE="/etc/forgentic/deploy.secret"
if [[ ! -f "$SECRET_FILE" ]]; then
  cat > "$SECRET_FILE" << 'EOF'
# Fill these in before running deploy-synterra.sh
INFISICAL_CLIENT_SECRET=<replace-with-machine-identity-secret>
INFISICAL_CLIENT_ID=<replace-with-machine-identity-client-id>
INFISICAL_PROJECT_ID=<replace-with-infisical-project-id>
EOF
  chown "$APP_USER:$APP_USER" "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "✓ /etc/forgentic/deploy.secret stub written — fill in Infisical credentials before deploying"
fi

echo ""
echo "=== Bootstrap complete for role: $ROLE ==="
echo ""
echo "Next steps:"
echo "  1. Edit /etc/forgentic/deploy.secret with real Infisical credentials"
echo "  2. Add $APP_USER's SSH key to GitHub (or use a deploy key)"
if [[ "$ROLE" == "app" ]]; then
  echo "  3. Run: sudo -u $APP_USER /opt/deploy-synterra.sh"
fi
