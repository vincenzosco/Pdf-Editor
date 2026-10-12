/* ============================================================
   Folio i18n — shared EN/IT dictionaries + minimal language API
   Keys starting with "ln." belong to the landing page (index.html),
   keys starting with "ap." belong to the PDF editor (app.html).
   ============================================================ */
(function (global) {
  'use strict';

  var DICTS = {

  /* ============================ ENGLISH ============================ */
  en: {
    'ln.page.title': 'Folio — Precision PDF Tools',
    'ln.meta.desc': 'Folio is a free, in-browser PDF toolkit. Annotate, edit, rotate, split, merge, watermark and sign documents — nothing to install, everything stays on your device.',
    'ln.nav.features': 'Features',
    'ln.nav.editor': 'PDF Editor',
    'ln.nav.testimonials': 'Testimonials',
    'ln.nav.cta': 'Try it',
    'ln.logo.aria': 'Folio home',
    'ln.hero.titleHtml': 'Mark up your PDFs with<br /><span class="highlight">surgical precision</span>',
    'ln.hero.sub': 'Folio gives you the tools to annotate, edit, and sign documents with the care they deserve. Everything stays in your browser.',
    'ln.hero.ctaMainHtml': 'Start for free <span aria-hidden="true">&rarr;</span>',
    'ln.hero.ctaAltHtml': 'Open PDF Editor <span aria-hidden="true">&rarr;</span>',
    'ln.hero.trust': 'Loved by teams that work with documents every day',
    'ln.hero.docAria': 'Interactive document preview showing annotations',
    'ln.trust.label': 'Used by teams at',
    'ln.features.label': 'Capabilities',
    'ln.features.title': 'Everything you need to work with PDFs',
    'ln.features.sub': 'Annotate, edit and sign in one workflow — 100% free, no limits, nothing to install.',
    'ln.feat.annotate.title': 'Annotate',
    'ln.feat.annotate.desc': 'Highlight, underline, strike through, and add margin notes. Every mark stays crisp and stays yours.',
    'ln.feat.edit.title': 'Edit',
    'ln.feat.edit.desc': 'Change text, rearrange pages, and adjust layouts without leaving the document. Full fidelity, always.',
    'ln.feat.sign.title': 'Sign',
    'ln.feat.sign.desc': 'Draw, type, or upload your signature. Certified signatures that hold up anywhere they\u2019re sent.',
    'ln.demo.label': 'Workflow',
    'ln.demo.title': 'Annotations that look like they were made on paper',
    'ln.demo.p': 'Every highlight, underline, and margin note renders at full resolution. Export with annotations baked in or send a clean copy — your choice.',
    'ln.demo.item1': '<strong>Layer-based</strong> — annotations sit on their own layer until you\u2019re ready to flatten',
    'ln.demo.item2': '<strong>Collaborative</strong> — share a document and see each other\u2019s marks in real time',
    'ln.demo.item3': '<strong>Export ready</strong> — PDF/A, flattened, or annotated — whichever your recipient needs',
    'ln.quote.text': '\u201CWe review dozens of contracts a week. Folio turned that from a chore into something we actually don\u2019t mind doing. The annotation tools feel like they were built by people who\u2019ve done this work.\u201D',
    'ln.cta.eyebrow': '100% free — no sign-up',
    'ln.cta.titleHtml': 'Your documents,<br />marked up beautifully',
    'ln.cta.sub': 'No sign-up, no uploads, no limits. Everything runs in your browser and your files never leave your device.',
    'ln.cta.btnHtml': 'Open the PDF editor <span aria-hidden="true">&rarr;</span>',
    'ln.cta.note': 'Works in Chrome, Firefox, Safari, and Edge. Nothing to install.',
    'ln.footer.privacy': 'Privacy',
    'ln.footer.terms': 'Terms',
    'ln.footer.support': 'Support',
    'ln.footer.status': 'Status',
    'ln.footer.copy': '\u00A9 2026 Folio. All rights reserved.',

    'ap.page.title': 'Folio — PDF Editor',
    'ap.meta.desc': 'Free PDF tools that run entirely in your browser: merge, split, rotate, crop, protect and sign your documents. No installs, no uploads, nothing leaves your device.',
    'ap.logo.aria': 'Folio home',
    'ap.top.title': 'PDF Editor',
    'ap.cat.organize': 'Organize PDF',
    'ap.cat.optimize': 'Optimize PDF',
    'ap.cat.toPdf': 'Convert to PDF',
    'ap.cat.fromPdf': 'Convert from PDF',
    'ap.cat.edit': 'Edit PDF',
    'ap.cat.protect': 'Protect PDF',

    'ap.t.merge.label': 'Merge PDF',
    'ap.t.merge.desc': 'Combine multiple PDF files into a single document. Drag files to reorder them before merging.',
    'ap.t.split.label': 'Split PDF',
    'ap.t.split.desc': 'Split a PDF into multiple separate files by page range.',
    'ap.t.remove-pages.label': 'Remove pages',
    'ap.t.remove-pages.desc': 'Select and remove the pages you don\u2019t need from your PDF.',
    'ap.t.extract-pages.label': 'Extract pages',
    'ap.t.extract-pages.desc': 'Extract specific pages from a PDF to create a new document.',
    'ap.t.reorder.label': 'Organize pages',
    'ap.t.reorder.desc': 'Reorder the pages of your PDF by dragging them into position.',
    'ap.t.scan.label': 'Scan to PDF',
    'ap.t.scan.desc': 'Turn scanned documents into an editable PDF with text recognition.',
    'ap.t.compress.label': 'Compress PDF',
    'ap.t.compress.desc': 'Reduce the file size of your PDF while keeping good quality.',
    'ap.t.repair.label': 'Repair PDF',
    'ap.t.repair.desc': 'Repair damaged or corrupted PDF files.',
    'ap.t.ocr.label': 'OCR PDF',
    'ap.t.ocr.desc': 'Make the text in scanned PDFs searchable and selectable.',
    'ap.t.jpg-to-pdf.label': 'JPG to PDF',
    'ap.t.jpg-to-pdf.desc': 'Convert your JPG images into a PDF file. You can combine multiple images into one document.',
    'ap.t.word-to-pdf.label': 'WORD to PDF',
    'ap.t.word-to-pdf.desc': 'Convert Word documents to PDF format.',
    'ap.t.ppt-to-pdf.label': 'POWERPOINT to PDF',
    'ap.t.ppt-to-pdf.desc': 'Convert PowerPoint presentations to PDF format.',
    'ap.t.excel-to-pdf.label': 'EXCEL to PDF',
    'ap.t.excel-to-pdf.desc': 'Convert Excel spreadsheets to PDF format.',
    'ap.t.html-to-pdf.label': 'HTML to PDF',
    'ap.t.html-to-pdf.desc': 'Convert HTML text or Markdown into a nicely formatted PDF file.',
    'ap.t.pdf-to-jpg.label': 'PDF to JPG',
    'ap.t.pdf-to-jpg.desc': 'Convert every page of the PDF into a JPG image.',
    'ap.t.pdf-to-word.label': 'PDF to WORD',
    'ap.t.pdf-to-word.desc': 'Convert PDFs into editable Word documents.',
    'ap.t.pdf-to-ppt.label': 'PDF to POWERPOINT',
    'ap.t.pdf-to-ppt.desc': 'Convert PDFs into editable PowerPoint presentations.',
    'ap.t.pdf-to-excel.label': 'PDF to EXCEL',
    'ap.t.pdf-to-excel.desc': 'Convert tables from PDF to Excel spreadsheets.',
    'ap.t.pdf-to-pdfa.label': 'PDF to PDF/A',
    'ap.t.pdf-to-pdfa.desc': 'Convert standard PDFs into PDF/A format for long-term archiving.',
    'ap.t.rotate.label': 'Rotate PDF',
    'ap.t.rotate.desc': 'Rotate PDF pages by 90\u00B0, 180\u00B0 or 270\u00B0.',
    'ap.t.page-numbers.label': 'Page numbers',
    'ap.t.page-numbers.desc': 'Add page numbers to your PDF with customizable position and format.',
    'ap.t.watermark.label': 'Watermark',
    'ap.t.watermark.desc': 'Add a text watermark to every page of the PDF.',
    'ap.t.crop.label': 'Crop PDF',
    'ap.t.crop.desc': 'Crop the margins of the PDF to the area you want.',
    'ap.t.edit-text.label': 'Edit text',
    'ap.t.edit-text.desc': 'Add new text or overwrite existing content in the PDF.',
    'ap.t.forms.label': 'PDF forms',
    'ap.t.forms.desc': 'Fill in and manage interactive PDF forms with fillable fields.',
    'ap.t.unlock.label': 'Unlock PDF',
    'ap.t.unlock.desc': 'Remove password protection from a PDF.',
    'ap.t.protect.label': 'Protect PDF',
    'ap.t.protect.desc': 'Add an open or an edit password to your PDF.',
    'ap.t.sign.label': 'Sign PDF',
    'ap.t.sign.desc': 'Add a digital or hand-drawn signature to your PDF.',
    'ap.t.redact.label': 'Redact PDF',
    'ap.t.redact.desc': 'Permanently black out sensitive information in the PDF.',
    'ap.t.compare.label': 'Compare PDF',
    'ap.t.compare.desc': 'Compare two PDF documents and show the differences.',

    'ap.soon.title': 'Coming soon',
    'ap.server.run': 'Run',
    'ap.server.busy': 'Processing\u2026',
    'ap.server.needFile': 'Upload the required file(s) first.',
    'ap.server.offline': 'Server tools need the Folio server. Start it with "npm start" and open this page from it.',
    'ap.server.unavailable': 'Not available on this server:',
    'ap.server.ok': 'Done.',
    'ap.soon.body': 'This feature requires server-side processing. We\u2019re working on making it available as soon as possible. In the meantime, you can try the other PDF tools that already work.',
    'ap.upload.dropSingle': 'Drop your file here or',
    'ap.upload.dropMulti': 'Drop your files here or',
    'ap.upload.btnPdf': 'Choose a PDF file',
    'ap.upload.btnPdfs': 'Choose PDF files',
    'ap.upload.btnProtected': 'Choose a protected PDF',
    'ap.upload.btnImages': 'Choose images',

    'ap.merge.btn': 'Merge PDF',
    'ap.merge.busy': 'Merging\u2026',
    'ap.merge.errFew': 'Please select at least 2 PDF files.',
    'ap.merge.errRun': 'Error while merging: ',
    'ap.merge.ok': 'PDFs merged successfully! ({n} files, {p} pages in total)',
    'ap.download': 'Download PDF',

    'ap.split.btn': 'Split PDF',
    'ap.split.busy': 'Splitting\u2026',
    'ap.split.mode': 'Split option',
    'ap.split.rangeOpt': 'Page range',
    'ap.split.everyOpt': 'Every N pages',
    'ap.split.rangeLabel': 'Pages (e.g. 1-3, 5, 7-9)',
    'ap.split.everyLabel': 'Every',
    'ap.split.errRange': 'Enter a page range.',
    'ap.split.errNoPages': 'No valid pages. Pages go from 1 to {n}.',
    'ap.split.ok': 'PDF split into {n} files!',
    'ap.split.errRun': 'Error: ',

    'ap.remove.btn': 'Remove pages',
    'ap.remove.busy': 'Removing\u2026',
    'ap.remove.label': 'Pages to remove (e.g. 1, 3, 5-7)',
    'ap.remove.total': 'Total pages: ',
    'ap.remove.errInput': 'Enter the pages to remove.',
    'ap.remove.errNoPages': 'No valid pages.',
    'ap.remove.ok': 'Removed {n} pages. {p} pages remaining.',
    'ap.remove.errRun': 'Error: ',

    'ap.extract.btn': 'Extract pages',
    'ap.extract.busy': 'Extracting\u2026',
    'ap.extract.label': 'Pages to extract (e.g. 1, 3, 5-7)',
    'ap.extract.total': 'Total pages: ',
    'ap.extract.errInput': 'Enter the pages to extract.',
    'ap.extract.errNoPages': 'No valid pages.',
    'ap.extract.ok': 'Extracted {n} pages.',
    'ap.extract.errRun': 'Error: ',

    'ap.reorder.btn': 'Apply order',
    'ap.reorder.busy': 'Reordering\u2026',
    'ap.reorder.hint': 'Use the arrow buttons to reorder the pages:',
    'ap.reorder.up': 'Move up',
    'ap.reorder.down': 'Move down',
    'ap.reorder.ok': 'Pages reordered.',
    'ap.reorder.errRun': 'Error: ',

    'ap.rotate.btn': 'Rotate PDF',
    'ap.rotate.busy': 'Rotating\u2026',
    'ap.rotate.angleLabel': 'Rotation',
    'ap.rotate.right': '90\u00B0 (right)',
    'ap.rotate.half': '180\u00B0',
    'ap.rotate.left': '90\u00B0 (left)',
    'ap.rotate.targetLabel': 'Apply to',
    'ap.rotate.all': 'All pages',
    'ap.rotate.some': 'Specific pages',
    'ap.rotate.rangeLabel': 'Pages (e.g. 1, 3, 5-7)',
    'ap.rotate.ok': 'PDF rotated.',
    'ap.rotate.errRun': 'Error: ',

    'ap.pagenum.btn': 'Add page numbers',
    'ap.pagenum.busy': 'Adding page numbers\u2026',
    'ap.pagenum.posLabel': 'Position',
    'ap.pagenum.pos.bc': 'Bottom center',
    'ap.pagenum.pos.br': 'Bottom right',
    'ap.pagenum.pos.bl': 'Bottom left',
    'ap.pagenum.pos.tc': 'Top center',
    'ap.pagenum.pos.tr': 'Top right',
    'ap.pagenum.pos.tl': 'Top left',
    'ap.pagenum.startLabel': 'Start number',
    'ap.pagenum.fmtLabel': 'Format',
    'ap.pagenum.ok': 'Page numbers added.',
    'ap.pagenum.errRun': 'Error: ',

    'ap.wm.btn': 'Apply watermark',
    'ap.wm.busy': 'Applying watermark\u2026',
    'ap.wm.textLabel': 'Watermark text',
    'ap.wm.opacityLabel': 'Opacity',
    'ap.wm.colorLabel': 'Color',
    'ap.wm.sizeLabel': 'Font size',
    'ap.wm.rotLabel': 'Rotation',
    'ap.wm.rotDiag': '-45\u00B0 (diagonal)',
    'ap.wm.rotHor': '0\u00B0 (horizontal)',
    'ap.wm.ok': 'Watermark applied.',
    'ap.wm.errRun': 'Error: ',

    'ap.crop.btn': 'Crop PDF',
    'ap.crop.busy': 'Cropping\u2026',
    'ap.crop.left': 'Left margin (mm)',
    'ap.crop.right': 'Right margin (mm)',
    'ap.crop.top': 'Top margin (mm)',
    'ap.crop.bottom': 'Bottom margin (mm)',
    'ap.crop.ok': 'PDF cropped.',
    'ap.crop.errRun': 'Error: ',

    'ap.edittext.btn': 'Add text',
    'ap.edittext.busy': 'Adding text\u2026',
    'ap.edittext.textLabel': 'Text to add',
    'ap.edittext.placeholder': 'Type your text\u2026',
    'ap.edittext.xLabel': 'Position X (pt)',
    'ap.edittext.yLabel': 'Position Y (pt)',
    'ap.edittext.sizeLabel': 'Size',
    'ap.edittext.colorLabel': 'Color',
    'ap.edittext.hint': 'The text will be added to every page. To cover existing text, use a background-colored box first.',
    'ap.edittext.errText': 'Enter the text to add.',
    'ap.edittext.ok': 'Text added to {n} pages.',
    'ap.edittext.errRun': 'Error: ',

    'ap.unlock.btn': 'Unlock PDF',
    'ap.unlock.busy': 'Unlocking\u2026',
    'ap.unlock.pwLabel': 'PDF password',
    'ap.unlock.pwPlaceholder': 'Enter the password',
    'ap.unlock.ok': 'PDF unlocked.',
    'ap.unlock.errBad': 'Error: wrong password or PDF is not protected.',

    'ap.protect.btn': 'Protect PDF',
    'ap.protect.busy': 'Protecting\u2026',
    'ap.protect.userLabel': 'Open password',
    'ap.protect.ownerLabel': 'Edit password',
    'ap.protect.userPlaceholder': 'Leave empty for no password',
    'ap.protect.ownerPlaceholder': 'Protect editing',
    'ap.protect.errPw': 'Enter at least one password.',
    'ap.protect.ok': 'PDF protected with a password.',
    'ap.protect.errRun': 'Error: ',

    'ap.jpg.btn': 'Create PDF',
    'ap.jpg.busy': 'Creating PDF\u2026',
    'ap.jpg.orientLabel': 'Page orientation',
    'ap.jpg.orientAuto': 'Automatic',
    'ap.jpg.orientPortrait': 'Portrait',
    'ap.jpg.orientLandscape': 'Landscape',
    'ap.jpg.formatLabel': 'Page size',
    'ap.jpg.errWebp': 'WebP is not supported. Convert the image to JPG or PNG before uploading it.',
    'ap.jpg.errNone': 'Upload at least one image.',
    'ap.jpg.ok': 'PDF created from {n} image(s).',
    'ap.jpg.errRun': 'Error: ',

    'ap.html.btn': 'Convert to PDF',
    'ap.html.busy': 'Converting\u2026',
    'ap.html.textLabel': 'Paste text or HTML',
    'ap.html.titleLabel': 'Document title',
    'ap.html.errEmpty': 'Enter some text or HTML.',
    'ap.html.ok': 'PDF created from your text.',
    'ap.html.errRun': 'Error: ',
    'ap.html.sample': '# Document title\n\nThis is a sample paragraph.\nYour text will be converted into a nicely formatted PDF.\n\n- List item 1\n- List item 2\n- List item 3',

    'ap.err.noFile': 'Upload a PDF file.',
    'ap.err.run': 'Error: ',
    'ap.html.titleDefault': 'Document',
    'ap.fatal.title': 'Unable to start the editor',
    'ap.fatal.body': 'The PDF library could not be loaded. Reload the page or check that the file <code>vendor/pdf-lib.min.js</code> is next to this page.'
  },

  /* ============================ ITALIANO ============================ */
  it: {
    'ln.page.title': 'Folio — Strumenti PDF di precisione',
    'ln.meta.desc': 'Folio è un toolkit PDF gratuito che funziona nel browser. Annota, modifica, ruota, dividi, unisci, applica filigrane e firma i documenti — niente da installare, tutto resta sul tuo dispositivo.',
    'ln.nav.features': 'Funzionalità',
    'ln.nav.editor': 'PDF Editor',
    'ln.nav.testimonials': 'Recensioni',
    'ln.nav.cta': 'Prova gratis',
    'ln.logo.aria': 'Folio homepage',
    'ln.hero.titleHtml': 'Evidenzia e correggi i tuoi PDF con<br /><span class="highlight">precisione chirurgica</span>',
    'ln.hero.sub': 'Folio ti offre gli strumenti per annotare, modificare e firmare i documenti con la cura che meritano. Tutto resta nel tuo browser.',
    'ln.hero.ctaMainHtml': 'Inizia gratis <span aria-hidden="true">&rarr;</span>',
    'ln.hero.ctaAltHtml': 'Apri PDF Editor <span aria-hidden="true">&rarr;</span>',
    'ln.hero.trust': 'Amato dai team che lavorano con i documenti ogni giorno',
    'ln.hero.docAria': 'Anteprima interattiva di un documento con annotazioni',
    'ln.trust.label': 'Utilizzato dai team in',
    'ln.features.label': 'Funzionalità',
    'ln.features.title': 'Tutto quello che serve per lavorare con i PDF',
    'ln.features.sub': 'Annota, modifica e firma in un unico flusso — gratis al 100%, senza limiti e senza installazioni.',
    'ln.feat.annotate.title': 'Annota',
    'ln.feat.annotate.desc': 'Evidenzia, sottolinea, barra e aggiungi note a margine. Ogni segno resta nitido e resta tuo.',
    'ln.feat.edit.title': 'Modifica',
    'ln.feat.edit.desc': 'Modifica il testo, riordina le pagine e aggiusta i layout senza uscire dal documento. Fedeltà totale, sempre.',
    'ln.feat.sign.title': 'Firma',
    'ln.feat.sign.desc': 'Disegna, digita o carica la tua firma. Firme certificate che valgono ovunque le invii.',
    'ln.demo.label': 'Flusso di lavoro',
    'ln.demo.title': 'Annotazioni che sembrano fatte a mano sulla carta',
    'ln.demo.p': 'Ogni evidenziazione, sottolineatura e nota a margine viene renderizzata a piena risoluzione. Esporta con le annotazioni incluse o invia una copia pulita: scegli tu.',
    'ln.demo.item1': '<strong>A livelli</strong> — le annotazioni restano su un livello separato finché non sei pronto a unificarle',
    'ln.demo.item2': '<strong>Collaborativo</strong> — condividi un documento e vedi i segni degli altri in tempo reale',
    'ln.demo.item3': '<strong>Pronto per l\u2019export</strong> — PDF/A, livelli uniti o annotato: come serve a chi lo riceve',
    'ln.quote.text': '\u00ABEsaminiamo decine di contratti a settimana. Folio ha trasformato quel compito in qualcosa che non ci pesa più fare. Gli strumenti di annotazione sembrano creati da chi fa davvero questo lavoro.\u00BB',
    'ln.cta.eyebrow': 'Gratis al 100% — senza registrazione',
    'ln.cta.titleHtml': 'I tuoi documenti,<br />annotati alla perfezione',
    'ln.cta.sub': 'Nessuna registrazione, nessun upload, nessun limite. Tutto gira nel browser e i tuoi file non lasciano mai il tuo dispositivo.',
    'ln.cta.btnHtml': 'Apri l\u2019editor PDF <span aria-hidden="true">&rarr;</span>',
    'ln.cta.note': 'Funziona su Chrome, Firefox, Safari ed Edge. Niente da installare.',
    'ln.footer.privacy': 'Privacy',
    'ln.footer.terms': 'Termini',
    'ln.footer.support': 'Supporto',
    'ln.footer.status': 'Stato',
    'ln.footer.copy': '\u00A9 2026 Folio. Tutti i diritti riservati.',

    'ap.page.title': 'Folio — Editor PDF',
    'ap.meta.desc': 'Strumenti PDF gratuiti che girano interamente nel browser: unisci, dividi, ruota, ritaglia, proteggi e firma i tuoi documenti. Nessuna installazione, nessun upload, nulla esce dal tuo dispositivo.',
    'ap.logo.aria': 'Folio homepage',
    'ap.top.title': 'Editor PDF',
    'ap.cat.organize': 'Organizza PDF',
    'ap.cat.optimize': 'Ottimizza PDF',
    'ap.cat.toPdf': 'Converti in PDF',
    'ap.cat.fromPdf': 'Converti da PDF',
    'ap.cat.edit': 'Modifica PDF',
    'ap.cat.protect': 'Protezione PDF',

    'ap.t.merge.label': 'Unisci PDF',
    'ap.t.merge.desc': 'Combina più file PDF in un unico documento. Trascina i file per riordinarli prima di unirli.',
    'ap.t.split.label': 'Dividi PDF',
    'ap.t.split.desc': 'Dividi un PDF in più file separati per intervallo di pagine.',
    'ap.t.remove-pages.label': 'Rimuovi pagine',
    'ap.t.remove-pages.desc': 'Seleziona e rimuovi le pagine che non ti servono dal tuo PDF.',
    'ap.t.extract-pages.label': 'Estrai pagine',
    'ap.t.extract-pages.desc': 'Estrai pagine specifiche da un PDF per creare un nuovo documento.',
    'ap.t.reorder.label': 'Organizza pagine',
    'ap.t.reorder.desc': 'Riordina le pagine del tuo PDF trascinandole nella posizione desiderata.',
    'ap.t.scan.label': 'Scansiona in PDF',
    'ap.t.scan.desc': 'Converti documenti scansionati in PDF modificabile con riconoscimento del testo.',
    'ap.t.compress.label': 'Comprimi PDF',
    'ap.t.compress.desc': 'Riduci la dimensione del file PDF mantenendo una buona qualità.',
    'ap.t.repair.label': 'Ripara PDF',
    'ap.t.repair.desc': 'Ripara file PDF danneggiati o corrotti.',
    'ap.t.ocr.label': 'OCR PDF',
    'ap.t.ocr.desc': 'Rendi ricercabile e selezionabile il testo nei PDF scansionati.',
    'ap.t.jpg-to-pdf.label': 'JPG in PDF',
    'ap.t.jpg-to-pdf.desc': 'Converti le tue immagini JPG in un file PDF. Puoi unire più immagini in un unico documento.',
    'ap.t.word-to-pdf.label': 'WORD in PDF',
    'ap.t.word-to-pdf.desc': 'Converti documenti Word in formato PDF.',
    'ap.t.ppt-to-pdf.label': 'POWERPOINT in PDF',
    'ap.t.ppt-to-pdf.desc': 'Converti presentazioni PowerPoint in formato PDF.',
    'ap.t.excel-to-pdf.label': 'EXCEL in PDF',
    'ap.t.excel-to-pdf.desc': 'Converti fogli di calcolo Excel in formato PDF.',
    'ap.t.html-to-pdf.label': 'HTML in PDF',
    'ap.t.html-to-pdf.desc': 'Converti testo HTML o Markdown in un file PDF ben formattato.',
    'ap.t.pdf-to-jpg.label': 'PDF in JPG',
    'ap.t.pdf-to-jpg.desc': 'Converti ogni pagina del PDF in un\u2019immagine JPG.',
    'ap.t.pdf-to-word.label': 'PDF in WORD',
    'ap.t.pdf-to-word.desc': 'Converti PDF in documenti Word modificabili.',
    'ap.t.pdf-to-ppt.label': 'PDF in POWERPOINT',
    'ap.t.pdf-to-ppt.desc': 'Converti PDF in presentazioni PowerPoint modificabili.',
    'ap.t.pdf-to-excel.label': 'PDF in EXCEL',
    'ap.t.pdf-to-excel.desc': 'Converti tabelle da PDF a fogli Excel.',
    'ap.t.pdf-to-pdfa.label': 'PDF in PDF/A',
    'ap.t.pdf-to-pdfa.desc': 'Converti PDF standard in formato PDF/A per l\u2019archiviazione a lungo termine.',
    'ap.t.rotate.label': 'Ruota PDF',
    'ap.t.rotate.desc': 'Ruota le pagine del PDF a 90°, 180° o 270°.',
    'ap.t.page-numbers.label': 'Numeri di pagina',
    'ap.t.page-numbers.desc': 'Aggiungi numeri di pagina al tuo PDF con posizione e formato personalizzabili.',
    'ap.t.watermark.label': 'Filigrana',
    'ap.t.watermark.desc': 'Aggiungi un testo in filigrana (watermark) a ogni pagina del PDF.',
    'ap.t.crop.label': 'Ritaglia PDF',
    'ap.t.crop.desc': 'Ritaglia i margini del PDF per ottenere l\u2019area desiderata.',
    'ap.t.edit-text.label': 'Modifica testo',
    'ap.t.edit-text.desc': 'Aggiungi nuovo testo o sovrascrivi contenuti esistenti nel PDF.',
    'ap.t.forms.label': 'Moduli PDF',
    'ap.t.forms.desc': 'Compila e gestisci moduli PDF interattivi con campi da riempire.',
    'ap.t.unlock.label': 'Sblocca PDF',
    'ap.t.unlock.desc': 'Rimuovi la protezione tramite password da un PDF.',
    'ap.t.protect.label': 'Proteggi PDF',
    'ap.t.protect.desc': 'Aggiungi una password di apertura o di modifica al tuo PDF.',
    'ap.t.sign.label': 'Firma PDF',
    'ap.t.sign.desc': 'Aggiungi una firma digitale o disegnata a mano al tuo PDF.',
    'ap.t.redact.label': 'Censura PDF',
    'ap.t.redact.desc': 'Oscura permanentemente informazioni sensibili nel PDF.',
    'ap.t.compare.label': 'Confronta PDF',
    'ap.t.compare.desc': 'Confronta due documenti PDF e mostra le differenze.',

    'ap.soon.title': 'Presto disponibile',
    'ap.server.run': 'Esegui',
    'ap.server.busy': 'Elaborazione\u2026',
    'ap.server.needFile': 'Carica prima i file richiesti.',
    'ap.server.offline': 'Le funzioni server richiedono il server Folio. Avvialo con "npm start" e apri questa pagina da l\u00ec.',
    'ap.server.unavailable': 'Non disponibile su questo server:',
    'ap.server.ok': 'Fatto.',
    'ap.soon.body': 'Questa funzione richiede l\u2019elaborazione lato server. Stiamo lavorando per renderla disponibile al più presto. Per ora, puoi provare gli altri strumenti di modifica PDF già funzionanti.',
    'ap.upload.dropSingle': 'Trascina il file qui o',
    'ap.upload.dropMulti': 'Trascina i file qui o',
    'ap.upload.btnPdf': 'Carica un file PDF',
    'ap.upload.btnPdfs': 'Carica file PDF',
    'ap.upload.btnProtected': 'Carica PDF protetto',
    'ap.upload.btnImages': 'Carica immagini',

    'ap.merge.btn': 'Unisci PDF',
    'ap.merge.busy': 'Unione in corso\u2026',
    'ap.merge.errFew': 'Seleziona almeno 2 file PDF.',
    'ap.merge.errRun': 'Errore durante l\u2019unione: ',
    'ap.merge.ok': 'PDF uniti con successo! ({n} file, {p} pagine totali)',
    'ap.download': 'Scarica PDF',

    'ap.split.btn': 'Dividi PDF',
    'ap.split.busy': 'Divisione in corso\u2026',
    'ap.split.mode': 'Opzione di divisione',
    'ap.split.rangeOpt': 'Intervallo di pagine',
    'ap.split.everyOpt': 'Ogni N pagine',
    'ap.split.rangeLabel': 'Pagine (es: 1-3, 5, 7-9)',
    'ap.split.everyLabel': 'Ogni',
    'ap.split.errRange': 'Inserisci un intervallo di pagine.',
    'ap.split.errNoPages': 'Nessuna pagina valida. Le pagine vanno da 1 a {n}.',
    'ap.split.ok': 'PDF diviso in {n} file!',
    'ap.split.errRun': 'Errore: ',

    'ap.remove.btn': 'Rimuovi pagine',
    'ap.remove.busy': 'Rimozione\u2026',
    'ap.remove.label': 'Pagine da rimuovere (es: 1, 3, 5-7)',
    'ap.remove.total': 'Totale pagine: ',
    'ap.remove.errInput': 'Inserisci le pagine da rimuovere.',
    'ap.remove.errNoPages': 'Nessuna pagina valida.',
    'ap.remove.ok': 'Rimosse {n} pagine. {p} pagine rimanenti.',
    'ap.remove.errRun': 'Errore: ',

    'ap.extract.btn': 'Estrai pagine',
    'ap.extract.busy': 'Estrazione\u2026',
    'ap.extract.label': 'Pagine da estrarre (es: 1, 3, 5-7)',
    'ap.extract.total': 'Totale pagine: ',
    'ap.extract.errInput': 'Inserisci le pagine da estrarre.',
    'ap.extract.errNoPages': 'Nessuna pagina valida.',
    'ap.extract.ok': 'Estratte {n} pagine.',
    'ap.extract.errRun': 'Errore: ',

    'ap.reorder.btn': 'Applica ordine',
    'ap.reorder.busy': 'Riordino\u2026',
    'ap.reorder.hint': 'Usa le frecce per riordinare le pagine:',
    'ap.reorder.up': 'Sposta su',
    'ap.reorder.down': 'Sposta giù',
    'ap.reorder.ok': 'Pagine riordinate.',
    'ap.reorder.errRun': 'Errore: ',

    'ap.rotate.btn': 'Ruota PDF',
    'ap.rotate.busy': 'Rotazione\u2026',
    'ap.rotate.angleLabel': 'Rotazione',
    'ap.rotate.right': '90° (destra)',
    'ap.rotate.half': '180°',
    'ap.rotate.left': '90° (sinistra)',
    'ap.rotate.targetLabel': 'Applica a',
    'ap.rotate.all': 'Tutte le pagine',
    'ap.rotate.some': 'Pagine specifiche',
    'ap.rotate.rangeLabel': 'Pagine (es: 1, 3, 5-7)',
    'ap.rotate.ok': 'PDF ruotato.',
    'ap.rotate.errRun': 'Errore: ',

    'ap.pagenum.btn': 'Aggiungi numeri',
    'ap.pagenum.busy': 'Aggiunta numeri\u2026',
    'ap.pagenum.posLabel': 'Posizione',
    'ap.pagenum.pos.bc': 'In basso al centro',
    'ap.pagenum.pos.br': 'In basso a destra',
    'ap.pagenum.pos.bl': 'In basso a sinistra',
    'ap.pagenum.pos.tc': 'In alto al centro',
    'ap.pagenum.pos.tr': 'In alto a destra',
    'ap.pagenum.pos.tl': 'In alto a sinistra',
    'ap.pagenum.startLabel': 'Numero iniziale',
    'ap.pagenum.fmtLabel': 'Formato',
    'ap.pagenum.ok': 'Numeri di pagina aggiunti.',
    'ap.pagenum.errRun': 'Errore: ',

    'ap.wm.btn': 'Applica filigrana',
    'ap.wm.busy': 'Applicazione filigrana\u2026',
    'ap.wm.textLabel': 'Testo filigrana',
    'ap.wm.opacityLabel': 'Opacità',
    'ap.wm.colorLabel': 'Colore',
    'ap.wm.sizeLabel': 'Dimensione carattere',
    'ap.wm.rotLabel': 'Rotazione',
    'ap.wm.rotDiag': '-45° (diagonale)',
    'ap.wm.rotHor': '0° (orizzontale)',
    'ap.wm.ok': 'Filigrana applicata.',
    'ap.wm.errRun': 'Errore: ',

    'ap.crop.btn': 'Ritaglia PDF',
    'ap.crop.busy': 'Ritaglio\u2026',
    'ap.crop.left': 'Margine sinistro (mm)',
    'ap.crop.right': 'Margine destro (mm)',
    'ap.crop.top': 'Margine superiore (mm)',
    'ap.crop.bottom': 'Margine inferiore (mm)',
    'ap.crop.ok': 'PDF ritagliato.',
    'ap.crop.errRun': 'Errore: ',

    'ap.edittext.btn': 'Aggiungi testo',
    'ap.edittext.busy': 'Aggiunta testo\u2026',
    'ap.edittext.textLabel': 'Testo da aggiungere',
    'ap.edittext.placeholder': 'Inserisci il testo\u2026',
    'ap.edittext.xLabel': 'Posizione X (punti)',
    'ap.edittext.yLabel': 'Posizione Y (punti)',
    'ap.edittext.sizeLabel': 'Dimensione',
    'ap.edittext.colorLabel': 'Colore',
    'ap.edittext.hint': 'Il testo verrà aggiunto a ogni pagina. Per modificare testo esistente, usa il colore di sfondo per coprirlo.',
    'ap.edittext.errText': 'Inserisci il testo da aggiungere.',
    'ap.edittext.ok': 'Testo aggiunto a {n} pagine.',
    'ap.edittext.errRun': 'Errore: ',

    'ap.unlock.btn': 'Sblocca PDF',
    'ap.unlock.busy': 'Sblocco\u2026',
    'ap.unlock.pwLabel': 'Password del PDF',
    'ap.unlock.pwPlaceholder': 'Inserisci la password',
    'ap.unlock.ok': 'PDF sbloccato.',
    'ap.unlock.errBad': 'Errore: password errata o PDF non protetto.',

    'ap.protect.btn': 'Proteggi PDF',
    'ap.protect.busy': 'Protezione\u2026',
    'ap.protect.userLabel': 'Password di apertura',
    'ap.protect.ownerLabel': 'Password di modifica',
    'ap.protect.userPlaceholder': 'Lascia vuoto per nessuna password',
    'ap.protect.ownerPlaceholder': 'Proteggi modifica',
    'ap.protect.errPw': 'Inserisci almeno una password.',
    'ap.protect.ok': 'PDF protetto con password.',
    'ap.protect.errRun': 'Errore: ',

    'ap.jpg.btn': 'Crea PDF',
    'ap.jpg.busy': 'Creazione PDF\u2026',
    'ap.jpg.orientLabel': 'Orientamento pagina',
    'ap.jpg.orientAuto': 'Automatico',
    'ap.jpg.orientPortrait': 'Verticale',
    'ap.jpg.orientLandscape': 'Orizzontale',
    'ap.jpg.formatLabel': 'Formato pagina',
    'ap.jpg.errWebp': 'Il formato WebP non è supportato. Converti l\u2019immagine in JPG o PNG prima di caricarla.',
    'ap.jpg.errNone': 'Carica almeno un\u2019immagine.',
    'ap.jpg.ok': 'PDF creato da {n} immagine/i.',
    'ap.jpg.errRun': 'Errore: ',

    'ap.html.btn': 'Converti in PDF',
    'ap.html.busy': 'Conversione\u2026',
    'ap.html.textLabel': 'Inserisci testo o HTML',
    'ap.html.titleLabel': 'Titolo del documento',
    'ap.html.errEmpty': 'Inserisci del testo o HTML.',
    'ap.html.ok': 'PDF creato dal testo.',
    'ap.html.errRun': 'Errore: ',
    'ap.html.sample': '# Titolo del documento\n\nQuesto è un paragrafo di esempio.\nIl testo verrà convertito in un PDF ben formattato.\n\n- Elemento lista 1\n- Elemento lista 2\n- Elemento lista 3',

    'ap.err.noFile': 'Carica un file PDF.',
    'ap.err.run': 'Errore: ',
    'ap.html.titleDefault': 'Documento',
    'ap.fatal.title': 'Impossibile avviare l\u2019editor',
    'ap.fatal.body': 'La libreria PDF non è stata caricata. Ricarica la pagina o controlla che il file <code>vendor/pdf-lib.min.js</code> sia presente accanto a questa pagina.'
  }
  };

  var STORE_KEY = 'folio-lang';

  /* Read ?lang=en|it from the current URL (if present). */
  function langFromUrl() {
    try {
      var m = new global.URLSearchParams(global.location.search).get('lang');
      return (m === 'en' || m === 'it') ? m : null;
    } catch (e) {
      return null;
    }
  }

  /* Keep the language in sync with the URL (?lang=it / no param for EN). */
  function syncUrl(lang) {
    try {
      if (!global.history || !global.history.replaceState) return;
      var p = new global.URLSearchParams(global.location.search);
      if (lang === 'it') {
        p.set('lang', 'it');
      } else {
        p.delete('lang');
      }
      var qs = p.toString();
      var url = global.location.pathname + (qs ? '?' + qs : '') + global.location.hash;
      global.history.replaceState(global.history.state, '', url);
    } catch (e) { /* ignore */ }
  }

  // Current language, kept in memory so a switch works even when storage is
  // unavailable (private mode, cookies disabled, some file:// contexts).
  var currentLang = null;

  function detect() {
    if (currentLang) return currentLang;
    var fromUrl = langFromUrl();
    if (fromUrl) { currentLang = fromUrl; return fromUrl; }
    try {
      var stored = global.localStorage.getItem(STORE_KEY);
      if (stored === 'en' || stored === 'it') { currentLang = stored; return stored; }
    } catch (e) { /* storage unavailable */ }
    var nav = (global.navigator && global.navigator.language || 'en').toLowerCase();
    currentLang = nav.indexOf('it') === 0 ? 'it' : 'en';
    return currentLang;
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'it') lang = 'en';
    currentLang = lang;
    try { global.localStorage.setItem(STORE_KEY, lang); } catch (e) { /* ignore */ }
  }

  function current() { return detect(); }

  function dict(lang) {
    return DICTS[lang] || DICTS.en;
  }

  /* t(key)          -> translated string
     t(key, {x: 1})  -> same, with {x} placeholders replaced */
  function t(key, vars) {
    var lang = detect();
    var val = DICTS[lang] && DICTS[lang][key];
    if (val === undefined) val = DICTS.en[key];
    if (val === undefined) return key;
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) {
          val = val.split('{' + k + '}').join(vars[k]);
        }
      }
    }
    return val;
  }

  global.FolioI18N = {
    t: t,
    set: setLang,
    current: current,
    dict: dict,
    langFromUrl: langFromUrl,
    syncUrl: syncUrl
  };
})(window);
