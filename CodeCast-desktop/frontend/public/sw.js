const CACHE_NAME = 'codecast-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './assets/css/main-*.css',
  './assets/js/main-*.js',
  './assets/js/vendor-react-*.js',
  './assets/js/vendor-state-*.js',
  './assets/js/vendor-virtual-*.js',
  './assets/js/vendor-utils-*.js'
];

const DYNAMIC_CACHE = 'codecast-dynamic-v1';
const API_CACHE = 'codecast-api-v1';

const CACHE_LIMITS = {
  [CACHE_NAME]: { maxSize: 50 * 1024 * 1024, maxEntries: 100 },
  [DYNAMIC_CACHE]: { maxSize: 20 * 1024 * 1024, maxEntries: 50 },
  [API_CACHE]: { maxSize: 10 * 1024 * 1024, maxEntries: 30 }
};

const LRU_ACCESS_TIME_KEY = 'sw-lru-access-times';

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeCast - 离线模式</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #ffffff;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 24px;
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    h1 {
      font-size: 24px;
      margin-bottom: 12px;
      font-weight: 600;
      background: linear-gradient(135deg, #7c7cff, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      color: #94a3b8;
      margin-bottom: 32px;
      line-height: 1.6;
      font-size: 15px;
    }
    button {
      padding: 14px 32px;
      background: linear-gradient(135deg, #7c7cff, #a78bfa);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(124, 124, 255, 0.4);
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(124, 124, 255, 0.6);
    }
    button:active {
      transform: translateY(0);
    }
    .status {
      margin-top: 20px;
      font-size: 13px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📴</div>
    <h1>您当前处于离线状态</h1>
    <p>请检查您的网络连接后，点击下方按钮重新连接</p>
    <button onclick="window.location.reload()">重新连接</button>
    <div class="status" id="status"></div>
  </div>
  <script>
    window.addEventListener('online', () => {
      document.getElementById('status').textContent = '✅ 网络已恢复，正在刷新...';
      setTimeout(() => window.location.reload(), 1000);
    });
    window.addEventListener('offline', () => {
      document.getElementById('status').textContent = '❌ 网络已断开';
    });
  </script>
</body>
</html>`;

const DYNAMIC_CACHE = 'codecast-dynamic-v1';
const API_CACHE = 'codecast-api-v1';

const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('*')));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME &&
                        name !== DYNAMIC_CACHE &&
                        name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Removing old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => cleanupAllCaches())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin !== location.origin) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  if (isHTMLRequest(request)) {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
return new Response(OFFLINE_PAGE, {
      status: 503,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  } catch (error) {
    console.error('[SW] Cache First failed:', error);
    return new Response(OFFLINE_PAGE, {
      status: 503,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(OFFLINE_PAGE, {
      status: 503,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, networkResponse.clone());
        });
      }
      return networkResponse;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function handleAPIRequest(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok && shouldCacheAPI(request.url)) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] API request failed, checking cache...');
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: '离线状态' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|gif|ico|woff|woff2)$/.test(pathname);
}

function isHTMLRequest(request) {
  return request.headers.get('accept')?.includes('text/html');
}

function shouldCacheAPI(url) {
  return url.includes('/api/') && 
         !url.includes('/chat/stream') && 
         !url.includes('/upload');
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }

  if (event.data && event.data.type === 'LRU_CLEANUP') {
    cleanupAllCaches();
  }
});

async function getLRUAccessTimes() {
  try {
    const data = await indexedDB.open(LRU_ACCESS_TIME_KEY, 1);
    return data;
  } catch {
    return new Map();
  }
}

async function updateAccessTime(cacheName, url) {
  try {
    const cache = await caches.open(cacheName);
    const response = await cache.match(url);
    
    if (response) {
      const metadata = new Headers(response.headers);
      metadata.set('sw-access-time', Date.now().toString());
      
      const body = await response.blob();
      const newResponse = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: metadata
      });
      
      await cache.put(url, newResponse);
    }
  } catch (error) {
    console.warn('[SW] Failed to update access time:', error);
  }
}

async function getCacheSize(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let totalSize = 0;

  for (const request of keys) {
    try {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    } catch {
      continue;
    }
  }

  return { size: totalSize, entryCount: keys.length };
}

async function cleanupCache(cacheName) {
  const limit = CACHE_LIMITS[cacheName];
  
  if (!limit) return;

  const { size, entryCount } = await getCacheSize(cacheName);

  if (size <= limit.maxSize && entryCount <= limit.maxEntries) {
    return;
  }

  console.log(`[SW LRU] Cleaning up cache ${cacheName}. Current: ${(size / 1024 / 1024).toFixed(2)}MB/${(limit.maxSize / 1024 / 1024).toFixed(2)}MB, ${entryCount}/${limit.maxEntries} entries`);

  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  const entriesWithTime = [];

  for (const request of keys) {
    try {
      const response = await cache.match(request);
      let accessTime = 0;

      if (response) {
        const timeHeader = response.headers.get('sw-access-time');
        accessTime = timeHeader ? parseInt(timeHeader, 10) : 0;
      }

      entriesWithTime.push({ request, accessTime, url: request.url });
    } catch {
      entriesWithTime.push({ request, accessTime: 0, url: request.url });
    }
  }

  entriesWithTime.sort((a, b) => a.accessTime - b.accessTime);

  while (true) {
    const currentStats = await getCacheSize(cacheName);

    if (currentStats.size <= limit.maxSize && currentStats.entryCount <= limit.maxEntries) {
      break;
    }

    if (entriesWithTime.length === 0) break;

    const oldestEntry = entriesWithTime.shift();
    if (oldestEntry) {
      await cache.delete(oldestEntry.request);
      console.log(`[SW LRU] Evicted: ${oldestEntry.url}`);
    }
  }

  console.log('[SW LRU] Cleanup complete');
}

async function cleanupAllCaches() {
  for (const cacheName of Object.keys(CACHE_LIMITS)) {
    await cleanupCache(cacheName);
  }
}
