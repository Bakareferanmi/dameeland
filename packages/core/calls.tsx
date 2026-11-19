import React,{useEffect,useRef,useState} from 'react'
import {Animated,Platform,Pressable,View,useWindowDimensions} from 'react-native'
import type {CallSignal} from './callSignal'
import {Avatar,Button,Copy,Icon,displayHandle,row,useDesign,type Glyph} from './ui'
import type {Person} from './index'

type Track={enabled:boolean;stop:()=>void;_switchCamera?:()=>void}
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
  replaceVideoTrack:(track:Track)=>Promise<void>
  close:()=>void
}
export type CallMedia={
  getStream:(video:boolean)=>Promise<CallStream>
  createPeer:()=>CallPeer
  switchCamera?:(stream:CallStream,peer:CallPeer)=>Promise<CallStream>
  startAudioSession?:(video:boolean)=>void
  stopAudioSession?:()=>void
  setAudioRoute?:(route:'phone'|'speaker'|'bluetooth')=>Promise<void>
  Surface:React.ComponentType<{stream:CallStream;local?:boolean;video:boolean;full?:boolean}>
}
export const callIceServers=[{urls:'stun:stun.cloudflare.com:3478'}]
const videoCapture={width:1280,height:720,frameRate:24}
export const callConstraints=(video:boolean)=>({
  audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},
  video:video?{...videoCapture,facingMode:'user'}:false,
})

function callMediaError(reason:unknown,video:boolean){
  const error=reason as {name?:string;message?:string}
  if(!globalThis.isSecureContext)return new Error('Calls need a secure connection. Open dameen from its https website and try again.')
  if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return new Error(video?'Camera or microphone blocked. Allow both for dameen in your browser settings.':'Microphone blocked. Allow it for dameen in your browser settings.')
  if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return new Error(`No ${video?'camera or microphone':'microphone'} was found on this device.`)
  if(error?.name==='NotReadableError'||error?.name==='TrackStartError'||/start audio source/i.test(error?.message??''))return new Error(video?'Camera or microphone unavailable. Close other calling apps and check browser permissions.':'Microphone unavailable. Close other calling apps or allow microphone access for your browser.')
  if(error?.name==='OverconstrainedError')return new Error(`This device could not use the requested ${video?'camera and microphone':'microphone'} settings.`)
  return new Error(video?'Couldn’t start the camera or microphone. Check browser permissions.':'Couldn’t start the microphone. Check browser permissions.')
}

function WebSurface({stream,local,video,full}:{stream:CallStream;local?:boolean;video:boolean;full?:boolean}){
  const element=useRef<HTMLMediaElement|null>(null)
  const [blocked,setBlocked]=useState(false)
  useEffect(()=>{
    const player=element.current
    if(!player)return
    player.srcObject=stream as MediaStream
    void player.play().catch(()=>setBlocked(true))
    return ()=>{player.srcObject=null}
  },[stream])
  return <View style={full?{flex:1,width:'100%',height:'100%'}:undefined}>
    {React.createElement(video?'video':'audio',{
      ref:(value:HTMLMediaElement|null)=>{element.current=value},autoPlay:true,playsInline:true,muted:local,
      style:video?full?{width:'100%',height:'100%',objectFit:'cover',background:'#120D1F'}:{width:'100%',aspectRatio:'16 / 9',objectFit:'cover',background:'#120D1F',borderRadius:16}:undefined,
    })}
    {blocked&&<Button label="Play call media" onPress={()=>void element.current?.play().then(()=>setBlocked(false)).catch(()=>{})}/>}
  </View>
}

