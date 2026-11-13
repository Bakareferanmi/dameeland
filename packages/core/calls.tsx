import React,{useEffect,useRef,useState} from 'react'
import {Platform,View} from 'react-native'
import type {CallSignal} from './callSignal'
import {Avatar,Button,Copy,PersonName,row,useDesign} from './ui'
import type {Person} from './index'

type Track={enabled:boolean;stop:()=>void}
export type CallStream={getTracks:()=>Track[];getAudioTracks:()=>Track[];getVideoTracks:()=>Track[]}
type Description={type:'offer'|'answer';sdp:string}
export type CallPeer={
  addTrack:(track:Track,stream:CallStream)=>unknown
  createOffer:()=>Promise<Description>
  createAnswer:()=>Promise<Description>
  setLocalDescription:(description:Description)=>Promise<void>
  setRemoteDescription:(description:Description)=>Promise<void>
  getLocalDescription:()=>Description|null
  onTrack:(listener:(stream:CallStream)=>void)=>void
  onState:(listener:(state:string)=>void)=>void
  waitForIce:()=>Promise<void>
  close:()=>void
}
export type CallMedia={
  getStream:(video:boolean)=>Promise<CallStream>
  createPeer:()=>CallPeer
  Surface:React.ComponentType<{stream:CallStream;local?:boolean;video:boolean}>
}
export const callIceServers=[{urls:'stun:stun.cloudflare.com:3478'}]
export const callConstraints=(video:boolean)=>({audio:true,video:video?{width:640,height:360,frameRate:24,facingMode:'user'}:false})

function WebSurface({stream,local,video}:{stream:CallStream;local?:boolean;video:boolean}){
  const element=useRef<HTMLMediaElement|null>(null)
  const [blocked,setBlocked]=useState(false)
  useEffect(()=>{
    const player=element.current
    if(!player)return
    player.srcObject=stream as MediaStream
    void player.play().catch(()=>setBlocked(true))
    return ()=>{player.srcObject=null}
  },[stream])
  return <View>
    {React.createElement(video?'video':'audio',{
      ref:(value:HTMLMediaElement|null)=>{element.current=value},autoPlay:true,playsInline:true,muted:local,
      style:video?{width:'100%',maxHeight:'38vh',aspectRatio:'16 / 9',background:'#120D1F',borderRadius:14}:undefined,
    })}
    {blocked&&<Button label="Play call media" onPress={()=>void element.current?.play().then(()=>setBlocked(false)).catch(()=>{})}/>}
  </View>
}

export function browserCallMedia():CallMedia|undefined{
  if(Platform.OS!=='web'||typeof RTCPeerConnection==='undefined'||!globalThis.navigator?.mediaDevices?.getUserMedia)return
  return {
    getStream:video=>navigator.mediaDevices.getUserMedia(callConstraints(video)),
    createPeer:()=>{
      const peer=new RTCPeerConnection({iceServers:callIceServers})
      return {
        addTrack:(track,stream)=>peer.addTrack(track as MediaStreamTrack,stream as MediaStream),
        createOffer:async()=>{const offer=await peer.createOffer();return {type:'offer',sdp:offer.sdp??''}},
        createAnswer:async()=>{const answer=await peer.createAnswer();return {type:'answer',sdp:answer.sdp??''}},
        setLocalDescription:description=>peer.setLocalDescription(description),
        setRemoteDescription:description=>peer.setRemoteDescription(description),
        getLocalDescription:()=>{const value=peer.localDescription;return value?.type==='offer'||value?.type==='answer'?{type:value.type,sdp:value.sdp}:null},
        onTrack:listener=>{peer.ontrack=event=>{listener(event.streams[0]??new MediaStream([event.track]))}},
        onState:listener=>{peer.onconnectionstatechange=()=>listener(peer.connectionState)},
        waitForIce:()=>waitForCallIce(()=>peer.iceGatheringState,listener=>{
          peer.addEventListener('icegatheringstatechange',listener)
          return ()=>peer.removeEventListener('icegatheringstatechange',listener)
        }),
        close:()=>peer.close(),
      }
    },
    Surface:WebSurface,
  }
}

export async function waitForCallIce(state:()=>string,subscribe:(listener:()=>void)=>()=>void){
  if(state()==='complete')return
  await new Promise<void>(resolve=>{
    const timer=setTimeout(finish,6500)
    const unsubscribe=subscribe(()=>{if(state()==='complete')finish()})
    function finish(){clearTimeout(timer);unsubscribe();resolve()}
    if(state()==='complete')finish()
  })
}

type ActiveCall={
  id:string;video:boolean;offer?:string;peer?:CallPeer;local?:CallStream;remote?:CallStream;
  state:'incoming'|'preparing'|'ringing'|'connecting'|'connected';timer?:ReturnType<typeof setTimeout>
}
const stop=(stream?:CallStream)=>stream?.getTracks().forEach(track=>track.stop())

