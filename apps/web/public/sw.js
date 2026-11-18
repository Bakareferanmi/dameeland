const CACHE_NAME='dameeland-shell-v8'
const APP_SHELL='/'
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
        return await cache.match(APP_SHELL)||new Response('',{status:503,headers:{'Content-Type':'text/html'}})
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

