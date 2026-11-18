import React from 'react'
import {VideoView,useVideoPlayer} from 'expo-video'

export default function NativeVideo({uri,autoPlay}:{uri:string;autoPlay?:boolean}){
  const player=useVideoPlayer(uri,instance=>{if(autoPlay)instance.play()})
  return <VideoView player={player} nativeControls contentFit="contain" style={{width:'100%',height:210,backgroundColor:'#120D1F'}}/>
}
