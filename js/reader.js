// Not Giriş — sınav kâğıdı okuma (fotoğraf -> soru etiketleri + öğretmen puanları)
// Mehmet Karadeniz, 2026-2027
// Her şey cihazda çalışır: Tesseract.js (basılı yazı) + Digits (el yazısı rakam).

const Reader = (() => {
  let worker = null;
  const MAX_SIDE = 2000;

  const INK = {
    kirmizi: (r, g, b) => r > 100 && r - g > 45 && r - b > 30 && r > g * 1.35,
    yesil: (r, g, b) => g > 80 && g - r > 30 && g - b > 15,
  };

  async function initOcr(onProgress) {
    if (worker) return worker;
    const base = new URL('.', location.href).href;
    worker = await Tesseract.createWorker('tur', 1, {
      workerPath: base + 'vendor/worker.min.js',
      corePath: base + 'vendor/',
      langPath: base + 'lang',
      gzip: true,
      workerBlobURL: false,
      logger: m => onProgress && onProgress(m),
    });
    return worker;
  }

  async function loadImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, fail) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = fail;
        i.src = url;
      });
      const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Öğretmen mürekkebi maskesi + OCR için mürekkebi silinmiş kopya
  function splitInk(canvas, renk) {
    const { width: w, height: h } = canvas;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, w, h);
    const test = INK[renk] || INK.kirmizi;
    const mask = new Uint8Array(w * h);
    const clean = new ImageData(new Uint8ClampedArray(data.data), w, h);
    for (let i = 0; i < w * h; i++) {
      const r = data.data[i * 4], g = data.data[i * 4 + 1], b = data.data[i * 4 + 2];
      if (test(r, g, b)) {
        mask[i] = 1;
        clean.data[i * 4] = clean.data[i * 4 + 1] = clean.data[i * 4 + 2] = 255;
      }
    }
    const cc = document.createElement('canvas');
    cc.width = w; cc.height = h;
    cc.getContext('2d').putImageData(clean, 0, 0);
    return { mask, clean: cc, w, h };
  }

  function dilateMask(m, w, h) {
    const o = new Uint8Array(m.length);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (m[i] || m[i - 1] || m[i + 1] || m[i - w] || m[i + w]) o[i] = 1;
    }
    return o;
  }

  // Bağlantılı bileşenler (8 komşuluk)
  function components(m, w, h) {
    const lab = new Int32Array(w * h);
    const comps = [];
    const stack = new Int32Array(w * h);
    let id = 0;
    for (let s = 0; s < w * h; s++) {
      if (!m[s] || lab[s]) continue;
      id++;
      let sp = 0; stack[sp++] = s; lab[s] = id;
      let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
      while (sp) {
        const p = stack[--sp];
        const px = p % w, py = (p - px) / w;
        area++;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = px + dx, Y = py + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const q = Y * w + X;
          if (m[q] && !lab[q]) { lab[q] = id; stack[sp++] = q; }
        }
      }
      comps.push({ id, x0, y0, x1, y1, area, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    }
    return { lab, comps };
  }

  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

  // Kırmızı bileşenlerden sayıları çıkar
  function findNumbers(ink, textH) {
    const { mask, w, h } = ink;
    const dm = dilateMask(mask, w, h);
    const { lab, comps } = components(dm, w, h);
    const minH = textH * 0.5, maxH = textH * 4.5;
    let cand = comps.filter(c => c.area >= 15 && c.h >= minH && c.h <= maxH && c.w <= textH * 4);
    // Etrafına çember çizilmiş sayılar: içinde başka bileşen merkezi olanı (çemberi) at
    cand = cand.filter(c => !cand.some(o => o !== c &&
      o.x0 > c.x0 && o.x1 < c.x1 && o.y0 > c.y0 && o.y1 < c.y1));
    // Uzun ince çizgileri (altı çizili, tik) at
    cand = cand.filter(c => !(c.w > c.h * 3));

    // Yatayda çakışan parçaları tek rakam yap (ör. 5'in kopuk şapkası)
    cand.sort((a, b) => a.x0 - b.x0);
    const digits = [];
    for (const c of cand) {
      const d = digits.find(g => overlap(g.x0, g.x1, c.x0, c.x1) > 0.5 * Math.min(g.w, c.w) &&
        Math.abs((g.y0 + g.y1) / 2 - (c.y0 + c.y1) / 2) < textH * 2);
      if (d) {
        d.ids.push(c.id);
        d.x0 = Math.min(d.x0, c.x0); d.x1 = Math.max(d.x1, c.x1);
        d.y0 = Math.min(d.y0, c.y0); d.y1 = Math.max(d.y1, c.y1);
        d.w = d.x1 - d.x0 + 1; d.h = d.y1 - d.y0 + 1;
      } else digits.push({ ids: [c.id], x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, w: c.w, h: c.h });
    }

    // Her rakamı sınıflandır
    for (const d of digits) {
      const bw = d.w, bh = d.h;
      const crop = new Uint8Array(bw * bh);
      const ids = new Set(d.ids);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const i = (y + d.y0) * w + (x + d.x0);
        if (mask[i] && ids.has(lab[i])) crop[y * bw + x] = 1;
      }
      const p = Digits.predict(Digits.toMnist(crop, bw, bh));
      d.digit = p.digit; d.prob = p.prob;
    }

    // Yan yana rakamları sayıya birleştir
    digits.sort((a, b) => a.x0 - b.x0);
    const numbers = [];
    for (const d of digits) {
      const n = numbers.find(g => {
        const last = g.parts[g.parts.length - 1];
        const gap = d.x0 - last.x1;
        const vo = overlap(last.y0, last.y1, d.y0, d.y1) / Math.min(last.h, d.h);
        return gap > -textH * 0.3 && gap < Math.max(last.h, d.h) * 0.8 && vo > 0.35;
      });
      if (n) {
        n.parts.push(d);
        n.x1 = Math.max(n.x1, d.x1); n.y0 = Math.min(n.y0, d.y0); n.y1 = Math.max(n.y1, d.y1);
      } else numbers.push({ parts: [d], x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 });
    }
    return numbers
      .filter(n => n.parts.length <= 3)
      .map(n => ({
        value: parseInt(n.parts.map(p => p.digit).join(''), 10),
        conf: n.parts.reduce((p, c) => p * c.prob, 1),
        x0: n.x0, y0: n.y0, x1: n.x1, y1: n.y1,
        cx: (n.x0 + n.x1) / 2, cy: (n.y0 + n.y1) / 2,
      }));
  }

  // OCR satırlarını blok ağacından düz listeye çevir
  function flattenLines(data) {
    const out = [];
    const walk = o => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (o.lines) o.lines.forEach(l => out.push({ text: l.text || '', bbox: l.bbox }));
      else { if (o.paragraphs) walk(o.paragraphs); }
    };
    walk(data.blocks || []);
    if (!out.length && data.lines) data.lines.forEach(l => out.push({ text: l.text, bbox: l.bbox }));
    return out;
  }

  const RE_SORU = /(\d{1,2})\s*[\.\-\)]?\s*S\s*[OÖ0]\s*R\s*U/i;
  const RE_PUAN = /(\d{1,3})\s*P\s*U\s*A\s*N/i;

  function findLabels(lines) {
    const labels = [];
    for (const l of lines) {
      const t = l.text.replace(/[|]/g, '1');
      const m = t.match(RE_SORU);
      if (!m) continue;
      const p = t.match(RE_PUAN);
      labels.push({
        no: parseInt(m[1], 10),
        max: p ? parseInt(p[1], 10) : null,
        x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1,
        h: l.bbox.y1 - l.bbox.y0,
      });
    }
    // Aynı numara iki kez çıktıysa ilkini tut
    const seen = new Set();
    return labels.filter(l => !seen.has(l.no) && seen.add(l.no)).sort((a, b) => a.y0 - b.y0);
  }

  function median(a) {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  }

  // Sayıları soru bantlarına dağıt
  function assign(labels, numbers, H, maxes) {
    const res = {};
    const used = new Set();
    labels.forEach((L, i) => {
      const top = L.y0 - L.h * 1.5;
      const bottom = i + 1 < labels.length ? labels[i + 1].y0 - labels[i + 1].h * 1.5 : H;
      const max = L.max ?? maxes[L.no - 1] ?? null;
      const cands = numbers.filter(n => !used.has(n) && n.cy >= top && n.cy < bottom);
      let best = null, bestScore = -1e9;
      for (const n of cands) {
        const dist = Math.hypot(n.cx - (L.x0 + L.x1) / 2, n.cy - (L.y0 + L.y1) / 2) / H;
        let s = n.conf - dist * 2;
        if (max != null && n.value > max) s -= 1;
        if (s > bestScore) { bestScore = s; best = n; }
      }
      if (best) {
        used.add(best);
        res[L.no] = { value: best.value, conf: best.conf, box: best, ok: best.conf >= 0.6 && (max == null || best.value <= max) };
      } else res[L.no] = { value: null, conf: 0, ok: false };
    });
    // İlk sorunun üstündeki sayı: kâğıda yazılmış toplam olabilir
    let total = null;
    if (labels.length) {
      const above = numbers.filter(n => !used.has(n) && n.cy < labels[0].y0 - labels[0].h);
      above.sort((a, b) => b.conf - a.conf);
      if (above[0] && above[0].conf > 0.5) total = { value: above[0].value, box: above[0] };
    }
    return { scores: res, total };
  }

  // Öğrenci adı / numarası için kâğıdın üst kısmındaki metin
  function headerText(lines, labels, H) {
    const limit = labels.length ? labels[0].y0 : H * 0.3;
    return lines.filter(l => l.bbox.y1 <= limit + 5).map(l => l.text).join(' ');
  }

  async function read(file, opts) {
    const { renk = 'kirmizi', maxes = [], onProgress } = opts || {};
    onProgress && onProgress({ status: 'Fotoğraf hazırlanıyor', progress: 0 });
    const canvas = await loadImage(file);
    const ink = splitInk(canvas, renk);
    onProgress && onProgress({ status: 'Model yükleniyor', progress: 0.1 });
    await Digits.load();
    const w = await initOcr(onProgress);
    onProgress && onProgress({ status: 'Yazılar okunuyor', progress: 0.3 });
    const { data } = await w.recognize(ink.clean, {}, { blocks: true, text: true });
    const lines = flattenLines(data);
    const labels = findLabels(lines);
    const textH = median(labels.map(l => l.h)) || median(lines.map(l => l.bbox.y1 - l.bbox.y0)) || canvas.height * 0.015;
    onProgress && onProgress({ status: 'Puanlar okunuyor', progress: 0.8 });
    const numbers = findNumbers(ink, textH);
    const { scores, total } = labels.length ? assign(labels, numbers, canvas.height, maxes) : { scores: {}, total: null };
    return {
      canvas, labels, numbers, scores, total,
      header: headerText(lines, labels, canvas.height),
      text: data.text || '',
    };
  }

  return { read, initOcr };
})();
