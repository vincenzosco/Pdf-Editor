/* ============================================
   PDF Editor - Application Logic
   ============================================ */

// --- Configuration ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const { PDFDocument, degrees, StandardFonts, rgb } = PDFLib;

const THUMBNAIL_SCALE = 0.3;
const TEXT_EDITOR_SCALE = 1.0;

// --- State ---
const state = {
  pdfBytes: null,            // Current PDF bytes (Uint8Array)
  pdfDoc: null,              // pdf-lib document (the working document)
  pdfjsDoc: null,            // PDF.js document (for rendering)
  pageCount: 0,              // Number of pages
  selectedPages: new Set(),  // Set of selected page indices
  fileName: '',
  fileSize: '',
  isProcessing: false,
  textAnnotations: [],       // Array of { id, pageIndex, text, x, y, fontSize, color }
  extractedTextCache: {},    // pageIndex -> array of { text, x, y, fontSize, fontName, width, height }
  history: {
    past: [],      // past snapshots
    future: [],    // future snapshots for redo
  },
};

// --- DOM References ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const mergeInput = $('#mergeInput');
const loadingState = $('#loadingState');
const errorState = $('#errorState');
const errorMessage = $('#errorMessage');
const pageGrid = $('#pageGrid');
const toolbar = $('#toolbar');
const fileInfoBar = $('#fileInfoBar');
const fileInfoName = $('#fileInfoName');
const fileInfoDetails = $('#fileInfoDetails');
const landingTools = $('#landingTools');
const btnUndo = $('#btnUndo');
const btnRedo = $('#btnRedo');
const downloadBtn = $('#downloadBtn');
const pageCount = $('#pageCount');
const previewModal = $('#previewModal');
const previewTitle = $('#previewTitle');
const previewBody = $('#previewBody');
const toastContainer = $('#toastContainer');

// Text editor modal refs
const textEditorModal = $('#textEditorModal');
const textEditorTitle = $('#textEditorTitle');
const textEditorCanvas = $('#textEditorCanvas');
const textEditorCanvasWrapper = $('#textEditorCanvasWrapper');
const teText = $('#teText');
const teFontSize = $('#teFontSize');
const teColor = $('#teColor');
const teX = $('#teX');
const teY = $('#teY');
const teAnnotationsSection = $('#teAnnotationsSection');
const teAnnotationsList = $('#teAnnotationsList');
const teAnalyzeBtn = $('#teAnalyzeBtn');
const teAnalyzedSection = $('#teAnalyzedSection');
const teAnalyzedList = $('#teAnalyzedList');
const teAnalyzeStatus = $('#teAnalyzeStatus');

// Conversion modal refs
const exportImagesModal = $('#exportImagesModal');
const exportImagesTitle = $('#exportImagesTitle');
const eiFormat = $('#eiFormat');
const eiScale = $('#eiScale');

const imagesToPDFModal = $('#imagesToPDFModal');
const ipFileInput = $('#ipFileInput');
const ipGrid = $('#ipGrid');
const ipPageSize = $('#ipPageSize');
const ipOrientation = $('#ipOrientation');
const ipConvertBtn = $('#ipConvertBtn');

const extractTextModal = $('#extractTextModal');
const extractedText = $('#extractedText');

// Images state for Images-to-PDF
const ipState = {
  files: [],        // Array of { name, dataUrl, width, height }
};

// ============================================
// Initialization
// ============================================
function init() {
  initDropZone();
  initGlobalDrop();
  initKeyboardShortcuts();
  initImageUploadDragDrop();
  initCardDropZones();
  triggerLandingEntrance();
}

// ============================================
// Animated View Transitions
// ============================================

function triggerLandingEntrance() {
  // Forces the entrance animations to re-trigger by briefly removing and re-adding
  // The animations have delays baked into the CSS nth-child rules
  const tools = document.getElementById('landingTools');
  const zone = document.getElementById('dropZone');
  if (tools) {
    tools.style.animation = 'none';
    tools.offsetHeight; // reflow
    tools.style.animation = '';
  }
  if (zone) {
    zone.style.animation = 'none';
    zone.offsetHeight;
    zone.style.animation = '';
  }
}

async function transitionToEditor() {
  return new Promise(resolve => {
    const mainContent = $('#mainContent');
    mainContent.classList.add('view-transitioning');
    setTimeout(async () => {
      // Show the editor view elements with entrance animations
      const toolbar = document.getElementById('toolbar');
      const fileInfoBar = document.getElementById('fileInfoBar');
      const pageGrid = document.getElementById('pageGrid');

      // Remove entrance classes first if they exist
      [toolbar, fileInfoBar, pageGrid].forEach(el => {
        if (el) el.classList.remove('view-enter');
      });

      mainContent.classList.remove('view-transitioning');

      // Force reflow then add entrance animations
      await new Promise(r => setTimeout(r, 20));
      [toolbar, fileInfoBar, pageGrid].forEach(el => {
        if (el) el.classList.add('view-enter');
      });
      resolve();
    }, 300);
  });
}

// ============================================
// Card Drop Zones (landing page tool cards)
// ============================================

function initCardDropZones() {
  const cards = document.querySelectorAll('.landing-tool-card');

  cards.forEach(card => {
    const acceptType = card.dataset.accept; // 'pdf' or 'image'

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.add('card-drag-over');
    });

    card.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only remove if we actually left the card (not entering a child)
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('card-drag-over');
      }
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('card-drag-over');

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      if (acceptType === 'image') {
        // Images to PDF — accept image files
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          handleToolClick('img2pdf', imageFiles);
        } else {
          showToast('Please drop image files (PNG, JPG, WebP)', 'error');
        }
      } else {
        // PDF tools — accept PDF files
        const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (pdfFiles.length > 0) {
          handleToolClick(card.dataset.tool, pdfFiles);
        } else {
          showToast('Please drop a PDF file', 'error');
        }
      }
    });

    // Also wire up the hidden file input inside the card for click-to-browse
    const fileInput = card.querySelector('.card-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          if (acceptType === 'image') {
            handleToolClick('img2pdf', files);
          } else {
            handleToolClick(card.dataset.tool, files);
          }
        }
        e.target.value = '';
      });
    }
  });
}

// ============================================
// Tool Card Click Handler
// ============================================

function handleToolClick(tool, preloadedFiles) {
  // If files were dropped/uploaded, use them directly
  if (preloadedFiles && preloadedFiles.length > 0) {
    if (tool === 'img2pdf') {
      openImagesToPDF();
      handleImageFiles(preloadedFiles);
      return;
    }
    // PDF tools: load the first PDF
    const pdfFile = preloadedFiles.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFile) {
      loadPDF(pdfFile).then(() => {
        // After loading, open the specific tool if applicable
        if (tool === 'text') openTextEditor();
        else if (tool === 'export') openExportImages();
        else if (tool === 'extract') openExtractText();
        else if (tool === 'merge' && preloadedFiles.length > 1) {
          // Merge additional PDFs
          for (let i = 1; i < preloadedFiles.length; i++) {
            if (preloadedFiles[i].type === 'application/pdf' || preloadedFiles[i].name.endsWith('.pdf')) {
              mergePDF(preloadedFiles[i]);
            }
          }
        }
      });
    }
    return;
  }

  // No files provided — trigger file picker via the card's hidden input
  const card = document.querySelector(`.landing-tool-card[data-tool="${tool}"]`);
  if (card) {
    const fileInput = card.querySelector('.card-file-input');
    if (fileInput) {
      fileInput.click();
    }
  }
}

