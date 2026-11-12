import React from 'react'
import {HugeiconsIcon} from '@hugeicons/react-native'
import {Linking,Platform,Share,useColorScheme} from 'react-native'
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context'
import {useFonts} from 'expo-font'
import {Image as ExpoImage} from 'expo-image'
import {PlusJakartaSans_500Medium} from '@expo-google-fonts/plus-jakarta-sans/500Medium'
import {PlusJakartaSans_700Bold} from '@expo-google-fonts/plus-jakarta-sans/700Bold'
import {PlusJakartaSans_800ExtraBold} from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold'
import * as SecureStore from 'expo-secure-store'
import Dameeland from '@dameeland/core/app'
import {LoadingScreen} from '@dameeland/core/loading'

const names={500:'PlusJakartaSans_500Medium',700:'PlusJakartaSans_700Bold',800:'PlusJakartaSans_800ExtraBold'} as const
const font=(weight:number)=>({fontFamily:names[weight as keyof typeof names]??names[500]})
const tokenKey='dameeland-session'
const loadToken=()=>SecureStore.getItemAsync(tokenKey)
const saveToken=(value:string|null)=>value?SecureStore.setItemAsync(tokenKey,value):SecureStore.deleteItemAsync(tokenKey)
const share=async(message:string)=>{await Share.share({message})}
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
async function pickMedia(){
  const ImagePicker=await import('expo-image-picker')
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.8})
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
  const theme=useColorScheme()==='dark'?'dark':'light'
  const offline=Platform.OS==='web'&&document.documentElement.dataset.preview==='true'
  const [loaded,error]=useFonts(offline?{}:{PlusJakartaSans_500Medium,PlusJakartaSans_700Bold,PlusJakartaSans_800ExtraBold})
  const configuredBase=process.env.EXPO_PUBLIC_API_URL
  const base=configuredBase??(Platform.OS==='android'?'http://10.0.2.2:8787':'http://localhost:8787')
  const demo=offline||process.env.EXPO_PUBLIC_DEMO==='1'||!configuredBase
  return <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:theme==='dark'?'#120D1F':'#FAF8FF'}}>{loaded||error?<Dameeland phone={offline} demo={demo} base={base} renderIcon={HugeiconsIcon} initialTheme={theme} font={error?()=>({}):font} loadToken={loadToken} saveToken={saveToken} openGoogle={openGoogle} modalViewport={Platform.OS==='web'?undefined:NativeModalViewport} pickMedia={pickMedia} renderGif={CommentGif} share={share}/>:<LoadingScreen/>}</SafeAreaView></SafeAreaProvider>
}
