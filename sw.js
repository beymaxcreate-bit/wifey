const CACHE='ask-wifey-v1.4.4-1-cache';
const ASSETS=[
  './',
  './index.html',
  './styles.css?v=14401',
  './app.js?v=14401',
  './manifest.webmanifest?v=14401',
  './icons/icon-192.png?v=14401',
  './icons/icon-512.png?v=14401',
  './icons/apple-touch-icon-180.png?v=14401'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  ]));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  // Always try the network first for page navigations so a fresh Vercel deploy
  // does not stay stuck behind an older iPhone/PWA cache.
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
        return response;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      if(response && response.status===200 && response.type==='basic'){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }))
  );
});
