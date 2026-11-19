import type {CallMedia} from '@dameeland/core/calls'
import React,{useEffect,useRef,useState} from 'react'
import {HugeiconsIcon} from '@hugeicons/react-native'
import {Linking,NativeModules,Platform,Share,useColorScheme} from 'react-native'
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context'
import {useFonts} from 'expo-font'
import {Image as ExpoImage} from 'expo-image'
import {PlusJakartaSans_500Medium} from '@expo-google-fonts/plus-jakarta-sans/500Medium'
import {PlusJakartaSans_700Bold} from '@expo-google-fonts/plus-jakarta-sans/700Bold'
import {PlusJakartaSans_800ExtraBold} from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import {AudioModule,RecordingPresets,setAudioModeAsync,useAudioRecorder} from 'expo-audio'
import {File,Paths} from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library/legacy'
import Dameeland from '@dameeland/core/app'
import {LoadingScreen} from '@dameeland/core/loading'
import NativeVideo from './NativeVideo'

const names={500:'PlusJakartaSans_500Medium',700:'PlusJakartaSans_700Bold',800:'PlusJakartaSans_800ExtraBold'} as const
const font=(weight:number)=>({fontFamily:names[weight as keyof typeof names]??names[500]})
const tokenKey='dameeland-session'
const loadToken=()=>SecureStore.getItemAsync(tokenKey)
const saveToken=(value:string|null)=>value?SecureStore.setItemAsync(tokenKey,value):SecureStore.deleteItemAsync(tokenKey)
const share=async(url:string,details?:{title:string;message:string})=>{
  const message=details?.message?details.message+'\n'+url:url
  await Share.share(Platform.OS==='ios'?{url,message:details?.message,title:details?.title}:{message,title:details?.title})
}
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true})})
const configureNotificationChannels=async()=>{
  if(Platform.OS!=='android')return
  await Notifications.setNotificationChannelAsync('default',{name:'Dameen notifications',importance:Notifications.AndroidImportance.HIGH,sound:'default',vibrationPattern:[0,250,150,250]})
  await Notifications.setNotificationChannelAsync('calls',{name:'Incoming calls',importance:Notifications.AndroidImportance.MAX,sound:'default',vibrationPattern:[0,500,250,500]})
}
const requestNotifications=async()=>{
  await configureNotificationChannels()
  const current=await Notifications.getPermissionsAsync()
  if(current.granted)return true
  const next=await Notifications.requestPermissionsAsync()
  return next.granted
}
const getNotificationDevice=async()=>{
  await configureNotificationChannels()
  if(!(await Notifications.getPermissionsAsync()).granted)return null
  const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId
  if(!projectId)throw new Error('This build is not linked to its Expo project. Rebuild the app with EAS.')
  const token=await Notifications.getExpoPushTokenAsync({projectId})
  return {platform:Platform.OS==='ios'?'ios':'android',token:token.data} as {platform:'android'|'ios';token:string}
}
const notifyDevice=async(title:string,body:string)=>{await Notifications.scheduleNotificationAsync({content:{title,body,sound:'default'},trigger:null})}
async function openGoogle(getUrl:()=>Promise<string>){
  if(Platform.OS==='web'){
    const popup=window.open('about:blank','_blank','popup,width=500,height=650')
    if(!popup)throw new Error('Allow pop-ups to continue with Google.')
    try{popup.location.href=await getUrl()}
    catch(error){popup.close();throw error}
    return {close:()=>popup.close()}
  }
  await Linking.openURL(await getUrl())
  return {close:()=>{}}
}
async function selectedMedia(image:{uri:string;type?:string|null;fileName?:string|null;mimeType?:string|null;fileSize?:number|null;duration?:number|null}){
  const kind:'video'|'image'=image.type==='video'?'video':'image'
  let uri=image.uri,fileSize=image.fileSize??0
  if(kind==='image'&&fileSize>5*1024*1024){
    const {manipulateAsync,SaveFormat}=await import('expo-image-manipulator')
    const compressed=await manipulateAsync(uri,[{resize:{width:1600}}],{compress:.7,format:SaveFormat.JPEG})
    uri=compressed.uri;fileSize=new File(uri).size
  }
  if(kind==='video'&&fileSize>25*1024*1024){
    const {compress}=await import('react-native-video-trim')
    const result=await compress(uri,{quality:'medium'})
    uri=result.outputPath.startsWith('file://')?result.outputPath:'file://'+result.outputPath
    fileSize=new File(uri).size
  }
  if(fileSize>(kind==='video'?25:5)*1024*1024)throw new Error(kind==='video'?'This video is still over 25 MB after compression. Choose a shorter video.':'Choose an image under 5 MB.')
  const extension=kind==='video'?'mp4':'jpg'
  const name=image.fileName??'dameen-'+Date.now()+'.'+extension
  const type=image.mimeType??(kind==='video'?'video/mp4':'image/jpeg')
  return {name,uri,data:{name,type,uri},kind,duration:kind==='video'&&image.duration?image.duration/1000:undefined}
}
async function pickMedia(comment=false){
  const ImagePicker=await import('expo-image-picker')
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:comment?['images']:['images','videos'],quality:comment?1:.8,allowsEditing:false})
  if(result.canceled)return null
  return selectedMedia(result.assets[0])
}
async function captureMedia(){
  const ImagePicker=await import('expo-image-picker')
  const permission=await ImagePicker.requestCameraPermissionsAsync()
  if(!permission.granted)throw new Error('Allow camera access to take a photo or video.')
  const result=await ImagePicker.launchCameraAsync({mediaTypes:['images','videos'],quality:.75,allowsEditing:false,videoMaxDuration:60})
  if(result.canceled)return null
  return selectedMedia(result.assets[0])
}
async function saveMedia(url:string,name:string){
  const kind=name.includes('-video-')?'video':name.includes('-audio-')?'audio':'image'
  const extension=kind==='video'?'mp4':kind==='audio'?'m4a':'jpg'
  const target=new File(Paths.cache,name+'.'+extension)
  if(target.exists)target.delete()
  const downloaded=await File.downloadFileAsync(url,target)
  const permission=await MediaLibrary.requestPermissionsAsync(true)
  if(!permission.granted)throw new Error('Allow photo and video access to save this file.')
  await MediaLibrary.saveToLibraryAsync(downloaded.uri)
}
function CommentGif({uri,label,animate}:{uri:string;label:string;animate:boolean}){
  return <ExpoImage source={{uri}} accessibilityLabel={label} accessible autoplay={animate} contentFit="cover"
    style={{width:96,height:64,borderRadius:10}}/>
}
function NativeModalViewport({color,children}:{color:string;children:React.ReactNode}){
  const style={flex:1,backgroundColor:color}
  return <SafeAreaProvider style={style}><SafeAreaView style={style}>{children}</SafeAreaView></SafeAreaProvider>
}
export default function App(){
  const audioRecorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recordingStarted=useRef(0)
  const voiceRecorder={
    start:async()=>{
      const permission=await AudioModule.requestRecordingPermissionsAsync()
      if(!permission.granted)throw new Error('Allow microphone access to record a voice note.')
      await setAudioModeAsync({playsInSilentMode:true,allowsRecording:true})
      await audioRecorder.prepareToRecordAsync()
      audioRecorder.record();recordingStarted.current=Date.now()
    },
    stop:async()=>{
      await audioRecorder.stop()
      const uri=audioRecorder.uri
      await setAudioModeAsync({playsInSilentMode:true,allowsRecording:false})
      if(!uri)return null
      const name='dameen-voice-'+Date.now()+'.m4a'
      return {name,uri,data:{uri,name,type:'audio/m4a'},kind:'audio' as const,duration:Math.max(1,(Date.now()-recordingStarted.current)/1000)}
    },
  }
  const [callMedia,setCallMedia]=useState<CallMedia>()
  const [notificationTarget,setNotificationTarget]=useState('')
  useEffect(()=>{
    const open=(response:Notifications.NotificationResponse)=>{
      const id=response.notification.request.content.data?.notificationId
      if(typeof id==='string')setNotificationTarget(id)
    }
    const subscription=Notifications.addNotificationResponseReceivedListener(open)
    void Notifications.getLastNotificationResponseAsync().then(response=>{if(response)open(response)}).catch(()=>{})
    return ()=>subscription.remove()
  },[])
  useEffect(()=>{
    if(Platform.OS==='web'||!NativeModules.WebRTCModule)return
    let active=true
    void import('./nativeCalls').then(module=>{if(active)setCallMedia(module.nativeCalls)}).catch(()=>{})
    return ()=>{active=false}
  },[])
  const theme=useColorScheme()==='dark'?'dark':'light'
  const offline=Platform.OS==='web'&&document.documentElement.dataset.preview==='true'
  const [loaded,error]=useFonts(offline?{}:{PlusJakartaSans_500Medium,PlusJakartaSans_700Bold,PlusJakartaSans_800ExtraBold})
  const base=process.env.EXPO_PUBLIC_API_URL?.trim()||'https://dameeland-api.bakareferanmi96.workers.dev'
  const demo=offline||process.env.EXPO_PUBLIC_DEMO==='1'
  return <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:loaded||error?(theme==='dark'?'#120D1F':'#FAF8FF'):'#4F25D6'}}>{loaded||error?<Dameeland phone={offline} demo={demo} base={base} callMedia={callMedia} notificationTarget={notificationTarget} renderIcon={HugeiconsIcon} initialTheme={theme} font={error?()=>({}):font} loadToken={loadToken} saveToken={saveToken} openGoogle={openGoogle} modalViewport={Platform.OS==='web'?undefined:NativeModalViewport} pickMedia={()=>pickMedia()} pickCamera={captureMedia} pickCommentMedia={()=>pickMedia(true)} voiceRecorder={voiceRecorder} saveMedia={saveMedia} renderVideo={NativeVideo} renderGif={CommentGif} share={share} requestNotifications={requestNotifications} getNotificationDevice={getNotificationDevice} notifyDevice={notifyDevice}/>:<LoadingScreen/>}</SafeAreaView></SafeAreaProvider>
}

