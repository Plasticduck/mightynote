const CACHE_VERSION = 22;
const CACHE_NAME = `mighty-ops-v${CACHE_VERSION}`;

// Only cache external libraries and static assets - NOT app files
const ASSETS_TO_CACHE = [
    '/MW Logo.png',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js'
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

// Activate event - clean up old caches, logout users, and take control
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating version ${CACHE_VERSION}`);
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && (cacheName.startsWith('mighty-note-') || cacheName.startsWith('mighty-ops-'))) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        }).then(() => {
            // Notify all clients to logout and refresh (version change = force re-login)
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'FORCE_LOGOUT',
                        version: CACHE_VERSION
                    });
                });
            });
        })
    );
});

// Fetch event - Network ONLY for app files, cache for external resources only
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    
    // Always go to network for API calls (no caching)
    if (url.pathname.startsWith('/.netlify/functions/') || url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Check if this is an app file (HTML, CSS, JS) - ALWAYS use network only
    const isAppFile = url.origin === location.origin && (
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname === '/'
    );
    
    if (isAppFile) {
        // Network ONLY for app files - no caching at all
        event.respondWith(fetch(event.request));
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
        
        // If navigating and nothing in cache, return login.html
        if (request.mode === 'navigate') {
            return caches.match('/login.html');
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
        // For navigation requests, return the cached login
        if (request.mode === 'navigate') {
            return caches.match('/login.html');
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
