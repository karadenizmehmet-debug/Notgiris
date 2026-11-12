// Not Giriş — uygulama arayüzü
// Mehmet Karadeniz, 2026-2027
// Tüm veriler bu cihazın localStorage alanında tutulur; hiçbir yere gönderilmez.

const SURUM = '0.3.6';
const ANAHTAR = 'notgiris_v2';
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
  try {
    // Hücre resimleri yalnızca bellekte; kaydederken çıkar
    const kopya = JSON.parse(JSON.stringify(S, (k, v) => (k === 'kirpik' || k === 'adKirpik' ? undefined : v)));
    localStorage.setItem(ANAHTAR, JSON.stringify(kopya));
  } catch (e) { mesaj('Kaydedilemedi: telefon hafızası dolu olabilir.'); }
}
let S = yukle();
const aktif = () => S.sinavlar.find(x => x.id === S.aktif) || null;

function yeniSinav(ad) {
  const s = { id: Date.now().toString(36), ad: ad || 'Yeni sınav', sorular: [], ogrenciler: [], satirlar: [] };
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
  mesajZaman = setTimeout(() => { m.hidden = true; }, 3500);
}
const kucuk = s => (s || '').toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c])).replace(/[^a-z]/g, '');
function benzerlik(a, b) {
  a = kucuk(a); b = kucuk(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ikili = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = ikili(a), B = ikili(b);
  let ortak = 0;
  for (const [k, v] of A) ortak += Math.min(v, B.get(k) || 0);
  return (2 * ortak) / (a.length - 1 + b.length - 1);
}
const topla = p => p.reduce((t, v) => t + (Number(v) || 0), 0);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Sekmeler ----------
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => sekme(b.dataset.tab)));
function sekme(ad) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('aktif', b.dataset.tab === ad));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('aktif', t.id === 'tab-' + ad));
  if (ad === 'puan') tabloCiz();
  if (ad === 'ayar') ayarDoldur();
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
  S.aktif = e.target.value; sakla();
  sekme(document.querySelector('nav button.aktif').dataset.tab);
});

// ---------- Ayarlar ----------
function ayarDoldur() {
  const s = aktif();
  $('#sinavAd').value = s.ad;
  $('#sorular').value = s.sorular.map(v => v ?? '').join(',');
  $('#liste').value = s.ogrenciler.map(o => `${o.no} ${o.ad}`).join('\n');
}
function listeCoz(metin) {
  metin = metin.trim();
  if (!metin) return [];
  if (metin[0] === '[' || metin[0] === '{') {
    try {
      const j = JSON.parse(metin);
      const arr = Array.isArray(j) ? j : (j.ogrenciler || []);
      return arr.filter(o => o.ad).map(o => ({ no: String(o.no || '').trim(), ad: o.ad.trim() }));
    } catch (e) { mesaj('Yapıştırılan liste okunamadı.'); return null; }
  }
  const out = [];
  metin.split(/\r?\n/).forEach(satir => {
    const m = satir.match(/^\s*(\d{1,6})?\s*[\t ,;.\-]*\s*(.+?)\s*$/);
    if (m && /[a-zçğıöşü]/i.test(m[2])) out.push({ no: m[1] || '', ad: m[2] });
  });
  return out;
}
$('#sinavKaydet').addEventListener('click', () => {
  const s = aktif();
  const liste = listeCoz($('#liste').value);
  if (liste === null) return;
  s.ad = $('#sinavAd').value.trim() || s.ad;
  const sorular = $('#sorular').value.split(/[,;\s]+/).filter(v => v !== '').map(v => parseInt(v, 10));
  if (sorular.length) s.sorular = sorular.map(v => (v > 0 ? v : null));
  s.ogrenciler = liste;
  if (liste.length) s.satirlar.forEach(adDuzelt);
  sakla(); sinavSecCiz();
  mesaj('Kaydedildi.');
});
$('#yeniSinav').addEventListener('click', () => {
  const ad = prompt('Sınav adı:', '');
  if (ad === null) return;
  yeniSinav(ad.trim() || 'Yeni sınav');
  sinavSecCiz(); ayarDoldur();
});
$('#sinavSil').addEventListener('click', () => {
  const s = aktif();
  if (!confirm(`"${s.ad}" ve tüm puanları silinsin mi? Bu geri alınamaz.`)) return;
  S.sinavlar = S.sinavlar.filter(x => x !== s);
  S.aktif = S.sinavlar[0]?.id || null;
  if (!S.aktif) yeniSinav();
  sakla(); sinavSecCiz(); ayarDoldur();
});

