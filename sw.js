// キャッシュ対策のサービスワーカー。
// 同一オリジンのコード/HTML/CSS は常にサーバーから最新を取得し、
// 古いキャッシュで更新が見えない問題を防ぐ（ネットワーク優先）。
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // 旧キャッシュがあれば全削除
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // 別オリジン（three.js のCDN等）はブラウザ標準処理に任せる
  if (url.origin !== self.location.origin) return;

  // 自サイトのコード/HTML/CSS/JSON は毎回サーバーから取得（キャッシュ無効）
  const isCode = /\.(js|css|html|json)$/.test(url.pathname)
    || url.pathname.endsWith('/')
    || url.pathname === self.location.pathname;

  if (isCode) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => fetch(req)));
  }
});
