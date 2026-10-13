#!/usr/bin/env bash
# Open the ports Folio needs on the VM.
#
#   deploy/open-firewall.sh --project pdf-editor-511418 --zone us-central1-a \
#                           --vm pdf-editor-server
#
# Creates the rules when they are missing and updates them when they already
# exist, so running it twice is harmless. The VM carries the tags the rules
# target: http-server and https-server (both set by the VM's creation) plus
# folio-app for the raw application port.
set -euo pipefail

PROJECT="${PROJECT:-}"
ZONE="${ZONE:-}"
VM="${VM:-}"

usage() { sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --zone) ZONE="$2"; shift 2 ;;
    --vm) VM="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

missing=""
[ -z "$PROJECT" ] && missing="$missing --project"
[ -z "$ZONE" ] && missing="$missing --zone"
[ -z "$VM" ] && missing="$missing --vm"
if [ -n "$missing" ]; then
  echo "error: missing required option(s):$missing (or set \$PROJECT, \$ZONE, \$VM)" >&2
  exit 2
fi

GCLOUD="${GCLOUD:-}"
if [ -z "$GCLOUD" ]; then
  if command -v gcloud >/dev/null 2>&1; then GCLOUD="gcloud"
  elif [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
  else echo "error: gcloud not found. Install the Google Cloud SDK or set \$GCLOUD." >&2; exit 2
  fi
fi
g() { "$GCLOUD" "$@"; }

# rule NAME PORT TAG DESCRIPTION
rule() {
  local name="$1" port="$2" tag="$3" desc="$4"
  if g compute firewall-rules describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    echo "==> updating $name (tcp:$port -> tag $tag)"
    g compute firewall-rules update "$name" --project "$PROJECT" \
      --allow "tcp:$port" --target-tags "$tag" --source-ranges 0.0.0.0/0 \
      --description "$desc" >/dev/null
  else
    echo "==> creating $name (tcp:$port -> tag $tag)"
    g compute firewall-rules create "$name" --project "$PROJECT" \
      --allow "tcp:$port" --target-tags "$tag" --source-ranges 0.0.0.0/0 \
      --description "$desc" >/dev/null
  fi
}

rule folio-allow-http 80 http-server "Folio: Caddy, HTTP"
rule folio-allow-https 443 https-server "Folio: Caddy, HTTPS"
rule folio-allow-app 8080 folio-app "Folio: application container directly"

# The 8080 rule targets the folio-app tag, so the VM has to carry it.
current="$(g compute instances describe "$VM" --zone "$ZONE" --project "$PROJECT" \
  --format='value(tags.items.list())' || true)"
if [[ ",$current," == *",folio-app,"* ]]; then
  echo "==> $VM already tagged folio-app"
else
  echo "==> tagging $VM with folio-app"
  g compute instances add-tags "$VM" --zone "$ZONE" --project "$PROJECT" --tags folio-app >/dev/null
fi

echo
echo "Rules for $PROJECT:"
g compute firewall-rules list --project "$PROJECT" --filter="name~^folio-allow" \
  --format='table(name,allowed[].map().firewall_rule().list():label=ALLOW,targetTags.list():label=TAGS)'
