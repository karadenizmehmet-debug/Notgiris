// Not Giriş — uygulama arayüzü
// Mehmet Karadeniz, 2026-2027
// Tüm veriler bu cihazın localStorage alanında tutulur; hiçbir yere gönderilmez.

const SURUM = '0.1.0';
const ANAHTAR = 'notgiris_v1';
const $ = s => document.querySelector(s);

// ---------- Depolama ----------
function yukle() {
  try {
    const s = JSON.parse(localStorage.getItem(ANAHTAR));
    if (s && Array.isArray(s.sinavlar)) return s;
  } catch (e) { /* bozuk veri: yeniden başla */ }
  return { sinavlar: [], aktif: null };
}
function sakla() {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(S)); }
  catch (e) { mesaj('Kaydedilemedi: telefon hafızası dolu olabilir.'); }
}
let S = yukle();
const aktif = () => S.sinavlar.find(x => x.id === S.aktif) || null;

function yeniSinav(ad) {
  const s = { id: Date.now().toString(36), ad: ad || 'Yeni sınav', sorular: [], renk: 'kirmizi', ogrenciler: [], sonuclar: {} };
  S.sinavlar.push(s);
  S.aktif = s.id;
  sakla();
  return s;
}

// ---------- Yardımcılar ----------
let mesajZaman;
function mesaj(t) {
  const m = $('#mesaj');
  m.textContent = t; m.hidden = false;
  clearTimeout(mesajZaman);
  mesajZaman = setTimeout(() => { m.hidden = true; }, 3200);
}
const kucuk = s => (s || '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü]/g, '');
function benzerlik(a, b) {
  a = kucuk(a); b = kucuk(b);
  if (a.length < 2 || b.length < 2) return 0;
  const ikili = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = ikili(a), B = ikili(b);
  let ortak = 0;
  for (const [k, v] of A) ortak += Math.min(v, B.get(k) || 0);
  return (2 * ortak) / (a.length - 1 + b.length - 1);
}
const topla = p => p.reduce((t, v) => t + (Number(v) || 0), 0);

// ---------- Sekmeler ----------
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => sekme(b.dataset.tab)));
function sekme(ad) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('aktif', b.dataset.tab === ad));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('aktif', t.id === 'tab-' + ad));
  if (ad === 'liste') listeCiz();
  if (ad === 'sinav') sinavFormDoldur();
  if (ad === 'oku') okuHazirla();
}

// ---------- Sınav seçimi ----------
function sinavSecCiz() {
  const sel = $('#sinavSec');
  sel.innerHTML = '';
  S.sinavlar.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.ad;
    sel.appendChild(o);
  });
  if (S.aktif) sel.value = S.aktif;
}
$('#sinavSec').addEventListener('change', e => {
  S.aktif = e.target.value; sakla(); cur = null;
  const acik = document.querySelector('nav button.aktif').dataset.tab;
  sekme(acik);
});

// ---------- Sınav formu ----------
function sinavFormDoldur() {
  const s = aktif();
  if (!s) return;
  $('#sinavAd').value = s.ad;
  $('#sorular').value = s.sorular.join(',');
  $('#renk').value = s.renk;
  $('#liste').value = s.ogrenciler.map(o => `${o.no} ${o.ad}`).join('\n');
}
function listeCoz(metin) {
  metin = metin.trim();
  if (!metin) return [];
  if (metin[0] === '[' || metin[0] === '{') {
    try {
      const j = JSON.parse(metin);
      const arr = Array.isArray(j) ? j : (j.ogrenciler || []);
      return arr.filter(o => o.no).map(o => ({ no: String(o.no).trim(), ad: (o.ad || '').trim() }));
    } catch (e) { mesaj('Yapıştırılan liste okunamadı.'); return null; }
  }
  const out = [];
  metin.split(/\r?\n/).forEach(satir => {
    const m = satir.match(/^\s*(\d{1,6})\s*[\t ,;.\-]*\s*(.+?)\s*$/);
    if (m) out.push({ no: m[1], ad: m[2] });
  });
  return out;
}
$('#sinavKaydet').addEventListener('click', () => {
  const s = aktif() || yeniSinav();
  const liste = listeCoz($('#liste').value);
  if (liste === null) return;
  s.ad = $('#sinavAd').value.trim() || s.ad;
  s.sorular = $('#sorular').value.split(/[,;\s]+/).map(v => parseInt(v, 10)).filter(v => v > 0);
  s.renk = $('#renk').value;
  s.ogrenciler = liste;
  sakla(); sinavSecCiz();
  mesaj(`Kaydedildi: ${liste.length} öğrenci, ${s.sorular.length || 'otomatik'} soru.`);
});
$('#yeniSinav').addEventListener('click', () => {
  const ad = prompt('Sınav adı:', '');
  if (ad === null) return;
  yeniSinav(ad.trim() || 'Yeni sınav');
  sinavSecCiz(); sinavFormDoldur(); cur = null;
});
$('#sinavSil').addEventListener('click', () => {
  const s = aktif();
  if (!s) return;
  if (!confirm(`"${s.ad}" ve okunan tüm puanları silinsin mi? Bu geri alınamaz.`)) return;
  S.sinavlar = S.sinavlar.filter(x => x !== s);
  S.aktif = S.sinavlar[0]?.id || null;
  if (!S.aktif) yeniSinav();
  sakla(); sinavSecCiz(); sinavFormDoldur(); cur = null;
});

