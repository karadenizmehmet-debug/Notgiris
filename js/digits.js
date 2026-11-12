// Not Giriş — el yazısı rakam tanıma (tamamen cihazda çalışır)
// Mehmet Karadeniz, 2026-2027
// Model: MNIST ile eğitilmiş küçük çok katmanlı ağ (784-256-128-10).

const Digits = (() => {
  let model = null;

  async function load() {
    if (model) return model;
    const res = await fetch('model/digits.json');
    const raw = await res.json();
    model = raw.w.map((layer, i) => ({
      rows: layer.map(r => Float32Array.from(r)),
      bias: Float32Array.from(raw.b[i]),
    }));
    return model;
  }

  // x: Float32Array(784), 0..1 (mürekkep = 1)
  function predict(x) {
    let a = x;
    model.forEach((layer, li) => {
      const out = new Float32Array(layer.rows.length);
      for (let j = 0; j < layer.rows.length; j++) {
        const w = layer.rows[j];
        let s = layer.bias[j];
        for (let k = 0; k < w.length; k++) s += w[k] * a[k];
        out[j] = li < model.length - 1 ? Math.max(0, s) : s;
      }
      a = out;
    });
    const m = Math.max(...a);
    const e = Array.from(a, v => Math.exp(v - m));
    const sum = e.reduce((p, c) => p + c, 0);
    const probs = e.map(v => v / sum);
    let best = 0;
    probs.forEach((p, i) => { if (p > probs[best]) best = i; });
    return { digit: best, prob: probs[best], probs };
  }

  // İkili maske parçasını (genişlik w, yükseklik h, Uint8Array) MNIST biçimine çevir:
  // en uzun kenar 20 piksel, kütle merkezi 28x28 alanın ortasında.
  function toMnist(mask, w, h) {
    const src = document.createElement('canvas');
    src.width = w; src.height = h;
    const sctx = src.getContext('2d');
    const img = sctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = mask[i] ? 255 : 0;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);

    const scale = 20 / Math.max(w, h);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const small = document.createElement('canvas');
    small.width = tw; small.height = th;
    const ctx = small.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, tw, th);
    const d = ctx.getImageData(0, 0, tw, th).data;

    let vals = new Float32Array(tw * th);
    let max = 0;
    for (let i = 0; i < tw * th; i++) { vals[i] = d[i * 4] / 255; if (vals[i] > max) max = vals[i]; }
    if (max > 0) vals = vals.map(v => Math.min(1, v / max));

    // İnce kalem izlerini kalınlaştır (MNIST çizgileri kalındır)
    const ink = vals.reduce((p, c) => p + c, 0) / (tw * th);
    if (ink < 0.18) vals = dilate(vals, tw, th);

    let sx = 0, sy = 0, sm = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const v = vals[y * tw + x]; sx += x * v; sy += y * v; sm += v;
    }
    const cx = sm ? sx / sm : tw / 2;
    const cy = sm ? sy / sm : th / 2;
    const ox = Math.round(14 - cx);
    const oy = Math.round(14 - cy);
    const out = new Float32Array(784);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const X = x + ox, Y = y + oy;
      if (X >= 0 && X < 28 && Y >= 0 && Y < 28) out[Y * 28 + X] = vals[y * tw + x];
    }
    return out;
  }

  function dilate(v, w, h) {
    const o = new Float32Array(v.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = v[y * w + x];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && X < w && Y >= 0 && Y < h) m = Math.max(m, v[Y * w + X] * 0.85);
      }
      o[y * w + x] = m;
    }
    return o;
  }

  return { load, predict, toMnist };
})();
