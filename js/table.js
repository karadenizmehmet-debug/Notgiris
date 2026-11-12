// Not Giriş — sınıf puan listesini okuma (fotoğraf, Excel/CSV, yapıştırma)
// Mehmet Karadeniz, 2026-2027
// Her şey cihazda çalışır: Tesseract.js (yazı) + Digits (el yazısı rakam yedeği).

const Table = (() => {
  let worker = null;
  const CFG = { gamma: 1.0, psm: '11' };
  const MAX_SIDE = 2600;

  // ---------- Ortak: başlık satırından soru sütunlarını bul ----------
  const RE_SORU = /^\s*(\d{1,2})\s*[.\-)]?\s*s\s*[oö0]\s*r\s*u\b(?:.*?(\d{1,3})\s*(?:p|puan|\)))?/i;
  const RE_SORU_GEVSEK = /s[oö0]ru/i;

  function sayi(v) {
    if (v == null) return null;
    const t = String(v).trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  // rows: string[][] (Excel/CSV/yapıştırma)
  function fromGrid(rows) {
    rows = rows.map(r => r.map(c => (c == null ? '' : String(c).trim())));
    let hi = -1, cols = [];
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const c = [];
      rows[i].forEach((cell, j) => {
        const m = cell.match(RE_SORU);
        if (m) c.push({ j, no: parseInt(m[1], 10), max: m[2] ? parseInt(m[2], 10) : null });
      });
      if (c.length >= 1) { hi = i; cols = c; break; }
    }
    if (hi < 0) throw new Error('Başlık satırında “1.soru, 2.soru…” sütunları bulunamadı.');
    cols.sort((a, b) => a.no - b.no);
    const ilkSoru = Math.min(...cols.map(c => c.j));
    // Ad sütunu: soru sütunlarından önce, en çok harf içeren sütun
    let adJ = -1, enCok = 0;
    for (let j = 0; j < ilkSoru; j++) {
      const harfli = rows.slice(hi + 1).filter(r => /[a-zçğıöşü]{2,}/i.test(r[j] || '')).length;
      if (harfli > enCok) { enCok = harfli; adJ = j; }
    }
    let noJ = -1;
    for (let j = 0; j < ilkSoru; j++) {
      if (j === adJ) continue;
      const sayili = rows.slice(hi + 1).filter(r => /^\d{1,6}$/.test(r[j] || '')).length;
      if (sayili >= 1) { noJ = j; break; }
    }
    const satirlar = [];
    for (const r of rows.slice(hi + 1)) {
      const ad = adJ >= 0 ? (r[adJ] || '') : '';
      const puanlar = cols.map(c => sayi(r[c.j]));
      if (!ad && puanlar.every(v => v == null)) continue;
      satirlar.push({ ad, no: noJ >= 0 ? (r[noJ] || '') : '', puanlar, supheli: puanlar.map(() => false) });
    }
    return { sorular: cols.map(c => ({ no: c.no, max: c.max })), satirlar };
  }

  function fromText(metin) {
    const rows = metin.replace(/\r/g, '').split('\n').filter(s => s.trim()).map(s => {
      if (s.includes('\t')) return s.split('\t');
      if (s.includes(';')) return s.split(';');
      return s.split(',');
    });
    return fromGrid(rows);
  }

  async function fromFile(file) {
    const ad = file.name.toLowerCase();
    if (ad.endsWith('.csv') || ad.endsWith('.txt')) return fromText(await file.text());
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return fromGrid(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
  }

  // ---------- Fotoğraf ----------
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
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: CFG.psm });
    return worker;
  }

  async function loadImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, fail) => {
        const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url;
      });
      const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }

  // Parlama ve gölgeyi düzelt: her pikseli bulanık arka plana böl, sonra kontrastı aç.
  function normalize(src) {
    const w = src.width, h = src.height;
    const sctx = src.getContext('2d');
    const d = sctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];

    // Arka plan: küçült, bulanıklaştır, büyüt
    const k = 16;
    const bw = Math.ceil(w / k), bh = Math.ceil(h / k);
    const small = document.createElement('canvas'); small.width = bw; small.height = bh;
    const sm = small.getContext('2d');
    sm.filter = 'blur(3px)';
    sm.drawImage(src, 0, 0, bw, bh);
    const big = document.createElement('canvas'); big.width = w; big.height = h;
    const bg = big.getContext('2d');
    bg.imageSmoothingQuality = 'high';
    bg.drawImage(small, 0, 0, w, h);
    const b = bg.getImageData(0, 0, w, h).data;

    const out = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const bgv = Math.max(30, 0.299 * b[i * 4] + 0.587 * b[i * 4 + 1] + 0.114 * b[i * 4 + 2]);
      out[i] = Math.min(1.2, gray[i] / bgv);
    }
    // Kontrast: koyu %1 -> 0, arka plan (~1.0) -> 255
    const ornek = [];
    for (let i = 0; i < out.length; i += 97) ornek.push(out[i]);
    ornek.sort((a, c) => a - c);
    const lo = ornek[Math.floor(ornek.length * 0.005)], hi = 0.97;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const ink = new Float32Array(w * h); // 0..1 mürekkep yoğunluğu
    for (let i = 0; i < w * h; i++) {
      let v = (out[i] - lo) / (hi - lo);
      v = Math.max(0, Math.min(1, v));
      v = Math.pow(v, CFG.gamma);
      ink[i] = 1 - v;
      const g = Math.round(v * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, ink, w, h };
  }

  function words(data) {
    const out = [];
    const walk = o => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (o.words) o.words.forEach(wd => out.push({ text: (wd.text || '').trim(), conf: wd.confidence, ...wd.bbox }));
      else ['paragraphs', 'lines'].forEach(k => o[k] && walk(o[k]));
    };
    walk(data.blocks || []);
    if (!out.length && data.words) data.words.forEach(wd => out.push({ text: wd.text.trim(), conf: wd.confidence, ...wd.bbox }));
    return out.filter(w => w.text).map(w => ({ ...w, cx: (w.x0 + w.x1) / 2, cy: (w.y0 + w.y1) / 2, h: w.y1 - w.y0 }));
  }

  function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

  // OCR'ın sayıya benzettiği harfleri düzelt
  function rakamMetni(t) {
    const d = t.replace(/[Oo]/g, '0').replace(/[lI|!]/g, '1').replace(/[Ss](?=\d|$)/g, '5').replace(/[,.'`]/g, '');
    return /^\d{1,3}$/.test(d) ? parseInt(d, 10) : null;
  }

  function basliklar(ws) {
    const heads = [];
    ws.forEach((w, i) => {
      if (!RE_SORU_GEVSEK.test(w.text)) return;
      let m = w.text.match(/(\d{1,2})\s*[.\-)]?\s*s/i);
      let x0 = w.x0;
      if (!m) {
        // "1." ve "soru" ayrı kelime olarak okunmuş olabilir
        const once = ws.filter(o => o !== w && Math.abs(o.cy - w.cy) < w.h && o.x1 <= w.x0 + 4 && w.x0 - o.x1 < w.h * 1.5)
          .sort((a, b) => b.x1 - a.x1)[0];
        const n = once && once.text.match(/(\d{1,2})/);
        if (!n) return;
        m = n; x0 = once.x0;
      }
      const p = w.text.match(/\((\d{1,3})\)|(\d{1,3})\s*p/i);
      heads.push({ no: parseInt(m[1], 10), x0, x1: w.x1, cy: w.cy, h: w.h, max: p ? parseInt(p[1] || p[2], 10) : null });
    });
    if (!heads.length) return [];
    // En kalabalık başlık satırını al
    const y = median(heads.map(h => h.cy));
    const hh = median(heads.map(h => h.h));
    const satir = heads.filter(h => Math.abs(h.cy - y) < hh * 1.5);
    const seen = new Set();
    return satir.sort((a, b) => a.x0 - b.x0).filter(h => !seen.has(h.no) && seen.add(h.no));
  }

  // Hücrede OCR rakam bulamazsa: el yazısı rakam modeli
  function hucreOku(norm, x0, y0, x1, y1) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
    x1 = Math.min(norm.w - 1, Math.round(x1)); y1 = Math.min(norm.h - 1, Math.round(y1));
    const w = x1 - x0, h = y1 - y0;
    if (w < 8 || h < 8) return null;
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = norm.ink[(y + y0) * norm.w + x + x0] > 0.4 ? 1 : 0;

    // Bileşenler; kenara değen uzun ince parçalar tablo çizgisidir
    const lab = new Int32Array(w * h), st = new Int32Array(w * h);
    const comps = [];
    for (let s0 = 0; s0 < w * h; s0++) {
      if (!m[s0] || lab[s0]) continue;
      const id = comps.length + 1;
      let sp = 0; st[sp++] = s0; lab[s0] = id;
      let cx0 = w, cy0 = h, cx1 = 0, cy1 = 0, area = 0;
      while (sp) {
        const q = st[--sp], qx = q % w, qy = (q - qx) / w;
        area++;
        if (qx < cx0) cx0 = qx; if (qx > cx1) cx1 = qx; if (qy < cy0) cy0 = qy; if (qy > cy1) cy1 = qy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = qx + dx, Y = qy + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const r = Y * w + X;
          if (m[r] && !lab[r]) { lab[r] = id; st[sp++] = r; }
        }
      }
      comps.push({ id, x0: cx0, y0: cy0, x1: cx1, y1: cy1, area, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1 });
    }
    const kenar = 2;
    let iyi = comps.filter(c => {
      if (c.area < Math.max(12, w * h * 0.002)) return false;
      const degiyor = c.x0 <= kenar || c.y0 <= kenar || c.x1 >= w - 1 - kenar || c.y1 >= h - 1 - kenar;
      const ince = c.w > c.h * 4 || c.h > c.w * 6;
      if (ince && (degiyor || c.w > w * 0.6 || c.h > h * 0.85)) return false;
      if (degiyor && (c.h > h * 0.8 || c.w > w * 0.8)) return false;
      if (c.h < h * 0.18) return false;
      const ortaX = (c.x0 + c.x1) / 2;
      if (c.w * 6 <= c.h && (ortaX < w * 0.12 || ortaX > w * 0.88)) return false; // kenardaki çizgi parçası
      return true;
    });
    if (!iyi.length) return null;
    // Rakamlar: yatayda çakışan parçaları birleştir
    iyi.sort((p, q) => p.x0 - q.x0);
    const rak = [];
    for (const c of iyi) {
      const d = rak.find(g => Math.min(g.x1, c.x1) - Math.max(g.x0, c.x0) > 0.4 * Math.min(g.x1 - g.x0, c.w));
      if (d) { d.ids.push(c.id); d.x0 = Math.min(d.x0, c.x0); d.x1 = Math.max(d.x1, c.x1); d.y0 = Math.min(d.y0, c.y0); d.y1 = Math.max(d.y1, c.y1); }
      else rak.push({ ids: [c.id], x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1 });
    }
    // Yüksekliği en büyük rakamın yarısından küçük olanlar leke/nokta
    const enH = Math.max(...rak.map(r => r.y1 - r.y0));
    const temiz = rak.filter(r => r.y1 - r.y0 >= enH * 0.45);
    if (!temiz.length || temiz.length > 3) return null;
    let deger = '', guven = 1;
    for (const r of temiz) {
      const pw = r.x1 - r.x0 + 1, ph = r.y1 - r.y0 + 1, ids = new Set(r.ids);
      const crop = new Uint8Array(pw * ph);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) crop[y * pw + x] = ids.has(lab[(y + r.y0) * w + x + r.x0]) ? 1 : 0;
      const p = Digits.predict(Digits.toMnist(crop, pw, ph));
      deger += p.digit; guven *= p.prob;
    }
    return { value: parseInt(deger, 10), conf: guven };
  }

  // Önizleme için hücrenin küçük resmi (yalnızca bellekte tutulur)
  function kes(src, x0, y0, x1, y1) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
    const w = Math.min(src.width - x0, Math.round(x1 - x0)), h = Math.min(src.height - y0, Math.round(y1 - y0));
    if (w < 4 || h < 4) return null;
    const s = Math.min(1, 64 / h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(src, x0, y0, w, h, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  async function fromPhoto(file, onProgress) {
    const say = (status, progress) => onProgress && onProgress({ status, progress });
    say('Fotoğraf hazırlanıyor', 0);
    const src = await loadImage(file);
    const norm = normalize(src);
    say('Model yükleniyor', 0.1);
    await Digits.load();
    const wk = await initOcr(onProgress);
    say('Yazılar okunuyor', 0.3);
    const { data } = await wk.recognize(norm.canvas, {}, { blocks: true, text: true });
    const ws = words(data);
    Table.son = { ws, norm };
    const heads = basliklar(ws);
    if (!heads.length) throw new Error('“1.soru, 2.soru…” başlıkları bulunamadı. Fotoğrafı daha yakından ve düz çekin.');
    say('Tablo çözülüyor', 0.85);

    const hh = median(heads.map(h => h.h));
    // Sütun sınırları: başlığın sol kenarından bir sonrakinin sol kenarına
    const genislik = heads.length > 1 ? median(heads.slice(1).map((h, i) => h.x0 - heads[i].x0)) : hh * 8;
    const kol = heads.map((h, i) => ({
      no: h.no, max: h.max,
      x0: h.x0 - genislik * 0.04,
      x1: i + 1 < heads.length ? heads[i + 1].x0 - genislik * 0.07 : h.x0 + genislik * 0.93,
    }));
    const solSinir = kol[0].x0;
    const sagSinir = kol[kol.length - 1].x1;

    // Eğim: başlık satırının eğiminden (fotoğraf hafif yamuk çekilmiş olabilir)
    const hx = heads[0].x0, hy = heads[0].cy;
    const egim = heads.length > 1 ? (heads[heads.length - 1].cy - hy) / (heads[heads.length - 1].x0 - hx) : 0;
    const duzY = (x, y) => y - egim * (x - hx);          // yamukluğu giderilmiş y
    const gercekY = (x, yd) => yd + egim * (x - hx);     // düz y -> fotoğraftaki y
    const kaydir = yd => -egim * (yd - hy);              // o satırda sütunların yatay kayması
    const basYd = Math.max(...heads.map(h => duzY(h.x0, h.cy))) + hh * 0.6;

    // Satırlar: ad/numara bölgesindeki kelimelerden
    const solKelimeler = ws.map(w => ({ ...w, yd: duzY(w.cx, w.cy) }))
      .filter(w => w.yd > basYd && w.x1 <= solSinir + kaydir(w.yd) + 4 && /[0-9a-zçğıöşü]/i.test(w.text))
      .sort((p, q) => p.yd - q.yd);
    const satirlar = [];
    for (const w of solKelimeler) {
      const s = satirlar.find(r => Math.abs(r.yd - w.yd) < hh * 0.6);
      if (s) s.ws.push(w); else satirlar.push({ yd: w.yd, ws: [w] });
    }
    satirlar.forEach(r => { r.yd = median(r.ws.map(w => w.yd)); });
    for (let i = satirlar.length - 1; i >= 0; i--) {
      const harf = satirlar[i].ws.map(w => w.text).join('').replace(/[^a-zçğıöşü]/gi, '').length;
      const no = satirlar[i].ws.some(w => /^\d{1,6}$/.test(w.text));
      if (harf < 3 && !no) satirlar.splice(i, 1);
    }
    satirlar.sort((p, q) => p.yd - q.yd);
    const satirH = satirlar.length > 1 ? median(satirlar.slice(1).map((r, i) => r.yd - satirlar[i].yd)) : hh * 2.5;
    const tumKelimeler = ws.map(w => ({ ...w, yd: duzY(w.cx, w.cy) }));

    const sonuc = [];
    for (const r of satirlar) {
      const dx = kaydir(r.yd);
      const adKelimeleri = r.ws.filter(w => /[a-zçğıöşü]/i.test(w.text)).sort((p, q) => p.x0 - q.x0);
      const noKelimesi = r.ws.find(w => /^\d{1,6}$/.test(w.text));
      const ad = adKelimeleri.map(w => w.text).join(' ').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü\s.'-]/g, '').trim();
      const puanlar = [], supheli = [], kirpik = [];
      kol.forEach(k => {
        const x0 = k.x0 + dx, x1 = k.x1 + dx;
        const icinde = tumKelimeler.filter(w => w.cx >= x0 && w.cx < x1 && Math.abs(w.yd - r.yd) < satirH * 0.45);
        let v = null, emin = false;
        for (const w of icinde) {
          const n = rakamMetni(w.text);
          if (n != null && w.conf >= 80) { v = n; emin = true; break; }
        }
        if (v == null) {
          const cy = gercekY((x0 + x1) / 2, r.yd);
          const h = hucreOku(norm, x0, cy - satirH * 0.46, x1, cy + satirH * 0.46);
          if (h && h.conf > 0.2) { v = h.value; emin = h.conf > 0.97; }
        }
        if (v != null && k.max != null && v > k.max) emin = false;
        puanlar.push(v); supheli.push(v == null || !emin);
        const cy = gercekY((x0 + x1) / 2, r.yd);
        kirpik.push(kes(src, x0, cy - satirH * 0.5, x1, cy + satirH * 0.5));
      });
      if (!ad && puanlar.every(v => v == null)) continue;
      const adCy = gercekY(solSinir / 2, r.yd);
      sonuc.push({ ad, no: noKelimesi ? noKelimesi.text : '', puanlar, supheli, kirpik,
        adKirpik: kes(src, Math.max(0, Math.min(...r.ws.map(w => w.x0)) - 6), adCy - satirH * 0.5, solSinir + dx, adCy + satirH * 0.5) });
    }
    return {
      sorular: kol.map(k => ({ no: k.no, max: k.max })),
      satirlar: sonuc,
      onizleme: { canvas: norm.canvas, kol, satirlar, satirH, egim },
    };
  }

  return { fromPhoto, fromFile, fromText, fromGrid, initOcr, son: null, CFG };
})();