function initDropZone() {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      loadPDF(files[0]);
    } else {
      showToast('Please drop a valid PDF file', 'error');
    }
  });
}

function initGlobalDrop() {
  document.addEventListener('dragover', (e) => {
    if (state.pdfDoc && e.target.closest('.page-grid, .main-content')) {
      e.preventDefault();
    }
  });

  document.addEventListener('drop', (e) => {
    if (state.pdfDoc && e.target.closest('.page-grid, .main-content')) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        mergePDF(files[0]);
      }
    }
  });
}

function initImageUploadDragDrop() {
  const uploadArea = document.getElementById('ipUploadArea');
  if (!uploadArea) return;

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-primary)';
    uploadArea.style.background = 'var(--color-primary-light)';
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '';
    uploadArea.style.background = '';
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    uploadArea.style.background = '';
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      handleImageFiles(files);
    }
  });
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (textEditorModal.style.display === 'flex') {
        closeTextEditor();
        return;
      }
      closePreview();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') &&
        state.selectedPages.size > 0 &&
        !e.target.closest('input, textarea')) {
      e.preventDefault();
      deletePages();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (state.history.past.length > 0) {
        e.preventDefault();
        undo();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
      e.preventDefault();
      redo();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'a' &&
        state.pdfDoc && !e.target.closest('input, textarea, .text-editor-controls')) {
      e.preventDefault();
      selectAllPages();
    }
  });
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

  toast.innerHTML = `${icon}<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// ============================================
// File Upload
// ============================================
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) loadPDF(file);
  event.target.value = '';
}

function handleMergeUpload(event) {
  const file = event.target.files[0];
  if (file) mergePDF(file);
  event.target.value = '';
}

// ============================================
// Undo / Redo System
// ============================================

const MAX_HISTORY = 20;

async function saveSnapshot() {
  if (!state.pdfDoc) return;
  try {
    const bytes = await state.pdfDoc.save();
    state.history.past.push({
      pdfBytes: bytes.slice(0),
      textAnnotations: JSON.parse(JSON.stringify(state.textAnnotations)),
      selectedPages: Array.from(state.selectedPages),
      pageCount: state.pageCount,
      fileName: state.fileName,
      fileSize: state.fileSize,
    });
    // Limit history size
    if (state.history.past.length > MAX_HISTORY) {
      state.history.past.shift();
    }
    // Clear future when new action is taken
    state.history.future = [];
    updateUndoRedoButtons();
  } catch (e) {
    console.error('Failed to save snapshot:', e);
  }
}

async function undo() {
  if (state.history.past.length === 0 || state.isProcessing) return;

  // Save current state to future
  const currentBytes = await state.pdfDoc.save();
  state.history.future.push({
    pdfBytes: currentBytes.slice(0),
    textAnnotations: JSON.parse(JSON.stringify(state.textAnnotations)),
    selectedPages: Array.from(state.selectedPages),
    pageCount: state.pageCount,
    fileName: state.fileName,
    fileSize: state.fileSize,
  });

  // Restore previous state
  const snapshot = state.history.past.pop();
  await restoreSnapshot(snapshot);
  updateUndoRedoButtons();
  showToast('Undo');
}

async function redo() {
  if (state.history.future.length === 0 || state.isProcessing) return;

  // Save current state to past
  const currentBytes = await state.pdfDoc.save();
  state.history.past.push({
    pdfBytes: currentBytes.slice(0),
    textAnnotations: JSON.parse(JSON.stringify(state.textAnnotations)),
    selectedPages: Array.from(state.selectedPages),
    pageCount: state.pageCount,
    fileName: state.fileName,
    fileSize: state.fileSize,
  });

  // Restore next state
  const snapshot = state.history.future.pop();
  await restoreSnapshot(snapshot);
  updateUndoRedoButtons();
  showToast('Redo');
}

async function restoreSnapshot(snapshot) {
  state.isProcessing = true;
  try {
    state.pdfDoc = await PDFDocument.load(snapshot.pdfBytes.slice(0));
    state.textAnnotations = snapshot.textAnnotations;
    state.selectedPages = new Set(snapshot.selectedPages);
    state.pageCount = snapshot.pageCount;
    state.fileName = snapshot.fileName;
    state.fileSize = snapshot.fileSize || '';

    await initPDFjs(snapshot.pdfBytes.slice(0));
    await renderAllThumbnails();
    updateUI();
  } catch (e) {
    console.error('Failed to restore snapshot:', e);
    showToast('Failed to undo/redo', 'error');
  } finally {
    state.isProcessing = false;
  }
}

function updateUndoRedoButtons() {
  if (btnUndo) btnUndo.disabled = state.history.past.length === 0;
  if (btnRedo) btnRedo.disabled = state.history.future.length === 0;
}

// ============================================
// PDF Loading
// ============================================
async function loadPDF(file) {
  if (state.isProcessing) return;
  state.isProcessing = true;
  showLoading(true);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    state.fileName = file.name.replace(/\.pdf$/i, '');
    state.fileSize = formatFileSize(file.size);
    state.textAnnotations = [];
    state.extractedTextCache = {};
    state.history.past = [];
    state.history.future = [];

    state.pdfDoc = await PDFDocument.load(data);
    state.pageCount = state.pdfDoc.getPageCount();

    await initPDFjs(data);

    state.selectedPages.clear();

    // Save initial snapshot
    await saveSnapshot();

    await renderAllThumbnails();
    updateUI();
    await transitionToEditor();

    showToast(`Loaded "${file.name}" (${state.pageCount} page${state.pageCount !== 1 ? 's' : ''})`);
  } catch (err) {
    console.error('Failed to load PDF:', err);
    showError(err.message || 'Could not load this PDF. The file may be corrupted or password-protected.');
  } finally {
    state.isProcessing = false;
    showLoading(false);
  }
}

async function initPDFjs(data) {
  state.pdfBytes = data.slice(0);
  state.pdfjsDoc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
}

async function syncPDFjsFromPDFLib() {
  const pdfBytes = await state.pdfDoc.save();
  state.pdfBytes = pdfBytes;
  state.pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  state.pageCount = state.pdfDoc.getPageCount();
}

// ============================================
// Thumbnail Rendering
// ============================================
async function renderAllThumbnails() {
  pageGrid.innerHTML = '';

  const totalPages = state.pageCount;

  for (let i = 0; i < totalPages; i += 4) {
    const batchEnd = Math.min(i + 4, totalPages);
    const promises = [];
    for (let j = i; j < batchEnd; j++) {
      promises.push(renderThumbnail(j));
    }
    await Promise.all(promises);
  }
}

async function renderThumbnail(pageIndex) {
  try {
    // Remove existing card for this page to avoid duplicates
    const oldCard = pageGrid.querySelector(`[data-page-index="${pageIndex}"]`);
    if (oldCard) oldCard.remove();

    const pdfjsPageNum = pageIndex + 1;
    const page = await state.pdfjsDoc.getPage(pdfjsPageNum);
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });

    const card = createPageCard(pageIndex);
    pageGrid.appendChild(card);

    const canvas = card.querySelector('.page-canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Overlay text annotations on the thumbnail
    renderTextOverlay(card, pageIndex, viewport);

  } catch (err) {
    console.error(`Failed to render page ${pageIndex}:`, err);
  }
}

// --- Text overlay on thumbnails ---
function renderTextOverlay(card, pageIndex, viewport) {
  const annotations = state.textAnnotations.filter(a => a.pageIndex === pageIndex);
  if (annotations.length === 0) return;

  const thumbnail = card.querySelector('.page-thumbnail');

  // Remove any existing overlay
  const oldOverlay = thumbnail.querySelector('.text-overlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'text-overlay';

  for (const ann of annotations) {
    const el = document.createElement('div');
    el.className = 'text-overlay-annotation';
    const canvasX = ann.x * THUMBNAIL_SCALE;
    const canvasY = viewport.height - ann.y * THUMBNAIL_SCALE;
    el.style.left = `${canvasX}px`;
    el.style.top = `${canvasY}px`;
    el.style.fontSize = `${ann.fontSize * THUMBNAIL_SCALE}px`;
    el.style.color = ann.color;
    el.textContent = ann.text;
    overlay.appendChild(el);
  }

  thumbnail.appendChild(overlay);
}

// ============================================
// Page Card Creation
// ============================================
function createPageCard(pageIndex) {
  const card = document.createElement('div');
  card.className = 'page-card';
  card.dataset.pageIndex = pageIndex;

  if (state.selectedPages.has(pageIndex)) {
    card.classList.add('selected');
  }

  const pdfPage = state.pdfDoc.getPage(pageIndex);
  const rotationAngle = pdfPage.getRotation().angle;

  card.innerHTML = `
    <div class="page-checkbox">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="rotation-badge" id="rotationBadge-${pageIndex}"${rotationAngle ? ` style="display:block"` : ''}>${rotationAngle ? `${rotationAngle}\u00B0` : ''}</div>
    <div class="page-thumbnail">
      <canvas class="page-canvas"></canvas>
    </div>
    <div class="page-card-footer">
      <span class="page-number">Page ${pageIndex + 1}</span>
      <div class="page-actions">
        <button class="page-action-btn" title="Move up" onclick="movePage(${pageIndex}, -1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button class="page-action-btn" title="Move down" onclick="movePage(${pageIndex}, 1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.page-action-btn')) return;
    togglePageSelection(pageIndex);
  });

  card.addEventListener('dblclick', () => {
    openPreview(pageIndex);
  });

  setupDragDrop(card, pageIndex);

  return card;
}