export function browserCallMedia():CallMedia|undefined{
  if(Platform.OS!=='web'||typeof RTCPeerConnection==='undefined'||!globalThis.navigator?.mediaDevices?.getUserMedia)return
  return {
    getStream:async video=>{
      let stream:MediaStream
      try{stream=await navigator.mediaDevices.getUserMedia(callConstraints(video))}
      catch(reason){
        // Some Windows/browser audio drivers reject processing constraints but work
        // with the browser defaults, so retry once with basic constraints.
        try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:'user'}:false})}
        catch{throw callMediaError(reason,video)}
      }
      const track=stream.getVideoTracks()[0]
      if(track)track.contentHint='motion'
      return stream
    },
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
        replaceVideoTrack:async track=>{
          const sender=peer.getSenders().find(value=>value.track?.kind==='video')
          if(!sender)throw new Error('Camera is not connected to this call.')
          await sender.replaceTrack(track as MediaStreamTrack)
        },
        close:()=>peer.close(),
      }
    },
    switchCamera:async(stream,peer)=>{
      const currentTrack=(stream as MediaStream).getVideoTracks()[0]
      const facing=currentTrack.getSettings().facingMode==='environment'?'user':'environment'
      const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{...videoCapture,facingMode:{exact:facing}}})
      const nextTrack=next.getVideoTracks()[0]
      if(!nextTrack)throw new Error('The other camera is not available.')
      nextTrack.enabled=currentTrack.enabled
      nextTrack.contentHint='motion'
      try{await peer.replaceVideoTrack(nextTrack)}
      catch(error){nextTrack.stop();throw error}
      stream.getVideoTracks().forEach(track=>track.stop())
      return new MediaStream([...stream.getAudioTracks() as MediaStreamTrack[],nextTrack])
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
  state:'incoming'|'preparing'|'calling'|'ringing'|'connecting'|'connected';timer?:ReturnType<typeof setTimeout>;connectedAt?:number
}
const stop=(stream?:CallStream)=>stream?.getTracks().forEach(track=>track.stop())

