import React from 'react'
import {Pressable,Text,View} from 'react-native'
import {useAudioPlayer,useAudioPlayerStatus} from 'expo-audio'

const clock=(seconds:number)=>{
  const safe=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0
  return Math.floor(safe/60)+':'+String(safe%60).padStart(2,'0')
}

export default function NativeAudio({uri}:{uri:string}){
  const player=useAudioPlayer(uri,{updateInterval:250})
  const status=useAudioPlayerStatus(player)
  const toggle=()=>{
    if(status.playing)player.pause()
    else{
      if(status.duration>0&&status.currentTime>=status.duration-.2)void player.seekTo(0)
      player.play()
    }
  }
  return <View style={{minWidth:230,paddingVertical:8,gap:7}}>
    <Pressable accessibilityRole="button" accessibilityLabel={status.playing?'Pause voice note':'Play voice note'} onPress={toggle}
      style={{minHeight:44,borderRadius:22,backgroundColor:'#6A35F0',paddingHorizontal:16,alignItems:'center',justifyContent:'center'}}>
      <Text style={{color:'#FFFFFF',fontWeight:'800'}}>{status.playing?'Pause':'Play voice note'}</Text>
    </Pressable>
    <Text style={{fontSize:12,color:'#7A6F8F',textAlign:'center'}}>{clock(status.currentTime)} / {clock(status.duration)}</Text>
  </View>
}
