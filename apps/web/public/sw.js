const CACHE_NAME='dameeland-shell-v12'
const APP_SHELL='/'
const OFFLINE_SHELL='<!doctype html><html style="background:#4F25D6"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#6A35F0"><style>html,body{width:100%;height:100%;margin:0;background:#4F25D6}body{display:grid;place-items:center}svg{width:116px;height:116px;animation:p 1.8s ease-in-out infinite}@keyframes p{50%{transform:scale(1.045)}}@media(prefers-reduced-motion:reduce){svg{animation:none}}</style></head><body><svg viewBox="0 0 64 64" aria-label="Opening dameen"><path d="M10 52C10 32 19 18 32 18C45 18 54 32 54 52Q54 54 52 54H12Q10 54 10 52Z" fill="#C8F53F"/><circle cx="24" cy="38" r="8.5" fill="#fff"/><circle cx="40" cy="38" r="8.5" fill="#fff"/><circle cx="26.2" cy="36.2" r="3.7" fill="#1B1233"/><circle cx="42.2" cy="36.2" r="3.7" fill="#1B1233"/></svg></body></html>'
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll([APP_SHELL,'/manifest.webmanifest'])).then(()=>self.skipWaiting()))})
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('dameeland-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.registration.navigationPreload?.enable(),
  ]).then(()=>self.clients.claim()))
})
self.addEventListener('fetch',event=>{
  const request=event.request
  const url=new URL(request.url)
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME)
      try{
        const preloaded=await event.preloadResponse
        const response=preloaded||await fetch(request)
        if(!response||!response.ok)throw new Error('Navigation response unavailable')
        if(url.pathname===APP_SHELL)await cache.put(APP_SHELL,response.clone())
        return response
      }catch{
        return await cache.match(APP_SHELL)||new Response(OFFLINE_SHELL,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})
      }
    })())
    return
  }
  if(!url.pathname.startsWith('/assets/'))return
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
    const cached=await cache.match(request)
    if(cached)return cached
    const response=await fetch(request)
    if(response.ok)await cache.put(request,response.clone())
    return response
  }))
})
self.addEventListener('push',event=>{
  let payload={title:'dameen',body:'You have new activity.',entityId:null,notificationId:null,kind:null}
  try{if(event.data)payload={...payload,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/icon-192.png',badge:'/icon-192.png',requireInteraction:payload.kind==='call',tag:payload.notificationId?'dameeland-'+payload.notificationId:'dameeland-activity',data:{notificationId:payload.notificationId}}))
})
self.addEventListener('notificationclick',event=>{
  event.notification.close()
  const id=event.notification.data?.notificationId
  const destination=id?'/?notification='+encodeURIComponent(id):'/'
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    const existing=clients.find(client=>'focus' in client)
    if(existing){if(id)existing.postMessage({type:'dameen-notification',id});return existing.focus()}
    return self.clients.openWindow(destination)
  }))
})

