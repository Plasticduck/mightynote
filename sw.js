const CACHE_VERSION = 18;
const CACHE_NAME = `mighty-note-v${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/styles.css',
    '/app.js',
    '/dashboard.js',
    '/manifest.json',
    '/MW Logo.png',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install event - cache assets and skip waiting
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing version ${CACHE_VERSION}`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((error) => {
                console.log('[SW] Cache failed:', error);
            })
    );
    
    // Force the new service worker to activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating version ${CACHE_VERSION}`);
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('mighty-note-')) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        }).then(() => {
            // Notify all clients about the update
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: CACHE_VERSION
                    });
                });
            });
        })
    );
});

// Fetch event - Network first for app files, cache first for external resources
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    
    // Always go to network for API calls (no caching)
    if (url.pathname.startsWith('/.netlify/functions/') || url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Check if this is an app file (HTML, CSS, JS) that should use network-first
    const isAppFile = url.origin === location.origin && (
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname === '/'
    );
    
    if (isAppFile) {
        // Network-first strategy for app files
        event.respondWith(networkFirst(event.request));
    } else {
        // Cache-first strategy for other assets (images, fonts, external libs)
        event.respondWith(cacheFirst(event.request));
    }
});

// Network-first strategy: Try network, fall back to cache
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // If successful, update the cache
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If navigating and nothing in cache, return index.html
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }
        
        throw error;
    }
}

// Cache-first strategy: Try cache, fall back to network
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // For navigation requests, return the cached index
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }
        throw error;
    }
}

// Listen for skip waiting message from the page
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
