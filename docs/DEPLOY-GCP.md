# Deploying Folio on Google Cloud

Folio runs as two containers on the project's VM: the app (built from the
repository `Dockerfile`, so LibreOffice, Ghostscript, qpdf and Tesseract are all
present) and Caddy, which terminates ports 80/443 in front of it.

Everything lives in `deploy/` and every command below is safe to re-run.

| Item | Value |
|---|---|
| Project | `pdf-editor-511418` |
| VM | `pdf-editor-server` |
| Zone | `us-central1-a` |
| Machine type | `e2-micro` (1 GB RAM — see *Swap* below) |
| Address | `34.61.56.12` (ephemeral) |
| Public URL | `https://34.61.56.12.nip.io/` (Let's Encrypt, via Caddy) |

## 0. Prerequisites

```bash
gcloud auth login
gcloud config set project pdf-editor-511418
gcloud compute instances list            # pdf-editor-server should be RUNNING
```

If `gcloud` is not on `PATH`, point the scripts at it: `export GCLOUD=~/google-cloud-sdk/bin/gcloud`.

## 1. Open the firewall

```bash
deploy/open-firewall.sh --project pdf-editor-511418 --zone us-central1-a --vm pdf-editor-server
```

Creates (or updates) three rules over `0.0.0.0/0`:

| Rule | Port | Target tag |
|---|---|---|
| `folio-allow-http` | 80 | `http-server` |
| `folio-allow-https` | 443 | `https-server` |
| `folio-allow-app` | 8080 | `folio-app` (added to the VM) |

## 2. Deploy

```bash
deploy/deploy.sh --project pdf-editor-511418 --zone us-central1-a --vm pdf-editor-server
```

What it does, all idempotent:

1. tars the repository (no `node_modules`, no `.git`, no local state) and copies
   it plus the generated `deploy/.env` to the VM;
2. unpacks it into `/opt/folio` and runs `deploy/remote-setup.sh` there, which
   creates the swap file, installs Docker + the compose plugin if needed,
   then `docker compose up -d --build`;
3. waits for `/api/health` behind Caddy and reports.

The app listens on **port 80** inside its container; Caddy publishes it on the
VM's 80/443. `deploy.sh` defaults `DOMAIN` to `<public-ip>.nip.io`, which resolves
to the VM, so Caddy obtains a **Let's Encrypt** certificate with no DNS of your
own and redirects HTTP to HTTPS. Pass `--domain your.domain` once you own one, or
`--no-tls` to skip the certificate and serve plain HTTP on port 80.
`--no-healthcheck` skips step 3.

## 3. Verify

```bash
deploy/healthcheck.sh --url https://34.61.56.12.nip.io
```

It checks `/api/health`, that `/` serves the site, and that every entry of
`/api/tools` reports itself available. A tool that needs a native binary and
cannot find it fails the check — that is the signal the image is incomplete.

Other useful commands:

```bash
deploy/healthcheck.sh --vm pdf-editor-server --zone us-central1-a \
  --project pdf-editor-511418            # same checks on localhost, over SSH
deploy/healthcheck.sh --url https://34.61.56.12.nip.io --allow-missing   # warnings only

gcloud compute ssh pdf-editor-server --zone us-central1-a --project pdf-editor-511418 \
  --command "sudo docker compose -f /opt/folio/deploy/docker-compose.yml logs --tail=100 app"
gcloud compute ssh pdf-editor-server --zone us-central1-a --project pdf-editor-511418 \
  --command "sudo docker compose -f /opt/folio/deploy/docker-compose.yml ps"
```

## Swap

`e2-micro` has 1 GB of RAM and ships with no swap. LibreOffice conversions and a
300 DPI OCR page each want several hundred megabytes, so `remote-setup.sh`
creates a 2 GB `/swapfile` (also added to `/etc/fstab`) and sets
`vm.swappiness=10`. Change the size with `SWAP_MB=4096 deploy/deploy.sh …`, or
raise the machine type if office conversions become frequent — the swap is a
safety net, not a substitute for memory:

```bash
gcloud compute instances set-machine-type pdf-editor-server --zone us-central1-a \
  --machine-type e2-small
```

## Updating an existing deployment

```bash
git pull
deploy/deploy.sh …            # rebuilds; the apt layer is cached, so this is quick
```

The Caddy certificate and the Tesseract language models live in named volumes,
so they survive a rebuild.

## HTTPS and your own domain

Out of the box the site is served over TLS at `https://<public-ip>.nip.io/`.
That name is provided by [nip.io](https://nip.io), which resolves it back to the
VM, and Let's Encrypt issues the certificate for it — so HTTPS works with no DNS
of your own. The certificate lives in the `caddy_data` volume and Caddy renews it
on its own; the first request after a fresh deploy can take a few seconds while
Caddy talks to the ACME server (the deploy waits for it).

`<ip>.nip.io` is convenient but ugly in links, so switch to a name you own: point
a DNS record at the VM's address and re-run with `--domain`:

```bash
deploy/deploy.sh … --domain folio.example.com
```

Caddy requests the new certificate on the next start (see `docker compose logs
caddy`); both names keep working until the DNS record for the old one is removed.
To go back to plain HTTP on port 80, re-run with `--no-tls` (the app stays
reachable directly on `:8080`).

After any change to the public name, update the absolute `og:url` / `og:image`
meta tags in `index.html` and `app.html`, so link previews resolve. Keep the
`?lang=` parameter handling intact.

## Static IP (recommended)

The current address is ephemeral, so it changes if the VM is stopped and
started. Reserve it and update the DNS record once:

```bash
gcloud compute addresses create folio-ip --region us-central1 --project pdf-editor-511418
gcloud compute addresses describe folio-ip --region us-central1 --project pdf-editor-511418 \
  --format='value(address)'
gcloud compute instances delete-access-config pdf-editor-server --zone us-central1-a \
  --access-config-name "external-nat"
gcloud compute instances add-access-config pdf-editor-server --zone us-central1-a \
  --address <reserved-address>
```

## Troubleshooting

| Symptom | Check |
|---|---|
| `deploy.sh` exits 2 | `PROJECT`/`ZONE`/`VM` missing or the instance name is wrong; the message names the flag. |
| Health check fails on `/api/tools` | The image lost a native binary: `sudo docker compose logs app`. |
| Timeout on `:80` | Firewall rule or Caddy: `sudo ss -ltnp` and `docker compose ps`. |
| No certificate yet / `https://<ip>.nip.io` hangs | Caddy is still requesting it: `sudo docker compose logs caddy`. Ports 80 and 443 must both be open for the ACME challenge (`open-firewall.sh`). |
| `rate limit exceeded` in the Caddy log | Let's Encrypt refused a new certificate for that name; reuse the existing one or pass `--domain` with a name you own. |
| Build killed (exit 137) | Out of memory: confirm swap is on (`swapon --show`) or use a larger machine type. |
| `apt-get update` prints `does not have a Release file` | A stale third-party repository on the VM (roadmap: `packagecloud.io/ookla/speedtest-cli`). `remote-setup.sh` warns and continues, then falls back to `get.docker.com` if the packages still cannot be installed. |
| OCR downloads models at runtime | `server/tessdata` was not fetched during the build; check the Dockerfile step. |