function setupDragDrop(card, pageIndex) {
  card.draggable = true;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', pageIndex);
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    $$('.page-card').forEach(c => c.classList.remove('drag-over-target'));
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    card.classList.add('drag-over-target');
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over-target');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over-target');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIndex = pageIndex;
    if (fromIndex !== toIndex) {
      reorderPages(fromIndex, toIndex);
    }
  });
}

// ============================================
// Selection
// ============================================
function togglePageSelection(pageIndex) {
  if (state.selectedPages.has(pageIndex)) {
    state.selectedPages.delete(pageIndex);
  } else {
    state.selectedPages.add(pageIndex);
  }

  const card = pageGrid.querySelector(`[data-page-index="${pageIndex}"]`);
  if (card) {
    card.classList.toggle('selected', state.selectedPages.has(pageIndex));
  }
  updateToolbarButtons();
}

function selectAllPages() {
  const allSelected = state.selectedPages.size === state.pageCount;

  if (allSelected) {
    state.selectedPages.clear();
  } else {
    state.selectedPages = new Set(Array.from({ length: state.pageCount }, (_, i) => i));
  }

  for (let i = 0; i < state.pageCount; i++) {
    const card = pageGrid.querySelector(`[data-page-index="${i}"]`);
    if (card) {
      card.classList.toggle('selected', state.selectedPages.has(i));
    }
  }
  updateToolbarButtons();
}

// ============================================
// Rotation
// ============================================
async function rotatePages(angle) {
  if (state.selectedPages.size === 0) {
    showToast('Select pages to rotate', 'error');
    return;
  }

  await saveSnapshot();

  for (const pageIndex of state.selectedPages) {
    const pdfPage = state.pdfDoc.getPage(pageIndex);
    const currentRotation = pdfPage.getRotation().angle;
    pdfPage.setRotation(degrees(currentRotation + angle));
  }

  await syncPDFjsFromPDFLib();
  await renderAllThumbnails();

  const action = angle > 0 ? 'clockwise' : 'counter-clockwise';
  showToast(`Rotated ${state.selectedPages.size} page${state.selectedPages.size !== 1 ? 's' : ''} ${action}`);
}

// ============================================
// Delete Pages
// ============================================
async function deletePages() {
  if (state.selectedPages.size === 0) {
    showToast('Select pages to delete', 'error');
    return;
  }

  const count = state.selectedPages.size;

  // Show confirmation for delete
  const confirmed = await confirmDelete(count);
  if (!confirmed) return;

  await saveSnapshot();

  const indicesToRemove = Array.from(state.selectedPages).sort((a, b) => b - a);

  for (const pageIndex of indicesToRemove) {
    state.pdfDoc.removePage(pageIndex);
  }

  // Update text annotations: remove ones on deleted pages, shift indices for others
  const removedSet = new Set(indicesToRemove);
  state.textAnnotations = state.textAnnotations.filter(ann => !removedSet.has(ann.pageIndex));
  for (const ann of state.textAnnotations) {
    let shift = 0;
    for (const removedIdx of indicesToRemove) {
      if (ann.pageIndex > removedIdx) shift--;
    }
    ann.pageIndex += shift;
  }

  // Clear extracted text cache for removed pages
  for (const idx of indicesToRemove) {
    delete state.extractedTextCache[idx];
  }

  state.selectedPages.clear();

  await syncPDFjsFromPDFLib();
  await renderAllThumbnails();
  updateUI();

  showToast(`Deleted ${count} page${count !== 1 ? 's' : ''}`);
}

// ============================================
// Reorder Pages
// ============================================
async function movePage(fromIndex, direction) {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= state.pageCount) return;
  await reorderPages(fromIndex, toIndex);
}

