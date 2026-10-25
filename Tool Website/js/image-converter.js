(() => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const list = document.getElementById('fileList');
  const convertBtn = document.getElementById('convertBtn');
  const clearBtn = document.getElementById('clearBtn');
  const formatSel = document.getElementById('format');
  const qualityInput = document.getElementById('quality');
  const qualityVal = document.getElementById('qualityVal');
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const aspectCheck = document.getElementById('aspectCheck');
  const resultsSection = document.getElementById('results');
  const resultsList = document.getElementById('resultsList');
  const downloadAllBtn = document.getElementById('downloadAllBtn');

  let items = [];
  let idCounter = 0;
  let convertedBlobs = [];

  qualityInput.addEventListener('input', () => qualityVal.textContent = qualityInput.value + '%');

  ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  function handleFiles(fileList) {
    Array.from(fileList).filter(f => f.type.startsWith('image/')).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          items.push({ id: 'f' + (idCounter++), file, dataUrl: e.target.result, width: img.width, height: img.height });
          renderList();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderList() {
    list.innerHTML = '';
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `
        <img src="${it.dataUrl}" alt="">
        <div class="file-info"><strong>${it.file.name}</strong><span>${it.width}×${it.height} • ${(it.file.size / 1024).toFixed(1)} KB</span></div>
        <button class="thumb-remove" data-id="${it.id}">&times;</button>`;
      list.appendChild(div);
    });
    convertBtn.disabled = items.length === 0;
  }

  list.addEventListener('click', e => {
    if (e.target.classList.contains('thumb-remove')) {
      items = items.filter(i => i.id !== e.target.dataset.id);
      renderList();
    }
  });

  clearBtn.addEventListener('click', () => { items = []; renderList(); resultsSection.classList.add('hidden'); });
  convertBtn.addEventListener('click', convertAll);

  async function convertAll() {
    convertedBlobs = [];
    resultsList.innerHTML = '';
    const format = formatSel.value;
    const quality = parseInt(qualityInput.value, 10) / 100;
    const targetW = parseInt(widthInput.value, 10) || null;
    const targetH = parseInt(heightInput.value, 10) || null;
    const keepAspect = aspectCheck.checked;

    for (const it of items) {
      const blob = await convertImage(it, format, quality, targetW, targetH, keepAspect);
      const ext = format.split('/')[1];
      const name = it.file.name.replace(/\.[^.]+$/, '') + '.' + (ext === 'jpeg' ? 'jpg' : ext);
      convertedBlobs.push({ name, blob });
      addResultRow(name, blob);
    }
    resultsSection.classList.remove('hidden');
    downloadAllBtn.classList.toggle('hidden', convertedBlobs.length < 2);
  }

  function convertImage(it, format, quality, targetW, targetH, keepAspect) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        let w = targetW || img.width, h = targetH || img.height;
        if (keepAspect) {
          if (targetW && !targetH) h = Math.round(targetW / img.width * img.height);
          else if (targetH && !targetW) w = Math.round(targetH / img.height * img.width);
          else if (targetW && targetH) {
            const r = Math.min(targetW / img.width, targetH / img.height);
            w = Math.round(img.width * r); h = Math.round(img.height * r);
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (format === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob), format, quality);
      };
      img.src = it.dataUrl;
    });
  }

  function addResultRow(name, blob) {
    const url = URL.createObjectURL(blob);
    const row = document.createElement('div');
    row.className = 'file-item';
    row.innerHTML = `
      <img src="${url}" alt="">
      <div class="file-info"><strong>${name}</strong><span>${(blob.size / 1024).toFixed(1)} KB</span></div>
      <a href="${url}" download="${name}" class="btn btn-small btn-outline">Download</a>`;
    resultsList.appendChild(row);
  }

  downloadAllBtn.addEventListener('click', async () => {
    const zip = new JSZip();
    convertedBlobs.forEach(c => zip.file(c.name, c.blob));
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url; a.download = 'converted-images.zip'; a.click();
  });
})();