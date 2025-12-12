const CACHE_NAME = 'music-pwa-v12';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/main.js',
  './js/utils/EventBus.js',
  './js/services/DatabaseService.js',
  './js/services/FileSystemService.js',
  './js/services/MetadataService.js',
  './js/services/PlaybackService.js',
  './js/services/ThemeService.js',
  './js/services/VisualizerService.js',
  './js/visualizer/utils.js',
  './js/visualizer/AudioEngine.js',
  './js/visualizer/VisualizerEngine.js',
  './js/visualizer/patterns/index.js',
  './js/visualizer/patterns/needles.js',
  './js/visualizer/patterns/breath.js',
  './js/visualizer/patterns/horizon.js',
  './js/visualizer/patterns/grid.js',
  './js/visualizer/patterns/mosaic.js',
  './js/components/AppHeader.js',
  './js/components/PlayerControls.js',
  './js/components/AlbumGrid.js',
  './js/components/TrackList.js',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js',
  'https://unpkg.com/@phosphor-icons/web@2.0.3/src/regular/style.css',
  'https://unpkg.com/@phosphor-icons/web@2.0.3/src/fill/style.css'
];

// Install - cache assets and skip waiting
self.addEventListener('install', (e) => {
  console.log('[SW] Installing new service worker...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate - clean up old caches and take control
self.addEventListener('activate', (e) => {
  console.log('[SW] Activating new service worker...');
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim(); // Take control of all pages immediately
    })
  );
});

// Fetch - network first for HTML, cache first for assets
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Network first for HTML (always get fresh content)
  if (request.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse));
          return response;
        })
        .catch(() => caches.match(request)) // Fallback to cache if offline
    );
    return;
  }

  // Cache first for everything else (CSS, JS, etc.)
  e.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) return response;

        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse));
          }
          return response;
        });
      })
  );
});

// Listen for messages from the client
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});