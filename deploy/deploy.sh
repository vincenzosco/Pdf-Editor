#!/usr/bin/env bash
# Deploy Folio to the project's Google Cloud VM.
#
#   deploy/deploy.sh --project pdf-editor-511418 --zone us-central1-a \
#                    --vm pdf-editor-server [--domain example.com] [--no-tls]
#
# PROJECT, ZONE and VM can also come from the environment. The script refuses to
# run without all three, and it is safe to re-run: it copies the sources,
# prepares the VM (swap + Docker) and brings the compose stack up, rebuilding
# only what changed. Unless --no-tls is given it points Caddy at
# <public-ip>.nip.io, so Let's Encrypt issues a certificate with no DNS of your
# own.
set -euo pipefail

PROJECT="${PROJECT:-}"
ZONE="${ZONE:-}"
VM="${VM:-}"
DOMAIN="${DOMAIN:-}"
NO_TLS="${NO_TLS:-0}"
FOLIO_TAG="${FOLIO_TAG:-}"
SSH_USER="${SSH_USER:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/folio}"
SWAP_MB="${SWAP_MB:-2048}"
SKIP_HEALTHCHECK="${SKIP_HEALTHCHECK:-0}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

usage() {
  sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Flags / environment:
  --project PROJECT   GCP project id            (or $PROJECT)
  --zone ZONE         zone of the VM            (or $ZONE)
  --vm NAME           instance name             (or $VM)
  --domain HOST       host name for TLS          (default: <public-ip>.nip.io)
  --no-tls            plain HTTP on :80, no certificate (or $NO_TLS=1)
  --user USER         SSH user on the VM        (default: your local user)
  --dir PATH          install directory on the VM (default: /opt/folio)
  --tag TAG           image tag                 (default: short git SHA)
  --no-healthcheck    skip the final check
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --zone) ZONE="$2"; shift 2 ;;
    --vm) VM="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --no-tls) NO_TLS=1; shift ;;
    --user) SSH_USER="$2"; shift 2 ;;
    --dir) REMOTE_DIR="$2"; shift 2 ;;
    --tag) FOLIO_TAG="$2"; shift 2 ;;
    --no-healthcheck) SKIP_HEALTHCHECK=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

missing=""
[ -z "$PROJECT" ] && missing="$missing --project"
[ -z "$ZONE" ] && missing="$missing --zone"
[ -z "$VM" ] && missing="$missing --vm"
if [ -n "$missing" ]; then
  cat >&2 <<EOF
error: missing required option(s):$missing

Folio cannot guess your VM. Pass them explicitly or export them:

  PROJECT=pdf-editor-511418 ZONE=us-central1-a VM=pdf-editor-server deploy/deploy.sh
EOF
  exit 2
fi

