import React from 'react'
import {HugeiconsIcon} from '@hugeicons/react'
import {createRoot} from 'react-dom/client'
import App from '@dameeland/core/app'
import '@fontsource-variable/plus-jakarta-sans'
import './shell.css'
import './interactions.css'

const params=new URLSearchParams(location.search)
const offline=location.protocol==='file:'||document.documentElement.dataset.preview==='true'
const phone=params.get('view')==='phone'||document.documentElement.dataset.view==='phone'
const demo=offline||(import.meta.env.DEV&&params.get('demo')==='1')
const initialTheme=params.get('theme')==='dark'||matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'
const font=(weight:number)=>({fontFamily:'Plus Jakarta Sans Variable, sans-serif',fontWeight:String(weight)})
const storageKey='dameeland-session'
const loadToken=async()=>{
  const saved=localStorage.getItem(storageKey)
  if(saved)return saved
  const current=sessionStorage.getItem(storageKey)
  if(current){localStorage.setItem(storageKey,current);sessionStorage.removeItem(storageKey)}
  return current
}
const saveToken=async(value:string|null)=>{
  sessionStorage.removeItem(storageKey)
  if(value)localStorage.setItem(storageKey,value)
  else localStorage.removeItem(storageKey)
}
const openGoogle=async(getUrl:()=>Promise<string>)=>{
  const popup=window.open('about:blank','_blank','popup,width=500,height=650')
  if(!popup)throw new Error('Allow pop-ups to continue with Google.')
  popup.opener=null
  try{popup.location.href=await getUrl()}
  catch(error){popup.close();throw error}
  return {close:()=>popup.close()}
}
const pickMedia=(comment=false)=>{
  const input=document.createElement('input')
  input.type='file'
  input.accept=comment?'image/png,image/jpeg,image/webp,image/gif':'image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime'
  return new Promise<{name:string;uri:string;data:File;kind?:'image'|'video';duration?:number}|null>((resolve,reject)=>{
    input.oncancel=()=>resolve(null)
    input.onchange=async()=>{
      const file=input.files?.[0]
      if(!file){resolve(null);return}
      const kind=file.type.startsWith('video/')?'video':'image'
      if(file.size>(kind==='video'?25:5)*1024*1024){reject(new Error(kind==='video'?'Choose a video under 25 MB.':'Choose an image under 5 MB.'));return}
      let duration:number|undefined
      if(kind==='video')duration=await new Promise<number>((done,fail)=>{
        const video=document.createElement('video'),url=URL.createObjectURL(file)
        video.preload='metadata'
        video.onloadedmetadata=()=>{const seconds=video.duration;URL.revokeObjectURL(url);Number.isFinite(seconds)?done(seconds):fail(new Error('Couldn’t read this video.'))}
        video.onerror=()=>{URL.revokeObjectURL(url);fail(new Error('Couldn’t read this video.'))}
        video.src=url
      }).catch(error=>{reject(error);return undefined})
      if(kind==='video'&&duration===undefined)return
      const reader=new FileReader()
      reader.onerror=()=>reject(new Error('Couldn’t open this image.'))
      reader.onload=()=>resolve({name:file.name,uri:String(reader.result),data:file,kind,duration})
      reader.readAsDataURL(file)
    }
    input.click()
  })
}
const share=async(url:string)=>{
  if(navigator.share){await navigator.share({url});return}
  if(navigator.clipboard){await navigator.clipboard.writeText(url);return}
  window.prompt('Copy this link',url)
}
const requestNotifications=async()=>{
  if(!('Notification' in window))return false
  if(Notification.permission==='granted')return true
  return (await Notification.requestPermission())==='granted'
}
const notifyDevice=async(title:string,body:string)=>{
  if(!('Notification' in window)||Notification.permission!=='granted')return
  if(document.visibilityState==='visible')return
  const registration=await navigator.serviceWorker?.ready.catch(()=>null)
  if(registration){await registration.showNotification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'dameeland-activity'})}
  else new Notification(title,{body,icon:'/icon-192.png'})
}
if(import.meta.env.PROD&&!offline&&'serviceWorker' in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})})
if(phone)document.body.classList.add('phone-preview')
let bootDismissed=false
const dismissBoot=()=>{
  if(bootDismissed)return
  bootDismissed=true
  const boot=document.getElementById('dameen-boot')
  if(!boot)return
  boot.classList.add('ready')
  window.setTimeout(()=>boot.remove(),380)
}
createRoot(document.getElementById('dameen-app')!).render(<App demo={demo} phone={phone} base={offline?'':import.meta.env.VITE_API_URL??'https://dameeland-api.bakareferanmi96.workers.dev'} renderIcon={HugeiconsIcon} initialTheme={initialTheme} font={font} loadToken={loadToken} saveToken={saveToken} openGoogle={openGoogle} pickMedia={()=>pickMedia()} pickCommentMedia={()=>pickMedia(true)} share={share} requestNotifications={requestNotifications} notifyDevice={notifyDevice} onReady={dismissBoot}/>)

