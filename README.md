# PDF Editor

A fully client-side PDF editor built with HTML, CSS, and JavaScript. No backend required — runs entirely in the browser. Works great with GitHub Pages.

**[Try the live demo](https://vincenzosco.github.io/Pdf-Editor)**

## Features

### Document Management
- **Upload** — Drag & drop PDFs or use the file picker
- **Merge** — Combine multiple PDFs by appending pages
- **Download** — Save your edited PDF with one click

### Page Operations
- **View** — Thumbnail grid of all pages with lazy batch rendering
- **Select** — Click to select, Ctrl+A / Select All toggle for bulk operations
- **Rotate** — Rotate pages clockwise or counter-clockwise (90° increments)
- **Delete** — Remove selected pages (also works with Delete/Backspace keys)
- **Reorder** — Drag-and-drop to reorder pages, or use the up/down arrow buttons

### Text Editing
- **Add Text** — Click any page to place text annotations
- **Position** — Click on the page preview to set exact X/Y coordinates, or enter them manually
- **Style** — Customize font size (4–200pt) and color via built-in color picker
- **Edit / Delete** — Modify or remove existing text annotations through the annotations panel
- **Visual Markers** — Colored markers on the page preview show all annotation positions
- **Thumbnail Overlays** — Text appears directly on page thumbnails as you type
- **PDF Embedding** — All annotations are embedded into the final PDF using professional fonts

### Conversion Tools
- **PDF to Images** — Export all pages as PNG or JPEG images at 1x, 2x, or 3x resolution, bundled as a ZIP file
- **Images to PDF** — Upload PNG, JPG, WebP images and combine them into a single PDF with configurable page size and orientation. Supports drag-and-drop reordering.
- **Extract Text** — Extract selectable text content from PDF pages with copy-to-clipboard and .txt download

### Performance
- **Batch rendering** — Pages render 4 at a time for smooth loading on large documents
- **Responsive** — Works on desktop and mobile devices
- **Zero dependencies** — Only needs pdf-lib, PDF.js, and JSZip from CDN

## How It Works

This tool uses powerful JavaScript libraries entirely in your browser:

| Library | Purpose |
|---------|---------|
| **[pdf-lib](https://pdf-lib.js.org/)** | PDF manipulation — create, modify, rotate, reorder, and merge pages; embed text and images |
| **[PDF.js](https://mozilla.github.io/pdf.js/)** | Rendering — display PDF pages as canvas thumbnails and previews; extract text content |
| **[JSZip](https://stuk.github.io/jszip/)** | Create ZIP archives for batch image exports |

All processing happens **locally in your browser**. No files are uploaded to any server.

## Deployment (GitHub Pages)

1. Fork or clone this repository
2. Push to your GitHub account
3. Go to **Settings → Pages**
4. Under "Branch", select `main` and `/` (root folder)
5. Your site will be live at `https://<username>.github.io/<repo>/`

## Project Structure

```
├── index.html       # Main HTML page
├── css/
│   └── style.css    # All styling
├── js/
│   └── script.js    # Application logic
└── README.md        # This file
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Delete selected pages |
| `Ctrl+A` / `Cmd+A` | Select / Deselect all pages |
| `Escape` | Close preview or text editor modal |

## Local Development

Since this is a static site, you can run it locally with any HTTP server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

## License

MIT
