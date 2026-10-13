# Folio — serves the static site and the server-side PDF tools.
# The apt packages enable the tools that need native binaries:
#   LibreOffice -> Word/PowerPoint/Excel to PDF
#   Ghostscript -> PDF/A + stronger compression
#   qpdf        -> protect / unlock (encryption)
# OCR needs no system package: tesseract.js runs its own WASM engine and the
# language models are baked in below, so `tesseract-ocr` would only add weight.
# Remove any of them if you don't need that tool; the API reports the rest as
# "not available on this server" instead of failing.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer libreoffice-impress libreoffice-calc \
      ghostscript qpdf \
      fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Language models, fetched before the sources are copied so that editing code
# does not re-download them. `ocr.js` picks up /app/server/tessdata and reads
# the models straight off disk instead of pulling one per language at runtime.
# Trim the list with --build-arg FOLIO_OCR_LANGS="eng ita" to save image size.
COPY scripts/ ./scripts/
ARG FOLIO_OCR_LANGS="eng ita spa deu fra"
RUN node scripts/fetch-tessdata.mjs $FOLIO_OCR_LANGS

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
