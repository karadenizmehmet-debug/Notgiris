// ==UserScript==
// @name         Not Giriş – e-Okul soru bazlı puan doldurucu
// @namespace    https://karadenizmehmet-debug.github.io/notgiris/
// @version      0.1.0
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
        <button class="ng-b ana" id="ng-doldur">Puanları Doldur</button>
        <button class="ng-b" id="ng-liste">Listeyi Al (uygulamaya)</button>
        <div class="ng-s" id="ng-durum"></div>
      </div>
      <button class="ng-ac" id="ng-ac">Not Giriş</button>`;
    document.body.appendChild(p);
    const durum = t => { p.querySelector('#ng-durum').textContent = t; };

    p.querySelector('#ng-ac').onclick = () => p.classList.toggle('acik');

    p.querySelector('#ng-liste').onclick = async () => {
      const liste = ogrenciSatirlari().map(tr => { const no = satirNo(tr); return { no, ad: satirAd(tr, no) }; });
      if (!liste.length) { durum('Bu sayfada öğrenci satırı bulunamadı.'); return; }
      const metin = JSON.stringify(liste);
      try { await navigator.clipboard.writeText(metin); durum(`${liste.length} öğrenci kopyalandı. Uygulamada Sınav > Sınıf listesi alanına yapıştırın.`); }
      catch (e) { p.querySelector('#ng-veri').value = metin; durum('Kopyalanamadı: kutudaki metni seçip kopyalayın.'); }
    };

    p.querySelector('#ng-doldur').onclick = () => {
      let veri;
      try { veri = JSON.parse(p.querySelector('#ng-veri').value.trim()); }
      catch (e) { durum('Yapıştırılan metin okunamadı.'); return; }
      if (!veri || veri.tip !== 'notgiris' || !Array.isArray(veri.kayitlar)) { durum('Bu metin Not Giriş verisi değil.'); return; }

      const satirlar = new Map(ogrenciSatirlari().map(tr => [satirNo(tr), tr]));
      let dolan = 0;
      const bulunamayan = [], kutuSorunu = [];
      for (const k of veri.kayitlar) {
        const tr = satirlar.get(String(k.no));
        if (!tr) { bulunamayan.push(`${k.no} ${k.ad}`); continue; }
        const kutular = puanKutulari(tr);
        if (kutular.length < k.puanlar.length) { kutuSorunu.push(`${k.no} (${kutular.length} kutu, ${k.puanlar.length} soru)`); tr.style.background = '#fff3c4'; continue; }
        k.puanlar.forEach((v, i) => degerYaz(kutular[i], v == null ? '' : String(v)));
        tr.style.background = '#dff3e0';
        dolan++;
      }
      let t = `${dolan} öğrenci dolduruldu (yeşil satırlar).`;
      if (bulunamayan.length) t += `\nSayfada bulunamayan: ${bulunamayan.join(', ')}`;
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
