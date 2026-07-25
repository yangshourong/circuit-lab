/* 智能电路实验室 — 轻量 Service Worker (STUB)。
 * 策略：运行时缓存同源 GET 请求，离线时回退到已缓存资源，
 * 从而至少保证「应用外壳」可离线打开。未做构建产物哈希预缓存清单，
 * 属于 MVP 级别的离线支持；后续可升级为 vite-plugin-pwa 的预缓存。 */
const CACHE = 'circuit-lab-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // 仅缓存同源导航与静态资源；跨域请求直接走网络。
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
