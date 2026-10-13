#!/usr/bin/env bash
# Runs ON the VM, as root, after the sources have been extracted.
#
#   sudo APP_DIR=/opt/folio SWAP_MB=2048 bash /opt/folio/deploy/remote-setup.sh
#
# Idempotent: it creates the swap file and installs Docker only when they are
# missing, and `compose up` is a no-op when nothing changed.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/folio}"
SWAP_MB="${SWAP_MB:-2048}"
COMPOSE_DIR="$APP_DIR/deploy"

log() { printf '==> %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "remote-setup.sh must run as root (use sudo)." >&2
  exit 1
fi

if [ ! -f "$COMPOSE_DIR/docker-compose.yml" ]; then
  echo "No compose file at $COMPOSE_DIR — did the sources get extracted?" >&2
  exit 1
fi

# 1. Swap. The default e2-micro has 1 GB of RAM; LibreOffice and a 300 DPI OCR
#    page each want several hundred megabytes, and without swap the OOM killer
#    ends those jobs instead of slowing them down.
if swapon --show | grep -q .; then
  log "swap already active: $(swapon --show=NAME,SIZE --noheadings | tr -s ' ' | tr '\n' ' ')"
else
  if [ ! -f /swapfile ]; then
    log "creating a ${SWAP_MB} MB swap file"
    if ! fallocate -l "${SWAP_MB}M" /swapfile 2>/dev/null; then
      dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_MB" status=none
    fi
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
  log "swap enabled"
fi
if ! grep -q '^/swapfile' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Prefer keeping the app in RAM; swap is the safety net, not the plan.
sysctl -w vm.swappiness=10 >/dev/null
if ! grep -q '^vm.swappiness' /etc/sysctl.conf; then
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# 2. Docker with the compose plugin (Ubuntu 24.04 packages both).
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  log "docker $(docker --version | cut -d, -f1) already installed"
else
  log "installing docker + compose plugin"
  export DEBIAN_FRONTEND=noninteractive
  install_docker_apt() {
    # A third-party repository that is broken or unreachable (a stale
    # packagecloud/speedtest source is the usual suspect) makes `apt-get update`
    # exit non-zero and, with `set -e`, would abort the whole deploy even though
    # docker's own packages come from the distribution. Warn and continue: the
    # install below only needs the indexes that did refresh.
    if ! apt-get update -qq; then
      log "apt-get update reported errors — continuing (only docker's packages matter here)"
    fi
    apt-get install -y -qq docker.io docker-compose-v2
  }
  if ! install_docker_apt; then
    log "apt could not install docker; falling back to the official install script"
    curl -fsSL https://get.docker.com | sh || true
  fi
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed and could not be installed automatically. Install it by hand and re-run:" >&2
  echo "  curl -fsSL https://get.docker.com | sudo sh" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  log "the compose plugin is missing; installing it standalone"
  mkdir -p /usr/local/lib/docker/cli-plugins
  arch="$(dpkg --print-architecture)"
  curl -fsSL -o /usr/local/lib/docker/cli-plugins/docker-compose \
    "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}" || true
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose 2>/dev/null || true
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "The docker compose plugin is unavailable. Install it and re-run." >&2
  exit 1
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# 3. Build and start. `--build` keeps the image in step with the sources; the
#    apt layer is cached, so a rebuild after a source-only change takes seconds.
log "building and starting the stack"
cd "$COMPOSE_DIR"
docker compose up -d --build --remove-orphans

# 4. Report, and give the app a moment to answer its health check.
log "waiting for /api/health"
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 3 http://127.0.0.1:8080/api/health || true)"
  if [ "$code" = "200" ]; then
    log "app is healthy on 127.0.0.1:8080"
    break
  fi
  [ "$i" = "30" ] && { log "app did not answer yet (HTTP $code) — check: docker compose logs app"; exit 1; }
  sleep 2
done

docker compose ps
log "done. Free memory: $(free -m | awk '/^Mem:/ {print $4" MB"}' )"