// Okunan adı sınıf listesindeki en yakın adla değiştir
function adDuzelt(satir) {
  const s = aktif();
  if (!s.ogrenciler.length) return;
  if (satir.no) {
    const o = s.ogrenciler.find(x => x.no === satir.no);
    if (o && benzerlik(o.ad, satir.ad) > 0.3) { satir.ad = o.ad; satir.adEmin = true; return; }
  }
  let enIyi = null, puan = 0;
  for (const o of s.ogrenciler) {
    const b = benzerlik(o.ad, satir.ad);
    if (b > puan) { puan = b; enIyi = o; }
  }
  if (enIyi && puan >= 0.5) {
    satir.ad = enIyi.ad; satir.no = enIyi.no || satir.no;
    satir.adEmin = puan >= 0.8;
  } else satir.adEmin = false;
}

// ---------- Okuma ----------
function ilerleme(m) {
  const kutu = $('#ilerleme');
  kutu.hidden = false;
  const ad = { 'loading tesseract core': 'OCR motoru yükleniyor', 'loading language traineddata': 'Türkçe dil verisi yükleniyor',
    'initializing api': 'OCR hazırlanıyor', 'recognizing text': 'Yazılar okunuyor' }[m.status] || m.status;
  kutu.querySelector('small').textContent = ad;
  if (typeof m.progress === 'number') kutu.querySelector('span').style.width = Math.round(m.progress * 100) + '%';
}

function sonucEkle(r, kaynak) {
  const s = aktif();
  const n = r.sorular.length;
  // Soru puanları: başlıktan geldiyse ve ayarda yoksa al
  if (!s.sorular.length) s.sorular = r.sorular.map(q => q.max ?? null);
  else if (s.sorular.length < n) s.sorular = [...s.sorular, ...Array(n - s.sorular.length).fill(null)];
  let yeni = 0, guncel = 0;
  for (const satir of r.satirlar) {
    adDuzelt(satir);
    const eski = s.satirlar.findIndex(x => (satir.no && x.no === satir.no) || (satir.ad && kucuk(x.ad) === kucuk(satir.ad)));
    if (eski >= 0) { s.satirlar[eski] = satir; guncel++; } else { s.satirlar.push(satir); yeni++; }
  }
  sakla();
  tabloCiz();
  mesaj(`${kaynak}: ${yeni} yeni, ${guncel} güncellenen öğrenci. Renkli hücreleri kontrol edin.`);
}

async function oku(is, kaynak) {
  try {
    const r = await is();
    $('#ilerleme').hidden = true;
    if (!r.satirlar.length) { mesaj('Tabloda öğrenci satırı bulunamadı.'); return; }
    sonucEkle(r, kaynak);
  } catch (e) {
    console.error(e);
    $('#ilerleme').hidden = true;
    mesaj(e.message || String(e));
  }
}
$('#foto').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) oku(() => Table.fromPhoto(f, ilerleme), 'Fotoğraf');
});
$('#dosya').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) oku(() => Table.fromFile(f), 'Dosya');
});
$('#yapistirAc').addEventListener('click', () => { $('#yapistirAlan').hidden = false; $('#yapistirMetin').focus(); });
$('#yapistirKapat').addEventListener('click', () => { $('#yapistirAlan').hidden = true; });
$('#yapistirOku').addEventListener('click', () => {
  const t = $('#yapistirMetin').value;
  oku(async () => Table.fromText(t), 'Yapıştırma').then(() => { $('#yapistirAlan').hidden = true; $('#yapistirMetin').value = ''; });
});