export function useRoomCall(media:CallMedia|undefined,roomKey:string|undefined,send:(signal:CallSignal)=>boolean|Promise<boolean>,notify:(message:string)=>void){
  const current=useRef<ActiveCall|null>(null)
  const [call,setCall]=useState<ActiveCall|null>(null)
  const update=(active:ActiveCall)=>{if(current.current===active)setCall({...active})}
  const clear=()=>{
    const active=current.current
    current.current=null
    if(active){clearTimeout(active.timer);active.peer?.close();stop(active.local);stop(active.remote);media?.stopAudioSession?.()}
    setCall(null)
  }
  function end(message?:string,signal=true){
    const active=current.current
    if(!active)return
    if(signal)void send({kind:'end',id:active.id})
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
      media.startAudioSession?.(active.video)
      const local=await media.getStream(active.video)
      if(current.current!==active){stop(local);return}
      active.local=local
      const peer=active.peer=media.createPeer()
      peer.onTrack(stream=>{if(current.current===active){active.remote=stream;update(active)}})
      peer.onState(state=>{
        if(current.current!==active)return
        if(state==='connected'){
          clearTimeout(active.timer)
          if(!active.connectedAt){active.connectedAt=Date.now();void send({kind:'connected',id:active.id})}
          active.state='connected';update(active)
        }
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
      if(!await send(outgoing))throw new Error('Couldn’t reach the other person. Try the call again.')
      if(current.current!==active){void send({kind:'end',id:active.id});return}
      if(current.current?.state!=='connected'){
        active.state=active.offer?'connecting':'calling';update(active)
        timeout(active,active.offer?'The call couldn’t connect.':'No answer yet.',65000)
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
        if(active.offer||active.state==='connected'||active.id<signal.id){void send({kind:'busy',id:signal.id});return}
        end(undefined,false)
      }
      const incoming:ActiveCall={id:signal.id,video:signal.video,offer:signal.sdp,state:'incoming'}
      current.current=incoming;update(incoming)
      timeout(incoming,'Incoming call timed out.',35000)
      return
    }
    if(!active||active.id!==signal.id)return
    if(signal.kind==='ringing'){
      if(active.state==='calling'){active.state='ringing';update(active)}
      return
    }
    if(signal.kind==='connected')return
    if(signal.kind==='answer'){
      if((active.state!=='calling'&&active.state!=='ringing')||!active.peer)return
      active.state='connecting';update(active)
      timeout(active,'The call couldn’t connect directly.',25000)
      try{await active.peer.setRemoteDescription({type:'answer',sdp:signal.sdp})}
      catch{if(current.current===active)end('Couldn’t connect the call.')}
      return
    }
    end(signal.kind==='busy'?'The other person is on a call.':signal.kind==='unavailable'?'The other person needs to open this chat.':'The other person ended the call.',false)
  }
  async function switchCamera(){
    const active=current.current
    if(!media?.switchCamera||!active?.video||!active.local||!active.peer)return
    try{
      active.local=await media.switchCamera(active.local,active.peer)
      update(active)
    }catch(reason){notify(reason instanceof Error?reason.message:'Couldn’t switch camera.')}
  }
  return {call,start,receive,end,switchCamera,canSwitchCamera:Boolean(media?.switchCamera),accept:()=>{const active=current.current;if(active?.state==='incoming')void connect(active)}}
}

const callLabels={incoming:'Incoming call',preparing:'Starting call…',calling:'Calling…',ringing:'Ringing…',connecting:'Connecting…',connected:'Connected'}
const formatDuration=(seconds:number)=>`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`
function CallControl({label,glyph,onPress,danger=false,active=false}:{label:string;glyph:Glyph;onPress:()=>void;danger?:boolean;active?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{alignItems:'center',gap:8,minWidth:68,minHeight:78}}>
    <View style={{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',backgroundColor:danger?'#E64661':active?'#FFFFFF':'#FFFFFF27'}}>
      <Icon name={glyph} color={active?'#24133F':'#FFFFFF'} size={25}/>
    </View>
    <Copy color="#FFFFFF" size={12}>{label}</Copy>
  </Pressable>
}
export function RoomCall({person,media,call,accept,end,switchCamera,canSwitchCamera}:{person:Person;media:CallMedia;call:ActiveCall;accept:()=>void;end:()=>void;switchCamera:()=>void;canSwitchCamera:boolean}){
  const [muted,setMuted]=useState(false)
  const [cameraOff,setCameraOff]=useState(false)
  const [audioRoute,setAudioRoute]=useState<'phone'|'speaker'|'bluetooth'>(call.video?'speaker':'phone')
  const [tick,setTick]=useState(0)
  const {reduced}=useDesign()
  const {width}=useWindowDimensions()
  const wave=useRef(new Animated.Value(1)).current
  const avatarSize=134
  const frameRadius=(person.role==='tech'?avatarSize*.28:avatarSize/2)+10
  useEffect(()=>{
    if(reduced||call.video||call.state!=='connected'){wave.setValue(1);return}
    const animation=Animated.loop(Animated.sequence([Animated.timing(wave,{toValue:1.14,duration:650,useNativeDriver:Platform.OS!=='web',isInteraction:false}),Animated.timing(wave,{toValue:1,duration:650,useNativeDriver:Platform.OS!=='web',isInteraction:false})]))
    animation.start();return ()=>animation.stop()
  },[call.state,call.video,reduced,wave])
  useEffect(()=>{
    if(call.state!=='connected')return
    const interval=setInterval(()=>setTick(value=>value+1),1000)
    return ()=>clearInterval(interval)
  },[call.state])
  const Surface=media.Surface
  const videoSurface=call.video&&(call.remote??call.local)
  const duration=call.connectedAt?formatDuration(Math.max(0,Math.floor((Date.now()-call.connectedAt)/1000))):undefined
  void tick
  const chooseAudioRoute=async(route:'phone'|'speaker'|'bluetooth')=>{
    if(!media.setAudioRoute)return
    try{await media.setAudioRoute(route);setAudioRoute(route)}catch{/* The requested device may not be connected. */}
  }
  return <View accessibilityLabel={call.video?'Video call screen':'Voice call screen'} style={{flex:1,backgroundColor:'#130D25',overflow:'hidden'}}>
    {!call.video&&call.remote&&<Surface stream={call.remote} video={false}/>}
    {videoSurface&&<View style={{position:'absolute',inset:0}}><Surface stream={videoSurface} video full local={!call.remote}/></View>}
    {call.video&&call.remote&&call.local&&<View style={{position:'absolute',top:24,right:18,width:Math.min(128,width*.27),height:174,borderWidth:2,borderColor:'#FFFFFF88',borderRadius:18,overflow:'hidden',backgroundColor:'#211B32'}}><Surface stream={call.local} video full local/></View>}
    {!videoSurface&&<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:25}}>
      <Animated.View style={{padding:8,borderRadius:frameRadius,borderWidth:2,borderColor:'#C8F53F',transform:[{scale:wave}]}}><Avatar person={person} size={avatarSize}/></Animated.View>
      <Copy color="#FFFFFF" size={31} weight={800} center>{displayHandle(person)}</Copy>
      <Copy color="#D3C7E8" size={16} center>{call.video?'Video call':'Voice call'}</Copy>
    </View>}
    <View style={{position:videoSurface?'absolute':'relative',top:videoSurface?0:undefined,left:0,right:0,paddingHorizontal:24,paddingTop:videoSurface?26:8,paddingBottom:16,backgroundColor:videoSurface?'#130D2577':'transparent',alignItems:videoSurface?'flex-start':'center',gap:5}}>
      {videoSurface&&<Copy color="#FFFFFF" size={24} weight={800}>{displayHandle(person)}</Copy>}
      <Copy color="#E7DDF6" size={14} weight={700}>{call.state==='connected'?duration:callLabels[call.state]}</Copy>
    </View>
    <View style={{marginTop:'auto',paddingHorizontal:20,paddingTop:24,paddingBottom:32,backgroundColor:videoSurface?'#130D25CC':'#201737',borderTopLeftRadius:28,borderTopRightRadius:28,gap:22}}>
      <View style={{...row,justifyContent:'space-around',flexWrap:'wrap'}}>
        {call.local&&<CallControl label={muted?'Unmute':'Mute'} glyph={muted?'micOff':'mic'} active={muted} onPress={()=>{call.local?.getAudioTracks().forEach(track=>{track.enabled=muted});setMuted(!muted)}}/>}
        {call.local&&call.video&&<CallControl label={cameraOff?'Camera on':'Camera off'} glyph={cameraOff?'vidOff':'vid'} active={cameraOff} onPress={()=>{call.local?.getVideoTracks().forEach(track=>{track.enabled=cameraOff});setCameraOff(!cameraOff)}}/>}
        {call.local&&call.video&&canSwitchCamera&&<CallControl label="Switch camera" glyph="rp" onPress={switchCamera}/>} 
        {call.local&&media.setAudioRoute&&<CallControl label="Phone" glyph="ph" active={audioRoute==='phone'} onPress={()=>void chooseAudioRoute('phone')}/>}
        {call.local&&media.setAudioRoute&&<CallControl label="Speaker" glyph="speaker" active={audioRoute==='speaker'} onPress={()=>void chooseAudioRoute('speaker')}/>}
        {call.local&&media.setAudioRoute&&<CallControl label="Bluetooth" glyph="bluetooth" active={audioRoute==='bluetooth'} onPress={()=>void chooseAudioRoute('bluetooth')}/>}
        {call.state==='incoming'&&<CallControl label="Accept call" glyph="ph" active onPress={accept}/>}
        <CallControl label={call.state==='incoming'?'Decline call':'End call'} glyph="hangup" danger onPress={end}/>
      </View>
    </View>
  </View>
}

