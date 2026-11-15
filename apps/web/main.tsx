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
const demo=offline||params.get('demo')==='1'
const initialTheme=params.get('theme')==='dark'||matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'
const font=(weight:number)=>({fontFamily:'Plus Jakarta Sans Variable, sans-serif',fontWeight:String(weight)})
const storageKey='dameeland-session'
const loadToken=async()=>sessionStorage.getItem(storageKey)
const saveToken=async(value:string|null)=>{if(value)sessionStorage.setItem(storageKey,value);else sessionStorage.removeItem(storageKey)}
const openGoogle=async(getUrl:()=>Promise<string>)=>{
  const popup=window.open('about:blank','_blank','popup,width=500,height=650')
  if(!popup)throw new Error('Allow pop-ups to continue with Google.')
  popup.opener=null
  try{popup.location.href=await getUrl()}
  catch(error){popup.close();throw error}
  return {close:()=>popup.close()}
}
const pickMedia=()=>{
  const input=document.createElement('input')
  input.type='file'
  input.accept='image/png,image/jpeg,image/webp'
  return new Promise<{name:string;uri:string;data:File}|null>((resolve,reject)=>{
    input.oncancel=()=>resolve(null)
    input.onchange=()=>{
      const file=input.files?.[0]
      if(!file){resolve(null);return}
      if(file.size>5*1024*1024){reject(new Error('Choose an image under 5 MB.'));return}
      const reader=new FileReader()
      reader.onerror=()=>reject(new Error('Couldn’t open this image.'))
      reader.onload=()=>resolve({name:file.name,uri:String(reader.result),data:file})
      reader.readAsDataURL(file)
    }
    input.click()
  })
}
const share=async(text:string)=>{
  if(navigator.share){await navigator.share({text});return}
  if(navigator.clipboard){await navigator.clipboard.writeText(text);return}
  window.prompt('Copy this post text',text)
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
if('serviceWorker' in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js')})
if(phone)document.body.classList.add('phone-preview')
createRoot(document.getElementById('root')!).render(<App demo={demo} phone={phone} base={import.meta.env.VITE_API_URL??''} renderIcon={HugeiconsIcon} initialTheme={initialTheme} font={font} loadToken={loadToken} saveToken={saveToken} openGoogle={openGoogle} pickMedia={pickMedia} share={share} requestNotifications={requestNotifications} notifyDevice={notifyDevice}/>)