// ---------- Deneme ----------
// Ayarlardaki sınıf listesiyle ayrı bir "DENEME" sınavı açar, rastgele not üretir.
$('#deneme').addEventListener('click', () => {
  const kaynak = aktif();
  const liste = kaynak.ogrenciler.length ? kaynak.ogrenciler : S.sinavlar.find(x => x.ogrenciler.length)?.ogrenciler;
  if (!liste || !liste.length) {
    alert('Önce sınıf listesini ekleyin:\n\n1) Firefox\'ta e-Okul not giriş sayfasında sağ alttaki Not Giriş panelinden “Listeyi Al”a basın.\n2) Not Giriş > Ayarlar > Sınıf listesi alanına yapıştırıp Kaydet\'e basın.\n3) Sonra yeniden Deneme\'ye basın.');
    return;
  }
  const tekNot = confirm('Tek not mu üretilsin (ör. 1. Sınav)?\n\nTamam: tek not (0-100)\nİptal: soru bazlı (10,20,30,40)');
  const s = yeniSinav('DENEME – kaydetmeyin');
  s.ogrenciler = liste.map(o => ({ ...o }));
  s.sorular = tekNot ? [100] : [10, 20, 30, 40];
  const rast = max => Math.round(max * (0.3 + Math.random() * 0.7));
  s.satirlar = s.ogrenciler.map(o => ({ ad: o.ad, no: o.no, adEmin: true, puanlar: s.sorular.map(rast), supheli: s.sorular.map(() => false) }));
  sakla(); sinavSecCiz(); tabloCiz();
  alert('Deneme sınavı oluşturuldu.\n\nDİKKAT: Bunlar rastgele notlar. e-Okul\'da “Puanları Doldur” ile yalnızca kutuların dolduğunu görün; e-Okul\'un Kaydet düğmesine BASMAYIN. Denemeden sonra sayfayı kaydetmeden kapatın.');
});

// ---------- Tablo ----------
function tabloCiz() {
  const s = aktif();
  const n = Math.max(s.sorular.length, ...s.satirlar.map(r => r.puanlar.length), 0);
  const thead = $('#tablo thead'), tbody = $('#tablo tbody');
  thead.innerHTML = '<tr><th>Ad Soyad</th>' +
    Array.from({ length: n }, (_, i) => `<th>${i + 1}<small>/${s.sorular[i] ?? '?'}</small></th>`).join('') +
    '<th>Top.</th><th></th></tr>';
  tbody.innerHTML = '';
  let supToplam = 0;
  s.satirlar.forEach((r, ri) => {
    const tr = document.createElement('tr');
    const adHucre = document.createElement('td');
    adHucre.className = 'ad' + (s.ogrenciler.length && !r.adEmin ? ' supheli' : '');
    adHucre.innerHTML = (r.adKirpik ? `<img src="${r.adKirpik}" alt="">` : '') +
      `<input value="${esc(r.ad)}" aria-label="Ad soyad">` + (r.no ? `<small>${esc(r.no)}</small>` : '');
    adHucre.querySelector('input').addEventListener('change', e => {
      r.ad = e.target.value.trim(); r.adEmin = true; adDuzelt(r); r.adEmin = true; sakla(); tabloCiz();
    });
    tr.appendChild(adHucre);

    for (let i = 0; i < n; i++) {
      const td = document.createElement('td');
      const v = r.puanlar[i];
      const max = s.sorular[i];
      const hata = v == null || (max != null && v > max);
      const sup = !hata && r.supheli?.[i];
      if (hata || sup) supToplam++;
      td.className = 'hucre' + (hata ? ' hata' : sup ? ' supheli' : '');
      td.innerHTML = (r.kirpik?.[i] ? `<img src="${r.kirpik[i]}" alt="">` : '') +
        `<input inputmode="numeric" pattern="[0-9]*" value="${v ?? ''}" aria-label="${ri + 1}. öğrenci ${i + 1}. soru">`;
      const inp = td.querySelector('input');
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('change', () => {
        r.puanlar[i] = inp.value === '' ? null : Number(inp.value);
        if (!r.supheli) r.supheli = [];
        r.supheli[i] = false;
        sakla(); tabloCiz();
      });
      tr.appendChild(td);
    }
    const top = document.createElement('td');
    top.className = 'top'; top.textContent = topla(r.puanlar);
    tr.appendChild(top);
    const sil = document.createElement('td');
    sil.innerHTML = '<button class="sil" aria-label="Satırı sil">✕</button>';
    sil.querySelector('button').addEventListener('click', () => {
      if (!confirm(`${r.ad || 'Bu satır'} silinsin mi?`)) return;
      s.satirlar.splice(ri, 1); sakla(); tabloCiz();
    });
    tr.appendChild(sil);
    tbody.appendChild(tr);
  });
  $('#ozet').textContent = s.satirlar.length
    ? `${s.satirlar.length} öğrenci${supToplam ? ` · ${supToplam} hücre kontrol bekliyor` : ' · hepsi kontrol edildi'}`
    : 'Henüz puan yok. Listenin fotoğrafını çekin, Excel dosyasını seçin ya da Excel\'den yapıştırın.';
  $('#altButonlar').hidden = !s.satirlar.length;
}

