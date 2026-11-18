import type {CallMedia} from '@dameeland/core/calls'
import React,{useEffect,useState} from 'react'
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
import Dameeland from '@dameeland/core/app'
import {LoadingScreen} from '@dameeland/core/loading'

const names={500:'PlusJakartaSans_500Medium',700:'PlusJakartaSans_700Bold',800:'PlusJakartaSans_800ExtraBold'} as const
const font=(weight:number)=>({fontFamily:names[weight as keyof typeof names]??names[500]})
const tokenKey='dameeland-session'
const loadToken=()=>SecureStore.getItemAsync(tokenKey)
const saveToken=(value:string|null)=>value?SecureStore.setItemAsync(tokenKey,value):SecureStore.deleteItemAsync(tokenKey)
const share=async(url:string)=>{await Share.share(Platform.OS==='ios'?{url}:{message:url})}
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true})})
const requestNotifications=async()=>{
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('calls',{name:'Incoming calls',importance:Notifications.AndroidImportance.MAX,sound:'default',vibrationPattern:[0,500,250,500]})
  const current=await Notifications.getPermissionsAsync()
  if(current.granted)return true
  const next=await Notifications.requestPermissionsAsync()
  return next.granted
}
const getNotificationDevice=async()=>{
  const token=await Notifications.getExpoPushTokenAsync()
  return {platform:Platform.OS==='ios'?'ios':'android',token:token.data} as {platform:'android'|'ios';token:string}
}
const notifyDevice=async(title:string,body:string)=>{await Notifications.scheduleNotificationAsync({content:{title,body,sound:'default'},trigger:null})}
async function openGoogle(getUrl:()=>Promise<string>){
  if(Platform.OS==='web'){
    const popup=window.open('about:blank','_blank','popup,width=500,height=650')
    if(!popup)throw new Error('Allow pop-ups to continue with Google.')
    popup.opener=null
    try{popup.location.href=await getUrl()}
    catch(error){popup.close();throw error}
    return {close:()=>popup.close()}
  }
  await Linking.openURL(await getUrl())
  return {close:()=>{}}
}
async function pickMedia(comment=false){
  const ImagePicker=await import('expo-image-picker')
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:comment?1:.8,allowsEditing:false})
  if(result.canceled)return null
  const image=result.assets[0]
  if(image.fileSize&&image.fileSize>5*1024*1024)throw new Error('Choose an image under 5 MB.')
  const name=image.fileName??'image.jpg'
  const type=image.mimeType??'image/jpeg'
  return {name,uri:image.uri,data:image.file??{name,type,uri:image.uri}}
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
  return <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:loaded||error?(theme==='dark'?'#120D1F':'#FAF8FF'):'#4F25D6'}}>{loaded||error?<Dameeland phone={offline} demo={demo} base={base} callMedia={callMedia} notificationTarget={notificationTarget} renderIcon={HugeiconsIcon} initialTheme={theme} font={error?()=>({}):font} loadToken={loadToken} saveToken={saveToken} openGoogle={openGoogle} modalViewport={Platform.OS==='web'?undefined:NativeModalViewport} pickMedia={()=>pickMedia()} pickCommentMedia={()=>pickMedia(true)} renderGif={CommentGif} share={share} requestNotifications={requestNotifications} getNotificationDevice={getNotificationDevice} notifyDevice={notifyDevice}/>:<LoadingScreen/>}</SafeAreaView></SafeAreaProvider>
}
