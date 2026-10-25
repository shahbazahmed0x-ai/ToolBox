(() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  // ----- DOM refs -----
  const dropZone = document.getElementById('dropZone');
  const pdfInput = document.getElementById('pdfInput');
  const uploadPrompt = document.getElementById('uploadPrompt');
  const editorApp = document.getElementById('editorApp');
  const loadStatus = document.getElementById('loadStatus');
  const statusEl = document.getElementById('status');

  const pdfCanvas = document.getElementById('pdfCanvas');
  const overlay = document.getElementById('overlay');
  const canvasInner = document.getElementById('canvasInner');
  const pageList = document.getElementById('pageList');
  const pageIndicator = document.getElementById('pageIndicator');
  const deletedBanner = document.getElementById('deletedBanner');
  const restorePageBtn = document.getElementById('restorePageBtn');

  const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const textColorInput = document.getElementById('textColorInput');
  const signatureBtn = document.getElementById('signatureBtn');
  const imageBtn = document.getElementById('imageBtn');
  const imageUploadInput = document.getElementById('imageUploadInput');
  const rotateBtn = document.getElementById('rotateBtn');
  const deletePageBtn = document.getElementById('deletePageBtn');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');

  const sigModal = document.getElementById('sigModal');
  const sigCanvas = document.getElementById('sigCanvas');
  const sigColor = document.getElementById('sigColor');
  const sigClearBtn = document.getElementById('sigClearBtn');
  const sigCancelBtn = document.getElementById('sigCancelBtn');
  const sigUseBtn = document.getElementById('sigUseBtn');

  // ----- State -----
  let originalPdfBytes = null;
  let pdfjsDoc = null;
  let numPages = 0;
  let currentPage = 1;
  let scale = 1.3;
  let currentTool = 'select';
  let pendingPlacement = null; // {type:'signature'|'image', dataUrl}
  let selectedAnnotationId = null;
  let annIdCounter = 0;
  const annotationsMeta = {}; // id -> {page,type,el,imageDataUrl,color}
  const deletedPages = new Set();
  const pageRotations = {}; // pageNum -> degrees (absolute)
  const pageDims = {}; // pageNum -> {width,height} at scale 1

  // ----- Upload handling -----
  ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadPdfFile(f); });
  dropZone.addEventListener('click', () => pdfInput.click());
  pdfInput.addEventListener('change', e => { if (e.target.files[0]) loadPdfFile(e.target.files[0]); });

  async function loadPdfFile(file) {
    loadStatus.textContent = 'Loading PDF...';
    originalPdfBytes = await file.arrayBuffer();
    const jsBytes = originalPdfBytes.slice(0);
    pdfjsDoc = await pdfjsLib.getDocument({ data: jsBytes }).promise;
    numPages = pdfjsDoc.numPages;

    for (let n = 1; n <= numPages; n++) {
      const page = await pdfjsDoc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      pageDims[n] = { width: vp.width, height: vp.height };
      pageRotations[n] = page.rotate || 0;
    }

    await buildPageList();
    uploadPrompt.classList.add('hidden');
    editorApp.classList.remove('hidden');
    showPage(1);
  }

  async function buildPageList() {
    pageList.innerHTML = '';
    for (let n = 1; n <= numPages; n++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'page-thumb';
      wrapper.dataset.page = n;
      const c = document.createElement('canvas');
      wrapper.appendChild(c);
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `Page ${n}`;
      wrapper.appendChild(badge);
      pageList.appendChild(wrapper);

      const page = await pdfjsDoc.getPage(n);
      const vp = page.getViewport({ scale: 0.3 });
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;

      wrapper.addEventListener('click', () => showPage(n));
    }
    refreshPageListBadges();
  }

  function refreshPageListBadges() {
    document.querySelectorAll('.page-thumb').forEach(el => {
      const n = parseInt(el.dataset.page, 10);
      el.classList.toggle('active', n === currentPage);
      el.classList.toggle('deleted', deletedPages.has(n));
      let rotBadge = el.querySelector('.badge.rot');
      if (pageRotations[n] % 360 !== (pageRotations[n] === 0 ? 0 : pageRotations[n])) {} // noop
      if (pageRotations[n] % 360 !== 0) {
        if (!rotBadge) {
          rotBadge = document.createElement('span');
          rotBadge.className = 'badge rot';
          rotBadge.style.top = '4px'; rotBadge.style.bottom = 'auto'; rotBadge.style.right = '4px'; rotBadge.style.left='auto';
          el.appendChild(rotBadge);
        }
        rotBadge.textContent = `${pageRotations[n]}°`;
      } else if (rotBadge) {
        rotBadge.remove();
      }
    });
  }

  // ----- Page rendering -----
  async function showPage(num) {
    currentPage = Math.min(Math.max(num, 1), numPages);
    const page = await pdfjsDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    canvasInner.style.width = viewport.width + 'px';
    canvasInner.style.height = viewport.height + 'px';
    overlay.style.width = viewport.width + 'px';
    overlay.style.height = viewport.height + 'px';

    await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;

    Object.values(annotationsMeta).forEach(meta => {
      meta.el.style.display = meta.page === currentPage ? '' : 'none';
    });

    pageIndicator.textContent = `Page ${currentPage} / ${numPages}`;
    deletedBanner.classList.toggle('hidden', !deletedPages.has(currentPage));
    refreshPageListBadges();
  }

  prevPageBtn.addEventListener('click', () => showPage(currentPage - 1));
  nextPageBtn.addEventListener('click', () => showPage(currentPage + 1));

  zoomInBtn.addEventListener('click', () => zoom(1.2));
  zoomOutBtn.addEventListener('click', () => zoom(1 / 1.2));

  function zoom(factor) {
    const newScale = Math.min(Math.max(scale * factor, 0.5), 3);
    const ratio = newScale / scale;
    rescaleAnnotations(ratio);
    scale = newScale;
    showPage(currentPage);
  }

  function rescaleAnnotations(ratio) {
    Object.values(annotationsMeta).forEach(meta => {
      const el = meta.el;
      const left = parseFloat(el.style.left) || 0, top = parseFloat(el.style.top) || 0;
      el.style.left = (left * ratio) + 'px';
      el.style.top = (top * ratio) + 'px';
      if (meta.type === 'image') {
        const w = parseFloat(el.style.width) || 0, h = parseFloat(el.style.height) || 0;
        el.style.width = (w * ratio) + 'px';
        el.style.height = (h * ratio) + 'px';
      } else {
        const tc = el.querySelector('.text-content');
        const fs = parseFloat(tc.style.fontSize) || 16;
        tc.style.fontSize = (fs * ratio) + 'px';
      }
    });
  }

  // ----- Tool switching -----
  toolBtns.forEach(btn => btn.addEventListener('click', () => {
    toolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    overlay.style.cursor = currentTool === 'text' ? 'crosshair' : 'default';
  }));

  overlay.addEventListener('click', e => {
    if (e.target !== overlay) return;
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    if (currentTool === 'text') {
      createTextAnnotation(x, y);
    } else if (pendingPlacement) {
      createImageAnnotation(x, y, pendingPlacement.dataUrl);
      pendingPlacement = null;
      currentTool = 'select';
      toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === 'select'));
      overlay.style.cursor = 'default';
      statusEl.textContent = '';
    } else {
      selectAnnotation(null);
    }
  });

  // ----- Text annotations -----
  function createTextAnnotation(x, y) {
    const id = 'ann' + (annIdCounter++);
    const el = document.createElement('div');
    el.className = 'annotation text-annotation';
    el.dataset.id = id;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.textContent = '⠿ move';
    el.appendChild(handle);

    const delBtn = document.createElement('button');
    delBtn.className = 'ann-delete';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); el.remove(); delete annotationsMeta[id]; });
    el.appendChild(delBtn);

    const content = document.createElement('div');
    content.className = 'text-content';
    content.contentEditable = 'true';
    content.style.fontSize = fontSizeSelect.value + 'px';
    content.style.color = textColorInput.value;
    el.appendChild(content);

    overlay.appendChild(el);
    makeDraggable(el, handle, id);

    annotationsMeta[id] = { page: currentPage, type: 'text', el, color: textColorInput.value };

    content.addEventListener('mousedown', e => e.stopPropagation());
    content.addEventListener('focus', () => selectAnnotation(id));
    el.addEventListener('mousedown', () => selectAnnotation(id));

    content.focus();
  }

  fontSizeSelect.addEventListener('change', () => {
    if (selectedAnnotationId && annotationsMeta[selectedAnnotationId]?.type === 'text') {
      annotationsMeta[selectedAnnotationId].el.querySelector('.text-content').style.fontSize = fontSizeSelect.value + 'px';
    }
  });
  textColorInput.addEventListener('input', () => {
    if (selectedAnnotationId && annotationsMeta[selectedAnnotationId]?.type === 'text') {
      const meta = annotationsMeta[selectedAnnotationId];
      meta.el.querySelector('.text-content').style.color = textColorInput.value;
      meta.color = textColorInput.value;
    }
  });

  // ----- Image / Signature annotations -----
  function createImageAnnotation(x, y, dataUrl, defaultWidth = 150) {
    const probe = new Image();
    probe.onload = () => {
      const h = defaultWidth * (probe.naturalHeight / probe.naturalWidth);
      const id = 'ann' + (annIdCounter++);
      const el = document.createElement('div');
      el.className = 'annotation image-annotation';
      el.dataset.id = id;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.width = defaultWidth + 'px';
      el.style.height = h + 'px';

      const img = document.createElement('img');
      img.src = dataUrl;
      el.appendChild(img);

      const delBtn = document.createElement('button');
      delBtn.className = 'ann-delete';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', e => { e.stopPropagation(); el.remove(); delete annotationsMeta[id]; });
      el.appendChild(delBtn);

      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      el.appendChild(resizeHandle);

      overlay.appendChild(el);
      makeDraggable(el, el, id);
      makeResizable(el, resizeHandle);

      annotationsMeta[id] = { page: currentPage, type: 'image', el, imageDataUrl: dataUrl };
      selectAnnotation(id);
    };
    probe.src = dataUrl;
  }

  // ----- Drag / Resize -----
  function makeDraggable(el, handle, id) {
    handle.addEventListener('mousedown', e => {
      if (e.target.classList.contains('ann-delete') || e.target.classList.contains('resize-handle')) return;
      e.preventDefault(); e.stopPropagation();
      selectAnnotation(id);
      const startX = e.clientX, startY = e.clientY;
      const origLeft = parseFloat(el.style.left) || 0, origTop = parseFloat(el.style.top) || 0;
      function onMove(ev) {
        el.style.left = (origLeft + ev.clientX - startX) + 'px';
        el.style.top = (origTop + ev.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function makeResizable(el, handle) {
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const origW = el.offsetWidth, origH = el.offsetHeight;
      const ratio = origW / origH;
      function onMove(ev) {
        let newW = Math.max(20, origW + (ev.clientX - startX));
        let newH = newW / ratio;
        el.style.width = newW + 'px';
        el.style.height = newH + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function selectAnnotation(id) {
    document.querySelectorAll('.annotation').forEach(el => el.classList.remove('selected'));
    selectedAnnotationId = id;
    if (id && annotationsMeta[id]) {
      annotationsMeta[id].el.classList.add('selected');
      if (annotationsMeta[id].type === 'text') {
        fontSizeSelect.value = parseFloat(annotationsMeta[id].el.querySelector('.text-content').style.fontSize) || 16;
      }
    }
  }

  // ----- Signature modal -----
  let drawing = false;
  const sigCtx = sigCanvas.getContext('2d');

  function getPos(e) {
    const rect = sigCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (sigCanvas.width / rect.width), y: (clientY - rect.top) * (sigCanvas.height / rect.height) };
  }

  function startDraw(e) { drawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); e.preventDefault(); }
  function moveDraw(e) {
    if (!drawing) return;
    const p = getPos(e);
    sigCtx.lineWidth = 2.5; sigCtx.lineCap = 'round'; sigCtx.strokeStyle = sigColor.value;
    sigCtx.lineTo(p.x, p.y); sigCtx.stroke();
    e.preventDefault();
  }
  function endDraw() { drawing = false; }

  sigCanvas.addEventListener('mousedown', startDraw);
  sigCanvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  sigCanvas.addEventListener('touchstart', startDraw);
  sigCanvas.addEventListener('touchmove', moveDraw);
  sigCanvas.addEventListener('touchend', endDraw);

  signatureBtn.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    sigModal.classList.remove('hidden');
  });
  sigClearBtn.addEventListener('click', () => sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height));
  sigCancelBtn.addEventListener('click', () => sigModal.classList.add('hidden'));
  sigUseBtn.addEventListener('click', () => {
    const dataUrl = trimCanvas(sigCanvas);
    sigModal.classList.add('hidden');
    pendingPlacement = { type: 'signature', dataUrl };
    currentTool = 'placeSignature';
    toolBtns.forEach(b => b.classList.remove('active'));
    statusEl.textContent = '✏️ Click anywhere on the page to place your signature.';
  });

  function trimCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) {
          found = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return canvas.toDataURL('image/png');
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(width, maxX + pad); maxY = Math.min(height, maxY + pad);
    const trimmed = document.createElement('canvas');
    trimmed.width = maxX - minX; trimmed.height = maxY - minY;
    trimmed.getContext('2d').drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return trimmed.toDataURL('image/png');
  }

  // ----- Image stamp -----
  imageBtn.addEventListener('click', () => imageUploadInput.click());
  imageUploadInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      pendingPlacement = { type: 'image', dataUrl: ev.target.result };
      currentTool = 'placeImage';
      toolBtns.forEach(b => b.classList.remove('active'));
      statusEl.textContent = '🖼️ Click anywhere on the page to place the image.';
    };
    reader.readAsDataURL(file);
    imageUploadInput.value = '';
  });

  // ----- Rotate / Delete pages -----
  rotateBtn.addEventListener('click', () => {
    pageRotations[currentPage] = ((pageRotations[currentPage] || 0) + 90) % 360;
    refreshPageListBadges();
    statusEl.textContent = `Page ${currentPage} will be rotated ${pageRotations[currentPage]}° in the final PDF.`;
  });

  deletePageBtn.addEventListener('click', () => {
    deletedPages.add(currentPage);
    deletedBanner.classList.remove('hidden');
    refreshPageListBadges();
  });
  restorePageBtn.addEventListener('click', () => {
    deletedPages.delete(currentPage);
    deletedBanner.classList.add('hidden');
    refreshPageListBadges();
  });

  // ----- Export -----
  downloadPdfBtn.addEventListener('click', exportPdf);

  function hexToRgbFloat(hex) {
    hex = (hex || '#000000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 };
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function exportPdf() {
    try {
      statusEl.textContent = '⏳ Preparing your PDF...';
      const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;
      const pdfLibDoc = await PDFDocument.load(originalPdfBytes);
      const pages = pdfLibDoc.getPages();
      const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);

      // Rotations
      Object.entries(pageRotations).forEach(([numStr, rotation]) => {
        const idx = parseInt(numStr, 10) - 1;
        if (pages[idx] && rotation % 360 !== 0) pages[idx].setRotation(degrees(rotation));
      });

      // Annotations
      for (const id in annotationsMeta) {
        const meta = annotationsMeta[id];
        const pageIdx = meta.page - 1;
        const page = pages[pageIdx];
        if (!page) continue;
        const pdfHeight = pageDims[meta.page].height;
        const el = meta.el;
        const leftPx = parseFloat(el.style.left) || 0;
        const topPx = parseFloat(el.style.top) || 0;

        if (meta.type === 'text') {
          const textContentEl = el.querySelector('.text-content');
          const text = textContentEl.innerText.trim();
          if (!text) continue;
          const fontSizePx = parseFloat(textContentEl.style.fontSize) || 16;
          const fontSizePt = fontSizePx / scale;
          const xPt = leftPx / scale;
          const topYPt = pdfHeight - (topPx / scale);
          const { r, g, b } = hexToRgbFloat(meta.color);
          const lines = text.split('\n');
          lines.forEach((line, i) => {
            page.drawText(line, {
              x: xPt,
              y: topYPt - fontSizePt - (i * fontSizePt * 1.25),
              size: fontSizePt,
              font,
              color: rgb(r, g, b)
            });
          });
        } else if (meta.type === 'image') {
          const wPx = parseFloat(el.style.width) || 100;
          const hPx = parseFloat(el.style.height) || 100;
          const wPt = wPx / scale, hPt = hPx / scale;
          const xPt = leftPx / scale;
          const yPt = pdfHeight - (topPx / scale) - hPt;
          const bytes = dataUrlToBytes(meta.imageDataUrl);
          let embedded;
          try {
            embedded = meta.imageDataUrl.startsWith('data:image/png')
              ? await pdfLibDoc.embedPng(bytes)
              : await pdfLibDoc.embedJpg(bytes);
          } catch {
            embedded = await pdfLibDoc.embedPng(bytes);
          }
          page.drawImage(embedded, { x: xPt, y: yPt, width: wPt, height: hPt });
        }
      }

      // Remove deleted pages (reverse order to keep indices valid)
      Array.from(deletedPages).sort((a, b) => b - a).forEach(num => {
        pdfLibDoc.removePage(num - 1);
      });

      const pdfBytes = await pdfLibDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'edited.pdf'; a.click();
      statusEl.textContent = '✅ Downloaded!';
    } catch (err) {
      console.error(err);
      statusEl.textContent = '❌ Something went wrong exporting the PDF.';
    }
  }
})();