// Not Giriş — uygulama arayüzü
// Mehmet Karadeniz, 2026-2027
// Tüm veriler bu cihazın localStorage alanında tutulur; hiçbir yere gönderilmez.

const SURUM = '0.6.0';
const YARDIMCI_GEREKEN = '0.4.0'; // e-Okul yardımcısının (eokul.user.js) en az bu sürümü
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
    alert('Önce sınıf listesi gerekli:\n\n1) Firefox\'ta e-Okul not giriş sayfasını açın.\n2) Not Giriş panelinde “Sınıf listesini uygulamaya gönder”e basın.\n3) Bu uygulamaya dönün; liste kendiliğinden gelir. Sonra yeniden Deneme\'ye basın.');
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
async function panoyaKopyala(metin, adet) {
  try {
    await navigator.clipboard.writeText(metin);
    mesaj(`${adet} öğrencinin puanları kopyalandı.`);
  } catch (e) {
    prompt('Kopyalanamadı. Aşağıdaki metni seçip kopyalayın:', metin);
  }
}
$('#kopyala').addEventListener('click', () => {
  const s = aktif();
  const bekleyen = s.satirlar.reduce((t, r) => t + r.puanlar.filter((v, i) => v == null || r.supheli?.[i] || (s.sorular[i] != null && v > s.sorular[i])).length, 0);
  if (bekleyen && !confirm(`${bekleyen} hücre henüz kontrol edilmedi. Yine de gönderilsin mi?`)) return;
  const veri = aktarimVerisi();
  // Yardımcı kuruluysa doğrudan ona ver; değilse panoya kopyala
  if (yardimciTamam()) {
    bekleyenGonderim = setTimeout(() => { bekleyenGonderim = null; panoyaKopyala(JSON.stringify(veri), s.satirlar.length); }, 1500);
    yardimciyaYolla({ ngU: 'gonder', veri });
  } else panoyaKopyala(JSON.stringify(veri), s.satirlar.length);
});