async function reorderPages(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;

  const pageIndices = Array.from({ length: state.pageCount }, (_, i) => i);
  const [moved] = pageIndices.splice(fromIndex, 1);
  pageIndices.splice(toIndex, 0, moved);

  await saveSnapshot();

  // Build new document with pages in new order
  const newDoc = await PDFDocument.create();
  const pagesToCopy = await newDoc.copyPages(state.pdfDoc, pageIndices);
  for (const page of pagesToCopy) {
    newDoc.addPage(page);
  }

  state.pdfDoc = newDoc;

  // Update selection (shift indices accordingly)
  const newSelected = new Set();
  for (const idx of state.selectedPages) {
    if (idx === fromIndex) {
      newSelected.add(toIndex);
    } else if (fromIndex < idx && idx <= toIndex) {
      newSelected.add(idx - 1);
    } else if (toIndex <= idx && idx < fromIndex) {
      newSelected.add(idx + 1);
    } else {
      newSelected.add(idx);
    }
  }
  state.selectedPages = newSelected;

  // Update text annotation page indices to match new order
  const indexMap = {};
  pageIndices.forEach((oldIdx, newIdx) => {
    indexMap[oldIdx] = newIdx;
  });
  for (const ann of state.textAnnotations) {
    if (indexMap[ann.pageIndex] !== undefined) {
      ann.pageIndex = indexMap[ann.pageIndex];
    }
  }

  // Update extracted text cache indices
  const newCache = {};
  for (const [oldIdx, items] of Object.entries(state.extractedTextCache)) {
    const newIdx = indexMap[parseInt(oldIdx)];
    if (newIdx !== undefined) {
      newCache[newIdx] = items;
    }
  }
  state.extractedTextCache = newCache;

  await syncPDFjsFromPDFLib();
  await renderAllThumbnails();
  updateUI();
}

// ============================================
// Merge PDF
// ============================================
async function mergePDF(file) {
  if (!state.pdfDoc) {
    loadPDF(file);
    return;
  }

  if (state.isProcessing) return;
  state.isProcessing = true;
  showLoading(true);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const mergeDoc = await PDFDocument.load(new Uint8Array(arrayBuffer));
    const mergePageCount = mergeDoc.getPageCount();

    await saveSnapshot();

    const copiedPages = await state.pdfDoc.copyPages(mergeDoc, mergeDoc.getPageIndices());
    for (const page of copiedPages) {
      state.pdfDoc.addPage(page);
    }

    await syncPDFjsFromPDFLib();
    await renderAllThumbnails();
    updateUI();

    showToast(`Merged "${file.name}" (${mergePageCount} page${mergePageCount !== 1 ? 's' : ''})`);
  } catch (err) {
    console.error('Failed to merge PDF:', err);
    showToast('Failed to merge PDF. The file may be corrupted.', 'error');
  } finally {
    state.isProcessing = false;
    showLoading(false);
  }
}

