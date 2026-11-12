// Not Giriş — Google ile giriş ve yönetici onayı
// Mehmet Karadeniz, 2026-2027
// Firebase projesi Künye ile ortaktır; Not Giriş yalnızca "notgiris_profiller" koleksiyonunu kullanır.
// Firebase'e yalnızca ad, e-posta ve onay durumu gider; puanlar ve öğrenci bilgileri telefonda kalır.

const ONBELLEK = 'notgiris_onay';   // son başarılı onay (internet yokken açılabilsin)
const ONBELLEK_GUN = 7;
const $ = s => document.querySelector(s);

function onbellekOku() {
  try { return JSON.parse(localStorage.getItem(ONBELLEK)); } catch (e) { return null; }
}
function onbellekYaz(v) {
  try { if (v) localStorage.setItem(ONBELLEK, JSON.stringify(v)); else localStorage.removeItem(ONBELLEK); } catch (e) { /* yoksay */ }
}
const onbellekGecerli = (uid) => {
  const o = onbellekOku();
  return !!(o && (!uid || o.uid === uid) && Date.now() - o.zaman < ONBELLEK_GUN * 864e5);
};

// Giriş ekranı durumları
function goster(durum, metin) {
  const g = $('#giris');
  if (durum === 'acik') { g.hidden = true; document.body.classList.remove('giriste'); return; }
  g.hidden = false; document.body.classList.add('giriste');
  $('#girisMetin').textContent = metin || '';
  $('#girisGoogle').hidden = durum !== 'giris';
  $('#girisYenile').hidden = durum !== 'bekliyor' && durum !== 'hata';
  $('#girisCikis').hidden = durum !== 'bekliyor';
  $('#girisBekle').hidden = durum !== 'kontrol';
}

goster('kontrol', 'Hesap kontrol ediliyor…');

let fb;
try {
  const [app, auth, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'),
  ]);
  fb = { ...app, ...auth, ...fs };
} catch (e) {
  // İnternet yok: son onay geçerliyse aç
  if (onbellekGecerli()) goster('acik');
  else goster('hata', 'İnternet bağlantısı gerekli. İlk girişte ve haftada bir onay kontrolü yapılır.');
}