// ---------- e-Okul yardımcısı (Tampermonkey betiği) ile konuşma ----------
// Betik bu sayfada da çalışır; mesajlar aynı sayfa içinde kalır, hiçbir sunucuya gitmez.
let yardimci = null, bekleyenGonderim = null;
const surumSayi = v => String(v || '0').split('.').map(Number).reduce((t, x, i) => t + (x || 0) * [1e6, 1e3, 1][i], 0);
const yardimciTamam = () => yardimci && surumSayi(yardimci.surum) >= surumSayi(YARDIMCI_GEREKEN);
const yardimciyaYolla = o => window.postMessage(JSON.stringify(o), location.origin);
function yardimciCiz() {
  const d = $('#yardimciDurum');
  if (!yardimci) {
    d.className = 'yardimci yok';
    d.innerHTML = 'e-Okul yardımcısı bu tarayıcıda kurulu değil. <a href="eokul.user.js">Kur</a> (Firefox + Tampermonkey gerekir)';
  } else if (!yardimciTamam()) {
    d.className = 'yardimci eski';
    d.innerHTML = `e-Okul yardımcısı eski (v${esc(yardimci.surum)}). <a href="eokul.user.js">Güncelle</a>`;
  } else {
    d.className = 'yardimci var';
    d.textContent = `✓ e-Okul yardımcısı kurulu (v${yardimci.surum})`;
  }
  $('#kopyala').textContent = yardimciTamam() ? "e-Okul'a gönder" : 'e-Okul için kopyala';
}
function listeGeldi(l) {
  if (!l || !Array.isArray(l.liste) || !l.liste.length) return;
  if (l.zaman <= (S.listeZaman || 0)) return;
  S.listeZaman = l.zaman;
  const s = aktif();
  s.ogrenciler = l.liste.filter(o => o.ad).map(o => ({ no: String(o.no || ''), ad: o.ad }));
  s.satirlar.forEach(adDuzelt);
  sakla(); tabloCiz();
  if ($('#tab-ayar').classList.contains('aktif')) ayarDoldur();
  mesaj(`e-Okul'dan ${s.ogrenciler.length} öğrencilik sınıf listesi alındı.`);
}
window.addEventListener('message', e => {
  if (e.origin !== location.origin || typeof e.data !== 'string' || !e.data.startsWith('{"ngY"')) return;
  let m;
  try { m = JSON.parse(e.data); } catch (err) { return; }
  if (m.ngY === 'durum') { yardimci = { surum: m.surum }; yardimciCiz(); kurulumCiz(); listeGeldi(m.liste); }
  if (m.ngY === 'gonderildi' && bekleyenGonderim) {
    clearTimeout(bekleyenGonderim); bekleyenGonderim = null;
    alert(`${m.adet} öğrencinin puanları e-Okul yardımcısına gönderildi.\n\nFirefox'ta e-Okul not giriş sayfasını açıp Listele'ye basın; panel kendiliğinden açılır. “Puanları Doldur”a basın, kontrol edip Kaydet'e siz basın.`);
  }
});
// ---------- Kurulum ekranı ----------
// Firefox + Tampermonkey + güncel e-Okul yardımcısı yoksa uygulama açılmaz.
// Yalnızca geliştirici için kaçış: adresin sonuna ?kurulum=atla
const firefoxMu = /Firefox\//.test(navigator.userAgent);
let kurulumAtla = false;
try { kurulumAtla = new URLSearchParams(location.search).get('kurulum') === 'atla'; } catch (e) { /* yoksay */ }
let kurulumIlk = true;
let kurulumKapaniyor = false;
function kurulumCiz() {
  const k = $('#kurulum');
  const kapat = () => { k.hidden = true; document.body.classList.remove('kurulumda'); };
  if (kurulumAtla) { kapat(); return; }
  const tamam = yardimciTamam();
  if (tamam && (k.hidden || kurulumIlk)) { kapat(); return; } // zaten kurulu: ekranı hiç gösterme
  if (kurulumKapaniyor) return;
  k.hidden = false; document.body.classList.add('kurulumda');
  // Yapılan her adım sönükleşir. Sayfa Tampermonkey'i göremez: “ekle”ye dokunup dönülünce
  // eklendi sayılır; yardımcı görünürse Tampermonkey zaten kuruludur.
  const adim = tamam ? 4 : !firefoxMu ? 1 : (yardimci || tmEklendi()) ? 3 : 2;
  [1, 2, 3].forEach(i => {
    const li = $('#kurA' + i);
    li.className = i < adim ? 'tamam' : i === adim ? 'sirada' : 'bekliyor';
  });
  $('#kurTMTekrar').hidden = !!yardimci || adim < 3;
  $('#kurBetik').textContent = yardimci ? 'Yardımcıyı güncelle' : 'Yardımcıyı kur';
  const d = $('#kurDurum');
  d.classList.toggle('tamam', tamam);
  d.textContent = tamam ? '✓ Kurulum tamam. Uygulama açılıyor…'
    : !firefoxMu ? 'Şu an Firefox dışında bir tarayıcıdasınız.'
    : yardimci ? `Yardımcı eski (v${yardimci.surum}); güncelleyin.`
    : kurulumIlk ? 'Kontrol ediliyor…'
    : 'e-Okul yardımcısı bulunamadı. Kurulunca bu ekran kendiliğinden kapanır.';
  if (tamam) { kurulumKapaniyor = true; setTimeout(() => { kurulumKapaniyor = false; kapat(); }, 1500); }
}
{
  // Chrome'dan Firefox'ta açma: Firefox yoksa Play Store'a gider
  const adres = new URL('.', location.href);
  const magaza = 'https://play.google.com/store/apps/details?id=org.mozilla.firefox';
  $('#kurFirefox').href = /Android/i.test(navigator.userAgent)
    ? `intent://${adres.host}${adres.pathname}#Intent;scheme=https;package=org.mozilla.firefox;S.browser_fallback_url=${encodeURIComponent(magaza)};end`
    : 'https://www.mozilla.org/tr/firefox/';
}
function tmEklendi() { try { return localStorage.getItem('notgiris_tm') === '1'; } catch (e) { return false; } }
function tmIsaretle(v) { try { if (v) localStorage.setItem('notgiris_tm', '1'); else localStorage.removeItem('notgiris_tm'); } catch (e) { /* yoksay */ } }
$('#kurTM').addEventListener('click', () => tmIsaretle(true));
$('#kurTMTekrar').addEventListener('click', e => { e.preventDefault(); tmIsaretle(false); kurulumCiz(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  kurulumCiz();
  // Tampermonkey betiği yalnızca sayfa açılırken çalışır: kurulumdan dönünce sayfayı bir kez yenile
  if (!$('#kurulum').hidden && firefoxMu && !yardimciTamam()) {
    yardimciyaYolla({ ngU: 'sor' });
    setTimeout(() => { if (!yardimciTamam()) location.reload(); }, 1000);
  }
});
kurulumCiz();
setTimeout(() => { kurulumIlk = false; kurulumCiz(); }, 1500);
// Kurulum ekranındayken yardımcıyı ara ara yokla (kurulumdan dönünce kendiliğinden kapanır)
setInterval(() => { if (!$('#kurulum').hidden) yardimciyaYolla({ ngU: 'sor' }); }, 2000);

// Uygulamaya her dönüşte yeni liste var mı diye sor
document.addEventListener('visibilitychange', () => { if (!document.hidden) yardimciyaYolla({ ngU: 'sor' }); });

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
yardimciCiz();
yardimciyaYolla({ ngU: 'sor' });
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