// ============================================
// Preview Modal
// ============================================
async function openPreview(pageIndex) {
  try {
    const pdfjsPageNum = pageIndex + 1;
    const page = await state.pdfjsDoc.getPage(pdfjsPageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    previewTitle.textContent = `Page ${pageIndex + 1}${state.fileName ? ` \u2014 ${state.fileName}.pdf` : ''}`;

    previewBody.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    previewBody.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    previewModal.style.display = 'flex';
  } catch (err) {
    console.error('Failed to open preview:', err);
    showToast('Could not render page preview', 'error');
  }
}

function closePreview() {
  previewModal.style.display = 'none';
  previewBody.innerHTML = '';
}

// ============================================
// Text Editor
// ============================================

// --- Open text editor ---
function openTextEditor() {
  let targetPage;

  // Use the first selected page, or the first page if nothing selected
  if (state.selectedPages.size > 0) {
    targetPage = Array.from(state.selectedPages)[0];
  } else {
    targetPage = 0;
  }

  if (targetPage === undefined || targetPage >= state.pageCount) {
    showToast('No page available for editing', 'error');
    return;
  }

  textEditorTitle.textContent = `Edit Text \u2014 Page ${targetPage + 1}`;

  // Clear form
  teText.value = '';
  teFontSize.value = 16;
  teColor.value = '#000000';
  teX.value = 50;
  teY.value = 50;

  // Store which page we're editing
  textEditorCanvas.dataset.pageIndex = targetPage;
  textEditorCanvas.dataset.editingId = '';
  textEditorCanvas.dataset.scale = TEXT_EDITOR_SCALE;

  // Update annotations list
  updateTextAnnotationsList(targetPage);

  // Render page preview and analyze text (await both to avoid race)
  await Promise.all([
    renderTextEditorPreview(targetPage),
    analyzePDFText(targetPage),
  ]);

  textEditorModal.style.display = 'flex';
}

// --- Close text editor ---
function closeTextEditor() {
  textEditorModal.style.display = 'none';
  textEditorCanvas.dataset.editingId = '';
  textEditorCanvas.width = 0;
  textEditorCanvas.height = 0;
}

// --- Render preview in text editor ---
async function renderTextEditorPreview(pageIndex) {
  try {
    const pdfjsPageNum = pageIndex + 1;
    const page = await state.pdfjsDoc.getPage(pdfjsPageNum);
    const viewport = page.getViewport({ scale: TEXT_EDITOR_SCALE });

    textEditorCanvas.width = viewport.width;
    textEditorCanvas.height = viewport.height;

    const ctx = textEditorCanvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Draw annotation markers (user-added + extracted text)
    drawAnnotationMarkers(pageIndex);

    // Set up click handler for placing new text
    textEditorCanvas.onclick = handleTextEditorCanvasClick;

  } catch (err) {
    console.error('Failed to render text editor preview:', err);
    showToast('Could not render page preview', 'error');
  }
}

// --- Analyze existing PDF text ---
async function analyzePDFText(pageIndex) {
  if (!state.pdfjsDoc) return;

  // If already cached, use cache
  if (state.extractedTextCache[pageIndex]) {
    renderAnalyzedList(pageIndex);
    return;
  }

  try {
    if (teAnalyzeStatus) {
      teAnalyzeStatus.textContent = 'Analyzing text...';
      teAnalyzeStatus.style.display = 'block';
    }

    const pdfjsPageNum = pageIndex + 1;
    const page = await state.pdfjsDoc.getPage(pdfjsPageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    // Convert text items to our format with proper coordinates
    const items = [];
    for (const item of textContent.items) {
      // item.transform is [scaleX, skewX, skewY, scaleY, translateX, translateY]
      // In PDF coordinate system (origin at bottom-left)
      const x = item.transform[4];
      const y = item.transform[5];
      // Estimate font size from transform (scaleY)
      const fontSize = Math.round(Math.abs(item.transform[3]) * 100) / 100 || 12;
      
      items.push({
        text: item.str,
        x: x,
        y: y,
        fontSize: fontSize,
        width: item.width || 0,
        height: item.height || fontSize * 0.7,
        fontName: item.fontName || 'Helvetica',
      });
    }

    state.extractedTextCache[pageIndex] = items;

    if (teAnalyzeStatus) {
      teAnalyzeStatus.textContent = `Found ${items.length} text element${items.length !== 1 ? 's' : ''}`;
      setTimeout(() => {
        if (teAnalyzeStatus) teAnalyzeStatus.style.display = 'none';
      }, 2000);
    }

    // Re-draw markers with extracted text now available
    drawAnnotationMarkers(pageIndex);
    renderAnalyzedList(pageIndex);

  } catch (err) {
    console.error('Failed to analyze PDF text:', err);
    if (teAnalyzeStatus) {
      teAnalyzeStatus.textContent = 'Could not extract text from this PDF';
      teAnalyzeStatus.style.display = 'block';
    }
  }
}

// --- Render analyzed text list in controls panel ---
function renderAnalyzedList(pageIndex) {
  if (!teAnalyzedSection || !teAnalyzedList) return;

  const items = state.extractedTextCache[pageIndex];
  if (!items || items.length === 0) {
    teAnalyzedSection.style.display = 'none';
    return;
  }

  teAnalyzedSection.style.display = 'flex';
  teAnalyzedList.innerHTML = '';

  for (let i = 0; i < items.length; i++) {
    const item = document.createElement('div');
    item.className = 'te-analyzed-item';
    item.dataset.analyzedIndex = i;

    const textSpan = document.createElement('span');
    textSpan.className = 'te-analyzed-text';
    textSpan.textContent = items[i].text || '(empty)';

    const btn = document.createElement('button');
    btn.className = 'te-annotation-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 3 21 7 7 21 3 21 3 17 17 3"/></svg>';
    btn.title = 'Edit this text';
    btn.onclick = (e) => {
      e.stopPropagation();
      loadAnalyzedIntoForm(i, pageIndex);
    };

    item.appendChild(textSpan);
    item.appendChild(btn);
    teAnalyzedList.appendChild(item);
  }
}

// --- Load analyzed text item into the annotation form ---
function loadAnalyzedIntoForm(analyzedIndex, pageIndex) {
  const items = state.extractedTextCache[pageIndex];
  if (!items || !items[analyzedIndex]) return;

  const item = items[analyzedIndex];
  
  // Check if this analyzed text has already been turned into an annotation
  const existingAnn = state.textAnnotations.find(
    a => a.pageIndex === pageIndex && 
         a._source === 'analyzed' && 
         a._analyzedIndex === analyzedIndex
  );

  if (existingAnn) {
    // Edit existing annotation
    loadAnnotationIntoForm(existingAnn.id);
    return;
  }

  // Load values into form for creating a new annotation
  teText.value = item.text;
  teFontSize.value = Math.round(item.fontSize) || 16;
  teX.value = Math.round(item.x);
  teY.value = Math.round(item.y);
  
  // Mark as editing a new annotation from analyzed text
  textEditorCanvas.dataset.editingId = '';
  teText.focus();
  
  // Show hint only once per session
  if (!window._analyzeHintShown) {
    window._analyzeHintShown = true;
    showToast('Edit the text and click "Add Text" to place it');
  }
}

// --- Draw annotation and extracted text markers on the canvas wrapper ---
function drawAnnotationMarkers(pageIndex) {
  // Remove all existing markers
  const existingMarkers = textEditorCanvasWrapper.querySelectorAll('.te-marker');
  existingMarkers.forEach(m => m.remove());

  // Draw user-added annotation markers (blue dots with labels)
  const annotations = state.textAnnotations.filter(a => a.pageIndex === pageIndex);
  for (const ann of annotations) {
    createMarker(ann, 'user', pageIndex);
  }

  // Draw extracted text markers (green, semi-transparent highlights with text)
  const extractedItems = state.extractedTextCache[pageIndex] || [];
  for (let i = 0; i < extractedItems.length; i++) {
    const item = extractedItems[i];
    // Skip if this extracted item already has a user annotation
    const hasAnnotation = annotations.some(
      a => a._source === 'analyzed' && a._analyzedIndex === i
    );
    createExtractedMarker(item, i, hasAnnotation);
  }
}

// --- Create a user annotation marker (blue dot with label) ---
function createMarker(ann, type, pageIndex) {
  const marker = document.createElement('div');
  marker.className = `te-marker te-marker-user`;
  marker.dataset.annotationId = ann.id;

  const canvasX = ann.x * TEXT_EDITOR_SCALE;
  const canvasY = textEditorCanvas.height - ann.y * TEXT_EDITOR_SCALE;

  marker.style.left = `${canvasX}px`;
  marker.style.top = `${canvasY}px`;

  // Label showing the text
  const label = document.createElement('span');
  label.className = 'te-marker-label';
  label.textContent = ann.text;

  const colorDot = document.createElement('span');
  colorDot.className = 'te-marker-dot';
  colorDot.style.background = ann.color;

  marker.appendChild(colorDot);
  marker.appendChild(label);

  // Click to edit
  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    loadAnnotationIntoForm(ann.id);
  });

  // Make draggable
  makeMarkerDraggable(marker, ann, 'user', pageIndex);

  textEditorCanvasWrapper.appendChild(marker);
}

// --- Create an extracted text marker (green highlight box) ---
function createExtractedMarker(item, index, hasAnnotation) {
  const marker = document.createElement('div');
  marker.className = `te-marker te-marker-extracted${hasAnnotation ? ' te-marker-muted' : ''}`;
  marker.dataset.extractedIndex = index;

  const canvasX = item.x * TEXT_EDITOR_SCALE;
  const canvasY = textEditorCanvas.height - item.y * TEXT_EDITOR_SCALE;
  const canvasW = item.width * TEXT_EDITOR_SCALE;
  const canvasH = (item.fontSize * 1.2) * TEXT_EDITOR_SCALE;

  marker.style.left = `${canvasX}px`;
  marker.style.top = `${canvasY - canvasH}px`;
  marker.style.width = `${Math.max(canvasW, 20)}px`;
  marker.style.height = `${canvasH}px`;

  // Show the actual text
  marker.textContent = item.text;
  marker.title = `${item.text} (x:${Math.round(item.x)}, y:${Math.round(item.y)})`;

  // Click to create annotation from this text
  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hasAnnotation) {
      loadAnalyzedIntoForm(index, parseInt(textEditorCanvas.dataset.pageIndex));
    }
  });

  if (!hasAnnotation) {
    marker.style.cursor = 'pointer';
  }

  textEditorCanvasWrapper.appendChild(marker);
}

