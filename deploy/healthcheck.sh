#!/usr/bin/env bash
# Check a running Folio deployment.
#
#   deploy/healthcheck.sh --url http://34.61.56.12
#   deploy/healthcheck.sh --vm pdf-editor-server --zone us-central1-a \
#                         --project pdf-editor-511418        # checks localhost over SSH
#
# Fails (exit 1) when the app does not answer, when the site or the tool map is
# broken, or when a tool that needs a native binary reports itself unavailable
# (pass --allow-missing to report those as warnings instead).
set -euo pipefail

URL="${URL:-}"
PROJECT="${PROJECT:-}"
ZONE="${ZONE:-}"
VM="${VM:-}"
ALLOW_MISSING="${ALLOW_MISSING:-0}"

usage() { sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --zone) ZONE="$2"; shift 2 ;;
    --vm) VM="$2"; shift 2 ;;
    --allow-missing) ALLOW_MISSING=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

fetch() {
  if [ -n "$URL" ]; then
    curl -sS -m 15 -w '\n%{http_code}' "$1"
  else
    # --vm mode: ask the machine itself, over SSH.
    gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --quiet \
      --command "curl -sS -m 15 -w '\n%{http_code}' $1" 2>/dev/null
  fi
}

if [ -z "$URL" ]; then
  if [ -z "$PROJECT" ] || [ -z "$ZONE" ] || [ -z "$VM" ]; then
    echo "error: pass --url, or all of --project/--zone/--vm." >&2
    exit 2
  fi
  URL="http://127.0.0.1:8080"
fi

fail=0
note() { printf '  %s\n' "$*"; }

echo "checking $URL"

# 1. Health.
health="$(fetch "$URL/api/health" || true)"
code="$(printf '%s\n' "$health" | tail -1)"
body="$(printf '%s\n' "$health" | sed '$d')"
if [ "$code" != "200" ]; then
  echo "FAIL  /api/health returned HTTP ${code:-none}"
  exit 1
fi
echo "ok    /api/health $body"

# 2. The landing page must be served, not a 404 from the API fallback.
page="$(fetch "$URL/" || true)"
pagecode="$(printf '%s\n' "$page" | tail -1)"
if [ "$pagecode" != "200" ] || ! printf '%s' "$page" | grep -qi folio; then
  echo "FAIL  / did not serve the landing page (HTTP $pagecode)"
  fail=1
else
  echo "ok    / serves the site"
fi

# 3. Every tool's availability. Parsing JSON with node keeps this script free of
#    a jq dependency (node is required for the app anyway).
tools="$(fetch "$URL/api/tools" || true)"
toolcode="$(printf '%s\n' "$tools" | tail -1)"
if [ "$toolcode" != "200" ]; then
  echo "FAIL  /api/tools returned HTTP ${toolcode:-none}"
  exit 1
fi
printf '%s' "$tools" | sed '$d' | ALLOW_MISSING="$ALLOW_MISSING" node -e '
let raw = "";
process.stdin.on("data", (d) => { raw += d; });
process.stdin.on("end", () => {
  const json = JSON.parse(raw);
  const ids = Object.keys(json.tools);
  const missing = ids.filter((id) => !json.tools[id].available);
  console.log(`ok    /api/tools ${json.count} tools, ${ids.length - missing.length} available`);
  for (const id of missing) {
    console.log(`  ${process.env.ALLOW_MISSING === "1" ? "warn " : "FAIL "} ${id}: ${json.tools[id].reason}`);
  }
  if (missing.length && process.env.ALLOW_MISSING !== "1") {
    console.error("FAIL  a tool that needs a native binary is unavailable: the image is missing it.");
    process.exit(1);
  }
});
' || fail=1

if [ "$fail" != "0" ]; then
  echo "health check FAILED"
  exit 1
fi
echo "health check passed"
