// Lance a Lance: guarda o app no aparelho para funcionar sem internet.
const CACHE = 'lance-a-lance-v5';
const FILES = ['./', 'index.html', 'app.css', 'pieces.css', 'app.js', 'core.js', 'engine.js', 'content.js', 'puzzles.js', 'chess.js',
  'stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm', 'stockfish-10.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const save = (req, res) => { if (res && res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.chess.com') return; // dados ao vivo
  if (url.origin === location.origin){
    // arquivos do app: tenta a versão nova; sem internet, usa a guardada
    e.respondWith(fetch(req).then(res => save(req, res)).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || caches.match('index.html'))));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => save(req, res))));
  }
});