// --- Make a marker draggable via mouse events ---
function makeMarkerDraggable(marker, ann, type, pageIndex) {
  let isDragging = false;
  let startX, startY;
  let origX, origY;

  marker.addEventListener('mousedown', (e) => {
    if (e.target.closest('.te-marker-label, .te-marker-dot')) {
      return;
    }
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = ann.x;
    origY = ann.y;
    marker.classList.add('te-marker-dragging');
    // Clear editing state so Add Text creates fresh
    textEditorCanvas.dataset.editingId = '';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = (e.clientX - startX) / TEXT_EDITOR_SCALE;
    const dy = (e.clientY - startY) / TEXT_EDITOR_SCALE;

    // Update position in PDF coordinates (flip Y)
    const newX = Math.max(0, origX + dx);
    const newY = Math.max(0, origY - dy); // Flip Y because canvas Y is inverted

    teX.value = Math.round(newX);
    teY.value = Math.round(newY);

    // Live-update marker position
    const canvasX = newX * TEXT_EDITOR_SCALE;
    const canvasY = textEditorCanvas.height - newY * TEXT_EDITOR_SCALE;
    marker.style.left = `${canvasX}px`;
    marker.style.top = `${canvasY}px`;
  });

  document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    marker.classList.remove('te-marker-dragging');
    
    // Update the annotation with new position
    const newX = parseFloat(teX.value);
    const newY = parseFloat(teY.value);
    if (!isNaN(newX) && !isNaN(newY) && (newX !== origX || newY !== origY)) {
      ann.x = newX;
      ann.y = newY;
      // Save snapshot for undo
      saveSnapshot();
    }
  });
}

// --- Handle click on text editor canvas (add new text) ---
function handleTextEditorCanvasClick(e) {
  const rect = textEditorCanvas.getBoundingClientRect();
  const scaleX = textEditorCanvas.width / rect.width;
  const scaleY = textEditorCanvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  // Convert to PDF coordinates (flip Y)
  const pdfX = Math.round(clickX / TEXT_EDITOR_SCALE);
  const pdfY = Math.round((textEditorCanvas.height - clickY) / TEXT_EDITOR_SCALE);

  teX.value = Math.max(0, pdfX);
  teY.value = Math.max(0, pdfY);

  // Focus the text input
  teText.focus();
}

// --- Add text annotation ---
async function addTextAnnotation() {
  const pageIndex = parseInt(textEditorCanvas.dataset.pageIndex, 10);
  const text = teText.value.trim();
  const fontSize = parseInt(teFontSize.value, 10);
  const color = teColor.value;
  const x = parseFloat(teX.value);
  const y = parseFloat(teY.value);
  const editingId = textEditorCanvas.dataset.editingId;

  if (!text) {
    showToast('Please enter some text', 'error');
    return;
  }

  if (isNaN(x) || isNaN(y)) {
    showToast('Please set a position (click on the page or enter X/Y)', 'error');
    return;
  }

  await saveSnapshot();

  if (editingId) {
    // Update existing annotation
    const ann = state.textAnnotations.find(a => a.id === editingId);
    if (ann) {
      ann.text = text;
      ann.fontSize = fontSize;
      ann.color = color;
      ann.x = x;
      ann.y = y;
    }
    textEditorCanvas.dataset.editingId = '';
  } else {
    // Add new annotation
    state.textAnnotations.push({
      id: generateId(),
      pageIndex,
      text,
      x,
      y,
      fontSize,
      color,
    });
  }

  // Clear form
  teText.value = '';
  teFontSize.value = 16;
  teColor.value = '#000000';

  // Re-render the preview with markers
  const targetPage = parseInt(textEditorCanvas.dataset.pageIndex, 10);
  renderTextEditorPreview(targetPage);
  updateTextAnnotationsList(targetPage);

  // Re-render page thumbnails to show annotation overlays
  renderThumbnail(targetPage);

  showToast(editingId ? 'Text updated' : 'Text added');
}

// --- Load annotation into form for editing ---
function loadAnnotationIntoForm(id) {
  const ann = state.textAnnotations.find(a => a.id === id);
  if (!ann) return;

  teText.value = ann.text;
  teFontSize.value = ann.fontSize;
  teColor.value = ann.color;
  teX.value = ann.x;
  teY.value = ann.y;

  textEditorCanvas.dataset.editingId = ann.id;
  teText.focus();
}

// --- Delete text annotation ---
async function deleteTextAnnotation(id) {
  await saveSnapshot();

  state.textAnnotations = state.textAnnotations.filter(a => a.id !== id);

  const pageIndex = parseInt(textEditorCanvas.dataset.pageIndex, 10);
  renderTextEditorPreview(pageIndex);
  updateTextAnnotationsList(pageIndex);
  renderThumbnail(pageIndex);

  if (textEditorCanvas.dataset.editingId === id) {
    textEditorCanvas.dataset.editingId = '';
    teText.value = '';
  }

  showToast('Text deleted');
}

