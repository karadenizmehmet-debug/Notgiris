// ==UserScript==
// @name         Not Giriş – e-Okul soru bazlı puan doldurucu
// @namespace    https://karadenizmehmet-debug.github.io/notgiris/
// @version      0.5.0
// @description  Not Giriş uygulamasındaki puanları e-Okul not giriş ekranındaki kutulara yazar; e-Okul sınıf listesini uygulamaya aktarır. Kaydet düğmesine öğretmen basar.
// @author       Mehmet Karadeniz, 2026-2027
// @match        https://e-okul.meb.gov.tr/*
// @match        https://*.e-okul.meb.gov.tr/*
// @match        https://karadenizmehmet-debug.github.io/Notgiris/*
// @match        https://karadenizmehmet-debug.github.io/notgiris/*
// @updateURL    https://karadenizmehmet-debug.github.io/Notgiris/eokul.user.js
// @downloadURL  https://karadenizmehmet-debug.github.io/Notgiris/eokul.user.js
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Satırın kendi hücrelerinin yazısı; hücre içindeki iç içe tabloların yazısı sayılmaz
  // (e-Okul sayfa düzeni de tablo: dış satır tüm sayfanın yazısını içerir)
  function hucreler(tr) {
    return [...tr.cells].map(td => {
      let el = td;
      if (td.querySelector('table')) { el = td.cloneNode(true); el.querySelectorAll('table').forEach(t => t.remove()); }
      return el.textContent.trim().replace(/\s+/g, ' ');
    });
  }
  // Bir tablo satırındaki öğrenci numarasını bul: ad hücresinden önceki son rakam hücresi
  // (e-Okul'da önce sıra no, sonra öğrenci no gelir; sıra no alınırsa yanlış öğrenciye yazılabilir)
  function satirNo(tr) {
    const t = hucreler(tr);
    const adSira = t.findIndex(x => /[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/.test(x) && x.length < 60);
    const sayilar = t.map((x, i) => (/^\d{1,6}$/.test(x) ? i : -1)).filter(i => i >= 0);
    const once = sayilar.filter(i => adSira < 0 || i < adSira);
    const i = once.length ? once[once.length - 1] : sayilar[0];
    return i === undefined ? null : t[i];
  }
  function satirAd(tr, no) {
    return hucreler(tr).find(t => t !== no && /[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/.test(t) && t.length < 60) || '';
  }
  function puanKutulari(tr) {
    return [...tr.querySelectorAll('input')].filter(i => {
      const tip = (i.type || 'text').toLowerCase();
      return ['text', 'number', 'tel', ''].includes(tip) && !i.disabled && !i.readOnly && i.offsetParent !== null;
    });
  }
  // Sayfa ve aynı kökenli iç çerçeveler (e-Okul tabloyu çerçevede gösterebilir)
  function belgeler(d = document, out = []) {
    out.push(d);
    for (const f of d.querySelectorAll('iframe,frame')) {
      try { if (f.contentDocument) belgeler(f.contentDocument, out); } catch (e) { /* farklı köken */ }
    }
    return out;
  }
  function ogrenciSatirlari() {
    const uygun = belgeler().flatMap(d => [...d.querySelectorAll('tr')]).filter(tr => satirNo(tr) && satirAd(tr, satirNo(tr)));
    // Öğrenci satırları aynı tabloda kardeştir: en çok satırı olan tablo bölümünü al, sayfa düzeni satırlarını at
    const gruplar = new Map();
    uygun.forEach(tr => { const g = gruplar.get(tr.parentElement) || []; g.push(tr); gruplar.set(tr.parentElement, g); });
    let en = [];
    gruplar.forEach(g => { if (g.length > en.length) en = g; });
    return en;
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
    input.focus();
    try {
      const pencere = input.ownerDocument.defaultView || window;
      Object.getOwnPropertyDescriptor(pencere.HTMLInputElement.prototype, 'value').set.call(input, deger);
    } catch (e) { input.value = deger; }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // e-Okul masaüstü düzeninde telefonda sayfa küçültülmüş görünür; panel ekranın sağ altında
  // ve yakınlaştırmadan bağımsız olarak normal boyutta dursun (görsel görüntü alanına göre yerleşir).
  function yerlestirKur(p) {
    const v = window.visualViewport;
    if (!v) return;
    p.style.position = 'absolute';
    p.style.right = 'auto'; p.style.bottom = 'auto';
    p.style.transformOrigin = '0 0';
    let bekliyor = false;
    const yerlestir = () => {
      bekliyor = false;
      const k = 1 / v.scale;
      const ekranGen = v.width * v.scale;
      const acik = p.classList.contains('acik');
      p.style.width = (acik ? Math.min(420, ekranGen - 20) : 140) + 'px';
      p.style.transform = `scale(${k})`;
      // Açıkken ekranın üstünde, kapalıyken sağ altta; panel ekran yüksekliğini aşmaz, içi kayar
      const kutu = p.querySelector('.ng-kutu');
      if (kutu) kutu.style.maxHeight = Math.max(200, v.height * v.scale - 110) + 'px';
      const r = p.getBoundingClientRect();
      p.style.left = (v.pageLeft + v.width - r.width - 10 * k) + 'px';
      p.style.top = (acik ? v.pageTop + 10 * k : v.pageTop + v.height - r.height - 70 * k) + 'px';
    };
    const iste = () => { if (!bekliyor) { bekliyor = true; requestAnimationFrame(yerlestir); } };
    v.addEventListener('resize', iste);
    v.addEventListener('scroll', iste);
    window.addEventListener('scroll', iste);
    new MutationObserver(iste).observe(p, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true, characterData: true });
    yerlestir();
  }

  // ---------- Sütun bulma ----------
  // Kutunun satırdaki hücresi (kutu hücre içindeki küçük bir tabloda olabilir)
  function satirHucresi(tr, el) {
    let c = el.closest('td,th');
    while (c && c.parentElement !== tr) c = c.parentElement ? c.parentElement.closest('td,th') : null;
    return c;
  }
  // Aynı tablodaki başlık satırı (“Okul No · Adı Soyadı · 1.Sınav …”)
  function baslikSatiri(tr) {
    const tablo = tr.closest('table');
    if (!tablo) return null;
    for (const r of tablo.rows) {
      const h = hucreler(r).join(' ');
      if (/sınav|proje/i.test(h) && /ad/i.test(h)) return r;
    }
    return null;
  }
  function kutuEtiketleri(tr) {
    const bas = baslikSatiri(tr);
    const etik = bas ? hucreler(bas) : [];
    return puanKutulari(tr).map(i => { const c = satirHucresi(tr, i); return c ? (etik[c.cellIndex] || '') : ''; });
  }
  const sade = t => (t || '').toLocaleLowerCase('tr').replace(/\s+/g, '');
  // Hangi sütundan başlanacak: sınav adındaki “1. Sınav / 2. Yazılı / 1. Proje”, yoksa ilk boş sütun
  function otoBaslangic(satirlar, sinavAdi) {
    const ilk = satirlar[0];
    if (!ilk) return { i: 0, neden: '1. kutu' };
    const etik = kutuEtiketleri(ilk.tr);
    const n = etik.length;
    const m = (sinavAdi || '').toLocaleLowerCase('tr').match(/(\d)\s*\.?\s*(sınav|yazılı|yazili|proje)/);
    if (m) {
      const aranan = m[1] + '.' + (m[2] === 'proje' ? 'proje' : 'sınav');
      const i = etik.findIndex(e => sade(e).includes(aranan));
      if (i >= 0) return { i, neden: `“${etik[i]}” sütunu (sınav adından)` };
    }
    for (let i = 0; i < n; i++) {
      if (satirlar.every(x => { const k = puanKutulari(x.tr)[i]; return !k || !k.value.trim(); })) {
        return { i, neden: etik[i] ? `“${etik[i]}” sütunu (ilk boş sütun)` : `${i + 1}. kutu (ilk boş)` };
      }
    }
    return { i: 0, neden: etik[0] ? `“${etik[0]}” sütunu` : '1. kutu' };
  }

  // ---------- Uygulamadan gelen veri (Tampermonkey deposu; telefondan çıkmaz) ----------
  function kayitliVeri() {
    try { const v = JSON.parse(GM_getValue('veri', 'null')); return v && v.veri && v.veri.tip === 'notgiris' ? v : null; } catch (e) { return null; }
  }
  const saat = z => new Date(z).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  let otoDoldur = () => {};

  function paneliKur() {
    if (document.getElementById('ng-panel')) return;
    const p = document.createElement('div');
    p.id = 'ng-panel';
    p.innerHTML = `
      <style>
        #ng-panel{position:fixed;right:10px;bottom:10px;text-align:right;pointer-events:none;z-index:2147483647;font:14px system-ui,sans-serif}
        #ng-panel .ng-ac{background:#1f3a5f;color:#fff;border:0;border-radius:22px;padding:10px 16px;font-weight:600;box-shadow:0 2px 8px #0004}
        #ng-panel>*{pointer-events:auto}
        #ng-panel .ng-kutu{text-align:left;display:none;overflow:auto;box-sizing:border-box;background:#fff;color:#1d2430;width:100%;padding:12px;border-radius:12px;box-shadow:0 4px 16px #0005;margin-bottom:8px}
        #ng-panel.acik .ng-kutu{display:block}
        #ng-panel textarea{width:100%;height:80px;font-size:12px;box-sizing:border-box}
        #ng-panel button.ng-b{width:100%;margin-top:6px;padding:10px;border-radius:8px;border:1px solid #ccd;background:#f4f6f9;color:#1d2430;font-weight:600}
        #ng-panel button.ng-b.ana{background:#1f3a5f;color:#fff;border-color:#1f3a5f;font-size:15px}
        #ng-panel button.ng-b:disabled{opacity:.5}
        #ng-panel .ng-s{font-size:12px;color:#555;margin-top:6px;white-space:pre-line}
        #ng-panel .ng-hazir{background:#e8f1fb;border-radius:8px;padding:8px;margin-top:8px;font-size:13px}
        #ng-panel details{margin-top:8px;font-size:12px;color:#555}
        #ng-panel summary{cursor:pointer}
        #ng-panel .ng-x{float:right;border:0;background:none;font-size:18px;line-height:1;color:#555}
      </style>
      <div class="ng-kutu">
        <button class="ng-x" id="ng-kapat" aria-label="Kapat">✕</button>
        <b>Not Giriş</b>
        <div class="ng-hazir" id="ng-hazir"></div>
        <button class="ng-b ana" id="ng-doldur">Puanları Doldur</button>
        <div class="ng-s" id="ng-durum" style="color:#1f3a5f;font-weight:600"></div>
        <button class="ng-b" id="ng-liste">Sınıf listesini uygulamaya gönder</button>
        <details>
          <summary>Gelişmiş</summary>
          <div class="ng-s">Yazılacak sütun:
            <select id="ng-bas"><option value="oto">Otomatik</option></select></div>
          <div class="ng-s">Elle yapıştırma (uygulamadaki “e-Okul için kopyala”):</div>
          <textarea id="ng-veri" placeholder="Boş bırakırsanız uygulamadan gönderilen puanlar kullanılır"></textarea>
        </details>
      </div>
      <button class="ng-ac" id="ng-ac">Not Giriş</button>`;
    document.documentElement.appendChild(p);
    yerlestirKur(p);
    const $ = s => p.querySelector(s);
    const durum = t => { $('#ng-durum').textContent = t; };
    const satirlariAl = () => ogrenciSatirlari().map(tr => { const no = satirNo(tr); return { tr, no, ad: satirAd(tr, no) }; });

    function hazirCiz() {
      const v = kayitliVeri();
      $('#ng-hazir').innerHTML = '';
      if (!v) {
        $('#ng-hazir').textContent = 'Uygulamadan gönderilmiş puan yok. Not Giriş uygulamasında “e-Okul’a gönder”e basın.';
        return;
      }
      const b = document.createElement('b');
      b.textContent = v.veri.sinav || 'Sınav';
      $('#ng-hazir').append('Hazır: ', b, ` · ${v.veri.kayitlar.length} öğrenci\nGönderilme: ${saat(v.zaman)}`);
      $('#ng-hazir').style.whiteSpace = 'pre-line';
    }
    function secenekler() {
      const sat = ogrenciSatirlari()[0];
      const etik = sat ? kutuEtiketleri(sat) : [];
      const sel = $('#ng-bas'), eski = sel.value;
      sel.innerHTML = '<option value="oto">Otomatik</option>' +
        etik.map((e, i) => `<option value="${i}">${i + 1}. kutu${e ? ' – ' + e.replace(/[<>&"]/g, '') : ''}</option>`).join('');
      sel.value = [...sel.options].some(o => o.value === eski) ? eski : 'oto';
    }
    function ac() { hazirCiz(); secenekler(); p.classList.add('acik'); }

    $('#ng-ac').addEventListener('click', () => { if (p.classList.contains('acik')) p.classList.remove('acik'); else ac(); });
    $('#ng-kapat').addEventListener('click', () => p.classList.remove('acik'));

    $('#ng-liste').addEventListener('click', () => {
      const liste = ogrenciSatirlari().map(tr => { const no = satirNo(tr); return { no, ad: satirAd(tr, no) }; });
      if (!liste.length) { durum(`Bu sayfada öğrenci satırı bulunamadı. Sınıfı ve dersi seçip Listele’ye basın.\n(Bulunan: ${belgeler().length} belge, ${belgeler().reduce((t, d) => t + d.querySelectorAll('tr').length, 0)} satır, ${belgeler().reduce((t, d) => t + d.querySelectorAll('input').length, 0)} kutu)`); return; }
      GM_setValue('liste', JSON.stringify({ zaman: Date.now(), liste }));
      try { GM_setClipboard(liste.map(o => `${o.no} ${o.ad}`).join('\n'), 'text'); } catch (e) { /* depo yeterli */ }
      durum(`${liste.length} öğrenci uygulamaya gönderildi. Not Giriş uygulamasına dönün; liste kendiliğinden gelir.`);
    });

    // Puanları sayfadaki kutulara yaz; { dolan, metin } döner
    function doldur(veri) {
      const satirlar = satirlariAl();
      if (!satirlar.length) return { dolan: 0, metin: 'Bu sayfada öğrenci tablosu yok. Sınıfı, dersi ve sınav sütununu seçip Listele’ye basın.' };
      const sec = $('#ng-bas').value;
      const oto = otoBaslangic(satirlar, veri.sinav);
      const bas = sec === 'oto' ? oto.i : Number(sec) || 0;
      const kullanilan = new Set();
      let dolan = 0;
      const bulunamayan = [], kutuSorunu = [], tahmini = [];
      for (const k of veri.kayitlar) {
        const bul = satirBul(k, satirlar, kullanilan);
        if (!bul) { bulunamayan.push(k.ad || k.no); continue; }
        const tr = bul.s.tr;
        kullanilan.add(tr);
        const kutular = puanKutulari(tr).slice(bas);
        if (kutular.length < k.puanlar.length) { kutuSorunu.push(`${bul.s.ad} (${kutular.length} kutu, ${k.puanlar.length} soru)`); tr.style.background = '#fff3c4'; continue; }
        k.puanlar.forEach((v, i) => degerYaz(kutular[i], v == null ? '' : String(v)));
        tr.style.background = bul.emin ? '#dff3e0' : '#e3ecff';
        if (!bul.emin) tahmini.push(`${k.ad} → ${bul.s.ad}`);
        dolan++;
      }
      let t = `${dolan} öğrenci dolduruldu (yeşil satırlar).\nYazılan yer: ${sec === 'oto' ? oto.neden : `${bas + 1}. kutu`}`;
      if (bulunamayan.length) t += `\nSayfada bulunamayan: ${bulunamayan.join(', ')}`;
      if (tahmini.length) t += `\nAd benzerliğiyle eşleşen (mavi): ${tahmini.join(', ')}`;
      if (kutuSorunu.length) t += `\nKutu sayısı uymayan (sarı): ${kutuSorunu.join(', ')}`;
      t += '\nKontrol edip e-Okul’daki Kaydet düğmesine basın.';
      return { dolan, metin: t };
    }

    $('#ng-doldur').addEventListener('click', () => {
      let veri;
      const elle = $('#ng-veri').value.trim();
      if (elle) {
        try { veri = JSON.parse(elle); } catch (e) { durum('Yapıştırılan metin okunamadı.'); return; }
      } else {
        const v = kayitliVeri();
        if (!v) { durum('Önce Not Giriş uygulamasında “e-Okul’a gönder”e basın.'); return; }
        veri = v.veri;
      }
      if (!veri || veri.tip !== 'notgiris' || !Array.isArray(veri.kayitlar)) { durum('Bu metin Not Giriş verisi değil.'); return; }
      durum(doldur(veri).metin);
    });

    // Uygulamadan yeni gönderilen puanları kendiliğinden yaz. Her gönderim yalnızca bir kez
    // yazılır (yanlış sınıf/sütuna tekrar tekrar yazılmasın); yeniden yazmak için “Puanları Doldur”.
    otoDoldur = () => {
      const v = kayitliVeri();
      if (!v || GM_getValue('uygulanan', 0) >= v.zaman) return;
      if (Date.now() - v.zaman > 2 * 3600e3) return; // 2 saatten eski gönderim kendiliğinden yazılmaz
      if (!ogrenciSatirlari().length) return;
      ac();
      const sonuc = doldur(v.veri);
      if (sonuc.dolan > 0) GM_setValue('uygulanan', v.zaman);
      durum('Uygulamadan gelen puanlar kendiliğinden yazıldı.\n' + sonuc.metin);
    };

    // Uygulamadan puan gönderilmişse ve not giriş tablosu açıksa paneli aç; yeni gönderimse yaz
    if (kayitliVeri() && ogrenciSatirlari().length) ac();
    otoDoldur();
  }

  // ---------- Not Giriş uygulaması sayfası: uygulamayla konuş ----------
  // Mesajlar düz metin (JSON) olarak aynı sayfa içinde gider; hiçbir sunucuya gönderilmez.
  function uygulamaKoprusu() {
    const yolla = o => window.postMessage(JSON.stringify(Object.assign({ ngY: o.tur }, o)), location.origin);
    const durumYolla = () => yolla({ tur: 'durum', surum: GM_info.script.version, liste: JSON.parse(GM_getValue('liste', 'null')) });
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || typeof e.data !== 'string' || !e.data.startsWith('{"ngU"')) return;
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.ngU === 'sor') durumYolla();
      if (m.ngU === 'gonder' && m.veri && m.veri.tip === 'notgiris') {
        GM_setValue('veri', JSON.stringify({ zaman: Date.now(), veri: m.veri }));
        yolla({ tur: 'gonderildi', adet: m.veri.kayitlar.length });
      }
    });
    durumYolla();
  }

  if (/^https:\/\/karadenizmehmet-debug\.github\.io\/notgiris\//i.test(location.href)) {
    uygulamaKoprusu();
    return;
  }

  // Giriş ve yönlendirme sayfalarına dokunma: panel yalnızca öğrenci tablosu olan sayfada kurulur.
  let zaman = null;
  const gozcu = new MutationObserver(() => { clearTimeout(zaman); zaman = setTimeout(dene, 700); });
  function dene() {
    if (document.getElementById('ng-panel')) { gozcu.disconnect(); return; }
    if (ogrenciSatirlari().length) { paneliKur(); gozcu.disconnect(); }
  }
  if (/\/OKL\//i.test(location.pathname)) {
    // Uygulamada “e-Okul’a gönder”e basılınca açık e-Okul sekmesi hemen yazsın
    try { GM_addValueChangeListener('veri', () => { dene(); otoDoldur(); }); } catch (e) { /* desteklenmiyor */ }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { dene(); otoDoldur(); } });
    dene();
    if (!document.getElementById('ng-panel')) gozcu.observe(document.documentElement, { childList: true, subtree: true });
  }
  // Düğme görünmezse Tampermonkey menüsünden açılabilsin
  try { GM_registerMenuCommand('Not Giriş panelini aç', () => { paneliKur(); document.getElementById('ng-ac').click(); }); } catch (e) { /* menü desteklenmiyor */ }
})();
