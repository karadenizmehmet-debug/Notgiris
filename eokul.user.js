// ==UserScript==
// @name         Not Giriş – e-Okul soru bazlı puan doldurucu
// @namespace    https://karadenizmehmet-debug.github.io/notgiris/
// @version      0.3.1
// @description  Not Giriş uygulamasından kopyalanan puanları e-Okul not giriş ekranındaki kutulara yazar. Kaydet düğmesine öğretmen basar.
// @author       Mehmet Karadeniz, 2026-2027
// @match        https://e-okul.meb.gov.tr/*
// @match        https://*.e-okul.meb.gov.tr/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Bir tablo satırındaki öğrenci numarasını bul (yalnızca rakamlardan oluşan ilk hücre)
  function satirNo(tr) {
    for (const td of tr.querySelectorAll('td')) {
      const t = td.textContent.trim();
      if (/^\d{1,6}$/.test(t)) return t;
    }
    return null;
  }
  function satirAd(tr, no) {
    const hucreler = [...tr.querySelectorAll('td')].map(td => td.textContent.trim().replace(/\s+/g, ' '));
    return hucreler.find(t => t !== no && /[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/.test(t) && t.length < 60) || '';
  }
  function puanKutulari(tr) {
    return [...tr.querySelectorAll('input')].filter(i => {
      const tip = (i.type || 'text').toLowerCase();
      return ['text', 'number', 'tel', ''].includes(tip) && !i.disabled && !i.readOnly && i.offsetParent !== null;
    });
  }
  function ogrenciSatirlari() {
    return [...document.querySelectorAll('tr')].filter(tr => satirNo(tr) && satirAd(tr, satirNo(tr)));
  }

  const kucuk = t => (t || '').toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c])).replace(/[^a-z]/g, '');
  function benzerlik(a, b) {
    a = kucuk(a); b = kucuk(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const ikili = t => { const m = new Map(); for (let i = 0; i < t.length - 1; i++) { const k = t.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
    const A = ikili(a), B = ikili(b);
    let ortak = 0;
    for (const [k, v] of A) ortak += Math.min(v, B.get(k) || 0);
    return (2 * ortak) / (a.length - 1 + b.length - 1);
  }
  // Önce numara, sonra ad (tam), sonra en yakın ad (tek ve açık farkla en iyi ise)
  function satirBul(k, satirlar, kullanilan) {
    const bos = satirlar.filter(s => !kullanilan.has(s.tr));
    if (k.no) { const s = bos.find(x => x.no === String(k.no)); if (s) return { s, emin: true }; }
    const tam = bos.filter(x => kucuk(x.ad) === kucuk(k.ad));
    if (tam.length === 1) return { s: tam[0], emin: true };
    const sirali = bos.map(x => ({ x, b: benzerlik(x.ad, k.ad) })).sort((p, q) => q.b - p.b);
    if (sirali[0] && sirali[0].b >= 0.75 && (!sirali[1] || sirali[0].b - sirali[1].b >= 0.1)) return { s: sirali[0].x, emin: false };
    return null;
  }

  function degerYaz(input, deger) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus();
    setter.call(input, deger);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function paneliKur() {
    if (document.getElementById('ng-panel')) return;
    const p = document.createElement('div');
    p.id = 'ng-panel';
    p.innerHTML = `
      <style>
        #ng-panel{position:fixed;right:10px;bottom:10px;z-index:2147483647;font:14px system-ui,sans-serif}
        #ng-panel .ng-ac{background:#1f3a5f;color:#fff;border:0;border-radius:22px;padding:10px 16px;font-weight:600;box-shadow:0 2px 8px #0004}
        #ng-panel .ng-kutu{display:none;background:#fff;color:#1d2430;width:min(330px,92vw);padding:12px;border-radius:12px;box-shadow:0 4px 16px #0005;margin-bottom:8px}
        #ng-panel.acik .ng-kutu{display:block}
        #ng-panel textarea{width:100%;height:90px;font-size:12px;box-sizing:border-box}
        #ng-panel button.ng-b{width:100%;margin-top:6px;padding:9px;border-radius:8px;border:1px solid #ccd;background:#f4f6f9;font-weight:600}
        #ng-panel button.ng-b.ana{background:#1f3a5f;color:#fff;border-color:#1f3a5f}
        #ng-panel .ng-s{font-size:12px;color:#555;margin-top:6px;white-space:pre-line}
      </style>
      <div class="ng-kutu">
        <b>Not Giriş</b>
        <div class="ng-s">Uygulamada “e-Okul için kopyala”ya basın, sonra buraya uzun basıp yapıştırın.</div>
        <textarea id="ng-veri" placeholder="Kopyalanan puanları buraya yapıştırın"></textarea>
        <div class="ng-s">Yazmaya başlanacak kutu (satırdaki sıra):
          <select id="ng-bas"><option value="0">1. kutu</option></select></div>
        <button class="ng-b ana" id="ng-doldur">Puanları Doldur</button>
        <button class="ng-b" id="ng-liste">Listeyi Al (uygulamaya)</button>
        <div class="ng-s" id="ng-durum"></div>
      </div>
      <button class="ng-ac" id="ng-ac">Not Giriş</button>`;
    document.body.appendChild(p);
    const durum = t => { p.querySelector('#ng-durum').textContent = t; };

    p.querySelector('#ng-ac').onclick = () => {
      p.classList.toggle('acik');
      // Satırdaki kutu sayısına göre başlangıç seçenekleri
      const sat = ogrenciSatirlari()[0];
      const n = sat ? puanKutulari(sat).length : 1;
      const sel = p.querySelector('#ng-bas'), eski = sel.value;
      sel.innerHTML = Array.from({ length: Math.max(1, n) }, (_, i) => `<option value="${i}">${i + 1}. kutu</option>`).join('');
      if (eski < n) sel.value = eski;
    };

    p.querySelector('#ng-liste').onclick = async () => {
      const liste = ogrenciSatirlari().map(tr => { const no = satirNo(tr); return { no, ad: satirAd(tr, no) }; });
      if (!liste.length) { durum('Bu sayfada öğrenci satırı bulunamadı.'); return; }
      const metin = JSON.stringify(liste);
      try { await navigator.clipboard.writeText(metin); durum(`${liste.length} öğrenci kopyalandı. Not Giriş > Ayarlar > Sınıf listesi alanına yapıştırıp Kaydet’e basın.`); }
      catch (e) { p.querySelector('#ng-veri').value = metin; durum('Kopyalanamadı: kutudaki metni seçip kopyalayın.'); }
    };

    p.querySelector('#ng-doldur').onclick = () => {
      let veri;
      try { veri = JSON.parse(p.querySelector('#ng-veri').value.trim()); }
      catch (e) { durum('Yapıştırılan metin okunamadı.'); return; }
      if (!veri || veri.tip !== 'notgiris' || !Array.isArray(veri.kayitlar)) { durum('Bu metin Not Giriş verisi değil.'); return; }

      const satirlar = ogrenciSatirlari().map(tr => { const no = satirNo(tr); return { tr, no, ad: satirAd(tr, no) }; });
      const kullanilan = new Set();
      let dolan = 0;
      const bulunamayan = [], kutuSorunu = [], tahmini = [];
      for (const k of veri.kayitlar) {
        const bul = satirBul(k, satirlar, kullanilan);
        if (!bul) { bulunamayan.push(k.ad || k.no); continue; }
        const tr = bul.s.tr;
        kullanilan.add(tr);
        const kutular = puanKutulari(tr).slice(Number(p.querySelector('#ng-bas').value) || 0);
        if (kutular.length < k.puanlar.length) { kutuSorunu.push(`${bul.s.ad} (${kutular.length} kutu, ${k.puanlar.length} soru)`); tr.style.background = '#fff3c4'; continue; }
        k.puanlar.forEach((v, i) => degerYaz(kutular[i], v == null ? '' : String(v)));
        tr.style.background = bul.emin ? '#dff3e0' : '#e3ecff';
        if (!bul.emin) tahmini.push(`${k.ad} → ${bul.s.ad}`);
        dolan++;
      }
      let t = `${dolan} öğrenci dolduruldu (yeşil satırlar).`;
      if (bulunamayan.length) t += `\nSayfada bulunamayan: ${bulunamayan.join(', ')}`;
      if (tahmini.length) t += `\nAd benzerliğiyle eşleşen (mavi): ${tahmini.join(', ')}`;
      if (kutuSorunu.length) t += `\nKutu sayısı uymayan (sarı): ${kutuSorunu.join(', ')}`;
      t += '\nKontrol edip e-Okul’daki Kaydet düğmesine basın.';
      durum(t);
    };
  }

  // Öğrenci tablosu olan çerçevede paneli göster (sayfa sonradan yüklenebilir)
  let zaman = null;
  const gozcu = new MutationObserver(() => { clearTimeout(zaman); zaman = setTimeout(dene, 500); });
  function dene() {
    if (document.body && ogrenciSatirlari().length >= 1) { paneliKur(); gozcu.disconnect(); }
  }
  dene();
  if (!document.getElementById('ng-panel')) gozcu.observe(document.documentElement, { childList: true, subtree: true });
})();