// ---------- Kâğıt okuma ----------
let cur = null; // { scores: {no: {value, ok, conf}}, total, sayfalar: [] , ogrenci }

function okuHazirla() {
  const s = aktif();
  const hazir = s && s.ogrenciler.length;
  $('#okuBos').hidden = !!hazir;
  $('#okuAlan').hidden = !hazir;
  if (!cur) $('#sonuc').hidden = true;
}

function ilerleme(m) {
  const kutu = $('#ilerleme');
  kutu.hidden = false;
  const ad = { 'loading tesseract core': 'OCR motoru yükleniyor', 'loading language traineddata': 'Türkçe dil verisi yükleniyor',
    'initializing api': 'OCR hazırlanıyor', 'recognizing text': 'Yazılar okunuyor' }[m.status] || m.status;
  kutu.querySelector('small').textContent = ad;
  if (typeof m.progress === 'number') kutu.querySelector('span').style.width = Math.round(m.progress * 100) + '%';
}

async function fotoOku(file, ekSayfa) {
  const s = aktif();
  if (!file || !s) return;
  try {
    const r = await Reader.read(file, { renk: s.renk, maxes: s.sorular, onProgress: ilerleme });
    $('#ilerleme').hidden = true;

    // Soru puanları belli değilse etiketlerden al
    if (!s.sorular.length && r.labels.length && r.labels.every(l => l.max)) {
      const enBuyuk = Math.max(...r.labels.map(l => l.no));
      s.sorular = Array.from({ length: enBuyuk }, (_, i) => r.labels.find(l => l.no === i + 1)?.max || 0);
      sakla();
      mesaj(`Soru puanları kâğıttan alındı: ${s.sorular.join(', ')}`);
    }

    let scores = r.scores;
    // Etiket bulunamadıysa: sayıları yukarıdan aşağı sırayla dağıt (hepsi şüpheli)
    if (!r.labels.length && s.sorular.length) {
      const sirali = [...r.numbers].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
      scores = {};
      s.sorular.forEach((_, i) => {
        const n = sirali[i];
        scores[i + 1] = n ? { value: n.value, conf: n.conf, box: n, ok: false } : { value: null, ok: false };
      });
      mesaj('Soru etiketleri bulunamadı, puanları kontrol edin.');
    }

    if (ekSayfa && cur) {
      Object.entries(scores).forEach(([no, v]) => { if (v.value != null || !cur.scores[no]) cur.scores[no] = v; });
      cur.sayfalar.push(r);
      if (!cur.total && r.total) cur.total = r.total;
    } else {
      cur = { scores, total: r.total, sayfalar: [r], ogrenci: ogrenciTahmin(r.header) };
    }
    sonucCiz();
  } catch (e) {
    console.error(e);
    $('#ilerleme').hidden = true;
    mesaj('Okuma hatası: ' + (e.message || e));
  }
}
$('#foto').addEventListener('change', e => { fotoOku(e.target.files[0], false); e.target.value = ''; });
$('#foto2').addEventListener('change', e => { fotoOku(e.target.files[0], true); e.target.value = ''; });

function siradakiOgrenci() {
  const s = aktif();
  return s.ogrenciler.find(o => !s.sonuclar[o.no]) || s.ogrenciler[0];
}