// --- Update the annotations list in the text editor ---
function updateTextAnnotationsList(pageIndex) {
  const annotations = state.textAnnotations.filter(a => a.pageIndex === pageIndex);

  if (annotations.length === 0) {
    teAnnotationsSection.style.display = 'none';
    return;
  }

  teAnnotationsSection.style.display = 'flex';
  teAnnotationsList.innerHTML = '';

  for (const ann of annotations) {
    const item = document.createElement('div');
    item.className = 'te-annotation-item';

    const colorDot = document.createElement('span');
    colorDot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${ann.color};flex-shrink:0;`;

    const textSpan = document.createElement('span');
    textSpan.className = 'te-annotation-text';
    textSpan.textContent = ann.text;

    const actions = document.createElement('div');
    actions.className = 'te-annotation-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'te-annotation-btn';
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 3 21 7 7 21 3 21 3 17 17 3"/></svg>';
    editBtn.title = 'Edit';
    editBtn.onclick = () => loadAnnotationIntoForm(ann.id);

    const delBtn = document.createElement('button');
    delBtn.className = 'te-annotation-btn te-annotation-btn-danger';
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    delBtn.title = 'Delete';
    delBtn.onclick = () => deleteTextAnnotation(ann.id);

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(colorDot);
    item.appendChild(textSpan);
    item.appendChild(actions);

    teAnnotationsList.appendChild(item);
  }
}

// --- Generate unique ID ---
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ============================================
// Download
// ============================================
async function downloadPDF() {
  if (!state.pdfDoc) return;

  try {
    // Create a copy of the PDF to embed text annotations (don't modify the original)
    const outputBytes = await state.pdfDoc.save();
    const outputDoc = await PDFDocument.load(outputBytes);

    // Embed all text annotations into the output document
    if (state.textAnnotations.length > 0) {
      const font = await outputDoc.embedFont(StandardFonts.Helvetica);

      for (const ann of state.textAnnotations) {
        if (ann.pageIndex >= outputDoc.getPageCount()) continue;

        const page = outputDoc.getPage(ann.pageIndex);
        const hex = ann.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        page.drawText(ann.text, {
          x: ann.x,
          y: ann.y,
          size: ann.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }
    }

    const pdfBytes = await outputDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.fileName || 'edited'}-edited.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('PDF downloaded successfully!');
  } catch (err) {
    console.error('Failed to download PDF:', err);
    showToast('Failed to save PDF', 'error');
  }
}

// ============================================
// Reset
// ============================================
function resetState() {
  state.pdfBytes = null;
  state.pdfDoc = null;
  state.pdfjsDoc = null;
  state.pageCount = 0;
  state.selectedPages.clear();
  state.fileName = '';
  state.isProcessing = false;
  state.textAnnotations = [];
  state.extractedTextCache = {};
  state.fileSize = '';
  state.history.past = [];
  state.history.future = [];

  // Animated transition back to landing
  const mainContent = $('#mainContent');
  mainContent.classList.add('view-transitioning');

  setTimeout(() => {
    dropZone.style.display = '';
    landingTools.style.display = 'flex';
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    pageGrid.style.display = 'none';
    pageGrid.innerHTML = '';
    toolbar.style.display = 'none';
    toolbar.classList.remove('view-enter');
    fileInfoBar.style.display = 'none';
    fileInfoBar.classList.remove('view-enter');
    pageGrid.classList.remove('view-enter');
    downloadBtn.style.display = 'none';
    pageCount.style.display = 'none';

    mainContent.classList.remove('view-transitioning');
    triggerLandingEntrance();
  }, 300);

  updateUndoRedoButtons();
  closeTextEditor();
}

// ============================================
// UI Updates
// ============================================
function updateUI() {
  if (state.pageCount > 0) {
    dropZone.style.display = 'none';
    landingTools.style.display = 'none';
    toolbar.style.display = 'flex';
    fileInfoBar.style.display = 'flex';
    downloadBtn.style.display = 'inline-flex';
    pageCount.style.display = 'inline';
    pageCount.textContent = `${state.pageCount} page${state.pageCount !== 1 ? 's' : ''}`;
    pageGrid.style.display = 'grid';
    errorState.style.display = 'none';

    // Update file info bar
    if (fileInfoName) fileInfoName.textContent = state.fileName || 'document';
    if (fileInfoDetails) {
      const details = `${state.pageCount} page${state.pageCount !== 1 ? 's' : ''}`;
      fileInfoDetails.textContent = state.fileSize ? `${details} \u2014 ${state.fileSize}` : details;
    }
  }
  updateToolbarButtons();
  updateUndoRedoButtons();
}

function updateToolbarButtons() {
  const hasSelection = state.selectedPages.size > 0;
  const allSelected = state.pageCount > 0 && state.selectedPages.size === state.pageCount;

  const selectAllBtn = $('#selectAllBtn');
  const deleteBtn = $('#deleteBtn');
  const rotateCWBtn = $('#rotateCWBtn');
  const rotateCCWBtn = $('#rotateCCWBtn');
  const textBtn = $('#textBtn');

  if (selectAllBtn) {
    selectAllBtn.innerHTML = allSelected
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="20 6 9 17 4 12"/></svg><span>Deselect All</span>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="12" x2="15" y2="12"/></svg><span>Select All</span>`;
  }

  const btnOpacity = hasSelection ? '1' : '0.4';
  if (deleteBtn) deleteBtn.style.opacity = btnOpacity;
  if (rotateCWBtn) rotateCWBtn.style.opacity = btnOpacity;
  if (rotateCCWBtn) rotateCCWBtn.style.opacity = btnOpacity;
  if (textBtn) textBtn.style.opacity = state.pageCount > 0 ? '1' : '0.4';

  const exportImagesBtn = $('#exportImagesBtn');
  const extractTextBtn = $('#extractTextBtn');
  if (exportImagesBtn) exportImagesBtn.style.opacity = state.pageCount > 0 ? '1' : '0.4';
  if (extractTextBtn) extractTextBtn.style.opacity = state.pageCount > 0 ? '1' : '0.4';
}

// ============================================
// Helpers
// ============================================

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function confirmDelete(count) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '400';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width:400px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-title">Delete ${count} page${count !== 1 ? 's' : ''}?</span>
          <button class="modal-close" id="confirmClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="flex-direction:column;gap:16px;text-align:center;padding:24px;">
          <p style="color:var(--color-text-secondary);font-size:0.9rem;">
            This action cannot be undone. Are you sure you want to delete ${count} page${count !== 1 ? 's' : ''}?
          </p>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="btn" id="confirmCancel">Cancel</button>
            <button class="btn btn-danger" id="confirmOk" style="background:var(--color-danger);color:white;border-color:var(--color-danger);">Delete</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve(false);
    };
    const confirm = () => {
      overlay.remove();
      resolve(true);
    };

    overlay.querySelector('#confirmClose').onclick = close;
    overlay.querySelector('#confirmCancel').onclick = close;
    overlay.querySelector('#confirmOk').onclick = confirm;
    overlay.onclick = close;

    // Keyboard handler
    const keyHandler = (e) => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', keyHandler); }
      if (e.key === 'Enter') { confirm(); document.removeEventListener('keydown', keyHandler); }
    };
    document.addEventListener('keydown', keyHandler);
  });
}

