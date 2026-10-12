# Folio — serves the static site and the server-side PDF tools.
# The apt packages enable the tools that need native binaries:
#   LibreOffice -> Word/PowerPoint/Excel to PDF
#   Ghostscript -> PDF/A + stronger compression
#   qpdf        -> protect / unlock (encryption)
#   Tesseract   -> OCR / scan fallback (tesseract.js downloads its own model)
# Remove any of them if you don't need that tool; the API reports the rest as
# "not available on this server" instead of failing.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer libreoffice-impress libreoffice-calc \
      ghostscript qpdf \
      tesseract-ocr tesseract-ocr-eng tesseract-ocr-ita \
      fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
