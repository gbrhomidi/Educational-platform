/* ==================== SERVICE WORKER (محسّن ومُعالَج) ==================== */
const CACHE_NAME = 'smart-learning-v7'; // تغيير الإصدار لضمان تحديث الكاش

const STATIC_ASSETS = [
    '/Educational-platform/',
    '/Educational-platform/index.html',
    '/Educational-platform/css/themes.css',
    '/Educational-platform/css/animations.css',
    '/Educational-platform/css/style.css',
    '/Educational-platform/js/error-handler.js',
    '/Educational-platform/js/store.js',
    '/Educational-platform/js/question-validator.js',
    '/Educational-platform/js/db.js',
    '/Educational-platform/js/translations.js',
    '/Educational-platform/js/theme-manager.js',
    '/Educational-platform/js/achievements.js',
    '/Educational-platform/js/network.js',
    '/Educational-platform/js/game.js',
    '/Educational-platform/js/audio.js',
    '/Educational-platform/js/splash.js',
    '/Educational-platform/js/adaptive-ai.js',
    '/Educational-platform/js/app-version.js',
    '/Educational-platform/js/ui.js',
    '/Educational-platform/js/constants.js',
    '/Educational-platform/js/app.js',
    '/Educational-platform/libs/dexie.min.js',
    '/Educational-platform/libs/confetti.browser.min.js',
    '/Educational-platform/libs/qrcode.min.js',
    '/Educational-platform/sw.js'
];

// Install: Cache static assets with error handling
self.addEventListener('install', event => {
    console.log('[SW] Installing new version');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                const results = await Promise.allSettled(
                    STATIC_ASSETS.map(async asset => {
                        try {
                            const response = await fetch(asset);
                            if (response.ok) {
                                await cache.put(asset, response);
                                console.log(`[SW] Cached: ${asset}`);
                            } else {
                                console.warn(`[SW] Failed to fetch ${asset}: ${response.status}`);
                            }
                        } catch (err) {
                            console.warn(`[SW] Error caching ${asset}:`, err);
                        }
                    })
                );
                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length) {
                    console.warn(`[SW] ${failed.length} assets failed to cache`);
                }
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('[SW] Installation failed:', err))
    );
});

// Activate: Clean old caches and take control
self.addEventListener('activate', event => {
    console.log('[SW] Activating new version');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log(`[SW] Deleting old cache: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Cache-first strategy with network fallback
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // تجاهل الطلبات غير GET أو خارج النطاق
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(self.location.origin)) return;
    if (url.pathname.includes('analytics') || url.pathname.includes('collect')) return;
    
    // التحقق مما إذا كان الطلب ضمن مسار التطبيق (لتجنب ملفات GitHub Pages الأخرى)
    if (!url.pathname.startsWith('/Educational-platform/') && url.pathname !== '/Educational-platform/') {
        // إذا كان الطلب لملف خارج نطاق التطبيق، نتركه للمتصفح
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                // تحديث الكاش في الخلفية للموارد غير المستندات
                if (event.request.destination !== 'document' && event.request.destination !== 'font') {
                    event.waitUntil(
                        fetch(event.request).then(networkResponse => {
                            if (networkResponse.ok) {
                                const clone = networkResponse.clone();
                                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                            }
                        }).catch(() => {})
                    );
                }
                return cached;
            }
            
            // محاولة جلب من الشبكة
            return fetch(event.request).then(networkResponse => {
                if (networkResponse.ok && event.request.destination !== 'document' && event.request.destination !== 'font') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => {
                // في حالة فشل الشبكة وعدم وجود كاش
                if (event.request.destination === 'document') {
                    return caches.match('/Educational-platform/index.html');
                }
                return new Response('⚠️ هذا المورد غير متوفر حالياً (لا يوجد اتصال بالإنترنت)', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/html; charset=utf-8'
                    })
                });
            });
        })
    );
});