# gcloud lives in different places depending on the shell; find it once.
GCLOUD="${GCLOUD:-}"
if [ -z "$GCLOUD" ]; then
  if command -v gcloud >/dev/null 2>&1; then
    GCLOUD="gcloud"
  elif [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
    GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
  else
    echo "error: gcloud not found. Install the Google Cloud SDK or set \$GCLOUD." >&2
    exit 2
  fi
fi
: "${SSH_USER:=$(whoami)}"
[ -z "$FOLIO_TAG" ] && FOLIO_TAG="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo local)"

g() { "$GCLOUD" "$@"; }
gss() { g compute ssh "$SSH_USER@$VM" --zone "$ZONE" --project "$PROJECT" --quiet "$@"; }

step() { printf '\n==> %s\n' "$*"; }

step "project $PROJECT · zone $ZONE · vm $VM · tag $FOLIO_TAG"
if ! g compute instances describe "$VM" --zone "$ZONE" --project "$PROJECT" --format='value(status)' >/dev/null 2>&1; then
  echo "error: instance '$VM' not found in $ZONE of project $PROJECT." >&2
  exit 2
fi

# The public address is needed twice — the default TLS host name and the final
# check — so resolve it once.
IP="$(g compute instances describe "$VM" --zone "$ZONE" --project "$PROJECT" \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"
if [ -z "$IP" ]; then
  echo "error: $VM has no external address; Folio has to be reachable from outside." >&2
  exit 2
fi
if [ -z "$DOMAIN" ] && [ "$NO_TLS" != "1" ]; then
  # nip.io resolves <ip>.nip.io back to <ip>, so Let's Encrypt can validate the
  # name and issue a certificate without a DNS record of your own. Let's
  # Encrypt keeps a raised rate limit for nip.io for exactly this use, and Caddy
  # renews the certificate on its own.
  DOMAIN="$IP.nip.io"
fi

# 1. Package the sources. node_modules and the local state never travel: the
#    image installs its dependencies itself.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
step "packaging the sources"
tar -czf "$STAGE/folio-src.tar.gz" \
  -C "$REPO" \
  --exclude='.git' --exclude='node_modules' --exclude='.bug-hunter' \
  --exclude='.freebuff' --exclude='.env' --exclude='*.log' \
  --exclude='deploy/.env' --exclude='server/tessdata' \
  --exclude='*.traineddata' --exclude='*.traineddata.gz' \
  .

cat > "$STAGE/folio.env" <<EOF
PORT=80
DOMAIN=$DOMAIN
FOLIO_TAG=$FOLIO_TAG
APP_UPSTREAM=app:80
SWAP_MB=$SWAP_MB
EOF

step "copying to the VM"
g compute scp "$STAGE/folio-src.tar.gz" "$SSH_USER@$VM:/tmp/folio-src.tar.gz" \
  --zone "$ZONE" --project "$PROJECT" --quiet
g compute scp "$STAGE/folio.env" "$SSH_USER@$VM:/tmp/folio.env" \
  --zone "$ZONE" --project "$PROJECT" --quiet

# 2. Unpack, install the environment file, run the VM-side setup. Everything
#    runs with sudo, so no file in /opt/folio ends up owned by the SSH user.
step "preparing the VM (swap, docker) and starting the stack"
gss --command "sudo mkdir -p $REMOTE_DIR \
  && sudo tar -xzf /tmp/folio-src.tar.gz -C $REMOTE_DIR \
  && sudo cp /tmp/folio.env $REMOTE_DIR/deploy/.env \
  && sudo chmod +x $REMOTE_DIR/deploy/*.sh \
  && sudo env APP_DIR=$REMOTE_DIR SWAP_MB=$SWAP_MB bash $REMOTE_DIR/deploy/remote-setup.sh"

# 3. Health check against the VM's public address, so what is verified is what a
#    visitor reaches — not the app on localhost.
if [ "$SKIP_HEALTHCHECK" = "1" ]; then
  step "skipping the health check (--no-healthcheck)"
  exit 0
fi
if [ -n "$DOMAIN" ]; then
  CHECK_URL="https://$DOMAIN"
else
  CHECK_URL="http://$IP"
fi
step "health check on $CHECK_URL"
# On the first deploy Caddy still has to request the certificate, so give it a
# few attempts before calling the deployment broken.
attempt=0
until bash "$HERE/healthcheck.sh" --url "$CHECK_URL"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 10 ]; then
    echo "error: the deployment failed its health check $attempt times." >&2
    exit 1
  fi
  echo "    ... retrying in 10s (Caddy may still be requesting the certificate)"
  sleep 10
done

step "deployed"
if [ -n "$DOMAIN" ]; then
  cat <<EOF
  https://$DOMAIN     (the site over TLS, via Caddy)
  http://$DOMAIN      (redirects to HTTPS)
  http://$IP:8080     (the app container directly, no TLS)

Point your own domain here and re-run to drop the nip.io name:
  deploy/deploy.sh --project $PROJECT --zone $ZONE --vm $VM --domain your.domain
EOF
else
  cat <<EOF
  http://$IP          (plain HTTP on port 80, via Caddy)
  http://$IP:8080     (the app container directly)

Re-run without --no-tls to get a Let's Encrypt certificate:
  deploy/deploy.sh --project $PROJECT --zone $ZONE --vm $VM
EOF
fi