function showLoading(show) {
  loadingState.style.display = show ? 'flex' : 'none';
  if (show) {
    dropZone.style.display = 'none';
    errorState.style.display = 'none';
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorState.style.display = 'flex';
  dropZone.style.display = 'none';
  loadingState.style.display = 'none';
  pageGrid.style.display = 'none';
}

// ============================================
// PDF to Images (Export Images)
// ============================================

function openExportImages() {
  if (!state.pdfDoc) {
    showToast('Open a PDF first', 'error');
    return;
  }

  exportImagesTitle.textContent = `Export PDF Pages as Images \u2014 ${state.fileName || 'document'}.pdf (${state.pageCount} pages)`;
  exportImagesModal.style.display = 'flex';
}

function closeExportImages() {
  exportImagesModal.style.display = 'none';
}

async function exportAllAsImages() {
  if (!state.pdfjsDoc) {
    showToast('No PDF loaded', 'error');
    return;
  }

  const format = eiFormat.value;
  const scale = parseFloat(eiScale.value);
  const totalPages = state.pageCount;
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';

  showToast(`Exporting ${totalPages} page${totalPages !== 1 ? 's' : ''} as ${format.toUpperCase()}...`);
  closeExportImages();

  try {
    const zip = new JSZip();

    for (let i = 0; i < totalPages; i++) {
      const page = await state.pdfjsDoc.getPage(i + 1);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
      const fileName = `page-${String(i + 1).padStart(3, '0')}.${ext}`;
      zip.file(fileName, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.fileName || 'document'}-images.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`Exported ${totalPages} page${totalPages !== 1 ? 's' : ''} as ${format.toUpperCase()} (ZIP)`);
  } catch (err) {
    console.error('Failed to export images:', err);
    showToast('Failed to export images', 'error');
  }
}

// ============================================
// Images to PDF
// ============================================

function openImagesToPDF() {
  ipState.files = [];
  ipGrid.innerHTML = '';
  ipConvertBtn.disabled = true;
  imagesToPDFModal.style.display = 'flex';
}

function closeImagesToPDF() {
  imagesToPDFModal.style.display = 'none';
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  handleImageFiles(files);
  event.target.value = '';
}

function handleImageFiles(files) {
  if (files.length === 0) return;

  let loaded = 0;
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        ipState.files.push({
          name: file.name,
          dataUrl: e.target.result,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        renderIPGrid();
        ipConvertBtn.disabled = false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function renderIPGrid() {
  ipGrid.innerHTML = '';

  for (let i = 0; i < ipState.files.length; i++) {
    const item = document.createElement('div');
    item.className = 'ip-grid-item';
    item.draggable = true;

    const img = document.createElement('img');
    img.src = ipState.files[i].dataUrl;
    img.alt = ipState.files[i].name;

    const order = document.createElement('span');
    order.className = 'ip-order';
    order.textContent = i + 1;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ip-remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove';
    removeBtn.onclick = () => {
      ipState.files.splice(i, 1);
      renderIPGrid();
      ipConvertBtn.disabled = ipState.files.length === 0;
    };

    // Drag and drop reorder
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', i);
      item.style.opacity = '0.4';
    });

    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      $$('.ip-grid-item').forEach(el => el.style.borderColor = '');
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      item.style.borderColor = 'var(--color-primary)';
    });

    item.addEventListener('dragleave', () => {
      item.style.borderColor = '';
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.style.borderColor = '';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = i;
      if (fromIdx !== toIdx) {
        const [moved] = ipState.files.splice(fromIdx, 1);
        ipState.files.splice(toIdx, 0, moved);
        renderIPGrid();
      }
    });

    item.appendChild(img);
    item.appendChild(order);
    item.appendChild(removeBtn);
    ipGrid.appendChild(item);
  }
}

async function convertImagesToPDF() {
  if (ipState.files.length === 0) {
    showToast('Add at least one image', 'error');
    return;
  }

  closeImagesToPDF();
  showToast('Creating PDF...');

  try {
    const pdfDoc = await PDFDocument.create();
    const pageSizeOption = ipPageSize.value;
    const orientationOption = ipOrientation.value;

    for (const imgData of ipState.files) {
      let image;

      // Detect image type from data URL
      if (imgData.dataUrl.startsWith('data:image/png')) {
        image = await pdfDoc.embedPng(imgData.dataUrl);
      } else if (imgData.dataUrl.startsWith('data:image/jpeg') || imgData.dataUrl.startsWith('data:image/jpg')) {
        image = await pdfDoc.embedJpg(imgData.dataUrl);
      } else {
        // For unsupported types (WebP, BMP, GIF), convert via canvas to PNG
        const canvas = document.createElement('canvas');
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imgData.dataUrl;
        });
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const pngDataUrl = canvas.toDataURL('image/png');
        image = await pdfDoc.embedPng(pngDataUrl);
      }

      const imgWidth = image.width;
      const imgHeight = image.height;
      const aspectRatio = imgWidth / imgHeight;

      // Determine page dimensions
      let pageWidth, pageHeight;

      if (pageSizeOption === 'auto') {
        pageWidth = imgWidth;
        pageHeight = imgHeight;
      } else {
        const sizes = {
          'A4': [595.28, 841.89],
          'Letter': [612, 792],
        };
        [pageWidth, pageHeight] = sizes[pageSizeOption] || sizes['A4'];
      }

      // Apply orientation
      if (orientationOption === 'portrait' && pageWidth > pageHeight) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      } else if (orientationOption === 'landscape' && pageHeight > pageWidth) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      } else if (orientationOption === 'auto' && pageSizeOption !== 'auto') {
        // Auto-orient: match image aspect ratio
        const pageAspect = pageWidth / pageHeight;
        if ((aspectRatio > 1 && pageAspect < 1) || (aspectRatio < 1 && pageAspect > 1)) {
          [pageWidth, pageHeight] = [pageHeight, pageWidth];
        }
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Scale image to fit the page
      const maxW = pageWidth - 40; // 20pt margins
      const maxH = pageHeight - 40;
      const scale = Math.min(maxW / imgWidth, maxH / imgHeight, 1);

      const drawW = imgWidth * scale;
      const drawH = imgHeight * scale;
      const drawX = (pageWidth - drawW) / 2;
      const drawY = (pageHeight - drawH) / 2;

      page.drawImage(image, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'images-converted.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`Created PDF with ${ipState.files.length} image${ipState.files.length !== 1 ? 's' : ''}`);
  } catch (err) {
    console.error('Failed to create PDF from images:', err);
    showToast('Failed to create PDF from images', 'error');
  }

  ipState.files = [];
}

// ============================================
// PDF to Text (Extract Text)
// ============================================

async function openExtractText() {
  if (!state.pdfjsDoc) {
    showToast('Open a PDF first', 'error');
    return;
  }

  extractTextModal.style.display = 'flex';
  extractedText.value = 'Extracting text...';

  try {
    const totalPages = state.pageCount;
    let allText = '';

    for (let i = 0; i < totalPages; i++) {
      const page = await state.pdfjsDoc.getPage(i + 1);
      const textContent = await page.getTextContent();

      if (totalPages > 1) {
        allText += `--- Page ${i + 1} ---\n\n`;
      }

      let lastY = null;
      let prevX = null;
      let line = '';

      for (const item of textContent.items) {
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];

        if (lastY !== null && Math.abs(y - lastY) > 5) {
          // New line
          allText += line.trimEnd() + '\n';
          line = '';
          prevX = null;
        } else if (prevX !== null && x > prevX + 10) {
          // Space between words
          line += ' ';
        }

        line += item.str;
        lastY = y;
        prevX = x;
      }

      if (line.trimEnd()) {
        allText += line.trimEnd() + '\n';
      }

      allText += '\n';
    }

    extractedText.value = allText.trimEnd() || '(No text found in this PDF)';
  } catch (err) {
    console.error('Failed to extract text:', err);
    extractedText.value = 'Failed to extract text. The PDF may contain scanned images instead of selectable text.';
  }
}

function closeExtractText() {
  extractTextModal.style.display = 'none';
  extractedText.value = '';
}

async function copyExtractedText() {
  const text = extractedText.value;
  if (!text || text === 'Extracting text...') {
    showToast('No text to copy', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('Text copied to clipboard');
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Text copied to clipboard');
  }
}

function downloadExtractedText() {
  const text = extractedText.value;
  if (!text || text === 'Extracting text...') {
    showToast('No text to download', 'error');
    return;
  }

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.fileName || 'document'}-extracted.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('Text downloaded as .txt');
}

// ============================================
// Start
// ============================================
document.addEventListener('DOMContentLoaded', init);