function aktarimVerisi() {
  const s = aktif();
  return {
    tip: 'notgiris', surum: 2, sinav: s.ad, sorular: s.sorular,
    kayitlar: s.satirlar.map(r => ({ no: r.no || '', ad: r.ad, puanlar: r.puanlar })),
  };
}
$('#kopyala').addEventListener('click', async () => {
  const s = aktif();
  const bekleyen = s.satirlar.reduce((t, r) => t + r.puanlar.filter((v, i) => v == null || r.supheli?.[i] || (s.sorular[i] != null && v > s.sorular[i])).length, 0);
  if (bekleyen && !confirm(`${bekleyen} hücre henüz kontrol edilmedi. Yine de kopyalansın mı?`)) return;
  const metin = JSON.stringify(aktarimVerisi());
  try {
    await navigator.clipboard.writeText(metin);
    mesaj(`${s.satirlar.length} öğrencinin puanları kopyalandı.`);
  } catch (e) {
    prompt('Kopyalanamadı. Aşağıdaki metni seçip kopyalayın:', metin);
  }
});
$('#csv').addEventListener('click', () => {
  const s = aktif();
  const n = Math.max(s.sorular.length, ...s.satirlar.map(r => r.puanlar.length));
  const bas = ['No', 'Ad Soyad', ...Array.from({ length: n }, (_, i) => `${i + 1}.soru`), 'Toplam'];
  const satirlar = [bas, ...s.satirlar.map(r => [r.no || '', r.ad, ...Array.from({ length: n }, (_, i) => r.puanlar[i] ?? ''), topla(r.puanlar)])];
  const csv = '﻿' + satirlar.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = (s.ad || 'puanlar').replace(/[^\wçğıöşüÇĞİÖŞÜ -]/g, '') + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('#temizle').addEventListener('click', () => {
  if (!confirm('Bu sınavın tüm puanları silinsin mi? Bu geri alınamaz.')) return;
  aktif().satirlar = []; sakla(); tabloCiz();
});

// ---------- Başlat ----------
if (!S.sinavlar.length) yeniSinav('Yeni sınav');
if (!aktif()) { S.aktif = S.sinavlar[0].id; sakla(); }
sinavSecCiz();
$('#surum').textContent = 'v' + SURUM;
$('#surumUst').textContent = 'v' + SURUM;

// ---------- Gece/gündüz modu ----------
function temaUygula(t) {
  document.documentElement.dataset.tema = t;
  $('#tema').textContent = t === 'gece' ? '☀️' : '🌙';
  document.querySelector('meta[name=theme-color]').content = t === 'gece' ? '#16263d' : '#1f3a5f';
}
let tema;
try { tema = localStorage.getItem('notgiris_tema'); } catch (e) { tema = null; }
temaUygula(tema || (matchMedia('(prefers-color-scheme: dark)').matches ? 'gece' : 'gunduz'));
$('#tema').addEventListener('click', () => {
  const yeni = document.documentElement.dataset.tema === 'gece' ? 'gunduz' : 'gece';
  temaUygula(yeni);
  try { localStorage.setItem('notgiris_tema', yeni); } catch (e) { /* yoksay */ }
});

// ---------- Paylaş ----------
$('#paylas').addEventListener('click', async () => {
  const url = new URL('.', location.href).href;
  const veri = { title: 'Not Giriş', text: 'Sınıf puan listesini e-Okul soru bazlı not girişine aktaran uygulama. Veriler telefonda kalır.', url };
  try {
    if (navigator.share) { await navigator.share(veri); return; }
    await navigator.clipboard.writeText(url);
    mesaj('Uygulama bağlantısı kopyalandı.');
  } catch (e) {
    if (e.name !== 'AbortError') prompt('Bağlantıyı kopyalayın:', url);
  }
});
sekme('puan');

if ('serviceWorker' in navigator) {
  const ilkKurulum = !navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW kaydı başarısız', e));
  // Yeni sürüm devreye girince sayfayı bir kez yenile
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!ilkKurulum) location.reload(); });
}
