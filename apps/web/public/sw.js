const CACHE_NAME='dameeland-shell-v1'
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(['/','/manifest.webmanifest'])).then(()=>self.skipWaiting()))})
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())})
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response})))
})
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const existing=clients.find(client=>'focus' in client);return existing?existing.focus():self.clients.openWindow('/')}))})
