// Not Giriş — çevrimdışı önbellek. Mehmet Karadeniz, 2026-2027
// Uygulama dosyaları: önce ağ (güncelleme hemen gelsin), ağ yoksa önbellek.
// Büyük dosyalar (OCR motoru, dil verisi, model): önce önbellek.
const CACHE = 'notgiris-v0.3.4';
const BUYUK = ['vendor/', 'lang/', 'model/', 'icons/'];
const FILES = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/app.js', 'js/table.js', 'js/digits.js', 'model/digits.json',
  'vendor/tesseract.min.js', 'vendor/xlsx.full.min.js', 'vendor/worker.min.js',
  'vendor/tesseract-core-lstm.wasm.js', 'vendor/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract-core-relaxedsimd-lstm.wasm.js',
  'lang/tur.traineddata.gz', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const yol = url.pathname.split('/').slice(2).join('/');
  if (BUYUK.some(b => yol.startsWith(b))) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
    return;
  }
  // no-cache: tarayıcının 10 dakikalık HTTP önbelleğini atla, sunucuya sor (ETag ile)
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => {
    if (r.ok) { const k = r.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
