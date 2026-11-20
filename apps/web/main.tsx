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
  if(matchMedia('(max-width: 760px), (pointer: coarse)').matches){
    const url=await getUrl()
    location.assign(url)
    return {close:()=>{}}
  }
  const popup=window.open('about:blank','_blank','popup,width=500,height=650')
  if(!popup)throw new Error('Allow pop-ups to continue with Google.')
  try{popup.location.href=await getUrl()}
  catch(error){popup.close();throw error}
  return {close:()=>popup.close()}
}
const compressImage=async(file:File)=>{
  const image=await createImageBitmap(file)
  const scale=Math.min(1,1920/Math.max(image.width,image.height))
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale)
  canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);image.close()
  let quality=.82,blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality))
  while(blob&&blob.size>4.8*1024*1024&&quality>.42){quality-=.1;blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality))}
  return blob?new File([blob],file.name.replace(/\.[^.]+$/,'.webp'),{type:'image/webp'}):file
}
const videoDuration=(file:File)=>new Promise<number>((resolve,reject)=>{
  const video=document.createElement('video'),url=URL.createObjectURL(file);video.preload='metadata'
  video.onloadedmetadata=()=>{const seconds=video.duration;URL.revokeObjectURL(url);Number.isFinite(seconds)?resolve(seconds):reject(new Error('Couldn’t read this video.'))}
  video.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Couldn’t read this video.'))};video.src=url
})
const compressVideo=async(file:File,duration:number)=>{
  if(file.size<=24*1024*1024)return file
  const video=document.createElement('video'),url=URL.createObjectURL(file);video.src=url;video.muted=false;video.playsInline=true
  await new Promise<void>((resolve,reject)=>{video.oncanplay=()=>resolve();video.onerror=()=>reject(new Error('Couldn’t compress this video.'))})
  const stream=(video as HTMLVideoElement&{captureStream:()=>MediaStream}).captureStream?.()
  if(!stream||typeof MediaRecorder==='undefined'){URL.revokeObjectURL(url);throw new Error('This browser could not compress the video. Choose a smaller one.')}
  const bits=Math.max(450000,Math.min(1800000,Math.floor(20*8*1024*1024/Math.max(1,duration))))
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bits,audioBitsPerSecond:96000}),chunks:Blob[]=[]
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)}
  const done=new Promise<void>((resolve,reject)=>{recorder.onstop=()=>resolve();recorder.onerror=()=>reject(new Error('Video compression failed.'))})
  recorder.start(500);await video.play();await new Promise<void>(resolve=>{video.onended=()=>resolve()});recorder.stop();await done
  stream.getTracks().forEach(track=>track.stop());URL.revokeObjectURL(url)
  return new File(chunks,file.name.replace(/\.[^.]+$/,'.webm'),{type:mime?.split(';')[0]??'video/webm'})
}
const pickMedia=(comment=false,capture=false)=>{
  const input=document.createElement('input')
  input.type='file'
  input.accept=comment?'image/png,image/jpeg,image/webp,image/gif':'image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime'
  if(capture)input.capture='environment'
  return new Promise<{name:string;uri:string;data:File;kind?:'image'|'video';duration?:number}|null>((resolve,reject)=>{
    input.oncancel=()=>resolve(null)
    input.onchange=async()=>{
      const original=input.files?.[0]
      if(!original){resolve(null);return}
      const kind=original.type.startsWith('video/')?'video':'image'
      let duration:number|undefined
      if(kind==='video')duration=await videoDuration(original).catch(error=>{reject(error);return undefined})
      if(kind==='video'&&duration===undefined)return
      const file=kind==='image'&&!comment?await compressImage(original):kind==='video'?await compressVideo(original,duration!):original
      if(file.size>(kind==='video'?25:5)*1024*1024){reject(new Error('This file could not be compressed enough. Try a shorter video or a different image.'));return}
      const reader=new FileReader()
      reader.onerror=()=>reject(new Error('Couldn’t open this image.'))
      reader.onload=()=>resolve({name:file.name,uri:String(reader.result),data:file,kind,duration})
      reader.readAsDataURL(file)
    }
    input.click()
  })
}
let voiceRecorder:MediaRecorder|null=null,voiceStream:MediaStream|null=null,voiceChunks:Blob[]=[]
const microphoneError=(reason:unknown)=>{
  const error=reason as {name?:string;message?:string}
  if(!window.isSecureContext)return new Error('Voice notes need a secure connection. Open dameen from its https website.')
  if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return new Error('Microphone blocked. Allow it for dameen and in your phone’s browser settings.')
  if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return new Error('No microphone was found on this device.')
  if(error?.name==='NotReadableError'||error?.name==='TrackStartError'||/start audio source/i.test(error?.message??''))return new Error('Microphone unavailable. Close other calling apps or allow microphone access for your browser.')
  return new Error('Couldn’t start the microphone. Check your browser’s microphone permission.')
}
const voice={
  start:async()=>{
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Voice notes are not supported by this browser.')
    voiceStream?.getTracks().forEach(track=>track.stop())
    voiceStream=null;voiceRecorder=null
    try{voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}
    catch(reason){
      try{voiceStream=await navigator.mediaDevices.getUserMedia({audio:true})}
      catch{throw microphoneError(reason)}
    }
    try{
      voiceChunks=[]
      const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type))
      voiceRecorder=new MediaRecorder(voiceStream,mime?{mimeType:mime}:undefined)
      voiceRecorder.ondataavailable=event=>{if(event.data.size)voiceChunks.push(event.data)}
      voiceRecorder.start(250)
    }catch(reason){voiceStream.getTracks().forEach(track=>track.stop());voiceStream=null;throw microphoneError(reason)}
  },
  stop:()=>new Promise<{name:string;uri:string;data:File;kind:'audio'}|null>((resolve,reject)=>{
    if(!voiceRecorder){resolve(null);return}
    voiceRecorder.onerror=()=>reject(new Error('Couldn’t record the voice note.'))
    voiceRecorder.onstop=()=>{const type=voiceRecorder?.mimeType||'audio/webm',blob=new Blob(voiceChunks,{type}),file=new File([blob],'voice-note.webm',{type});voiceStream?.getTracks().forEach(track=>track.stop());voiceRecorder=null;voiceStream=null;resolve({name:file.name,uri:URL.createObjectURL(file),data:file,kind:'audio'})}
    voiceRecorder.stop()
  }),
}
const saveMedia=async(url:string,name:string)=>{const blob=await fetch(url).then(response=>response.ok?response.blob():Promise.reject(new Error('Couldn’t save this media.')));const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)}
const share=async(url:string,details?:{title:string;message:string})=>{
  if(navigator.share){await navigator.share({url,title:details?.title,text:details?.message});return}
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
createRoot(document.getElementById('dameen-app')!).render(<App demo={demo} phone={phone} base={offline?'':import.meta.env.VITE_API_URL??'https://dameeland-api.bakareferanmi96.workers.dev'} renderIcon={HugeiconsIcon} initialTheme={initialTheme} font={font} loadToken={loadToken} saveToken={saveToken} openGoogle={openGoogle} pickMedia={()=>pickMedia()} pickCamera={()=>pickMedia(false,true)} pickCommentMedia={()=>pickMedia(true)} voiceRecorder={voice} saveMedia={saveMedia} share={share} requestNotifications={requestNotifications} notifyDevice={notifyDevice} onReady={dismissBoot}/>)

