(() => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const thumbsContainer = document.getElementById('thumbs');
  const generateBtn = document.getElementById('generateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');

  const pageSizeSel = document.getElementById('pageSize');
  const orientationSel = document.getElementById('orientation');
  const marginInput = document.getElementById('margin');
  const fitModeSel = document.getElementById('fitMode');
  const qualityInput = document.getElementById('quality');
  const qualityVal = document.getElementById('qualityVal');

  let images = [];
  let idCounter = 0;

  qualityInput.addEventListener('input', () => qualityVal.textContent = qualityInput.value + '%');

  ['dragenter', 'dragover'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          images.push({ id: 'img-' + (idCounter++), file, dataUrl: e.target.result, width: img.width, height: img.height });
          renderThumbs();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderThumbs() {
    thumbsContainer.innerHTML = '';
    images.forEach((img, index) => {
      const div = document.createElement('div');
      div.className = 'thumb';
      div.dataset.id = img.id;
      div.innerHTML = `
        <span class="thumb-index">${index + 1}</span>
        <img src="${img.dataUrl}" alt="">
        <button class="thumb-remove" data-id="${img.id}">&times;</button>`;
      thumbsContainer.appendChild(div);
    });
    generateBtn.disabled = images.length === 0;
    statusEl.textContent = images.length ? `${images.length} image(s) ready. Drag thumbnails to reorder.` : '';
  }

  thumbsContainer.addEventListener('click', e => {
    if (e.target.classList.contains('thumb-remove')) {
      images = images.filter(i => i.id !== e.target.dataset.id);
      renderThumbs();
    }
  });

  if (window.Sortable) {
    Sortable.create(thumbsContainer, {
      animation: 150,
      onEnd: () => {
        const order = Array.from(thumbsContainer.children).map(c => c.dataset.id);
        images.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        renderThumbs();
      }
    });
  }

  clearBtn.addEventListener('click', () => { images = []; renderThumbs(); });
  generateBtn.addEventListener('click', generatePDF);

  function mmToPt(mm) { return mm * 2.834645669; }

  async function generatePDF() {
    if (!images.length) return;
    statusEl.textContent = 'Generating PDF...';
    generateBtn.disabled = true;

    const { jsPDF } = window.jspdf;
    const pageSizeChoice = pageSizeSel.value;
    const orientationChoice = orientationSel.value;
    const marginPt = mmToPt(parseFloat(marginInput.value) || 0);
    const fitMode = fitModeSel.value;
    const quality = parseInt(qualityInput.value, 10) / 100;

    const STANDARD = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };
    let doc = null;

    for (const imgData of images) {
      let orientation = orientationChoice === 'auto'
        ? (imgData.width > imgData.height ? 'landscape' : 'portrait')
        : orientationChoice;

      let pageW, pageH;
      if (pageSizeChoice === 'fit') {
        pageW = imgData.width; pageH = imgData.height;
        if (orientation === 'landscape' && pageW < pageH) [pageW, pageH] = [pageH, pageW];
        if (orientation === 'portrait' && pageW > pageH) [pageW, pageH] = [pageH, pageW];
      } else {
        let [w, h] = STANDARD[pageSizeChoice] || STANDARD.a4;
        if (orientation === 'landscape') [w, h] = [h, w];
        pageW = w; pageH = h;
      }

      if (!doc) {
        doc = new jsPDF({ orientation: pageW > pageH ? 'landscape' : 'portrait', unit: 'pt', format: [pageW, pageH] });
      } else {
        doc.addPage([pageW, pageH], pageW > pageH ? 'landscape' : 'portrait');
      }

      const availW = pageW - marginPt * 2, availH = pageH - marginPt * 2;
      const imgRatio = imgData.width / imgData.height, availRatio = availW / availH;
      let drawW, drawH;

      if (fitMode === 'stretch') { drawW = availW; drawH = availH; }
      else if (fitMode === 'cover') {
        if (imgRatio > availRatio) { drawH = availH; drawW = availH * imgRatio; }
        else { drawW = availW; drawH = availW / imgRatio; }
      } else {
        if (imgRatio > availRatio) { drawW = availW; drawH = availW / imgRatio; }
        else { drawH = availH; drawW = availH * imgRatio; }
      }

      const x = marginPt + (availW - drawW) / 2;
      const y = marginPt + (availH - drawH) / 2;

      const compressed = await compressImage(imgData.dataUrl, quality);
      doc.addImage(compressed, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
    }

    doc.save('converted-images.pdf');
    statusEl.textContent = '✅ Done! Your PDF has been downloaded.';
    generateBtn.disabled = false;
  }

  function compressImage(dataUrl, quality) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }
})();