function ogrenciTahmin(baslik) {
  const s = aktif();
  const noEsles = baslik.match(/n[oö]\s*[:.]?\s*(\d{1,6})/i);
  if (noEsles) {
    const o = s.ogrenciler.find(x => x.no === noEsles[1]);
    if (o) return { no: o.no, neden: 'Kâğıttaki numaradan bulundu' };
  }
  let enIyi = null, puan = 0;
  for (const o of s.ogrenciler) {
    const b = benzerlik(baslik, o.ad) + 0.5 * Math.max(...o.ad.split(/\s+/).map(p => benzerlik(baslik, p)));
    if (b > puan) { puan = b; enIyi = o; }
  }
  if (enIyi && puan > 0.55) return { no: enIyi.no, neden: 'Kâğıttaki addan tahmin edildi, kontrol edin' };
  const sira = siradakiOgrenci();
  return { no: sira?.no, neden: 'Ad okunamadı: sıradaki öğrenci seçildi' };
}

function sonucCiz() {
  const s = aktif();
  $('#sonuc').hidden = false;

  const sel = $('#ogrenciSec');
  sel.innerHTML = '';
  s.ogrenciler.forEach(o => {
    const op = document.createElement('option');
    op.value = o.no;
    op.textContent = `${o.no} ${o.ad}${s.sonuclar[o.no] ? ' ✓' : ''}`;
    sel.appendChild(op);
  });
  sel.value = cur.ogrenci?.no || '';
  $('#ogrenciIpucu').textContent = cur.ogrenci?.neden || '';

  const n = s.sorular.length || Math.max(0, ...Object.keys(cur.scores).map(Number));
  const grid = $('#puanlar');
  grid.innerHTML = '';
  for (let i = 1; i <= n; i++) {
    const sc = cur.scores[i] || { value: null, ok: false };
    const max = s.sorular[i - 1];
    const kutu = document.createElement('div');
    kutu.className = 'puan';
    kutu.innerHTML = `<div class="baslik"><span>${i}. soru</span><span>/${max ?? '?'}</span></div>
      <input inputmode="numeric" pattern="[0-9]*" data-no="${i}" value="${sc.value ?? ''}">`;
    const inp = kutu.querySelector('input');
    const durum = () => {
      const v = inp.value === '' ? null : Number(inp.value);
      kutu.classList.remove('tamam', 'supheli', 'hata');
      if (v == null || Number.isNaN(v) || (max != null && v > max)) kutu.classList.add('hata');
      else if (!sc.ok && !inp.dataset.elle) kutu.classList.add('supheli');
      else kutu.classList.add('tamam');
    };
    inp.addEventListener('input', () => { inp.dataset.elle = '1'; cur.scores[i] = { value: inp.value === '' ? null : Number(inp.value), ok: true }; durum(); toplamCiz(); });
    inp.addEventListener('focus', () => inp.select());
    durum();
    grid.appendChild(kutu);
  }
  toplamCiz();
  onizlemeCiz();
}

function degerler() {
  const s = aktif();
  const n = s.sorular.length || Math.max(0, ...Object.keys(cur.scores).map(Number));
  return Array.from({ length: n }, (_, i) => cur.scores[i + 1]?.value ?? null);
}

function toplamCiz() {
  const s = aktif();
  const t = topla(degerler());
  $('#toplam').textContent = t;
  $('#toplamMax').textContent = topla(s.sorular) || '?';
  const kt = $('#kagitToplam');
  kt.className = '';
  if (cur.total) {
    kt.textContent = ` · kâğıtta ${cur.total.value}`;
    kt.classList.add(cur.total.value === t ? 'uyusur' : 'uyusmaz');
  } else kt.textContent = '';
}

function onizlemeCiz() {
  const r = cur.sayfalar[cur.sayfalar.length - 1];
  const c = $('#onizleme');
  c.width = r.canvas.width; c.height = r.canvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(r.canvas, 0, 0);
  ctx.lineWidth = Math.max(2, c.width / 400);
  ctx.strokeStyle = '#1e66d0';
  r.labels.forEach(l => ctx.strokeRect(l.x0, l.y0, l.x1 - l.x0, l.y1 - l.y0));
  ctx.strokeStyle = '#d32f2f';
  ctx.fillStyle = '#d32f2f';
  ctx.font = `bold ${Math.round(c.width / 40)}px sans-serif`;
  r.numbers.forEach(n => {
    ctx.strokeRect(n.x0 - 3, n.y0 - 3, n.x1 - n.x0 + 6, n.y1 - n.y0 + 6);
    ctx.fillText(String(n.value), n.x1 + 6, n.y1);
  });
}

