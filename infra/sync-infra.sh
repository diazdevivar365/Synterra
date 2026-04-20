#!/usr/bin/env bash
# Sync infra files from this repo (laptop) to each LXC node.
# Only pushes compose + config files. Never touches data dirs or .env files.
#
# Usage:
#   bash infra/sync-infra.sh                    # sync all nodes
#   bash infra/sync-infra.sh app                # sync one node
#   bash infra/sync-infra.sh db cache metering  # sync multiple nodes
#
# Run from the repo root or infra/ — both work.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA="$REPO_ROOT/infra"

# ── Helpers ───────────────────────────────────────────────────────────────────
push() {
  local src="$1" host="$2" dst="$3"
  scp -q "$src" "root@$host:$dst"
  echo "  ✓ $(basename "$src") → $host:$dst"
}

push_config_dir() {
  local src="$1" host="$2" dst="$3"
  ssh "root@$host" "mkdir -p $dst"
  while IFS= read -r -d '' f; do
    push "$f" "$host" "$dst/$(basename "$f")"
  done < <(find "$src" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)
}

mark_runnable() { ssh "root@$1" "chmod +x $2"; }

# ── Per-node sync ─────────────────────────────────────────────────────────────

sync_app() {
  echo "→ app (192.168.10.52)"
  # App uses a full git clone on the server — compose + traefik/promtail
  # configs are already in the repo there. Only the deploy script is pushed.
  push "$INFRA/deploy-synterra.sh" 192.168.10.52 /opt/deploy-synterra.sh
  mark_runnable 192.168.10.52 /opt/deploy-synterra.sh
}

sync_db() {
  echo "→ db (192.168.10.50)"
  ssh root@192.168.10.50 "mkdir -p /home/forgentic/infra/lxc-db"
  push "$INFRA/lxc-db/docker-compose.yml" 192.168.10.50 /home/forgentic/infra/lxc-db/docker-compose.yml
  push "$INFRA/lxc-db/deploy-db.sh"       192.168.10.50 /opt/deploy-db.sh
  mark_runnable 192.168.10.50 /opt/deploy-db.sh
}

sync_cache() {
  echo "→ cache (192.168.10.51)"
  ssh root@192.168.10.51 "mkdir -p /home/forgentic/infra/lxc-cache"
  push "$INFRA/lxc-cache/docker-compose.yml" 192.168.10.51 /home/forgentic/infra/lxc-cache/docker-compose.yml
  push "$INFRA/lxc-cache/deploy-cache.sh"    192.168.10.51 /opt/deploy-cache.sh
  mark_runnable 192.168.10.51 /opt/deploy-cache.sh
}

sync_metering() {
  echo "→ metering (metering.lan)"
  ssh root@metering.lan "mkdir -p /home/forgentic/infra/lxc-metering"
  push "$INFRA/lxc-metering/docker-compose.yml" metering.lan /home/forgentic/infra/lxc-metering/docker-compose.yml
  push "$INFRA/lxc-metering/deploy-metering.sh" metering.lan /opt/deploy-metering.sh
  mark_runnable metering.lan /opt/deploy-metering.sh
}

sync_observability() {
  echo "→ observability (observability.lan)"
  ssh root@observability.lan "mkdir -p /home/forgentic/infra/lxc-observability/config"
  push "$INFRA/lxc-observability/docker-compose.yml"      observability.lan /home/forgentic/infra/lxc-observability/docker-compose.yml
  push "$INFRA/lxc-observability/deploy-observability.sh" observability.lan /opt/deploy-observability.sh
  push_config_dir "$INFRA/lxc-observability/config"       observability.lan /home/forgentic/infra/lxc-observability/config
  mark_runnable observability.lan /opt/deploy-observability.sh
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
  NODES=(app db cache metering observability)
else
  NODES=("$@")
fi

for node in "${NODES[@]}"; do
  case "$node" in
    app)           sync_app ;;
    db)            sync_db ;;
    cache)         sync_cache ;;
    metering)      sync_metering ;;
    observability) sync_observability ;;
    *) echo "Unknown node: $node (valid: app db cache metering observability)" >&2; exit 1 ;;
  esac
done

echo ""
echo "✓ Sync complete. To apply: ssh <node> && bash /opt/deploy-<node>.sh"
