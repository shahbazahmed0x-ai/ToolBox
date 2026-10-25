# 🧰 ToolBox — Free Online PDF & Image Tools

A collection of free, privacy-friendly browser-based tools. Everything runs **100% client-side** — no files are ever uploaded to a server, making it perfect for static hosting on **GitHub Pages**.

## ✨ Tools Included

### 1. Image to PDF Converter
- Upload multiple images (drag & drop or click)
- Reorder images via drag-and-drop
- Choose page size (A4, Letter, Legal, or Fit to Image)
- Orientation: Auto / Portrait / Landscape
- Fit modes: Contain, Cover, Stretch
- Adjustable margins and image quality

### 2. Image Format Converter
- Convert images between PNG, JPEG, and WEBP
- Resize with optional aspect-ratio lock
- Adjustable compression quality
- Batch convert and download all as a ZIP

### 3. PDF Editor
- Upload and preview any PDF
- Add custom text anywhere on a page (font size & color)
- Draw a signature on a signature pad and place it on the page
- Upload and place image stamps/logos
- Drag & resize placed elements
- Rotate or delete individual pages
- Zoom in/out
- Export your edited PDF

## 🛠️ Tech Stack

- Vanilla HTML / CSS / JavaScript (no build step required)
- [pdf-lib](https://pdf-lib.js.org/) — PDF creation & editing
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF rendering
- [jsPDF](https://github.com/parallax/jsPDF) — Image to PDF generation
- [JSZip](https://stuk.github.io/jszip/) — Batch ZIP downloads
- [SortableJS](https://sortablejs.github.io/Sortable/) — Drag-to-reorder thumbnails

## 🚀 Running Locally

Just open `index.html` in your browser, or serve the folder with any static server:

```bash
npx serve .