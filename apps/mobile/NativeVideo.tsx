import React,{useEffect} from 'react'
import {VideoView,useVideoPlayer} from 'expo-video'

export default function NativeVideo({uri,autoPlay,onError}:{uri:string;autoPlay?:boolean;onError?:()=>void}){
  const player=useVideoPlayer(uri,instance=>{if(autoPlay)instance.play()})
  useEffect(()=>{
    if(!onError)return
    const subscription=player.addListener('statusChange',({status})=>{if(status==='error')onError()})
    return ()=>subscription.remove()
  },[player,onError])
  return <VideoView player={player} nativeControls contentFit="contain" style={{width:'100%',height:210,backgroundColor:'#120D1F'}}/>
}