export function useRoomCall(media:CallMedia|undefined,roomKey:string|undefined,send:(signal:CallSignal)=>boolean,notify:(message:string)=>void){
  const current=useRef<ActiveCall|null>(null)
  const [call,setCall]=useState<ActiveCall|null>(null)
  const update=(active:ActiveCall)=>{if(current.current===active)setCall({...active})}
  const clear=()=>{
    const active=current.current
    current.current=null
    if(active){clearTimeout(active.timer);active.peer?.close();stop(active.local);stop(active.remote)}
    setCall(null)
  }
  function end(message?:string,signal=true){
    const active=current.current
    if(!active)return
    if(signal)send({kind:'end',id:active.id})
    clear()
    if(message)notify(message)
  }
  const timeout=(active:ActiveCall,message:string,ms:number)=>{
    clearTimeout(active.timer)
    active.timer=setTimeout(()=>{if(current.current===active)end(message)},ms)
  }
  useEffect(()=>()=>{clear()},[roomKey])

  async function connect(active:ActiveCall){
    if(!media)return
    active.state='preparing';update(active)
    try{
      const local=await media.getStream(active.video)
      if(current.current!==active){stop(local);return}
      active.local=local
      const peer=active.peer=media.createPeer()
      peer.onTrack(stream=>{if(current.current===active){active.remote=stream;update(active)}})
      peer.onState(state=>{
        if(current.current!==active)return
        if(state==='connected'){clearTimeout(active.timer);active.state='connected';update(active)}
        if(state==='disconnected')timeout(active,'Call connection was interrupted.',12000)
        if(state==='failed')end('The networks couldn’t connect directly. Try a different network.')
      })
      local.getTracks().forEach(track=>peer.addTrack(track,local))
      if(active.offer)await peer.setRemoteDescription({type:'offer',sdp:active.offer})
      const description=active.offer?await peer.createAnswer():await peer.createOffer()
      await peer.setLocalDescription(description)
      await peer.waitForIce()
      if(current.current!==active)return
      const sdp=peer.getLocalDescription()?.sdp
      if(!sdp)throw new Error('Couldn’t prepare the call.')
      const outgoing:CallSignal=active.offer?{kind:'answer',id:active.id,sdp}:{kind:'offer',id:active.id,video:active.video,sdp}
      if(!send(outgoing))throw new Error('Chat is reconnecting. Try the call again.')
      if(current.current?.state!=='connected'){
        active.state=active.offer?'connecting':'ringing';update(active)
        timeout(active,active.offer?'The call couldn’t connect.':'No answer yet.',35000)
      }
    }catch(reason){
      if(current.current===active)end(reason instanceof Error?reason.message:'Couldn’t access call media.')
    }
  }
  function start(video:boolean){
    if(!media||current.current)return
    const active:ActiveCall={id:Date.now().toString(36)+Math.random().toString(36).slice(2).padEnd(10,'0'),video,state:'preparing'}
    current.current=active
    void connect(active)
  }
  async function receive(signal:CallSignal){
    const active=current.current
    if(signal.kind==='offer'){
      if(!media)return
      if(active?.id===signal.id)return
      if(active){
        // Simultaneous outgoing calls use the same deterministic winner on both devices.
        if(active.offer||active.state==='connected'||active.id<signal.id){send({kind:'busy',id:signal.id});return}
        end(undefined,false)
      }
      const incoming:ActiveCall={id:signal.id,video:signal.video,offer:signal.sdp,state:'incoming'}
      current.current=incoming;update(incoming)
      timeout(incoming,'Incoming call timed out.',35000)
      return
    }
    if(!active||active.id!==signal.id)return
    if(signal.kind==='answer'){
      if(active.state!=='ringing'||!active.peer)return
      active.state='connecting';update(active)
      timeout(active,'The call couldn’t connect directly.',25000)
      try{await active.peer.setRemoteDescription({type:'answer',sdp:signal.sdp})}
      catch{if(current.current===active)end('Couldn’t connect the call.')}
      return
    }
    end(signal.kind==='busy'?'The other person is on a call.':signal.kind==='unavailable'?'The other person needs to open this chat.':'The other person ended the call.',false)
  }
  return {call,start,receive,end,accept:()=>{const active=current.current;if(active?.state==='incoming')void connect(active)}}
}

const callLabels={incoming:'Incoming call',preparing:'Starting call…',ringing:'Ringing…',connecting:'Connecting…',connected:'Connected'}
export function RoomCall({person,media,call,accept,end}:{person:Person;media:CallMedia;call:ActiveCall;accept:()=>void;end:()=>void}){
  const [muted,setMuted]=useState(false)
  const [cameraOff,setCameraOff]=useState(false)
  const {theme}=useDesign()
  const Surface=media.Surface
  return <View style={{gap:16}}>
    <View style={row}><Avatar person={person}/><View><PersonName person={person}/><Copy color={theme.muted}>{callLabels[call.state]}</Copy></View></View>
    {call.remote&&<Surface stream={call.remote} video={call.video}/>}
    {call.video&&call.local&&<Surface stream={call.local} video local/>}
    <View style={{...row,flexWrap:'wrap'}}>
      {call.state==='incoming'&&<Button label="Accept call" onPress={accept}/>}
      {call.local&&<Button label={muted?'Unmute':'Mute'} variant="secondary" onPress={()=>{call.local?.getAudioTracks().forEach(track=>{track.enabled=muted});setMuted(!muted)}}/>}
      {call.local&&call.video&&<Button label={cameraOff?'Turn camera on':'Turn camera off'} variant="secondary" onPress={()=>{call.local?.getVideoTracks().forEach(track=>{track.enabled=cameraOff});setCameraOff(!cameraOff)}}/>}
      <Button label={call.state==='incoming'?'Decline call':'End call'} variant="danger" onPress={end}/>
    </View>
  </View>
}
