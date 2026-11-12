// Not Giriş — çevrimdışı önbellek. Mehmet Karadeniz, 2026-2027
const CACHE = 'notgiris-v0.2.0';
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
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