$('#kaydet').addEventListener('click', () => {
  const s = aktif();
  const no = $('#ogrenciSec').value;
  if (!no) { mesaj('Öğrenci seçin.'); return; }
  const p = degerler();
  const hatali = p.findIndex((v, i) => v == null || (s.sorular[i] != null && v > s.sorular[i]));
  if (hatali >= 0 && !confirm(`${hatali + 1}. soruda boş ya da en yüksek puandan büyük değer var. Yine de kaydedilsin mi?`)) return;
  if (s.sonuclar[no] && !cur.duzenle && !confirm('Bu öğrencinin puanları zaten kayıtlı. Üzerine yazılsın mı?')) return;
  s.sonuclar[no] = { puanlar: p, ts: Date.now() };
  sakla();
  const o = s.ogrenciler.find(x => x.no === no);
  mesaj(`${o ? o.ad : no}: ${topla(p)} puan kaydedildi.`);
  cur = null;
  $('#sonuc').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Liste ----------
function listeCiz() {
  const s = aktif();
  const thead = $('#tablo thead'), tbody = $('#tablo tbody');
  thead.innerHTML = '<tr><th>No</th><th>Ad Soyad</th><th>Toplam</th><th></th></tr>';
  tbody.innerHTML = '';
  if (!s) return;
  let okunan = 0;
  s.ogrenciler.forEach(o => {
    const r = s.sonuclar[o.no];
    if (r) okunan++;
    const tr = document.createElement('tr');
    if (!r) tr.className = 'bos';
    tr.innerHTML = `<td>${o.no}</td><td></td><td>${r ? topla(r.puanlar) : '—'}</td><td>${r ? '<button class="sil">Sil</button>' : ''}</td>`;
    tr.children[1].textContent = o.ad;
    if (r) {
      tr.title = r.puanlar.join(' · ');
      tr.children[1].addEventListener('click', () => duzenle(o.no));
      tr.querySelector('.sil').addEventListener('click', () => {
        if (!confirm(`${o.ad} için okunan puanlar silinsin mi?`)) return;
        delete s.sonuclar[o.no]; sakla(); listeCiz();
      });
    }
    tbody.appendChild(tr);
  });
  $('#ozet').textContent = `${okunan} / ${s.ogrenciler.length} öğrenci okundu. Düzeltmek için ada dokunun.`;
}

function duzenle(no) {
  const s = aktif();
  const r = s.sonuclar[no];
  const scores = {};
  r.puanlar.forEach((v, i) => { scores[i + 1] = { value: v, ok: true }; });
  cur = { scores, total: null, sayfalar: [], ogrenci: { no, neden: 'Kayıtlı puanlar düzenleniyor' }, duzenle: true };
  sekme('oku');
  sonucCiz();
}

function aktarimVerisi() {
  const s = aktif();
  return {
    tip: 'notgiris', surum: 1, sinav: s.ad, sorular: s.sorular,
    kayitlar: s.ogrenciler.filter(o => s.sonuclar[o.no])
      .map(o => ({ no: o.no, ad: o.ad, puanlar: s.sonuclar[o.no].puanlar })),
  };
}
$('#kopyala').addEventListener('click', async () => {
  const veri = aktarimVerisi();
  if (!veri.kayitlar.length) { mesaj('Henüz okunmuş kâğıt yok.'); return; }
  const metin = JSON.stringify(veri);
  try {
    await navigator.clipboard.writeText(metin);
    mesaj(`${veri.kayitlar.length} öğrencinin puanları kopyalandı.`);
  } catch (e) {
    prompt('Kopyalanamadı. Aşağıdaki metni seçip kopyalayın:', metin);
  }
});
$('#csv').addEventListener('click', () => {
  const s = aktif();
  const n = s.sorular.length;
  const bas = ['No', 'Ad Soyad', ...Array.from({ length: n }, (_, i) => `S${i + 1}`), 'Toplam'];
  const satirlar = [bas, ...s.ogrenciler.map(o => {
    const p = s.sonuclar[o.no]?.puanlar || [];
    return [o.no, o.ad, ...Array.from({ length: n }, (_, i) => p[i] ?? ''), p.length ? topla(p) : ''];
  })];
  const csv = '﻿' + satirlar.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = (s.ad || 'puanlar').replace(/[^\wçğıöşüÇĞİÖŞÜ -]/g, '') + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

// ---------- Başlat ----------
if (!S.sinavlar.length) yeniSinav('Yeni sınav');
if (!aktif()) { S.aktif = S.sinavlar[0].id; sakla(); }
sinavSecCiz();
$('#surum').textContent = 'v' + SURUM;
sekme(aktif().ogrenciler.length ? 'oku' : 'sinav');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW kaydı başarısız', e));
}
