import React from 'react'
import {PermissionsAndroid,Platform,View} from 'react-native'
import {mediaDevices,RTCPeerConnection,RTCView,type MediaStream,type MediaStreamTrack} from 'react-native-webrtc'
import InCallManager from 'react-native-incall-manager'
import {callConstraints,callIceServers,waitForCallIce,type CallMedia} from '@dameeland/core/calls'

export const nativeCalls:CallMedia={
  startAudioSession(video){InCallManager.start({media:video?'video':'audio',auto:true})},
  stopAudioSession(){InCallManager.stop()},
  async setAudioRoute(route){
    if(route==='bluetooth'&&Platform.OS==='android'&&Number(Platform.Version)>=31){
      const allowed=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)
      if(allowed!==PermissionsAndroid.RESULTS.GRANTED)throw new Error('Allow nearby-device access to use a Bluetooth headset.')
    }
    const requested={phone:'EARPIECE',speaker:'SPEAKER_PHONE',bluetooth:'BLUETOOTH'}[route]
    const result=await InCallManager.chooseAudioRoute(requested)
    if(result?.selectedAudioDevice&&result.selectedAudioDevice!==requested)throw new Error(route==='bluetooth'?'Connect a Bluetooth headset first.':'That audio output is unavailable.')
  },
  async getStream(video){
    if(Platform.OS==='android'){
      const required=[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
      const permissions=video?[...required,PermissionsAndroid.PERMISSIONS.CAMERA]:required
      const result=await PermissionsAndroid.requestMultiple(permissions)
      if(permissions.some(permission=>result[permission]!==PermissionsAndroid.RESULTS.GRANTED))
        throw new Error(video?'Allow microphone and camera access to start a video call.':'Allow microphone access to start a voice call.')
    }
    return mediaDevices.getUserMedia(callConstraints(video) as unknown as Parameters<typeof mediaDevices.getUserMedia>[0])
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
      replaceVideoTrack:async track=>{
        const sender=peer.getSenders().find(value=>value.track?.kind==='video')
        if(!sender)throw new Error('Camera is not connected to this call.')
        await sender.replaceTrack(track as MediaStreamTrack)
      },
      close:()=>peer.close(),
    }
  },
  async switchCamera(stream){
    const track=stream.getVideoTracks()[0] as MediaStreamTrack&{_switchCamera?:()=>void}
    if(!track?._switchCamera)throw new Error('The other camera is not available on this device.')
    track._switchCamera()
    return stream
  },
  Surface({stream,local,video,full}){
    if(!video)return null
    return <View style={full?{flex:1,width:'100%',height:'100%',overflow:'hidden',backgroundColor:'#120D1F'}:{borderRadius:14,overflow:'hidden',backgroundColor:'#120D1F'}}>
      <RTCView streamURL={(stream as MediaStream).toURL()} mirror={local} objectFit={full?'cover':'contain'} style={full?{width:'100%',height:'100%'}:{width:'100%',aspectRatio:16/9}}/>
    </View>
  },
}
