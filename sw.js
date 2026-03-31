// Service Worker for 業務かるがも
// 真っ白問題対策: HTMLはキャッシュしない、アセットのみキャッシュ
const CACHE_NAME = 'karugamo-v2';
const CACHE_ASSETS = [
  '/assets/icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 外部API・認証系は常にネットワーク（キャッシュしない）
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('line.me') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('googleapis.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTMLファイルは常にネットワーク優先（キャッシュしない）
  // → これが真っ白の原因: キャッシュされた古いHTMLが返される
  if (e.request.destination === 'document' ||
      url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/app.html').then(r => r || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // アセット: キャッシュ優先
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.destination === 'image') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
