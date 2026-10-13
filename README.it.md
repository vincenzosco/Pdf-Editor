# Folio — Strumenti PDF di precisione

[English](README.md) · **Italiano**

Un toolkit PDF gratuito: annota, modifica, ruota, dividi, unisci, applica
filigrane, firma e converti documenti. Il front end è HTML/JS statico; un piccolo
server Node/Express lo ospita ed esegue gli strumenti che non possono funzionare
nel browser.

## Avvio rapido

```bash
npm install
npm start        # http://localhost:8080/app.html
npm test         # test server + test client
```

`npm start` serve l'area di lavoro su `/app.html` e la landing su `/`. Gli
strumenti solo-browser (unisci, dividi, ruota, filigrana, JPG in PDF, …)
funzionano anche senza server. Gli strumenti marcati *server* lo richiedono e
chiamano `/api`: se apri `app.html` come file, quei pannelli spiegano che sono
offline invece di fallire in silenzio.

Altri script:

| Script | Cosa fa |
|---|---|
| `npm run dev` | come `start`, si riavvia quando i file cambiano |
| `npm run test:server` | solo i test del server |
| `npm run test:client` | solo i test client (jsdom) |
| `npm run test:ci` | tutto, un thread alla volta (l'OCR è CPU-bound) |
| `npm run tessdata eng ita` | scarica i modelli Tesseract in `server/tessdata` |

## Strumenti

**Nel browser** (i file non lasciano mai il dispositivo) — unisci, dividi,
rimuovi/estrai/riordina pagine, ruota, numeri di pagina, filigrana, ritaglia,
modifica testo, JPG in PDF, HTML in PDF.

**Sul server (JS puro)** — PDF in JPG, PDF in PowerPoint, OCR, scansione, estrai
testo, raddrizza (deskew), PDF in Word, PDF in Excel, PDF in HTML, PDF in
Markdown, confronta, comprimi, ripara, firma, oscura, moduli.

**Sul server (servono binari nativi)** — Word/PowerPoint/Excel in PDF
(LibreOffice), PDF in PDF/A (Ghostscript), proteggi/sblocca (qpdf).

`GET /api/tools` indica quali sono disponibili sull'host in esecuzione e l'UI
mostra il motivo quando uno non lo è: niente fallisce in silenzio.

## API

- `GET  /api/health` — `{ ok, uptime }`; usalo come health check.
- `GET  /api/tools` — disponibilità per strumento (`available`, `reason`).
- `POST /api/tools/:id` — `multipart/form-data` con una o più parti `files` e un
  campo JSON `options`; il corpo della risposta è il file risultante, con il suo
  nome nell'header `X-Folio-Filename`. Gli errori tornano come
  `{ "error": "…" }` con stato 4xx/5xx.

## Privacy

Gli strumenti solo-browser tengono i file sul dispositivo. **Gli strumenti
server caricano il file sul server per elaborarlo**, quindi il testo della
landing va letto come riferito agli strumenti solo-browser. Se ti serve quella
promessa ovunque, lascia disattivati gli strumenti server.

## Deploy

In locale, con Docker:

```bash
docker build -t folio .
docker run -p 8080:8080 folio
```

L'immagine installa LibreOffice, Ghostscript e qpdf e include i modelli OCR,
quindi ogni strumento funziona. Lo stack compose in `deploy/` aggiunge Caddy
davanti, per le porte 80 e 443.

Sulla VM Google Cloud del progetto:

```bash
deploy/open-firewall.sh --project pdf-editor-511418 --zone us-central1-a \
                        --vm pdf-editor-server     # una volta
PROJECT=pdf-editor-511418 ZONE=us-central1-a VM=pdf-editor-server \
  deploy/deploy.sh                                 # a ogni rilascio
```

`deploy.sh` impacchetta i sorgenti, li copia sulla VM, la prepara (file di swap
da 2 GB, Docker + compose) e avvia lo stack. Si può rieseguire senza rischi. Per
servire in HTTPS, punta un record DNS alla VM e rilancia con
`--domain tuo.dominio`: Caddy ottiene il certificato automaticamente. Il runbook
completo, con come leggere i log e tornare indietro, è in
[docs/DEPLOY-GCP.md](docs/DEPLOY-GCP.md).

L'istanza deployata è raggiungibile su <http://34.61.56.12/>. `og:url` e
`og:image` in `index.html` puntano lì; cambiali entrambi se il sito si sposta.

## Documentazione

- [docs/DEPLOY-GCP.md](docs/DEPLOY-GCP.md) — runbook di deploy.
- [agents/maintenance.md](agents/maintenance.md) — mappa del progetto, come
  mantenerlo ed estenderlo.
- [agents/no-ai-trailers.md](agents/no-ai-trailers.md) — regola obbligatoria sui
  commit.
- [skills/](skills/) — procedure riutilizzabili.