if (fb) {
  const app = fb.initializeApp({
    apiKey: 'AIzaSyA2CtczZ6nbl1fFfS8Rnb7nFHDRHJV4X4s',
    authDomain: 'kunye-daa1d.firebaseapp.com',
    projectId: 'kunye-daa1d',
    storageBucket: 'kunye-daa1d.firebasestorage.app',
    messagingSenderId: '564683754253',
    appId: '1:564683754253:web:e9b857e87d79107faebe44',
  }, 'notgiris');
  const auth = fb.getAuth(app);
  const db = fb.getFirestore(app);
  const YONETICI = 'karadenizmehmet@gmail.com';
  const KOLEKSIYON = 'notgiris_profiller';
  let dinleyici = null;

  const hata = e => (e && e.code === 'permission-denied') ? 'Yetki hatası: Firebase kuralları eksik olabilir.' : (e && e.message) || String(e);

  $('#girisGoogle').addEventListener('click', async ev => {
    ev.preventDefault();
    const saglayici = new fb.GoogleAuthProvider();
    saglayici.setCustomParameters({ prompt: 'select_account' });
    try { await fb.signInWithPopup(auth, saglayici); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await fb.signInWithRedirect(auth, saglayici);
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        goster('giris', 'Giriş yapılamadı: ' + hata(e));
      }
    }
  });
  const cikis = async () => { onbellekYaz(null); if (dinleyici) dinleyici(); await fb.signOut(auth); };
  $('#girisCikis').addEventListener('click', cikis);
  $('#hesapCikis').addEventListener('click', () => { if (confirm('Çıkış yapılsın mı?')) cikis(); });
  $('#girisYenile').addEventListener('click', () => location.reload());

  fb.onAuthStateChanged(auth, async user => {
    if (dinleyici) { dinleyici(); dinleyici = null; }
    $('#hesapBolum').hidden = !user;
    $('#yonetimBolum').hidden = true;
    if (!user) { onbellekYaz(null); goster('giris', 'Uygulamayı kullanmak için Google hesabınızla giriş yapın. Giriş yaptıktan sonra yönetici onayı gerekir.'); return; }
    goster('kontrol', 'Hesap kontrol ediliyor…');
    $('#hesapAd').textContent = `${user.displayName || ''} (${user.email})`;
    const yonetici = (user.email || '').toLowerCase() === YONETICI;
    const ref = fb.doc(db, KOLEKSIYON, user.uid);
    try {
      let snap;
      try { snap = await fb.getDocFromServer(ref); } catch (e) { snap = await fb.getDoc(ref); }
      if (!snap.exists()) {
        await fb.setDoc(ref, {
          email: user.email,
          ad: user.displayName || user.email,
          durum: yonetici ? 'onayli' : 'bekliyor',
          rol: yonetici ? 'yonetici' : 'kullanici',
          kayit: fb.serverTimestamp(),
        });
      }
      // Onay canlı izlenir: yönetici onaylayınca ekran kendiliğinden açılır, kaldırınca kapanır
      dinleyici = fb.onSnapshot(ref, s => {
        const p = s.data();
        if (p && p.durum === 'onayli') {
          onbellekYaz({ uid: user.uid, zaman: Date.now() });
          goster('acik');
          if (yonetici) yonetimYukle();
        } else {
          onbellekYaz(null);
          goster('bekliyor', `Merhaba ${user.displayName || user.email}. Hesabınız yönetici onayı bekliyor. Onaylanınca bu ekran kendiliğinden açılır.`);
        }
      }, e => {
        if (onbellekGecerli(user.uid)) goster('acik');
        else goster('hata', 'Onay durumu alınamadı: ' + hata(e));
      });
    } catch (e) {
      if (onbellekGecerli(user.uid)) goster('acik');
      else goster('hata', 'Onay durumu alınamadı: ' + hata(e));
    }
  });

  // ---------- Yönetici: kullanıcı onayları ----------
  async function yonetimYukle() {
    const bolum = $('#yonetimBolum'), kap = $('#kullaniciListe');
    bolum.hidden = false;
    kap.textContent = 'Yükleniyor…';
    try {
      const qs = await fb.getDocs(fb.collection(db, KOLEKSIYON));
      const uyeler = [];
      qs.forEach(d => uyeler.push({ id: d.id, ...d.data() }));
      uyeler.sort((a, b) => (a.durum === 'bekliyor' ? 0 : 1) - (b.durum === 'bekliyor' ? 0 : 1) || String(a.ad).localeCompare(String(b.ad), 'tr'));
      const bekleyen = uyeler.filter(u => u.durum === 'bekliyor').length;
      $('#yonetimOzet').textContent = `${uyeler.length} kullanıcı${bekleyen ? ` · ${bekleyen} onay bekliyor` : ''}`;
      kap.textContent = '';
      for (const u of uyeler) {
        const satir = document.createElement('div');
        satir.className = 'uye';
        const bilgi = document.createElement('div');
        const ad = document.createElement('b'); ad.textContent = u.ad || u.email;
        const ep = document.createElement('small'); ep.textContent = u.email || '';
        const et = document.createElement('span');
        et.className = 'etiket ' + (u.durum === 'onayli' ? 'ok' : 'bekle');
        et.textContent = u.rol === 'yonetici' ? 'Yönetici' : u.durum === 'onayli' ? 'Onaylı' : 'Bekliyor';
        bilgi.append(ad, ' ', et, document.createElement('br'), ep);
        satir.appendChild(bilgi);
        if (u.rol !== 'yonetici') {
          const btn = document.createElement('div'); btn.className = 'butonlar';
          const b1 = document.createElement('button');
          if (u.durum === 'onayli') {
            b1.className = 'tehlike'; b1.textContent = 'Erişimi kaldır';
            b1.onclick = () => guncelle(u, { durum: 'bekliyor' }, `${u.ad || u.email} erişimi kaldırılsın mı?`);
          } else {
            b1.className = 'birincil'; b1.textContent = 'Onayla';
            b1.onclick = () => guncelle(u, { durum: 'onayli' });
            const b2 = document.createElement('button');
            b2.className = 'ikincil'; b2.textContent = 'Reddet';
            b2.onclick = async () => {
              if (!confirm(`${u.ad || u.email} isteği silinsin mi?`)) return;
              try { await fb.deleteDoc(fb.doc(db, KOLEKSIYON, u.id)); yonetimYukle(); } catch (e) { alert('Silinemedi: ' + hata(e)); }
            };
            btn.appendChild(b2);
          }
          btn.prepend(b1);
          satir.appendChild(btn);
        }
        kap.appendChild(satir);
      }
    } catch (e) {
      kap.textContent = 'Liste alınamadı: ' + hata(e);
    }
  }
  async function guncelle(u, veri, soru) {
    if (soru && !confirm(soru)) return;
    try { await fb.updateDoc(fb.doc(db, KOLEKSIYON, u.id), veri); yonetimYukle(); } catch (e) { alert('Kaydedilemedi: ' + hata(e)); }
  }
  $('#yonetimYenile').addEventListener('click', yonetimYukle);
}
