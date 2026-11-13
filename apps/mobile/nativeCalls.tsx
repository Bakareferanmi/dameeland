import React from 'react'
import {PermissionsAndroid,Platform,View} from 'react-native'
import {mediaDevices,RTCPeerConnection,RTCView,type MediaStream,type MediaStreamTrack} from 'react-native-webrtc'
import {callConstraints,callIceServers,waitForCallIce,type CallMedia} from '@dameeland/core/calls'

export const nativeCalls:CallMedia={
  async getStream(video){
    if(Platform.OS==='android'){
      const required=[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
      const permissions=video?[...required,PermissionsAndroid.PERMISSIONS.CAMERA]:required
      const result=await PermissionsAndroid.requestMultiple(permissions)
      if(permissions.some(permission=>result[permission]!==PermissionsAndroid.RESULTS.GRANTED))
        throw new Error(video?'Allow microphone and camera access to start a video call.':'Allow microphone access to start a voice call.')
    }
    return mediaDevices.getUserMedia(callConstraints(video))
  },
  createPeer(){
    const peer=new RTCPeerConnection({iceServers:callIceServers})
    return {
      addTrack:(track,stream)=>peer.addTrack(track as MediaStreamTrack,stream as MediaStream),
      createOffer:async()=>({type:'offer',sdp:(await peer.createOffer()).sdp}),
      createAnswer:async()=>({type:'answer',sdp:(await peer.createAnswer()).sdp}),
      setLocalDescription:value=>peer.setLocalDescription(value),
      setRemoteDescription:value=>peer.setRemoteDescription(value),
      getLocalDescription:()=>{
        const value=peer.localDescription
        return value?.type==='offer'||value?.type==='answer'?{type:value.type,sdp:value.sdp}:null
      },
      onTrack:listener=>peer.addEventListener('track',event=>{if(event.streams[0])listener(event.streams[0])}),
      onState:listener=>peer.addEventListener('connectionstatechange',()=>listener(peer.connectionState)),
      waitForIce:()=>waitForCallIce(()=>peer.iceGatheringState,listener=>{
        peer.addEventListener('icegatheringstatechange',listener)
        return ()=>peer.removeEventListener('icegatheringstatechange',listener)
      }),
      close:()=>peer.close(),
    }
  },
  Surface({stream,local,video}){
    if(!video)return null
    return <View style={{borderRadius:14,overflow:'hidden',backgroundColor:'#120D1F'}}>
      <RTCView streamURL={(stream as MediaStream).toURL()} mirror={local} objectFit="contain" style={{width:'100%',aspectRatio:16/9}}/>
    </View>
  },
}
