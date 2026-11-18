import {Learning,LearningProgress,StudyLesson} from './Learning'
import {dailyLesson} from './learningCatalog'
import {browserCallMedia,RoomCall,useRoomCall,type CallMedia} from './calls'
import {readCallSignal,type CallSignal} from './callSignal'
import React,{lazy,Suspense,useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react'
import {AccessibilityInfo,Animated,AppState,BackHandler,Easing,Image,KeyboardAvoidingView,Modal,PanResponder,Platform,Pressable,RefreshControl,ScrollView,Switch,TextInput,View,useWindowDimensions,type ViewStyle} from 'react-native'
import {api,birthdayToday,validBirthDate,storyLifetime,verifiedStoryLifetime,storyVideoLimit,verifiedStoryVideoLimit,verifiedStoryLimit,capitalizeName,normalizeUsername,usernameHint,validUsername,initialChats,initialComments,initialPosts,initials,lime,me,people,questions,slides,themes,type FollowListKind,type FollowPage,type FollowStats,type Note,type Person,type Post,type BirthdayEntry,type Role,type Story,type StoryGroup,type Theme} from './index'
import {Avatar,Button,Card,Copy,Design,displayHandle,Field,Icon,IconButton,IconTile,Logo,PersonName,ScreenLinks,Segmented,VerifiedBadge,row,spread,stack,useDesign,type Glyph,type IconRendererProps} from './ui'
import type {ExtraPage} from './FeatureScreens'
import {LoadingScreen} from './LoadingScreen'
import {GoogleButton} from './GoogleButton'
import AccountRecovery from './AccountRecovery'
import {useBrowserModalBack} from './useBrowserModalBack'
import {Toast,type ToastMessage} from './Toast'
import {Comments,type GifRenderer} from './Comments'
import type {AdminAccount,AdminOverview,CommentAttachment,Viewer} from './index'

const Admin=lazy(()=>import('./Admin'))
const FeatureScreen=lazy(()=>import('./FeatureScreens'))

const sampleFollows:Record<string,string[]>={ada:['tobi','zee'],tobi:['ada','code'],zee:['ada','bello'],bello:['ada'],code:['tobi'],maths:['bello'],squad:['code']}

type Page=ExtraPage|'Home'|'Learn'|'Explore'|'Play'|'Messages'|'Chat'|'Notifications'|'Profile'|'Settings'|'Quiz'|'Admin'
type Room={id:string;person:Person;lastActivity?:string;lastActivityAt?:string}
type RoomPage={items:Room[];nextCursor:string|null}
type MessagePage={items:Note[];nextCursor:string|null}
type Session={token:string;user:Viewer}
type AuthMode='signup'|'login'
type Credentials={firstName:string;lastName:string;username:string;email:string;password:string;dob:string}
type NotificationItem={id:string;kind:string;entityId?:string;body:string;created:string;read:boolean;actor?:Person}
type Presence={online:boolean;lastSeen:string|null}
type IncomingCall={id:string;room:string;person:Person;video:boolean;offer:string;state:string;expires:string}
type CallStatus={id:string;room:string;state:string;answer?:string;offer?:string;expires:string}
type BirthDraft={day:string;month:string;year:string}
const emptyBirth:BirthDraft={day:'',month:'',year:''}
const digits=(value:string,max:number)=>value.replace(/\D/g,'').slice(0,max)
/** YYYY-MM-DD from the three fields, or '' while any part is missing or the date is not real. */
const birthIso=(draft:BirthDraft)=>{
  if(!draft.day||!draft.month||draft.year.length!==4)return ''
  const value=draft.year+'-'+draft.month.padStart(2,'0')+'-'+draft.day.padStart(2,'0')
  return validBirthDate(value)?value:''
}
function BirthdayFields({value,onChange,note}:{value:BirthDraft;onChange:(next:BirthDraft)=>void;note?:string}){
  const {theme}=useDesign()
  return <View style={{gap:5}}>
    <View style={{...row,alignItems:'flex-start'}}>
      <View style={{flex:1,minWidth:0}}><Field label="Day" placeholder="DD" value={value.day} onChangeText={text=>onChange({...value,day:digits(text,2)})} keyboardType="number-pad" maxLength={2} autoComplete="birthdate-day"/></View>
      <View style={{flex:1,minWidth:0}}><Field label="Month" placeholder="MM" value={value.month} onChangeText={text=>onChange({...value,month:digits(text,2)})} keyboardType="number-pad" maxLength={2} autoComplete="birthdate-month"/></View>
      <View style={{flex:1.4,minWidth:0}}><Field label="Year" placeholder="YYYY" value={value.year} onChangeText={text=>onChange({...value,year:digits(text,4)})} keyboardType="number-pad" maxLength={4} autoComplete="birthdate-year"/></View>
    </View>
    {!!note&&<Copy size={12} color={theme.muted}>{note}</Copy>}
  </View>
}
function SearchVisibility({label,detail,value,onChange,disabled}:{label:string;detail:string;value:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){
  const {theme}=useDesign()
  return <View style={{...row,gap:12}}>
    <View style={{flex:1,gap:4}}><Copy weight={800}>{label}</Copy><Copy size={12} color={theme.muted}>{detail}</Copy></View>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{true:theme.purple}}/>
  </View>
}

type GoogleStart={url:string;state:string;exchange:string}
type GoogleWindow={close:()=>void}
type Media={name:string;uri:string;data:Blob|{uri:string;name:string;type:string};kind?:'image'|'video';duration?:number}
type Props={
  demo:boolean; base:string; phone?:boolean; initialTheme:Theme; font:(weight:number)=>object; renderIcon:React.ComponentType<IconRendererProps>;
  loadToken?:()=>Promise<string|null>; saveToken?:(token:string|null)=>Promise<void>;
  openGoogle?:(getUrl:()=>Promise<string>)=>Promise<GoogleWindow>;
  callMedia?:CallMedia;
  notificationTarget?:string;
  modalViewport?:React.ComponentType<{color:string;children:React.ReactNode}>;
  pickMedia?:()=>Promise<Media|null>; pickCommentMedia?:()=>Promise<Media|null>; renderGif?:GifRenderer; share?:(url:string)=>Promise<void>;
  requestNotifications?:()=>Promise<boolean>; getNotificationDevice?:()=>Promise<{platform:'android'|'ios';token:string}|null>; notifyDevice?:(title:string,body:string)=>Promise<void>;
  onReady?:()=>void;
}
type Overlay={kind:'connections';list:FollowListKind;person:Person}|{kind:'comments'|'share'|'post'|'editPost';post:Post;targetId?:string}|{kind:'editMessage';message:Note}|{kind:'story';person:Person}|{kind:'photo';person:Person;photo:'avatar'|'cover'}|{kind:'create'|'wish'|'newStory'|'editProfile'|'editUsername'}|{kind:'call';video:boolean;person:Person;ringing?:boolean;incoming?:boolean}
type PageEntry={page:Page;profile:Person;room:Room|null;overlays:Overlay[];scrollY:number;lessonId:string}
const tabs:[Page,Glyph][]=[['Home','home'],['Learn','book'],['Explore','search'],['Play','game']]
const localRooms=people.filter(p=>p.id in initialChats).map(person=>({id:person.id,person}))
const storyPeople=[people[0],people[3],people[4],people[2],people[1]]
const hour=3600000
// Demo stories carry a posted time and disappear 12 hours later, like real ones. Zee's is about to expire.
const demoPosted:Record<string,number>={ada:Date.now()-2*hour,bello:Date.now()-4*hour,code:Date.now()-9*hour,zee:Date.now()-storyLifetime+4*60000,tobi:Date.now()-hour}
const storyLeft=(ms:number)=>{const minutes=Math.max(1,Math.ceil(ms/60000));return minutes>=60?Math.floor(minutes/60)+'h '+(minutes%60)+'m left':minutes+'m left'}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2)
const json=(body:unknown,method='POST')=>({method,body:JSON.stringify(body)})
const foreground=()=>Platform.OS==='web'?document.visibilityState==='visible':AppState.currentState==='active'
const vapidBytes=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),char=>char.charCodeAt(0))
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Try again.'
const demoUsernameTaken=(username:string)=>people.some(person=>person.id===username)||[...welcomeAccounts.values()].some(account=>account.user.username===username)
const welcomeAccounts=new Map<string,{user:Person;password:string}>()
const shortTime=(value:string)=>{
  if(!value.includes('T')) return value
  const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000))
  return minutes<1?'Just now':minutes<60?minutes+'m':minutes<1440?Math.floor(minutes/60)+'h':Math.floor(minutes/1440)+'d'
}
const withinEditWindow=(value:string|undefined)=>!!value&&Number.isFinite(Date.parse(value))&&Date.now()-Date.parse(value)<=3600000
const callLength=(seconds:number)=>seconds<60?seconds+'s':Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s'
const mergeNotes=(current:Note[],incoming:Note[])=>[...new Map([...current,...incoming].map(item=>[item.id,item])).values()].sort((a,b)=>Date.parse(a.createdAt??'')-Date.parse(b.createdAt??''))
function Motion({children,reduced,style,distance=10,axis='y'}:{children:React.ReactNode;reduced:boolean;style?:ViewStyle;distance?:number;axis?:'x'|'y'}){
  const animation=useRef(new Animated.Value(reduced?1:0)).current
  useEffect(()=>{
    if(reduced){animation.setValue(1);return}
    const motion=Animated.timing(animation,{toValue:1,duration:240,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web',isInteraction:false})
    motion.start()
    return ()=>motion.stop()
  },[animation,reduced])
  const offset=animation.interpolate({inputRange:[0,1],outputRange:[distance,0]})
  return <Animated.View style={[style,{opacity:animation,transform:[axis==='x'?{translateX:offset}:{translateY:offset}]}]}>{children}</Animated.View>
}
function RefreshIndicator({reduced,color}:{reduced:boolean;color:string}){
  const pulse=useRef(new Animated.Value(reduced?1:.35)).current
  useEffect(()=>{
    if(reduced){pulse.setValue(1);return}
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1,duration:520,easing:Easing.inOut(Easing.quad),useNativeDriver:Platform.OS!=='web',isInteraction:false}),
      Animated.timing(pulse,{toValue:.35,duration:520,easing:Easing.inOut(Easing.quad),useNativeDriver:Platform.OS!=='web',isInteraction:false}),
    ]))
    animation.start();return ()=>animation.stop()
  },[pulse,reduced])
  return <View accessibilityRole="progressbar" accessibilityLabel="Refreshing" style={{position:'absolute',top:0,left:0,right:0,height:3,zIndex:20,alignItems:'center',overflow:'hidden'}}>
    <Animated.View style={{width:'46%',height:3,borderRadius:3,backgroundColor:color,transform:[{scaleX:pulse}]}}/>
  </View>
}
function DefaultModalViewport({color,children}:{color:string;children:React.ReactNode}){
  return <View style={{flex:1,backgroundColor:color}}>{children}</View>
}

function Intro({step,onNext,onBack,onSkip,reduced,desktop,showPublicBrand}:{step:number;onNext:()=>void;onBack:()=>void;onSkip:()=>void;reduced:boolean;desktop:boolean;showPublicBrand:boolean}){
  const {font}=useDesign()
  const slide=slides[step]
  const description=showPublicBrand&&step===0
    ?'Chat with classmates and practise mathematics, English and digital technologies with short lessons.'
    :slide.description
  const illustration:Glyph=(['book','grp','trophy'] as const)[step]
  return <ScrollView style={{backgroundColor:'#4F25D6'}} contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:desktop?48:14}}>
    <View style={{alignSelf:'center',width:'100%',maxWidth:1056,minHeight:desktop?610:676,padding:desktop?38:18,overflow:'hidden',justifyContent:'space-between'}}>
      <View style={spread}>
        <View style={row}>
          <Logo variant="inverse" size={desktop?48:40}/>
          {showPublicBrand&&<h1 style={{...font(800),margin:0,color:'#fff',fontSize:24,lineHeight:1.15}}>dameen</h1>}
        </View>
        <Pressable onPress={onSkip} accessibilityRole="button" style={{minHeight:44,justifyContent:'center',paddingHorizontal:16,borderRadius:14,backgroundColor:'#FFFFFF16'}}><Copy color="#fff" weight={800}>Skip</Copy></Pressable>
      </View>
      <Motion key={step} reduced={reduced} axis="x" distance={14} style={{flexGrow:desktop?1:0,flexShrink:0,flexDirection:desktop?'row-reverse':'column',alignItems:desktop?'center':'stretch',justifyContent:'center',gap:desktop?48:16,paddingTop:desktop?12:0}}>
        <View style={{flex:desktop?1:undefined,minHeight:desktop?330:216,justifyContent:'center',alignItems:'center'}}>
          <View style={{width:'92%',maxWidth:desktop?325:257,backgroundColor:'#fff',borderRadius:22,padding:desktop?22:16,gap:14,transform:[{rotate:slide.tilt}],boxShadow:'0 18px 48px #210A7655'}}>
            <IconTile name={illustration} background="#EEE8FC" color="#4F25D6" size={desktop?45:36}/>
            <Copy color="#1B1233" weight={800} size={desktop?23:17}>{slide.post}</Copy>
            <View style={spread}>
              <View style={row}><Icon name="heartOn" color="#6A35F0" size={18}/><Copy color="#4F25D6" weight={800}>{slide.likes}</Copy></View>
              <View style={{backgroundColor:'#EEE8FC',borderRadius:9,paddingVertical:7,paddingHorizontal:10}}><Copy color="#4F25D6" weight={800} size={12}>{slide.action}</Copy></View>
            </View>
          </View>
        </View>
        <View style={{flex:desktop?1:undefined,gap:14,paddingHorizontal:desktop?10:2}}>
          <View accessibilityLabel={`Slide ${step+1} of 3`} style={{...row,gap:5}}>{slides.map((_,i)=><View key={i} style={{width:i===step?27:10,height:4,borderRadius:4,backgroundColor:i===step?lime:'#B69CF9'}}/>)}</View>
          <Copy color="#fff" weight={800} size={desktop?57:43}>{slide.title}</Copy>
          <Copy color="#E9DFFF" size={desktop?18:15}>{description}</Copy>
        </View>
      </Motion>
      <View style={{width:'100%',maxWidth:desktop?380:undefined,gap:6,paddingTop:18}}>
        <Button label={step===2?'Get started':'Continue'} variant="fun" onPress={onNext}/>
        {step>0&&<Pressable accessibilityRole="button" onPress={onBack} style={{...row,justifyContent:'center',minHeight:44}}><Icon name="back" color="#fff" size={17}/><Copy color="#fff" weight={800}>Back</Copy></Pressable>}
        {showPublicBrand&&<a href="/about/" style={{...font(700),display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,color:'#fff',fontSize:13}}>About dameen</a>}
      </View>
    </View>
  </ScrollView>
}
function Auth({base,demo,busy,error,submit,onGoogle,onCancelGoogle,googlePending,onDemo,reduced,recovering,setRecovering}:{base:string;demo:boolean;busy:boolean;error:string;submit:(mode:'signup'|'login',values:Credentials)=>void;onGoogle:(mode:AuthMode,username:string,dob:string)=>void;onCancelGoogle:()=>void;googlePending:boolean;onDemo:()=>void;reduced:boolean;recovering:boolean;setRecovering:(value:boolean)=>void}){
  const [mode,setMode]=useState<'signup'|'login'>('signup')
  const [firstName,setFirstName]=useState(''),[lastName,setLastName]=useState('')
  const [username,setUsername]=useState('')
  const handle=normalizeUsername(username)
  const [availability,setAvailability]=useState<{handle:string;status:'available'|'taken'|'error'}>()
  const usernameStatus=availability?.handle===handle?availability.status:undefined
  useEffect(()=>{
    if(mode!=='signup'||!validUsername(handle))return
    const controller=new AbortController()
    const timer=setTimeout(()=>{
      const check=demo?Promise.resolve({available:!demoUsernameTaken(handle)}):api<{available:boolean}>(base,'/auth/username?username='+encodeURIComponent(handle),{signal:controller.signal})
      check.then(result=>{if(!controller.signal.aborted)setAvailability({handle,status:result.available?'available':'taken'})})
        .catch(()=>{if(!controller.signal.aborted)setAvailability({handle,status:'error'})})
    },300)
    return ()=>{clearTimeout(timer);controller.abort()}
  },[base,demo,handle,mode])
  const [email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [birth,setBirth]=useState<BirthDraft>(emptyBirth)
  const [show,setShow]=useState(false)
  const {theme}=useDesign()
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:20}}>
    <Motion reduced={reduced} style={{...stack,width:'100%',maxWidth:448,alignSelf:'center'}}>
      <Logo size={40}/>
      {recovering?<AccountRecovery base={base} demoEmail={email} findDemoAccount={demo?address=>welcomeAccounts.get(address):undefined}
        onBack={()=>{setPassword('');setRecovering(false)}}/>:<>
      <Segmented options={['Sign up','Log in']} selected={mode==='signup'?'Sign up':'Log in'} onSelect={value=>setMode(value==='Sign up'?'signup':'login')}/>
      {mode==='signup'&&<View style={{...row,alignItems:'flex-start'}}>
        <View style={{flex:1,minWidth:0}}><Field label="First name" value={firstName} onChangeText={value=>setFirstName(capitalizeName(value))} autoCapitalize="words" maxLength={60} autoComplete="given-name"/></View>
        <View style={{flex:1,minWidth:0}}><Field label="Last name" value={lastName} onChangeText={value=>setLastName(capitalizeName(value))} autoCapitalize="words" maxLength={60} autoComplete="family-name"/></View>
      </View>}
      {mode==='signup'&&<View style={{gap:5}}>
        <Field label="Username" placeholder="e.g. ada_olu" value={username} onChangeText={value=>setUsername(value.toLowerCase())} maxLength={24} autoCapitalize="none" autoCorrect={false} autoComplete="username"/>
        <View accessibilityLiveRegion="polite">
          <Copy size={12} color={usernameStatus==='taken'?theme.ink:theme.muted}>
            {!validUsername(handle)?usernameHint:usernameStatus==='available'?'Username is available.':usernameStatus==='taken'?'That username is taken.':usernameStatus==='error'?'Couldn’t check availability. You can still try signing up.':'Checking availability…'}
          </Copy>
        </View>
      </View>}
      {mode==='signup'&&<BirthdayFields value={birth} onChange={setBirth} note="Your date of birth lets friends wish you a happy birthday. Only the day and month are shown to others."/>}
      <Field label={mode==='signup'?'Email':'Email or username'} placeholder={mode==='signup'?'you@example.com':'Email address or username'} value={email} onChangeText={setEmail} keyboardType={mode==='signup'?'email-address':'default'} autoCapitalize="none" autoCorrect={false} autoComplete={mode==='signup'?'email':'username'} maxLength={254}/>
      <Field label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" action={show?'eyeOff':'eye'} actionLabel={show?'Hide password':'Show password'} onAction={()=>setShow(!show)}/>
      {!!error&&<View accessibilityRole="alert"><Copy color={theme.ink}>{error}</Copy></View>}
      <Button label={busy?'Please wait…':mode==='signup'?'Sign up':'Log in'} disabled={busy||mode==='signup'&&usernameStatus==='taken'} onPress={()=>submit(mode,{firstName,lastName,username:handle,email,password,dob:birthIso(birth)})}/>
      {mode==='login'&&<Button label="Forgot password or username?" variant="plain" disabled={busy} onPress={()=>setRecovering(true)}/>}
      <GoogleButton signup={mode==='signup'} disabled={busy||mode==='signup'&&usernameStatus==='taken'} onPress={()=>onGoogle(mode,handle,birthIso(birth))}/>
      {googlePending&&<Button label="Cancel Google sign-in" variant="plain" onPress={onCancelGoogle}/>}
      {demo&&<><Button label="Explore demo" variant="secondary" onPress={onDemo}/><Copy color={theme.muted} center size={12}>Look around with sample data. Nothing is saved.</Copy></>}
      {Platform.OS==='web'&&!demo&&React.createElement('a',{href:'/about/',style:{color:theme.ink,textAlign:'center',fontSize:13}},'About dameen')}
      </>}
    </Motion>
  </ScrollView>
}
function StoryRow({onStory,onCreate,onAdd,seen,own,others}:{onStory:(p:Person)=>void;onCreate:()=>void;onAdd?:()=>void;seen:Set<string>;own:Person|null;others:Person[]}){
  const {theme}=useDesign()
  return <ScrollView horizontal directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{...row,gap:10,paddingVertical:1}}>
    <View style={{width:58,alignItems:'center',gap:7}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Your story" onPress={onCreate} style={({pressed})=>({width:52,height:52,alignItems:'center',justifyContent:'center',transform:[{scale:pressed?.92:1}]})}>
        {own?<Avatar person={own} size={44} ring seen={seen.has(own.id)}/>:<View style={{width:52,height:52,borderRadius:26,borderWidth:1,borderStyle:'dashed',borderColor:theme.purple,backgroundColor:theme.chip,alignItems:'center',justifyContent:'center'}}><Icon name="plus" color={theme.ink}/></View>}
      </Pressable>
      {own&&onAdd&&<Pressable accessibilityRole="button" accessibilityLabel="Add another story" onPress={onAdd} style={{position:'absolute',right:0,top:29,width:23,height:23,borderRadius:12,backgroundColor:theme.purple,borderWidth:2,borderColor:theme.card,alignItems:'center',justifyContent:'center'}}><Icon name="plus" color="#fff" size={14}/></Pressable>}
      <Copy size={10} weight={800}>Your story</Copy>
    </View>
    {others.map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={person.name+' story'} onPress={()=>onStory(person)} style={({pressed})=>({width:52,alignItems:'center',gap:7,transform:[{scale:pressed?.92:1}]})}>
      <Avatar person={person} size={43} ring seen={seen.has(person.id)}/><Copy size={10} weight={700}>{person.name.split(' ')[0]}</Copy>
    </Pressable>)}
  </ScrollView>
}
function PreviewMedia({kind}:{kind:'image'|'video'}){
  const maths=kind==='image'
  const ink=maths?'#24134A':'#FFF'
  const accent=maths?'#4F25D6':lime
  return <View style={{minHeight:172,backgroundColor:maths?'#E9E0FF':'#251651',borderRadius:14,padding:15,gap:12,justifyContent:'space-between',overflow:'hidden'}}>
    <View style={spread}>
      <IconTile name={maths?'maths':'play'} size={maths?34:42} color={accent} background={maths?'#FFFFFFBA':'#FFFFFF19'}/>
      <Copy color={accent} size={11} weight={800}>{maths?'MATHS NOTES':'VIDEO · 0:40'}</Copy>
    </View>
    <View style={{gap:5}}>
      <Copy color={ink} weight={800} size={25}>{maths?'Quadratic equations':'Build a weather app'}</Copy>
      <Copy color={maths?'#4F25D6':'#DED0FF'} size={12}>{maths?'Factorise · Complete the square · Check':'Code Club'}</Copy>
    </View>
  </View>
}
function LazyImage({uri,alt,style}:{uri:string;alt:string;style:object}){
  if(Platform.OS==='web')return React.createElement('img',{src:uri,alt,loading:'lazy',decoding:'async',style})
  return <Image accessibilityLabel={alt} source={{uri}} resizeMode="cover" style={style}/>
}
function UploadedMedia({post}:{post:Post}){
  const {theme}=useDesign()
  if(!post.media)return null
  if(post.kind==='video'&&Platform.OS==='web')return React.createElement('video',{src:post.media,controls:true,playsInline:true,preload:'metadata',style:{width:'100%',maxHeight:360,borderRadius:14,backgroundColor:theme.chip}})
  if(post.kind==='video')return <View style={{height:210,borderRadius:14,backgroundColor:'#120D1F',alignItems:'center',justifyContent:'center',gap:10}}><IconTile name="play" size={48} color={lime} background="#FFFFFF19"/><Copy color="#fff" weight={800}>VIDEO</Copy></View>
  return <LazyImage uri={post.media} alt="Post attachment" style={{width:'100%',height:195,borderRadius:14,backgroundColor:theme.chip,objectFit:'cover'}}/>
}

function PostCard({post,onReact,onOverlay,onProfile,detail=false}:{post:Post;detail?:boolean;onReact:(p:Post,k:'like'|'repost')=>void;onOverlay:(o:Overlay)=>void;onProfile:(p:Person)=>void}){
  const {theme}=useDesign()
  return <Card style={{padding:14,gap:9}}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Open '+displayHandle(post.author)+' profile'} onPress={()=>onProfile(post.author)} style={row}><Avatar person={post.author} size={40}/><View style={{flex:1}}><PersonName person={post.author}/><Copy color={theme.muted} size={12}>{shortTime(post.time)}{post.editedAt?' · Edited':''}</Copy></View></Pressable>
    {!!post.body&&(detail?<Copy size={15}>{post.body}</Copy>:<Pressable accessibilityRole="button" accessibilityLabel="Open post details" onPress={()=>onOverlay({kind:'post',post})} style={{minHeight:32,justifyContent:'center'}}><Copy size={15}>{post.body}</Copy></Pressable>)}
    {post.media?<UploadedMedia post={post}/>:post.kind&&<PreviewMedia kind={post.kind}/>} 
    <View style={{...row,justifyContent:'space-between',gap:1,borderTopWidth:1,borderColor:theme.border,paddingTop:3}}><IconButton name={post.liked?'heartOn':'heart'} label={post.liked?'Unlike post':'Like post'} active={post.liked} count={post.likes} onPress={()=>onReact(post,'like')}/><IconButton name="cm" label="Comments" count={post.comments} onPress={()=>onOverlay({kind:'comments',post})}/><IconButton name="rp" label={post.reposted?'Undo repost':'Repost'} active={post.reposted} count={post.reposts} onPress={()=>onReact(post,'repost')}/><IconButton name="sh" label="Share post" onPress={()=>onOverlay({kind:'share',post})}/></View>
  </Card>
}
function ConnectionList({base,token,profile,list,samples,onProfile}:{base:string;token:string;profile:Person;list:FollowListKind;samples?:Person[];onProfile:(person:Person)=>void}){
  const {theme}=useDesign()
  const [people,setPeople]=useState<Person[]>([])
  const [next,setNext]=useState<string|null>(null)
  const [cursor,setCursor]=useState('')
  const [revision,retry]=useState(0)
  const [loading,setLoading]=useState(!samples)
  const [error,setError]=useState('')
  const sampleMode=!!samples
  useEffect(()=>{
    if(sampleMode)return
    const controller=new AbortController()
    setLoading(true);setError('')
    const path='/people/'+encodeURIComponent(profile.id)+'/connections/'+list+'?cursor='+encodeURIComponent(cursor)
    api<FollowPage>(base,path,{signal:controller.signal},token).then(result=>{
      if(controller.signal.aborted)return
      setPeople(previous=>cursor?[...previous,...result.people.filter(person=>!previous.some(item=>item.id===person.id))]:result.people)
      setNext(result.nextCursor)
    }).catch(reason=>{
      if(!controller.signal.aborted)setError(errorMessage(reason))
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[base,token,profile.id,list,cursor,revision,sampleMode])
  const entries=samples??people
  return <>
    {entries.map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={'View '+displayHandle(person)+' profile'} onPress={()=>onProfile(person)} style={{...row,minHeight:52}}>
      <Avatar person={person}/><View style={{flex:1}}><PersonName person={person}/><Copy size={12} color={theme.muted}>{person.detail}</Copy></View>
    </Pressable>)}
    {loading&&<Copy color={theme.muted}>Loading people…</Copy>}
    {!!error&&<><Copy color={theme.muted}>{error}</Copy><Button label="Try again" variant="secondary" onPress={()=>retry(value=>value+1)}/></>}
    {!loading&&!error&&!entries.length&&<Copy color={theme.muted}>{list==='followers'?'No followers yet.':'This profile isn’t following anyone yet.'}</Copy>}
    {!loading&&!error&&next&&<Button label="Load more" variant="secondary" onPress={()=>setCursor(next)}/>}
  </>
}
function Empty({title,detail,action,onPress}:{title:string;detail:string;action?:string;onPress?:()=>void}){
  const {theme}=useDesign()
  return <Card style={{padding:24,alignItems:'center',gap:10}}><IconTile name="plus" size={42} color={theme.purple} background={theme.chip}/><Copy center weight={800} size={19}>{title}</Copy><Copy center color={theme.muted}>{detail}</Copy>{action&&onPress&&<Button label={action} variant="fun" onPress={onPress}/>}</Card>
}
function Loading(){
  const {theme}=useDesign()
  return <View accessibilityLabel="Loading" style={stack}>{[0,1].map(i=><Card key={i}><View style={{...row}}><View style={{height:44,width:44,borderRadius:22,backgroundColor:theme.chip}}/><View style={{height:15,width:110,borderRadius:8,backgroundColor:theme.chip}}/></View><View style={{height:90,borderRadius:14,backgroundColor:theme.chip}}/></Card>)}</View>
}
function FeatureCard({glyph,title,description,action,onPress,compact=false}:{glyph:Glyph;title:string;description:string;action:string;onPress:()=>void;compact?:boolean}){
  return <Card style={{backgroundColor:'#4F25D6',borderColor:'#4F25D6',padding:compact?16:22,gap:12,overflow:'hidden'}}>
    <IconTile name={glyph} size={compact?37:45} color={lime} background="#FFFFFF24"/>
    <View style={{gap:5}}><Copy color="#fff" size={compact?22:31} weight={800}>{title}</Copy><Copy color="#E9DFFF" size={13}>{description}</Copy></View>
    <View style={{alignSelf:compact?'stretch':'flex-start'}}><Button label={action} variant="fun" onPress={onPress}/></View>
  </Card>
}
function Meter({percent}:{percent:number}){
  const {theme}=useDesign()
  return <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round(percent)}} style={{height:7,backgroundColor:theme.chip,borderRadius:7,overflow:'hidden'}}><View style={{height:7,width:`${percent}%`,backgroundColor:theme.purple}}/></View>
}
function Quiz({onBack}:{onBack:()=>void}){
  const [index,setIndex]=useState(0),[pick,setPick]=useState<number|null>(null),[score,setScore]=useState(0)
  const q=questions[index]
  if(!q)return <Card style={{alignItems:'center',padding:24}}><View style={{backgroundColor:lime,borderRadius:60,width:105,height:105,justifyContent:'center',alignItems:'center'}}><Copy size={30} weight={800} color="#1B1233">{score}/{questions.length}</Copy></View><Copy size={25} weight={800}>{score===questions.length?'Perfect score':'Nice work'}</Copy><Copy>You earned {score*40} XP</Copy><Button label="Play again" onPress={()=>{setIndex(0);setPick(null);setScore(0)}}/><Button label="Done" variant="secondary" onPress={onBack}/></Card>
  return <View style={stack}><View style={spread}><Copy weight={800}>Quiz Duel</Copy><Copy>{index+1} / {questions.length}</Copy></View><Meter percent={((index+1)/questions.length)*100}/><Card style={{padding:24}}><Copy center size={22} weight={800}>{q.text}</Copy></Card>{q.options.map((value,i)=><Button key={value} label={value} disabled={pick!==null&&pick!==i&&q.answer!==i} variant={pick!==null&&q.answer===i?'fun':pick===i?'danger':'secondary'} onPress={()=>{if(pick===null){setPick(i);if(i===q.answer)setScore(score+1)}}}/>)}{pick!==null&&<><Copy weight={800}>{pick===q.answer?'Correct!':'The answer is '+q.options[q.answer]+'.'}</Copy><Button label={index===questions.length-1?'See results':'Next question'} onPress={()=>{setPick(null);setIndex(index+1)}}/></>}</View>
}
function CallPreview({video,person,onClose}:{video:boolean;person:Person;onClose:()=>void}){
  const [seconds,setSeconds]=useState(0),[muted,setMuted]=useState(false)
  useEffect(()=>{const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer)},[])
  return <View style={{flex:1,backgroundColor:'#130D25',padding:24,alignItems:'center'}}>
    <Copy color="#C9B8FF" weight={800} size={16}>{video?'Video call preview':'Voice call preview'}</Copy>
    <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:20}}><Avatar person={person} size={128} ring/><Copy color="#fff" size={30} weight={800}>{displayHandle(person)}</Copy><Copy color="#C9B8FF" size={16}>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · Simulated call</Copy></View>
    <View style={{...row,justifyContent:'space-around',width:'100%',paddingBottom:24}}><Button label={muted?'Unmute':'Mute'} leading={muted?'micOff':'mic'} onPress={()=>setMuted(!muted)} variant="secondary"/><Button label="End call" leading="hangup" onPress={onClose} variant="danger"/></View>
  </View>
}
export default function App(props:Props){
  const {base,font,phone}=props
  const [demoEntered,setDemoEntered]=useState(false)
  // `props.demo` means the build has no backend; `demoEntered` is someone choosing Explore demo on a live build.
  const demo=props.demo||demoEntered
  const {width}=useWindowDimensions()
  const desktop=width>=900&&!phone
  const rail=width>=1100&&!phone
  const [appearance,setAppearance]=useState<Theme|'system'>('system')
  const themeName=appearance==='system'?props.initialTheme:appearance
  const theme=themes[themeName]
  const [reduced,setReduced]=useState(false)
  const [starting,setStarting]=useState(true)
  const [stage,setStage]=useState<'intro'|'auth'|'app'|'restore'>(props.loadToken&&!demo?'restore':'intro')
  const [step,setStep]=useState(0)
  const [recovering,setRecovering]=useState(false)
  const [user,setUser]=useState<Viewer>(me),[token,setToken]=useState('')
  const verifiedBenefits=Boolean(user.verified||user.teacher)
  const videoLimit=verifiedBenefits?verifiedStoryVideoLimit:storyVideoLimit
  const [page,setPage]=useState<Page>('Home')
  const pageHistory=useRef<PageEntry[]>([])
  const googleRequest=useRef<AbortController|null>(null)
  const [googlePending,setGooglePending]=useState(false)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const [posts,setPosts]=useState<Post[]>(demo?initialPosts:[])
  const [loading,setLoading]=useState(false),[feedError,setFeedError]=useState(''),[followingOnly,setFollowingOnly]=useState(false)
  const [overlay,setOverlay]=useState<Overlay|null>(null)
  const overlayHistory=useRef<Overlay[]>([])
  const pageScroll=useRef(0)
  const [toast,setToast]=useState<ToastMessage|null>(null)
  const [seen,setSeen]=useState(new Set<string>())
  const [demoAccounts,setDemoAccounts]=useState<AdminAccount[]>(()=>people.filter(person=>!person.group).map(person=>({person,email:'',created:null,independentlyVerified:person.role!=='tech'&&!!person.verified})))
  const [ownStory,setOwnStory]=useState<{text:string;image?:string;videoPreview?:boolean;posted:number;background?:string}|null>(null)
  const [storyMode,setStoryMode]=useState('Text')
  const [storyImage,setStoryImage]=useState<string>()
  const [storyBackground,setStoryBackground]=useState('#4F25D6')
  const [birthdays,setBirthdays]=useState<BirthdayEntry[]>([])
  const [birthdayWall,setBirthdayWall]=useState<Array<{body:string;created:string;author:Person}>>([])
  const [wishedBirthdays,setWishedBirthdays]=useState<Set<string>>(()=>new Set())
  const [birthDraft,setBirthDraft]=useState<BirthDraft>(emptyBirth)
  const [storyMedia,setStoryMedia]=useState<Media|null>(null)
  const [liveStories,setLiveStories]=useState<StoryGroup[]>([])
  const [storyIndex,setStoryIndex]=useState(0)
  const [storyReplyDraft,setStoryReplyDraft]=useState('')
  const [storyReplyBusy,setStoryReplyBusy]=useState(false)
  const [storyRefresh,setStoryRefresh]=useState(0)
  const [clock,setClock]=useState(()=>Date.now())
  const [wishes,setWishes]=useState<string[]>([])
  const [lessonId,setLessonId]=useState(()=>dailyLesson().id)
  const [completedLessons,setCompletedLessons]=useState<string[]>([])
  const [learningError,setLearningError]=useState(false)
  const [learningRetry,setLearningRetry]=useState(0)
  const [profileNameDraft,setProfileNameDraft]=useState('')
  const [usernameDraft,setUsernameDraft]=useState('')
  const [bioDraft,setBioDraft]=useState('')
  const [voicePlaying,setVoicePlaying]=useState(false)
  const [quietMode,setQuietMode]=useState(false)
  const [query,setQuery]=useState(''),[results,setResults]=useState<(Person&{followsViewer?:boolean})[]>([])
  const [searching,setSearching]=useState(false),[searchError,setSearchError]=useState('')
  const searchTerm=query.trim().replace(/^@+/, '')
  const [follows,setFollows]=useState<Record<string,boolean>>({})
  const [rooms,setRooms]=useState<Room[]>(demo?localRooms:[])
  const [roomsLoading,setRoomsLoading]=useState(true)
  const [roomsLoadingMore,setRoomsLoadingMore]=useState(false)
  const [roomsNextCursor,setRoomsNextCursor]=useState<string|null>(null)
  const [room,setRoom]=useState<Room|null>(null)
  const [inboxTab,setInboxTab]=useState('Chats')
  const [profile,setProfile]=useState<Person>(me)
  const [photoBusy,setPhotoBusy]=useState<'avatar'|'cover'|null>(null)
  const photoLock=useRef(false)
  const [profileStats,setProfileStats]=useState<{id:string; data?:FollowStats; error?:boolean}|null>(null)
  const [personalAnalytics,setPersonalAnalytics]=useState<{posts:number;followers:number;following:number;likes:number;comments:number;reposts:number}|null>(null)
  const [presenceById,setPresenceById]=useState<Record<string,Presence>>({})
  const sharedLinkHandled=useRef(false)
  const [statsRefresh,refreshStats]=useState(0)
  const [notes,setNotes]=useState<Record<string,Note[]>>({})
  const [commentKeyboardInset,setCommentKeyboardInset]=useState(0)
  const [chats,setChats]=useState<Record<string,Note[]>>(demo?initialChats:{})
  const [messageLoadingOlder,setMessageLoadingOlder]=useState(false)
  const [messageNextCursor,setMessageNextCursor]=useState<Record<string,string|null>>({})
  const [draft,setDraft]=useState(''),[attachment,setAttachment]=useState<Media|null>(null)
  const [postSearchPublic,setPostSearchPublic]=useState(false)
  const [profileSearchPublic,setProfileSearchPublic]=useState(false)
  const [message,setMessage]=useState(''),[comment,setComment]=useState('')
  const [replyTarget,setReplyTarget]=useState<Note|null>(null)
  const [commentMedia,setCommentMedia]=useState<Media|Exclude<CommentAttachment,{kind:'image'}>|null>(null)
  const commentDraft=useRef(0)
  const clearComment=()=>{commentDraft.current+=1;setComment('');setCommentMedia(null);setReplyTarget(null)}
  useEffect(()=>{
    if(Platform.OS!=='web'||overlay?.kind!=='comments'||!window.visualViewport)return
    const viewport=window.visualViewport
    const update=()=>{
      const covered=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)
      setCommentKeyboardInset(covered>120?covered:0)
    }
    update()
    viewport.addEventListener('resize',update)
    viewport.addEventListener('scroll',update)
    return ()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);setCommentKeyboardInset(0)}
  },[overlay?.kind])
  const [unread,setUnread]=useState(demo)
  const [notifications,setNotifications]=useState(true)
  const [deviceNotifications,setDeviceNotifications]=useState<'unknown'|'granted'|'denied'>(props.requestNotifications?'unknown':'denied')
  const [notificationItems,setNotificationItems]=useState<NotificationItem[]>([])
  const [notificationCursor,setNotificationCursor]=useState('')
  const [notificationNextCursor,setNotificationNextCursor]=useState<string|null>(null)
  const [notificationHistory,setNotificationHistory]=useState<string[]>([])
  const handledNotification=useRef('')
  const [notificationsLoading,setNotificationsLoading]=useState(false)
  const [quietStart,setQuietStart]=useState(''),[quietEnd,setQuietEnd]=useState('')
  const pending=useRef(new Set<string>())
  const scroll=useRef<React.ComponentRef<typeof ScrollView>>(null)
  const scrollOffsets=useRef<Partial<Record<Page,number>>>({})
  const pendingOffset=useRef<{page:Page;y:number}|null>(null)
  const stickToChatEnd=useRef(true)
  const initialChatScroll=useRef(true)
  const replyTimers=useRef<ReturnType<typeof setTimeout>[]>([])
  const demoSession=useRef(0)
  const [retry,setRetry]=useState(0)
  const [refreshing,setRefreshing]=useState(false)
  const refreshLock=useRef(false)
  const pullStart=useRef<{x:number;y:number}|null>(null)
  const call=<T,>(path:string,options?:RequestInit)=>api<T>(base,path,options,token)
  const notify=(message:string,tone:ToastMessage['tone']='success')=>setToast({id:uid(),message,tone})
  const dismissToast=(id:string)=>setToast(current=>current?.id===id?null:current)
  const fail=(reason:unknown)=>notify(errorMessage(reason),'error')
  async function enableDeviceNotifications(){
    if(!props.requestNotifications)return
    try{
      const granted=await props.requestNotifications()
      if(granted&&Platform.OS==='web'&&token){
        const publicKey=await fetch(base.replace(/\/$/,'')+'/api/notification-public-key').then(response=>response.ok?response.json() as Promise<{publicKey:string}>:Promise.reject(new Error('Push notifications are not configured.')))
        const registration=await navigator.serviceWorker.ready
        const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(publicKey.publicKey)})
        const jsonSubscription=subscription.toJSON()
        await call('/notifications/devices',json({platform:'pwa',endpoint:subscription.endpoint,token:JSON.stringify(jsonSubscription.keys??{})}))
      }
      if(granted&&Platform.OS!=='web'&&token&&props.getNotificationDevice){
        const device=await props.getNotificationDevice()
        if(device)await call('/notifications/devices',json(device))
      }
      setDeviceNotifications(granted?'granted':'denied')
      notify(granted?'Device notifications enabled.':'Notifications were not enabled.',granted?'success':'error')
    }catch(reason){setDeviceNotifications('denied');fail(reason)}
  }
  useEffect(()=>{
    let alive=true
    AccessibilityInfo.isReduceMotionEnabled?.().then(value=>{if(alive)setReduced(value)})
    const sub=AccessibilityInfo.addEventListener?.('reduceMotionChanged',setReduced)
    return ()=>{alive=false;sub?.remove();replyTimers.current.forEach(clearTimeout)}
  },[])
  useEffect(()=>{
    const timer=setTimeout(()=>setStarting(false),1400)
    return ()=>clearTimeout(timer)
  },[])
  useEffect(()=>{
    if(!starting&&stage!=='restore')props.onReady?.()
  },[starting,stage,props.onReady])
  useEffect(()=>{
    if(stage!=='restore')return
    let alive=true
    const controller=new AbortController()
    const timeout=setTimeout(()=>{
      if(!alive)return
      alive=false
      controller.abort()
      setError('Couldn’t restore your session. Check your connection and sign in again.')
      setStage('auth')
    },10000)
    async function restore(){
      try{
        const stored=await props.loadToken?.()
        if(!alive)return
        if(!stored){if(alive)setStage('intro');return}
        const account=await api<Viewer>(base,'/me',{signal:controller.signal},stored)
        if(alive){setToken(stored);setUser(account);setStage('app')}
      }catch{if(alive)setStage('intro')}
      finally{clearTimeout(timeout)}
    }
    void restore()
    return ()=>{alive=false;clearTimeout(timeout);controller.abort()}
  },[stage,base,props.loadToken])
  useEffect(()=>{
    if(demo||!token||page!=='Home')return
    let alive=true
    setLoading(true);setFeedError('')
    api<Post[]>(base,'/feed'+(followingOnly?'?following=1':''),{},token)
      .then(data=>{if(alive)setPosts(data)})
      .catch(reason=>{if(alive)setFeedError(errorMessage(reason))})
      .finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  },[base,demo,token,page,followingOnly,retry])
  useEffect(()=>{
    if(demo||!token||page!=='Explore')return
    const controller=new AbortController()
    setSearching(false);setSearchError('')
    const timer=setTimeout(()=>{
      setSearching(true)
      api<(Person&{following:boolean;followsViewer:boolean})[]>(base,'/people?q='+encodeURIComponent(searchTerm),{signal:controller.signal},token)
        .then(data=>{if(!controller.signal.aborted){setResults(data);setFollows(previous=>({...previous,...Object.fromEntries(data.map(p=>[p.id,p.following]))}))}})
        .catch(reason=>{if(!controller.signal.aborted)setSearchError(errorMessage(reason))})
        .finally(()=>{if(!controller.signal.aborted)setSearching(false)})
    },searchTerm?260:0)
    return ()=>{controller.abort();clearTimeout(timer)}
  },[base,demo,token,searchTerm,page,retry])
  useEffect(()=>{
    if(demo||!token||page!=='Messages')return
    let alive=true
    setRoomsLoading(true);setFeedError('')
    api<RoomPage>(base,'/rooms?paged=1',{},token).then(data=>{if(alive){setRooms(data.items);setRoomsNextCursor(data.nextCursor)}}).catch(reason=>{if(alive)setFeedError(errorMessage(reason))}).finally(()=>{if(alive)setRoomsLoading(false)})
    return ()=>{alive=false}
  },[base,demo,token,page,retry])
  useEffect(()=>{
    if(demo||!token||stage!=='app')return
    const target=props.notificationTarget||(Platform.OS==='web'?new URLSearchParams(window.location.search).get('notification')??'':'')
    if(!target||handledNotification.current===target)return
    handledNotification.current=target
    void api<NotificationItem>(base,'/notifications/'+encodeURIComponent(target),{},token).then(item=>openNotification(item)).catch(fail)
    if(Platform.OS==='web')window.history.replaceState(window.history.state,'',window.location.pathname+window.location.hash)
  },[base,demo,props.notificationTarget,stage,token])
  useEffect(()=>{
    if(Platform.OS!=='web')return
    const listener=(event:MessageEvent)=>{
      if(event.data?.type!=='dameen-notification'||typeof event.data.id!=='string')return
      const target=event.data.id
      if(!token||stage!=='app')return
      handledNotification.current=target
      void api<NotificationItem>(base,'/notifications/'+encodeURIComponent(target),{},token).then(item=>openNotification(item)).catch(fail)
    }
    navigator.serviceWorker?.addEventListener('message',listener)
    return ()=>navigator.serviceWorker?.removeEventListener('message',listener)
  },[base,stage,token])
  useEffect(()=>{
    if(demo||!token||page!=='Settings')return
    api<{quiet_start?:string|null;quiet_end?:string|null}>(base,'/notification-preferences',{},token).then(value=>{setQuietStart(value.quiet_start??'');setQuietEnd(value.quiet_end??'')}).catch(()=>{})
  },[base,demo,token,page])
  async function saveNotificationPreferences(){
    if(demo||!token)return
    try{await call('/notification-preferences',json({messages:notifications,follows:notifications,comments:notifications,reactions:notifications,calls:true,birthdays:notifications,announcements:notifications,quiet_start:quietStart||null,quiet_end:quietEnd||null}));notify('Notification preferences saved.')}catch(reason){fail(reason)}
  }
  useEffect(()=>{
    if(demo||!token||page!=='Notifications')return
    let alive=true
    setNotificationsLoading(true)
    api<{unread:number;items:NotificationItem[];nextCursor:string|null}>(base,'/notifications'+(notificationCursor?'?cursor='+encodeURIComponent(notificationCursor):''),{},token).then(data=>{if(alive){setNotificationItems(data.items);setNotificationNextCursor(data.nextCursor);setUnread(data.unread>0)}}).catch(reason=>{if(alive)notify(errorMessage(reason),'error')}).finally(()=>{if(alive)setNotificationsLoading(false)})
    return ()=>{alive=false}
  },[base,demo,token,page,retry,notificationCursor])
  useEffect(()=>{
    if(demo||!token||stage!=='app')return
    let active=true
    const refresh=()=>api<{unread:number;items:NotificationItem[];nextCursor:string|null}>(base,'/notifications',{},token).then(data=>{
      if(active){if(page!=='Notifications'||!notificationCursor){setNotificationItems(data.items);setNotificationNextCursor(data.nextCursor)}setUnread(data.unread>0)}
    }).catch(()=>{})
    void refresh()
    const interval=setInterval(()=>{if(AppState.currentState==='active')void refresh()},30000)
    return ()=>{active=false;clearInterval(interval)}
  },[base,demo,stage,token,page,notificationCursor])
  const roomId=room?.id
  const messageLoading=!demo&&!!roomId&&chats[roomId]===undefined&&!feedError
  const [pendingIncoming,setPendingIncoming]=useState<IncomingCall|null>(null)
  const incomingHandled=useRef(new Set<string>())
  const answeredCall=useRef('')
  const webCallMedia=React.useMemo(browserCallMedia,[])
  const callMedia=props.callMedia??webCallMedia
  const refreshConversation=(id:string)=>api<MessagePage>(base,'/rooms/'+id+'/messages?paged=1',{},token).then(data=>{
    setMessageNextCursor(previous=>id in previous?previous:{...previous,[id]:data.nextCursor})
    setChats(previous=>({...previous,[id]:mergeNotes(previous[id]??[],data.items)}))
  })
  const sendCall=async(signal:CallSignal)=>{
    try{
      if(signal.kind==='offer'){
        if(!roomId)return false
        await call('/rooms/'+roomId+'/calls',json({signal}))
      }else if(signal.kind==='answer')await call('/calls/'+signal.id+'/answer',json({signal},'PUT'))
      else if(signal.kind==='connected')await call('/calls/'+signal.id+'/connected',{method:'PUT'})
      else if(signal.kind!=='ringing'){
        await call('/calls/'+signal.id+'/end',{method:'PUT'})
        if(roomId)void refreshConversation(roomId).catch(()=>{})
      }
      return true
    }catch(reason){if(signal.kind==='offer'||signal.kind==='answer')fail(reason);return false}
  }
  const roomCall=useRoomCall(callMedia,page==='Chat'?roomId:undefined,sendCall,message=>notify(message))
  const receiveCall=useRef(roomCall.receive)
  receiveCall.current=roomCall.receive
  async function handleIncoming(item:IncomingCall){
    if(!callMedia||incomingHandled.current.has(item.id)||roomCall.call)return
    incomingHandled.current.add(item.id)
    try{
      await call('/calls/'+item.id+'/ringing',{method:'PUT'})
      setPendingIncoming(item)
      if(page!=='Chat'||roomId!==item.room)openRoom({id:item.room,person:item.person})
    }catch{incomingHandled.current.delete(item.id)}
  }
  useEffect(()=>{
    if(demo||!token||stage!=='app'||!callMedia)return
    let active=true
    const check=()=>{
      if(!foreground()||roomCall.call||pendingIncoming)return
      void api<IncomingCall[]>(base,'/calls/incoming',{},token).then(items=>{if(active&&items[0])void handleIncoming(items[0])}).catch(()=>{})
    }
    check()
    const interval=setInterval(check,4000)
    const resumed=AppState.addEventListener('change',state=>{if(state==='active')check()})
    const visible=()=>{if(foreground())check()}
    if(Platform.OS==='web')document.addEventListener('visibilitychange',visible)
    return ()=>{active=false;clearInterval(interval);resumed.remove();if(Platform.OS==='web')document.removeEventListener('visibilitychange',visible)}
  },[base,demo,token,stage,callMedia,roomCall.call?.id,pendingIncoming?.id,page,roomId])
  useEffect(()=>{
    if(!pendingIncoming||page!=='Chat'||roomId!==pendingIncoming.room||!callMedia)return
    void receiveCall.current({kind:'offer',id:pendingIncoming.id,video:pendingIncoming.video,sdp:pendingIncoming.offer})
    setPendingIncoming(null)
  },[pendingIncoming,page,roomId,callMedia])
  useEffect(()=>{
    const activeCall=roomCall.call
    if(demo||!token||!activeCall||page!=='Chat')return
    let active=true
    const check=()=>api<CallStatus>(base,'/calls/'+activeCall.id,{},token).then(status=>{
      if(!active)return
      if(status.state==='ended'||status.state==='declined'){
        void receiveCall.current({kind:status.state==='declined'?'busy':'end',id:activeCall.id})
        if(roomId)void refreshConversation(roomId).catch(()=>{})
      }else if(status.state==='ringing'&&activeCall.state==='calling'){
        void receiveCall.current({kind:'ringing',id:activeCall.id})
      }else if(status.answer&&answeredCall.current!==activeCall.id){
        answeredCall.current=activeCall.id
        void receiveCall.current({kind:'answer',id:activeCall.id,sdp:status.answer})
      }
    }).catch(()=>{})
    void check()
    const interval=setInterval(check,activeCall.state==='connected'?5000:2000)
    return ()=>{active=false;clearInterval(interval)}
  },[base,demo,token,page,roomId,roomCall.call?.id,roomCall.call?.state])
  useEffect(()=>{
    if(demo||!token||page!=='Chat'||!roomId)return
    let active=true
    let lastSync=0
    let syncing=false
    const endpoint=base||((typeof window!=='undefined'&&window.location?.origin)||'')
    const url=endpoint.replace(/^http/,'ws').replace(/\/$/,'')+'/api/rooms/'+roomId+'/socket'
    const refresh=()=>{
      if(syncing)return
      syncing=true
      return api<MessagePage>(base,'/rooms/'+roomId+'/messages?paged=1',{},token)
      .then(data=>{if(active){lastSync=Date.now();setMessageNextCursor(previous=>roomId in previous?previous:{...previous,[roomId]:data.nextCursor});setChats(previous=>({...previous,[roomId]:mergeNotes(previous[roomId]??[],data.items)}));setFeedError('');if(foreground()&&data.items.some(item=>!item.call&&item.author.id!==user.id&&!item.readAt))void api(base,'/rooms/'+roomId+'/read',{method:'PUT'},token).catch(()=>{})}})
      .catch(reason=>{if(active)setFeedError(errorMessage(reason))})
      .finally(()=>{syncing=false})
    }
    const socket=new WebSocket(url,['dameeland','ticket.'+token])
    socket.onopen=()=>{if(active)void refresh()}
    socket.onmessage=event=>{
      if(!active)return
      let data
      try{data=JSON.parse(String(event.data))}catch{return}
      if(data?.type==='call'){
        const signal=readCallSignal(data.signal)
        if(signal)void receiveCall.current(signal)
        return
      }
      if(data?.type==='call-history'){void refresh();return}
      if(data?.type==='read'&&Array.isArray(data.ids)&&typeof data.readAt==='string'){
        const ids=new Set<string>(data.ids)
        setChats(previous=>({...previous,[roomId]:(previous[roomId]??[]).map(item=>ids.has(item.id)?{...item,readAt:data.readAt}:item)}))
        return
      }
      if(data?.type==='message-updated'&&typeof data.id==='string'&&typeof data.body==='string'){
        setChats(previous=>({...previous,[roomId]:(previous[roomId]??[]).map(item=>item.id===data.id?{...item,body:data.body,editedAt:data.editedAt}:item)}))
        return
      }
      if(data?.type==='message-deleted'&&typeof data.id==='string'){
        setChats(previous=>({...previous,[roomId]:(previous[roomId]??[]).filter(item=>item.id!==data.id)}))
        return
      }
      const item=data as Note
      setChats(previous=>({...previous,[roomId]:[...(previous[roomId]??[]).filter(m=>m.id!==item.id),item]}))
      if(item.author.id!==user.id){
        if(foreground())void api(base,'/rooms/'+roomId+'/read',{method:'PUT'},token).catch(()=>{})
        void props.notifyDevice?.(item.author.name,'New message: '+item.body)
      }
    }
    void refresh()
    const poll=setInterval(()=>{if(foreground()&&(socket.readyState!==WebSocket.OPEN||Date.now()-lastSync>15000))void refresh()},3500)
    const heartbeat=setInterval(()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'presence'}))},30000)
    const resumed=AppState.addEventListener('change',state=>{if(state==='active')void refresh()})
    const visible=()=>{if(foreground())void refresh()}
    if(Platform.OS==='web')document.addEventListener('visibilitychange',visible)
    return ()=>{active=false;clearInterval(poll);clearInterval(heartbeat);resumed.remove();if(Platform.OS==='web')document.removeEventListener('visibilitychange',visible);socket.close()}
  },[base,demo,token,page,roomId])
  useEffect(()=>{
    if(demo||!token||page!=='Home')return
    let alive=true
    const load=()=>api<StoryGroup[]>(base,'/stories',{},token).then(data=>{if(alive)setLiveStories(data)}).catch(()=>{})
    void load()
    const timer=setInterval(()=>{setClock(Date.now());void load()},60000)
    return ()=>{alive=false;clearInterval(timer)}
  },[base,demo,token,page,storyRefresh])
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),30000)
    return ()=>clearInterval(timer)
  },[])
  const demoStories=React.useMemo(()=>storyPeople.filter(person=>clock-demoPosted[person.id]<storyLifetime),[clock])
  const demoOwn=React.useMemo(()=>ownStory&&clock-ownStory.posted<storyLifetime?ownStory:null,[ownStory,clock])
  useEffect(()=>{
    if(demo||!token||page!=='Home')return
    let alive=true
    api<BirthdayEntry[]>(base,'/birthdays',{},token).then(data=>{if(alive)setBirthdays(data)}).catch(()=>{})
    api<Array<{body:string;created:string;author:Person}>>(base,'/people/'+encodeURIComponent(user.id)+'/birthday-wall',{},token).then(data=>{if(alive)setBirthdayWall(data)}).catch(()=>{})
    return ()=>{alive=false}
  },[base,demo,token,page])
  // Stories vanish 12 hours after posting: hide them on the client as soon as they expire, not only on the next refresh.
  const activeStories=React.useMemo(()=>liveStories.map(group=>({...group,stories:group.stories.filter(item=>Date.parse(item.expires)>clock)})).filter(group=>group.stories.length),[liveStories,clock])
  const seenAuthors=demo?seen:new Set(activeStories.filter(group=>group.stories.every(item=>item.viewed||seen.has(item.id))).map(group=>group.author.id))
  const storyId=overlay?.kind==='story'?overlay.person.id:null
  useEffect(()=>{
    if(demo||!storyId||!token)return
    const current=activeStories.find(group=>group.author.id===storyId)?.stories[storyIndex]
    if(!current||current.viewed||seen.has(current.id))return
    setSeen(previous=>new Set(previous).add(current.id))
    void api(base,'/stories/'+encodeURIComponent(storyId)+'/'+encodeURIComponent(current.id)+'/view',{method:'PUT'},token).catch(()=>{})
  },[base,demo,token,storyId,storyIndex,activeStories,seen])
  const moveStory=useCallback((direction:1|-1)=>{
    if(!storyId)return
    const queue=demo?(demoOwn?[user,...demoStories]:demoStories):activeStories.map(group=>group.author)
    const index=queue.findIndex(person=>person.id===storyId)
    if(index<0)return
    const count=demo?1:activeStories[index].stories.length
    const inner=storyIndex+direction
    setStoryReplyDraft('')
    if(inner>=0&&inner<count){setStoryIndex(inner);return}
    const next=queue[index+direction]
    if(!next&&direction===-1)return
    if(next&&demo)setSeen(previous=>new Set(previous).add(next.id))
    setStoryIndex(direction===-1&&!demo&&next?activeStories[index-1].stories.length-1:0)
    setOverlay(current=>current?.kind==='story'&&current.person.id===storyId?(next?{kind:'story',person:next}:null):current)
  },[storyId,storyIndex,demoOwn,demoStories,user,demo,activeStories])
  useEffect(()=>{
    if(!storyId||storyReplyDraft||storyReplyBusy)return
    const timer=setTimeout(()=>moveStory(1),6500)
    return ()=>clearTimeout(timer)
  },[storyId,moveStory,storyReplyDraft,storyReplyBusy])
  const storySwipe=React.useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponderCapture:(_,gesture)=>Math.abs(gesture.dx)>14&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.4,
    onPanResponderRelease:(_,gesture)=>{if(Math.abs(gesture.dx)>=42)moveStory(gesture.dx<0?1:-1)},
  }),[moveStory])
  const restorePageScroll=()=>{
    const target=pendingOffset.current
    if(!target||target.page!==page||page==='Home'&&loading||!scroll.current)return
    pendingOffset.current=null
    scroll.current.scrollTo({y:target.y,animated:false})
  }
  useLayoutEffect(()=>{
    if(!pendingOffset.current)return
    const frame=requestAnimationFrame(restorePageScroll)
    return ()=>cancelAnimationFrame(frame)
  },[page,profile.id,room?.id,loading,stage])
  function changePage(next:Page,scrollY=0){
    if(page==='Chat')roomCall.end()
    pendingOffset.current={page:next,y:scrollY}
    pageScroll.current=scrollY
    setPage(next);setFeedError('')
  }
  function dismissOverlays(){
    overlayHistory.current=[]
    setOverlay(null)
    clearComment()
  }
  function open(next:Page,details?:{profile?:Person;room?:Room;lessonId?:string}){
    const sameDestination=next===page&&(!details?.profile||details.profile.id===profile.id)&&(!details?.room||details.room.id===room?.id)&&(!details?.lessonId||details.lessonId===lessonId)
    const isTab=tabs.some(([tab])=>tab===next)
    if(sameDestination&&!overlay){
      if(isTab)scroll.current?.scrollTo({y:0,animated:!reduced})
      return
    }
    pageHistory.current.push({page,profile,room,lessonId,scrollY:pageScroll.current,overlays:overlay?[...overlayHistory.current,overlay]:[]})
    if(overlay)dismissOverlays()
    if(details?.profile)setProfile(details.profile)
    if(details?.room)setRoom(details.room)
    if(details?.lessonId)setLessonId(details.lessonId)
    changePage(next,isTab?scrollOffsets.current[next]??0:0)
  }
  const startQuiz=()=>open('Quiz')
  const featuredLesson=dailyLesson(clock)
  const openLesson=(id:string)=>open('Lesson',{lessonId:id})
  useEffect(()=>{
    if(demo||!token)return
    const controller=new AbortController()
    setLearningError(false)
    api<string[]>(base,'/me/lessons',{signal:controller.signal},token)
      .then(ids=>{if(!controller.signal.aborted)setCompletedLessons(previous=>[...new Set([...previous,...ids])])})
      .catch(()=>{if(!controller.signal.aborted)setLearningError(true)})
    return ()=>controller.abort()
  },[base,demo,token,learningRetry])
  async function completeLesson(id:string,answer:number){
    const session=demoSession.current
    if(!demo)await call('/me/lessons/'+encodeURIComponent(id),json({answer},'PUT'))
    if(session===demoSession.current)setCompletedLessons(current=>current.includes(id)?current:[...current,id])
  }

  useEffect(()=>{
    if(demo||!token||page!=='Profile')return
    const id=profile.id
    const controller=new AbortController()
    setProfileStats(previous=>previous?.id===id&&previous.data?previous:null)
    if(id!==user.id)void api<Person>(base,'/people/'+encodeURIComponent(id),{signal:controller.signal},token)
      .then(person=>{if(!controller.signal.aborted)setProfile(previous=>previous.id===id?person:previous)})
      .catch(()=>{})
    api<FollowStats>(base,'/people/'+encodeURIComponent(id)+'/follow-stats',{signal:controller.signal},token)
      .then(data=>{
        if(controller.signal.aborted)return
        setProfileStats({id,data})
        setFollows(previous=>({...previous,[id]:data.followedByViewer}))
      })
      .catch(()=>{if(!controller.signal.aborted)setProfileStats({id,error:true})})
    return ()=>controller.abort()
  },[base,demo,page,profile.id,statsRefresh,token])
  useEffect(()=>{
    if(demo||!token||stage!=='app')return
    const update=(online:boolean)=>{void api(base,'/me/presence',json({online},'PUT'),token).catch(()=>{})}
    const active=()=>Platform.OS==='web'?document.visibilityState==='visible':AppState.currentState==='active'
    update(active())
    const timer=setInterval(()=>{if(active())update(true)},30000)
    const native=Platform.OS==='web'?undefined:AppState.addEventListener('change',state=>update(state==='active'))
    const visibility=()=>{if(Platform.OS==='web')update(active())}
    if(Platform.OS==='web')document.addEventListener('visibilitychange',visibility)
    return ()=>{clearInterval(timer);native?.remove();if(Platform.OS==='web')document.removeEventListener('visibilitychange',visibility);update(false)}
  },[base,demo,stage,token])
  useEffect(()=>{
    if(demo||!token||page!=='Profile'||profile.id!==user.id)return
    let active=true
    api<NonNullable<typeof personalAnalytics>>(base,'/me/analytics',{},token)
      .then(data=>{if(active)setPersonalAnalytics(data)}).catch(()=>{})
    return ()=>{active=false}
  },[base,demo,token,page,profile.id,user.id,statsRefresh,posts.length])
  const presenceTarget=page==='Chat'?room?.person.id:page==='Profile'?profile.id:undefined
  useEffect(()=>{
    if(demo||!token||!presenceTarget)return
    let alive=true
    const load=()=>api<Presence>(base,'/people/'+encodeURIComponent(presenceTarget)+'/presence',{},token).then(value=>{if(alive)setPresenceById(previous=>({...previous,[presenceTarget]:value}))}).catch(()=>{})
    void load()
    const timer=setInterval(load,30000)
    return ()=>{alive=false;clearInterval(timer)}
  },[base,demo,token,presenceTarget])
  useEffect(()=>{
    if(!voicePlaying)return
    const timer=setTimeout(()=>setVoicePlaying(false),8000)
    return ()=>clearTimeout(timer)
  },[voicePlaying])
  const showProfile=(person:Person)=>open('Profile',{profile:demo?demoAccounts.find(account=>account.person.id===person.id)?.person??person:person})
  const sharedLink=(kind:'profile'|'post',id:string)=>kind==='post'?'https://dameen.app/p/'+encodeURIComponent(id):profile.username?'https://dameen.app/u/'+encodeURIComponent(profile.username):'https://dameen.app/?profile='+encodeURIComponent(id)
  useEffect(()=>{
    if(sharedLinkHandled.current||stage!=='app'||(!demo&&!token)||Platform.OS!=='web')return
    const params=new URLSearchParams(window.location.search)
    const postId=params.get('post')
    const profileId=params.get('profile')
    if(!postId&&!profileId)return
    sharedLinkHandled.current=true
    if(postId){
      const request=demo?Promise.resolve(initialPosts.find(post=>post.id===postId)):call<Post>('/posts/'+encodeURIComponent(postId))
      void request.then(post=>{if(post)selectOverlay({kind:'post',post});else notify('This post is unavailable.','error')})
        .catch(()=>notify('This post is unavailable.','error'))
    }else if(profileId){
      const request=demo?Promise.resolve(people.find(person=>person.id===profileId)):call<Person>('/people/'+encodeURIComponent(profileId))
      void request.then(person=>{if(person)showProfile(person);else notify('This profile is unavailable.','error')})
        .catch(()=>notify('This profile is unavailable.','error'))
    }
  },[stage,token,demo])
  const selectOverlay=(value:Overlay)=>{
    if(value.kind==='editProfile'){setProfileNameDraft(user.name);setBioDraft(user.bio??'');setProfileSearchPublic(Boolean(user.searchPublic))}
    if(value.kind==='editUsername')setUsernameDraft(user.username??'')
    if(value.kind==='newStory'){setStoryMode('Text');setStoryImage(undefined);setStoryMedia(null);setStoryBackground('#4F25D6')}
    if(overlay)overlayHistory.current.push(overlay)
    clearComment()
    setOverlay(value)
    if(value.kind==='story'){
      const stories=activeStories.find(group=>group.author.id===value.person.id)?.stories
      const unread=stories?.findIndex(item=>!item.viewed&&!seen.has(item.id))??-1
      setStoryIndex(demo?0:Math.max(0,unread));setStoryReplyDraft('')
      if(demo)setSeen(previous=>new Set(previous).add(value.person.id))
    }
    if(value.kind==='comments'&&!demo){
      const id=value.post.id
      call<Note[]>('/posts/'+id+'/comments').then(data=>setNotes(previous=>({...previous,[id]:[...data,...(previous[id]??[]).filter(item=>!data.some(match=>match.id===item.id))]}))).catch(fail)
    }
  }
  async function authenticate(mode:'signup'|'login',values:Credentials){
    if(busy)return
    const email=values.email.trim().toLowerCase()
    const firstName=capitalizeName(values.firstName.trim()),lastName=capitalizeName(values.lastName.trim())
    const username=normalizeUsername(values.username)
    if(mode==='signup'&&(!firstName||!lastName)){setError('Enter your first and last name.');return}
    if(mode==='signup'&&!validUsername(username)){setError(usernameHint);return}
    if(mode==='signup'&&!validBirthDate(values.dob)){setError('Enter a valid date of birth.');return}
    const name=[firstName,lastName].join(' ')
    const isEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const loginUsername=email.replace(/^@/,'')
    if((!isEmail&&(mode==='signup'||!validUsername(loginUsername)))){
      setError(mode==='signup'?'Enter a valid email.':'Enter your email or username and password.');return
    }
    setBusy(true);setError('')
    try{
      if(demo){
        const saved=mode==='signup'||isEmail?welcomeAccounts.get(email):[...welcomeAccounts.values()].find(account=>account.user.username===loginUsername)
        if(mode==='login'&&(!saved||saved.password!==values.password))throw new Error('Email, username or password is incorrect.')
        if(mode==='signup'&&saved)throw new Error('An account already uses this email.')
        if(mode==='signup'&&demoUsernameTaken(username))throw new Error('That username is taken.')
        const account=saved?.user??{...me,name,username,initials:initials(name),dob:values.dob,birthday:values.dob.slice(5)}
        if(mode==='signup')welcomeAccounts.set(email,{user:account,password:values.password})
        setUser(account)
      }else{
        const result=await api<Session>(base,'/auth/'+mode,json(mode==='signup'?{...values,email,firstName,lastName,username}:{identifier:email,password:values.password}))
        setToken(result.token);setUser(result.user)
        try{await props.saveToken?.(result.token)}catch{notify('You’re signed in for this session.')}
      }
      setPage('Home');setStage('app')
    }catch(reason){setError(errorMessage(reason))}
    finally{setBusy(false)}
  }
  async function authenticateWithGoogle(mode:AuthMode,username:string,dob:string){
    if(busy)return
    setError('')
    if(demo||!props.openGoogle){setError('Google sign-in is unavailable right now.');return}
    if(mode==='signup'&&!validUsername(username)){setError('Choose a username to sign up with Google. '+usernameHint);return}
    if(mode==='signup'&&!validBirthDate(dob)){setError('Enter your date of birth to sign up with Google.');return}
    setBusy(true)
    const controller=new AbortController()
    googleRequest.current=controller
    setGooglePending(true)
    let googleWindow:GoogleWindow|undefined
    try{
      let attempt:GoogleStart|undefined
      googleWindow=await props.openGoogle(async()=>{
        attempt=await api<GoogleStart>(base,'/google/start',{...json({mode,username,dob}),signal:controller.signal})
        return attempt.url
      })
      if(!attempt)throw new Error('Google sign-in could not start.')
      const {state,exchange}=attempt
      const deadline=Date.now()+180000
      while(!controller.signal.aborted&&Date.now()<deadline){
        const result=await api<Session|{pending:true}>(base,'/google/exchange',{...json({state,exchange}),signal:controller.signal})
        if('token' in result){
          setToken(result.token);setUser(result.user)
          try{await props.saveToken?.(result.token)}catch{notify('You’re signed in for this session.')}
          setPage('Home');setStage('app')
          return
        }
        await new Promise(resolve=>setTimeout(resolve,2000))
      }
      throw new Error('Google sign-in timed out. Please try again.')
    }catch(reason){if(!controller.signal.aborted)setError(errorMessage(reason))}
    finally{googleWindow?.close();googleRequest.current=null;setGooglePending(false);setBusy(false)}
  }
  async function logout(){
    try{
      if(!demo){await call('/logout',{method:'POST'});await props.saveToken?.(null)}
      demoSession.current++
      replyTimers.current.forEach(clearTimeout);replyTimers.current=[]
      scrollOffsets.current={};pendingOffset.current=null;setToast(null)
      roomCall.end();pageHistory.current=[];dismissOverlays();setToken('');setUser(me);setPage('Home');setStage('auth');setError('')
      setPosts(props.demo?initialPosts:[]);setNotes({});setChats(props.demo?initialChats:{});setMessageNextCursor({});setRoomsLoading(true);setRoomsNextCursor(null);setFollows({});setProfileStats(null)
      setNotificationItems([]);setNotificationCursor('');setNotificationNextCursor(null);setNotificationHistory([]);setUnread(false)
      setRooms(props.demo?localRooms:[]);setRoom(null);setDraft('');setAttachment(null);setPostSearchPublic(false);clearComment();setMessage('');setSeen(new Set());setOwnStory(null);setDemoEntered(false);setBirthdays([]);setBirthdayWall([]);setWishedBirthdays(new Set());setLiveStories([]);setStoryIndex(0);setStoryMedia(null);setWishes([]);setCompletedLessons([]);setLearningError(false);setVoicePlaying(false);setQuietMode(false);setFollowingOnly(false)
    }catch(reason){fail(reason)}
  }
  async function react(post:Post,kind:'like'|'repost'){
    const active=kind==='like'?!post.liked:!post.reposted
    const key=kind+post.id
    if(pending.current.has(key))return
    pending.current.add(key)
    try{
      if(!demo)await call('/posts/'+post.id+'/'+kind,json({active},'PUT'))
      setPosts(previous=>previous.map(item=>item.id!==post.id?item:kind==='like'?{...item,liked:active,likes:item.likes+(active?1:-1)}:{...item,reposted:active,reposts:item.reposts+(active?1:-1)}))
    }catch(reason){fail(reason)}finally{pending.current.delete(key)}
  }
  async function follow(person:Person){
    const active=!follows[person.id],key='follow'+person.id
    if(pending.current.has(key))return
    pending.current.add(key)
    try{
      if(!demo){
        await call('/people/'+person.id+'/follow',json({active},'PUT'))
        refreshStats(value=>value+1)
      }
      setFollows(previous=>({...previous,[person.id]:active}))
    }catch(reason){fail(reason)}finally{pending.current.delete(key)}
  }
  async function saveProfile(){
    if(busy||!profileNameDraft.trim()||Array.from(bioDraft.trim()).length>50)return
    const session=demoSession.current
    setBusy(true)
    try{
      const input={name:profileNameDraft.trim(),bio:bioDraft.trim(),searchPublic:profileSearchPublic}
      const account=demo?{...user,...input}:await call<Viewer>('/me/profile',json(input,'PUT'))
      if(session!==demoSession.current)return
      setUser(account)
      setProfile(previous=>previous.id===account.id?account:previous)
      setPosts(previous=>previous.map(post=>post.author.id===account.id?{...post,author:account}:post))
      if(demo)welcomeAccounts.forEach((entry,email)=>{if(entry.user.id===account.id)welcomeAccounts.set(email,{...entry,user:account})})
      modalClose()
      notify('Profile updated')
    }catch(reason){if(session===demoSession.current)fail(reason)}
    finally{setBusy(false)}
  }
  async function saveUsername(){
    const username=normalizeUsername(usernameDraft)
    if(busy||!validUsername(username))return
    setBusy(true)
    try{
      const account=demo?{...user,username,usernameNextChangeAt:new Date(Date.now()+3*86400000).toISOString()}:await call<Viewer>('/me/username',json({username},'PUT'))
      setUser(account)
      setProfile(previous=>previous.id===account.id?account:previous)
      setPosts(previous=>previous.map(post=>post.author.id===account.id?{...post,author:account}:post))
      modalClose()
      notify('Username updated')
    }catch(reason){fail(reason)}
    finally{setBusy(false)}
  }
  async function uploadProfilePhoto(kind:'avatar'|'cover'){
    if(!props.pickMedia||profile.id!==user.id||photoLock.current)return
    photoLock.current=true
    setPhotoBusy(kind)
    const session=demoSession.current
    try{
      const media=await props.pickMedia()
      if(!media||session!==demoSession.current)return
      let account:Person
      if(demo)account={...user,[kind]:media.uri}
      else{
        const form=new FormData()
        if(media.data instanceof Blob)form.append('image',media.data,media.name)
        else form.append('image',media.data as unknown as Blob)
        account=await call<Person>('/me/photos/'+kind,{method:'PUT',body:form})
      }
      if(session!==demoSession.current)return
      setUser(account)
      setProfile(previous=>previous.id===account.id?account:previous)
      setPosts(previous=>previous.map(post=>post.author.id===account.id?{...post,author:account}:post))
      if(demo)welcomeAccounts.forEach((entry,email)=>{if(entry.user===user)welcomeAccounts.set(email,{...entry,user:account})})
      notify(kind==='avatar'?'Profile picture updated':'Cover photo updated')
    }catch(reason){if(session===demoSession.current)fail(reason)}
    finally{photoLock.current=false;setPhotoBusy(null)}
  }
  async function createPost(){
    if(busy||(!draft.trim()&&!attachment))return
    setBusy(true)
    try{
      if(demo)setPosts(previous=>[{id:uid(),author:user,body:draft.trim(),media:attachment?.uri,kind:attachment?.kind,time:'Just now',likes:0,comments:0,reposts:0,liked:false,reposted:false},...previous])
      else{
        const form=new FormData()
        form.append('body',draft.trim())
        if(postSearchPublic)form.append('searchPublic','true')
        if(attachment?.kind==='video'&&attachment.duration)form.append('duration',String(attachment.duration))
        if(attachment?.data instanceof Blob)form.append(attachment.kind==='video'?'video':'image',attachment.data,attachment.name)
        else if(attachment)form.append(attachment.kind==='video'?'video':'image',attachment.data as unknown as Blob)
        await call('/posts',attachment?{method:'POST',body:form}:json({body:draft,searchPublic:postSearchPublic}))
        setRetry(n=>n+1)
      }
      setDraft('');setAttachment(null);setPostSearchPublic(false);dismissOverlays();setFollowingOnly(false);open('Home');notify('Post shared')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function updatePostSearchVisibility(post:Post,searchPublic:boolean){
    if(busy||demo||post.author.id!==user.id)return
    const session=demoSession.current
    setBusy(true)
    try{
      const saved=await call<{searchPublic:boolean}>('/posts/'+encodeURIComponent(post.id)+'/search-visibility',json({searchPublic},'PUT'))
      if(session!==demoSession.current)return
      setPosts(previous=>previous.map(item=>item.id===post.id?{...item,searchPublic:saved.searchPublic}:item))
      setOverlay(current=>current?.kind==='share'&&current.post.id===post.id?{...current,post:{...current.post,searchPublic:saved.searchPublic}}:current)
      notify(saved.searchPublic?'Post is public on the web':'Post search visibility turned off')
    }catch(reason){if(session===demoSession.current)fail(reason)}
    finally{setBusy(false)}
  }
  async function editPost(post:Post){
    const body=comment.trim()
    if(busy||!body)return
    setBusy(true)
    try{
      const saved=demo?{body,editedAt:new Date().toISOString()}:await call<{body:string;editedAt:string}>('/posts/'+encodeURIComponent(post.id),json({body},'PUT'))
      setPosts(previous=>previous.map(item=>item.id===post.id?{...item,...saved}:item))
      modalClose();setComment('');notify('Post updated')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function deletePost(post:Post){
    if(busy)return
    setBusy(true)
    try{
      if(!demo)await call('/posts/'+encodeURIComponent(post.id),{method:'DELETE'})
      setPosts(previous=>previous.filter(item=>item.id!==post.id))
      dismissOverlays();notify('Post deleted')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function editMessage(item:Note){
    if(!room||busy||!comment.trim())return
    setBusy(true)
    try{
      const saved=demo?{body:comment.trim(),editedAt:new Date().toISOString()}:await call<{body:string;editedAt:string}>('/rooms/'+encodeURIComponent(room.id)+'/messages/'+encodeURIComponent(item.id),json({body:comment.trim()},'PUT'))
      setChats(previous=>({...previous,[room.id]:(previous[room.id]??[]).map(entry=>entry.id===item.id?{...entry,...saved}:entry)}))
      modalClose();setComment('');notify('Message updated')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function deleteMessage(item:Note){
    if(!room||busy)return
    setBusy(true)
    try{
      if(!demo)await call('/rooms/'+encodeURIComponent(room.id)+'/messages/'+encodeURIComponent(item.id),{method:'DELETE'})
      setChats(previous=>({...previous,[room.id]:(previous[room.id]??[]).filter(entry=>entry.id!==item.id)}))
      notify('Message deleted')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function wishBirthday(person:Person,message?:string){
    if(busy)return
    const first=person.name.split(' ')[0]
    const body=message||'Happy birthday, '+first+'! 🎂🎉'
    if(demo){setWishedBirthdays(previous=>new Set(previous).add(person.id));setWishes(previous=>[...previous,body]);notify('Birthday wish sent to '+first+'.');return}
    setBusy(true)
    try{
      await call('/people/'+encodeURIComponent(person.id)+'/birthday-wish',json({body}))
      setWishedBirthdays(previous=>new Set(previous).add(person.id))
      notify('Your wish was sent to '+first+' as a message.')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function saveBirthday(){
    const dob=birthIso(birthDraft)
    if(busy||!dob)return
    setBusy(true)
    try{
      setUser(await call<Viewer>('/me/birthday',json({dob},'PUT')))
      setBirthDraft(emptyBirth);notify('Birthday saved.')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function shareStory(){
    if(busy)return
    setBusy(true)
    try{
      const form=new FormData()
      form.append('text',comment.trim())
      if(storyMode==='Text')form.append('background',storyBackground)
      if((storyMode==='Photo'||storyMode==='Video')&&storyMedia){
        if(storyMode==='Video'&&storyMedia.duration)form.append('duration',String(storyMedia.duration))
        if(storyMedia.data instanceof Blob)form.append(storyMode==='Video'?'video':'image',storyMedia.data,storyMedia.name)
        else form.append(storyMode==='Video'?'video':'image',storyMedia.data as unknown as Blob)
      }
      await call('/stories',{method:'POST',body:form})
      setStoryRefresh(n=>n+1)
      modalClose();notify('Story shared. It disappears after '+(verifiedBenefits?18:12)+' hours.')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function deleteStory(id:string){
    if(busy)return
    setBusy(true)
    try{
      await call('/stories/'+encodeURIComponent(id),{method:'DELETE'})
      const own=activeStories.find(group=>group.author.id===user.id)
      setLiveStories(previous=>previous.map(group=>group.author.id===user.id?{...group,stories:group.stories.filter(item=>item.id!==id)}:group).filter(group=>group.stories.length))
      setStoryRefresh(n=>n+1)
      if((own?.stories.length??0)<=1)modalClose()
      notify('Story deleted')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function pickCommentPhoto(){
    const revision=commentDraft.current
    try{
      const media=await (props.pickCommentMedia??props.pickMedia)?.()
      if(media&&revision===commentDraft.current)setCommentMedia(media)
    }catch(reason){if(revision===commentDraft.current)fail(reason)}
  }
  async function addComment(post:Post){
    const key='comment:'+post.id
    const body=comment.trim()
    if(busy||pending.current.has(key)||(!body&&!commentMedia))return
    const revision=commentDraft.current
    const session=demoSession.current
    pending.current.add(key)
    setBusy(true)
    try{
      let item:Note
      if(demo){
        item={id:uid(),author:user,body,parentId:replyTarget?.id,replyTo:replyTarget?displayHandle(replyTarget.author):undefined,likes:0,liked:false,attachment:commentMedia&&'uri' in commentMedia?{kind:'image',url:commentMedia.uri}:commentMedia??undefined}
      }else{
        let request=json({body,parentId:replyTarget?.id,...(commentMedia&&'uri' in commentMedia?{}:commentMedia?{[commentMedia.kind]:commentMedia.id}:{})}) as RequestInit
        if(commentMedia&&'uri' in commentMedia){
          const form=new FormData()
          form.append('body',body)
          if(replyTarget)form.append('parentId',replyTarget.id)
          if(commentMedia.data instanceof Blob)form.append('image',commentMedia.data,commentMedia.name)
          else form.append('image',commentMedia.data as unknown as Blob)
          request={method:'POST',body:form}
        }
        item=await call<Note>('/posts/'+post.id+'/comments',request)
      }
      if(session!==demoSession.current)return
      setNotes(previous=>{
        const existing=previous[post.id]??(demo&&post.id==='quadratics'?initialComments:[])
        return {...previous,[post.id]:existing.some(note=>note.id===item.id)?existing:[...existing,item]}
      })
      setPosts(previous=>previous.map(p=>p.id===post.id?{...p,comments:p.comments+1}:p))
      if(revision===commentDraft.current)clearComment()
    }catch(reason){if(session===demoSession.current)fail(reason)}
    finally{pending.current.delete(key);setBusy(false)}
  }
  async function likeComment(postId:string,item:Note){
    const key='comment-like:'+item.id
    if(pending.current.has(key))return
    pending.current.add(key)
    try{
      const result=demo?{liked:!item.liked,likes:(item.likes??0)+(item.liked?-1:1)}
        :await call<{liked:boolean;likes:number}>('/comments/'+item.id+'/like',json({active:!item.liked},'PUT'))
      setNotes(previous=>({...previous,[postId]:(previous[postId]??[]).map(note=>note.id===item.id?{...note,...result}:note)}))
    }catch(reason){fail(reason)}finally{pending.current.delete(key)}
  }
  async function likeStory(author:Person,story:Story){
    const key='story-like:'+story.id
    if(pending.current.has(key))return
    pending.current.add(key)
    try{
      const result=demo?{liked:!story.liked,likes:(story.likes??0)+(story.liked?-1:1)}
        :await call<{liked:boolean;likes:number}>('/stories/'+author.id+'/'+story.id+'/like',json({active:!story.liked},'PUT'))
      setLiveStories(previous=>previous.map(group=>({...group,stories:group.stories.map(item=>item.id===story.id?{...item,...result}:item)})))
      if(demo)notify(result.liked?'Story liked':'Story like removed')
    }catch(reason){fail(reason)}finally{pending.current.delete(key)}
  }
  async function replyToStory(author:Person,story:Story){
    const reply=storyReplyDraft.trim()
    if(!reply||storyReplyBusy||author.id===user.id)return
    setStoryReplyBusy(true)
    try{
      const next=await call<{id:string}>('/rooms',json({target:author.id}))
      const context=story.text?'Replied to your story “'+story.text.slice(0,100)+'”':'Replied to your story'
      await call('/rooms/'+next.id+'/messages',json({body:context+'\n'+reply}))
      setStoryReplyDraft('')
      openRoom({id:next.id,person:author})
      notify('Story reply sent')
    }catch(reason){fail(reason)}finally{setStoryReplyBusy(false)}
  }
  function openRoom(next:Room){
    stickToChatEnd.current=true;initialChatScroll.current=true
    setMessage('');open('Chat',{room:next})
  }
  async function messagePerson(person:Person){
    try{
      const next=demo?{id:person.id}:await call<{id:string}>('/rooms',json({target:person.id}))
      const nextRoom={id:next.id,person}
      setRooms(previous=>previous.some(r=>r.id===next.id)?previous:[...previous,nextRoom])
      openRoom(nextRoom)
    }catch(reason){fail(reason)}
  }
  async function openNotification(item:NotificationItem){
    if(!item.read){
      try{
        await call('/notifications/'+item.id+'/read',{method:'PUT'})
        setNotificationItems(previous=>previous.map(entry=>entry.id===item.id?{...entry,read:true}:entry))
        setUnread(notificationItems.some(entry=>entry.id!==item.id&&!entry.read))
      }catch(reason){fail(reason)}
    }
    if(!item.entityId)return
    try{
      const target=item.entityId
      if(item.kind==='follow'){
        showProfile(await call<Person>('/people/'+encodeURIComponent(target)))
      }else if(item.kind==='call'){
        const pending=(await call<IncomingCall[]>('/calls/incoming')).find(entry=>'call:'+entry.id===target)
        if(pending)await handleIncoming(pending)
        else notify('This call has ended.','error')
      }else if(item.kind==='message'){
        const available=await call<Room[]>('/rooms')
        const conversation=available.find(entry=>entry.id===target)
        if(conversation)openRoom(conversation)
        else notify('Conversation unavailable.','error')
      }else if(target.startsWith('story:')){
        const [,author,id]=target.split(':')
        const groups=await call<StoryGroup[]>('/stories')
        setLiveStories(groups)
        const group=groups.find(entry=>entry.author.id===author)
        const index=group?.stories.findIndex(entry=>entry.id===id)??-1
        if(group&&index>=0){selectOverlay({kind:'story',person:group.author});setStoryIndex(index)}
        else notify('This story has expired.','error')
      }else{
        const parts=target.split(':')
        const commentTarget=parts[0]==='comment'?parts[2]:undefined
        const postId=commentTarget?parts[1]:target
        const post=await call<Post>('/posts/'+encodeURIComponent(postId))
        selectOverlay({kind:item.kind==='comment'||!!commentTarget?'comments':'post',post,targetId:commentTarget})
      }
    }catch(reason){fail(reason)}
  }
  async function send(){
    if(!room||busy||!message.trim())return
    const id=room.id
    const append=(item:Note)=>setChats(previous=>({...previous,[id]:[...(previous[id]??[]).filter(m=>m.id!==item.id),item]}))
    setBusy(true)
    try{
      const item=demo?{id:uid(),author:user,body:message.trim()}:await call<Note>('/rooms/'+id+'/messages',json({body:message}))
      stickToChatEnd.current=true
      append(item);setMessage('')
      if(demo){
        const session=demoSession.current
        replyTimers.current.push(setTimeout(()=>{if(session===demoSession.current){append({id:uid(),author:room.person,body:'Thanks for the message! See you at school.'});void props.notifyDevice?.(room.person.name,'Thanks for the message! See you at school.')}},950))
      }
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function loadMoreRooms(){
    if(demo||!token||!roomsNextCursor||roomsLoadingMore)return
    setRoomsLoadingMore(true)
    try{
      const data=await api<RoomPage>(base,'/rooms?paged=1&cursor='+encodeURIComponent(roomsNextCursor),{},token)
      setRooms(previous=>[...previous,...data.items.filter(item=>!previous.some(saved=>saved.id===item.id))])
      setRoomsNextCursor(data.nextCursor)
    }catch(reason){fail(reason)}finally{setRoomsLoadingMore(false)}
  }
  async function loadOlderMessages(){
    if(demo||!token||!room||!messageNextCursor[room.id]||messageLoadingOlder)return
    const id=room.id
    setMessageLoadingOlder(true)
    stickToChatEnd.current=false
    try{
      const data=await api<MessagePage>(base,'/rooms/'+id+'/messages?paged=1&before='+encodeURIComponent(messageNextCursor[id]!),{},token)
      setChats(previous=>({...previous,[id]:mergeNotes(data.items,previous[id]??[])}))
      setMessageNextCursor(previous=>({...previous,[id]:data.nextCursor}))
    }catch(reason){fail(reason)}finally{setMessageLoadingOlder(false)}
  }
  const displayedPosts=demo&&followingOnly?posts.filter(p=>p.author.id===user.id||follows[p.author.id]):posts
  async function refreshPage(){
    if(refreshLock.current||stage!=='app')return
    refreshLock.current=true
    setRefreshing(true)
    const session=demoSession.current
    try{
      if(!demo&&token){
        if(page==='Home'){
          const [feed,stories,birthdays]=await Promise.all([
            api<Post[]>(base,'/feed'+(followingOnly?'?following=1':''),{},token),
            api<StoryGroup[]>(base,'/stories',{},token),
            api<BirthdayEntry[]>(base,'/birthdays',{},token),
          ])
          if(session===demoSession.current){setPosts(feed);setLiveStories(stories);setBirthdays(birthdays);setFeedError('')}
        }else if(page==='Explore'){
          const people=await api<(Person&{following:boolean})[]>(base,'/people?q='+encodeURIComponent(query),{},token)
          if(session===demoSession.current){setResults(people);setFollows(previous=>({...previous,...Object.fromEntries(people.map(person=>[person.id,person.following]))}));setSearchError('')}
        }else if(page==='Messages'){
          const rooms=await api<RoomPage>(base,'/rooms?paged=1',{},token)
          if(session===demoSession.current){setRooms(rooms.items);setRoomsNextCursor(rooms.nextCursor)}
        }else if(page==='Chat'&&room){
          const messages=await api<MessagePage>(base,'/rooms/'+room.id+'/messages?paged=1',{},token)
          if(session===demoSession.current){setChats(previous=>({...previous,[room.id]:mergeNotes(previous[room.id]??[],messages.items)}));setMessageNextCursor(previous=>room.id in previous?previous:{...previous,[room.id]:messages.nextCursor})}
        }else if(page==='Profile'){
          const [person,stats]=await Promise.all([
            api<Person|Viewer>(base,profile.id===user.id?'/me':'/people/'+encodeURIComponent(profile.id),{},token),
            api<FollowStats>(base,'/people/'+encodeURIComponent(profile.id)+'/follow-stats',{},token),
          ])
          if(session===demoSession.current){setProfile(person);if(profile.id===user.id)setUser(person as Viewer);setProfileStats({id:profile.id,data:stats});setFollows(previous=>({...previous,[profile.id]:stats.followedByViewer}));refreshStats(value=>value+1)}
        }else if(page==='Learn'||page==='Lesson'||page==='Progress'){
          const completed=await api<string[]>(base,'/me/lessons',{},token)
          if(session===demoSession.current)setCompletedLessons(completed)
        }else if(page==='Birthdays'){
          const entries=await api<BirthdayEntry[]>(base,'/birthdays',{},token)
          if(session===demoSession.current)setBirthdays(entries)
        }else if(page==='Birthday wall'){
          const entries=await api<Array<{body:string;created:string;author:Person}>>(base,'/people/'+encodeURIComponent(user.id)+'/birthday-wall',{},token)
          if(session===demoSession.current)setBirthdayWall(entries)
        }else if(page==='Settings'){
          const preferences=await api<{quiet_start?:string|null;quiet_end?:string|null}>(base,'/notification-preferences',{},token)
          if(session===demoSession.current){setQuietStart(preferences.quiet_start??'');setQuietEnd(preferences.quiet_end??'')}
        }else if(page==='Notifications'){
          const notifications=await api<{unread:number;items:NotificationItem[];nextCursor:string|null}>(base,'/notifications'+(notificationCursor?'?cursor='+encodeURIComponent(notificationCursor):''),{},token)
          if(session===demoSession.current){setNotificationItems(notifications.items);setNotificationNextCursor(notifications.nextCursor);setUnread(notifications.unread>0)}
        }else setRetry(value=>value+1)
      }
    }catch(reason){if(session===demoSession.current)fail(reason)}
    finally{refreshLock.current=false;setRefreshing(false)}
  }
  const displayedPeople=demo?people.map(person=>demoAccounts.find(account=>account.person.id===person.id)?.person??person).filter(p=>(displayHandle(p)+' '+p.detail).toLowerCase().includes(searchTerm.toLowerCase())):results
  const canShare=Boolean(props.share)
  const overlays=overlay?[...overlayHistory.current,overlay]:[]
  const restoreOverlays=(items:Overlay[])=>{
    overlayHistory.current=items.slice(0,-1)
    setOverlay(items.at(-1)??null)
    clearComment()
  }
  const modalClose=()=>restoreOverlays(overlays.slice(0,-1))
  const pageDepth=pageHistory.current.reduce((depth,entry)=>depth+entry.overlays.length+1,0)
  const navigationDepth=stage==='app'?pageDepth+overlays.length:stage==='auth'?step+1+Number(recovering):step
  const backToDepth=(target:number)=>{
    if(stage==='intro'){setStep(target);return}
    if(stage==='auth'){
      setRecovering(false)
      if(target<=step){setStep(target);setStage('intro')}
      return
    }
    if(stage!=='app')return
    const stack=pageHistory.current
    let depth=pageDepth+overlays.length
    let layers=overlays
    let previous:PageEntry|undefined
    while(depth>target){
      if(layers.length)layers=layers.slice(0,-1)
      else{
        const entry=stack.pop()
        if(!entry)break
        previous=entry
        layers=entry.overlays
      }
      depth--
    }
    restoreOverlays(layers)
    if(!previous)return
    setProfile(previous.profile.id===user.id?user:previous.profile)
    setRoom(previous.room)
    setLessonId(previous.lessonId)
    if(previous.page==='Chat'){
      stickToChatEnd.current=false
      initialChatScroll.current=false
    }
    changePage(previous.page,previous.scrollY)
  }
  const goBack=()=>backToDepth(Math.max(0,navigationDepth-1))
  useEffect(()=>{
    if(Platform.OS!=='android')return
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(overlay)return false // Native Modal handles this through onRequestClose.
      if(roomCall.call){roomCall.end();return true}
      if(navigationDepth>0){goBack();return true}
      return false
    })
    return ()=>subscription.remove()
  })
  useBrowserModalBack(navigationDepth,backToDepth)
  const compose=()=>selectOverlay({kind:'create'})
  const section=(title:string)=> <Copy size={19} weight={800}>{title}</Copy>
  const failure=<Empty title="Couldn’t connect" detail={feedError} action="Try again" onPress={()=>setRetry(n=>n+1)}/>
  const navButton=(name:Page,glyph:Glyph)=>{
    const nearestTab=pageHistory.current.filter(entry=>tabs.some(([tab])=>entry.page===tab)).at(-1)?.page
    const active=page===name||name==='Messages'&&page==='Chat'||!tabs.some(([tab])=>page===tab)&&nearestTab===name
    const color=active?theme.ink:theme.muted
    return <Pressable accessibilityRole="button" accessibilityLabel={name} accessibilityState={{selected:active}} key={name} onPress={()=>open(name)}
      style={({pressed})=>({...row,flexDirection:desktop?'row':'column',justifyContent:desktop?'flex-start':'center',minHeight:desktop?48:54,flex:desktop?0:1,paddingHorizontal:desktop?12:0,gap:desktop?12:3,borderRadius:13,backgroundColor:desktop&&active?theme.chip:'transparent',opacity:pressed?.68:1})}>
      <View style={{width:desktop?26:38,height:desktop?28:28,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:active&&!desktop?theme.chip:'transparent'}}>
        <Icon name={glyph} color={color} size={desktop?21:20} strong={active}/>
      </View>
      <Copy color={color} weight={active?800:700} size={desktop?14:10}>{name}</Copy>
      {desktop&&name==='Notifications'&&unread&&<View style={{marginLeft:'auto',width:7,height:7,borderRadius:4,backgroundColor:theme.purple}}/>}
    </Pressable>
  }
  const ownBirthday=birthdayToday(user.birthday??user.dob?.slice(5))
  const birthdayPeople=demo?people.filter(person=>!person.group&&birthdayToday(person.birthday)):birthdays.filter(entry=>entry.person.id!==user.id&&birthdayToday(entry.person.birthday)).map(entry=>entry.person)
  const upcomingBirthdays=demo?[]:birthdays.filter(entry=>entry.person.id!==user.id&&typeof entry.daysUntil==='number'&&entry.daysUntil>=0&&entry.daysUntil<=7).sort((a,b)=>(a.daysUntil??99)-(b.daysUntil??99))
  const birthdayDayLabel=(days:number|undefined)=>days===0?'Today':days===1?'Tomorrow':'In '+days+' days'
  const wishedAlready=(id:string)=>wishedBirthdays.has(id)||birthdays.some(entry=>entry.person.id===id&&entry.wished)
  const hasOwnStory=demo?!!demoOwn:activeStories.some(group=>group.author.id===user.id)
  const ownStoryCount=demo?(demoOwn?1:0):activeStories.find(group=>group.author.id===user.id)?.stories.length??0
  const canAddStory=ownStoryCount<(verifiedBenefits?verifiedStoryLimit:1)
  const home=<>
    {(demo||token)&&<View style={{paddingHorizontal:2}}><StoryRow onStory={person=>selectOverlay({kind:'story',person})} onCreate={()=>selectOverlay(hasOwnStory?{kind:'story',person:user}:{kind:'newStory'})} onAdd={canAddStory?()=>selectOverlay({kind:'newStory'}):undefined} seen={seenAuthors} own={hasOwnStory?user:null} others={demo?demoStories:activeStories.map(group=>group.author).filter(author=>author.id!==user.id)}/></View>}
    {(ownBirthday||birthdayPeople.length>0)&&<Card>
      {ownBirthday&&<View style={{gap:4}}><Copy size={19} weight={800}>Happy birthday, {user.name.split(' ')[0]}! 🎂</Copy><Copy color={theme.muted}>Have a great day. Friends can send you a wish today.</Copy></View>}
      {birthdayPeople.length>0&&<>{section('Birthdays today')}{birthdayPeople.map(person=><View key={person.id} style={{...row,flexWrap:'wrap'}}>
        <Avatar person={person}/><View style={{flex:1,minWidth:120}}><PersonName person={person}/><Copy size={12} color={theme.muted}>{person.detail}</Copy></View>
        <View style={{...row,gap:4}}>{['🎉','✨','💪'].map(wish=><Button key={wish} label={wishedAlready(person.id)?'✓':wish} variant="secondary" disabled={busy||wishedAlready(person.id)} onPress={()=>void wishBirthday(person,wish+' Happy birthday!')}/>)}</View>
      </View>)}</>}
      {upcomingBirthdays.length>0&&<Card>{section('Upcoming birthdays')}{upcomingBirthdays.slice(0,5).map(entry=><View key={entry.person.id} style={{...row,flexWrap:'wrap'}}><Avatar person={entry.person} size={42}/><View style={{flex:1,minWidth:130}}><PersonName person={entry.person}/><Copy size={12} color={theme.muted}>{birthdayDayLabel(entry.daysUntil)}</Copy></View>{entry.daysUntil===0&&<Button label={entry.wished?'Wished':'Wish'} variant="secondary" disabled={busy||entry.wished} onPress={()=>void wishBirthday(entry.person)}/>}</View>)}</Card>}
      {ownBirthday&&<Card style={{backgroundColor:theme.chip}}>{section('Your birthday wall')}<Copy color={theme.muted}>{birthdayWall.length?'Wishes from your classmates today.':'Your birthday wishes will appear here.'}</Copy>{birthdayWall.slice(0,5).map((wish,index)=><View key={wish.created+index} style={{...row,alignItems:'flex-start'}}><Avatar person={wish.author} size={34}/><View style={{flex:1}}><PersonName person={wish.author}/><Copy>{wish.body}</Copy></View></View>)}{demo&&wishes.map((wish,index)=><View key={'demo'+index} style={{...row,alignItems:'flex-start'}}><Avatar person={user} size={34}/><View style={{flex:1}}><Copy>{wish}</Copy></View></View>)}</Card>}
    </Card>}
    {!demo&&!!token&&!user.dob&&<Card>{section('Add your birthday')}<Copy color={theme.muted}>Friends can wish you a happy birthday. Only the day and month are shown to others.</Copy><BirthdayFields value={birthDraft} onChange={setBirthDraft}/><Button label="Save birthday" disabled={busy||!birthIso(birthDraft)} onPress={()=>void saveBirthday()}/></Card>}
    <Segmented options={['For you','Following']} selected={followingOnly?'Following':'For you'} onSelect={value=>setFollowingOnly(value==='Following')}/>
    {feedError?failure:loading?<Loading/>:displayedPosts.length?displayedPosts.map(post=><PostCard key={post.id} post={post} onReact={react} onOverlay={selectOverlay} onProfile={showProfile}/>):<Empty title={followingOnly?'Your following feed is empty':'Start the conversation'} detail={followingOnly?'Follow classmates to see their posts here.':'Share the first post with your classmates.'} action={followingOnly?'Find people':'Create post'} onPress={followingOnly?()=>open('Explore'):compose}/>}
    {demo&&!followingOnly&&<View style={{...row,flexWrap:'wrap'}}>
      <Button label="Birthdays" leading="gift" variant="secondary" onPress={()=>open('Birthdays')}/>
      <Button label="Events" leading="grp" variant="secondary" onPress={()=>open('Events')}/>
    </View>}
  </>
  const explore=<>
    <Field label="Search" glyph="search" testID="explore-search-input" underlineColorAndroid="transparent" style={{paddingRight:13}} placeholder="Search people by name or username" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" maxLength={60}/>
    {demo&&!query&&<Card>{section('Trending in your school')}<View style={{...row,flexWrap:'wrap'}}>{['#QuizFriday','#StudyTogether','#WordSprint'].map(tag=><Button key={tag} label={tag} variant="secondary" onPress={()=>setQuery(tag)}/>)}</View></Card>}
    {section(query?'Search results':'Suggested for you')}
    {searchError?<Empty title="Search unavailable" detail={searchError} action="Try again" onPress={()=>setRetry(n=>n+1)}/>:searching?<Loading/>:displayedPeople.length?displayedPeople.map(person=><Card key={person.id} style={spread}><Pressable accessibilityRole="button" accessibilityLabel={'Open '+displayHandle(person)+' profile'} onPress={()=>showProfile(person)} style={{...row,flex:1}}><Avatar person={person}/><View style={{flex:1}}><PersonName person={person}/><Copy color={theme.muted} size={12}>{person.detail}</Copy></View></Pressable><Button label={follows[person.id]?'Following':'followsViewer' in person&&person.followsViewer?'Follow back':'Follow'} variant={follows[person.id]?'secondary':'primary'} onPress={()=>void follow(person)}/></Card>):<Empty title="No results" detail={query?'Try a different name or clear the search.':'Classmates will appear here after they sign up.'}/>}
  </>
  const learning=<Learning featured={featuredLesson} done={completedLessons} onLesson={openLesson} onTimer={()=>open('Study timer')} onProgress={()=>open('Progress')}/>
  const play=<>
    <FeatureCard glyph="trophy" title="Quiz Duel" description="Race through questions and win XP." action="Play quiz" onPress={startQuiz}/>
    <ScreenLinks items={ [['Games','game'],...(demo?[['Leaderboard','trophy'] as const,['Rewards','gift'] as const]:[])] } open={open}/>
  </>
  const roomList=rooms.filter(r=>inboxTab==='Chats'?!r.person.group:inboxTab==='Groups'?r.person.group:false)
  const inbox=<>
    <Segmented options={['Chats','Groups','Requests']} selected={inboxTab} onSelect={setInboxTab}/>
    {demo&&inboxTab==='Chats'&&<Card>{section('Active now')}<View style={row}>{[people[0],people[1],people[2]].map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={'Message '+person.name} onPress={()=>void messagePerson(person)}><Avatar person={person} ring size={42}/></Pressable>)}</View></Card>}
    {feedError&&!rooms.length?failure:roomsLoading&&!rooms.length?<Loading/>:roomList.length?<>{roomList.map(r=><Motion key={r.id} reduced={reduced} distance={4}><Pressable accessibilityRole="button" accessibilityLabel={'Open conversation with '+displayHandle(r.person)} onPress={()=>openRoom(r)}><Card style={{...row,minHeight:72}}><Avatar person={r.person} size={50}/><View style={{flex:1,minWidth:0,gap:3}}><View style={spread}><PersonName person={r.person}/>{r.lastActivityAt&&<Copy color={theme.muted} size={11}>{shortTime(r.lastActivityAt)}</Copy>}</View><Copy color={theme.muted} size={12}>{chats[r.id]?.at(-1)?.body??r.lastActivity??'Open conversation'}</Copy></View></Card></Pressable></Motion>)}{roomsNextCursor&&inboxTab==='Chats'&&<Button label={roomsLoadingMore?'Loading conversations…':'Load more conversations'} variant="secondary" disabled={roomsLoadingMore} onPress={()=>void loadMoreRooms()}/>}</>:<Empty title={inboxTab==='Chats'?'No messages yet':inboxTab==='Groups'?'No groups yet':'No message requests'} detail={inboxTab==='Chats'?'Find a classmate and start a chat.':inboxTab==='Groups'?'Group conversations are available in the preview.':'New requests will appear here.'} action={inboxTab==='Chats'?'Find people':undefined} onPress={()=>open('Explore')}/>} 
  </>
  const lastOwnMessageId=room?[...(chats[room.id]??[])].reverse().find(note=>!note.call&&note.author.id===user.id)?.id:undefined
  const chat=room&&<>
    {!demo&&callMedia&&deviceNotifications!=='granted'&&props.requestNotifications&&<View style={{alignItems:'center'}}><Button label="Enable call alerts" variant="plain" onPress={()=>void enableDeviceNotifications()}/></View>}
    {!demo&&!callMedia&&<Copy color={theme.muted} size={12}>Voice and video calls are available in the installed app build or a supported browser.</Copy>}
    {demo&&room.person.group&&<Card><Copy weight={800}>Pinned message</Copy><Copy>Bring one practice question to the next study session.</Copy><Button label="Join group voice call" leading="ph" variant="secondary" onPress={()=>selectOverlay({kind:'call',video:false,person:room.person,ringing:true})}/></Card>}
    {demo&&room.id==='ada'&&<Card><Copy size={12} color={theme.muted}>Call log · Voice call · 2 min</Copy><Button label={voicePlaying?'Stop voice note preview':'Preview voice note · 0:08'} leading="play" variant="secondary" onPress={()=>setVoicePlaying(!voicePlaying)}/>{voicePlaying&&<Copy>Transcript: Can we revise quadratic equations after school?</Copy>}</Card>}
    {!!feedError&&<Empty title="Reconnecting" detail={feedError}/>}
    {messageLoading&&!(chats[room.id]?.length)&&<Loading/>}
    {!messageLoading&&messageNextCursor[room.id]&&<View style={{alignItems:'center'}}><Button label={messageLoadingOlder?'Loading earlier messages…':'Load earlier messages'} variant="plain" disabled={messageLoadingOlder} onPress={()=>void loadOlderMessages()}/></View>}
    {(chats[room.id]??[]).map(item=>item.call?<View key={item.id} accessibilityLabel={item.body} style={{alignSelf:'center',alignItems:'center',width:'100%',maxWidth:320,paddingVertical:16,gap:6}}>
      <View style={{width:44,height:44,borderRadius:22,backgroundColor:item.call.outcome==='missed'?theme.chip:theme.card,borderWidth:1,borderColor:theme.border,alignItems:'center',justifyContent:'center'}}><Icon name={item.call.video?'vid':'ph'} color={item.call.outcome==='missed'?'#D13438':theme.purple} size={21}/></View>
      <Copy center weight={800} color={item.call.outcome==='missed'?'#D13438':theme.text}>{item.body}</Copy>
      <Copy center color={theme.muted} size={12}>{item.call.outcome==='completed'?callLength(item.call.durationSeconds)+' · ':''}{item.createdAt?shortTime(item.createdAt):''}</Copy>
      {callMedia&&<Pressable accessibilityRole="button" accessibilityLabel={'Call '+displayHandle(room.person)+' again'} onPress={()=>{if(!roomCall.call)roomCall.start(item.call!.video)}} style={{minHeight:38,paddingHorizontal:18,justifyContent:'center',borderRadius:20,backgroundColor:theme.chip}}><Copy color={theme.purple} weight={800} size={12}>Call again</Copy></Pressable>}
    </View>:(()=>{
      const own=item.author.id===user.id
      const canEdit=own&&verifiedBenefits&&(demo||withinEditWindow(item.createdAt))
      return <View key={item.id} style={{alignSelf:own?'flex-end':'flex-start',backgroundColor:own?theme.purple:theme.card,maxWidth:'84%',borderRadius:18,borderBottomLeftRadius:own?18:5,borderBottomRightRadius:own?5:18,borderWidth:1,borderColor:own?theme.purple:theme.border,padding:12,gap:5}}>
        <Copy color={own?'#fff':theme.text}>{item.body}</Copy>
        {!!item.editedAt&&<Copy size={10} color={own?'#FFFFFFCC':theme.muted}>Edited</Copy>}
        {own&&lastOwnMessageId===item.id&&<Copy size={11} color="#FFFFFFCC">{item.readAt?'Seen · '+shortTime(item.readAt):'Sent'}</Copy>}
        {own&&verifiedBenefits&&<View style={{...row,gap:4,flexWrap:'wrap'}}>{canEdit&&<Button label="Edit" variant="plain" onPress={()=>{setComment(item.body);selectOverlay({kind:'editMessage',message:item})}}/>}<Button label="Delete" variant="plain" onPress={()=>void deleteMessage(item)}/></View>}
      </View>
    })())}
    {!messageLoading&&!(chats[room.id]?.length)&&!feedError&&<Empty title="Say hello" detail="Messages are visible to both people in this conversation."/>}
  </>
  const ownProfile=profile.id===user.id
  const currentStats=profileStats?.id===profile.id?profileStats:undefined
  const profilePresence=ownProfile&&stage==='app'?{online:true,lastSeen:null}:presenceById[profile.id]
  const demoConnections=(id:string,list:FollowListKind)=>{
    const members=[...people,user]
    const outgoing=(person:Person)=>person.id===user.id?Object.keys(follows).filter(key=>follows[key]):sampleFollows[person.id]??[]
    return list==='following'
      ? members.filter(person=>outgoing(members.find(member=>member.id===id)??user).includes(person.id))
      : members.filter(person=>outgoing(person).includes(id))
  }
  const followers=demo?demoConnections(profile.id,'followers').length:currentStats?.data?.followers
  const following=demo?demoConnections(profile.id,'following').length:currentStats?.data?.following
  const profileContent=<>
    <Card style={{padding:0,overflow:'hidden'}}>
      <Pressable accessibilityRole="button" accessibilityLabel="View cover photo" onPress={()=>selectOverlay({kind:'photo',person:profile,photo:'cover'})} style={{height:136,backgroundColor:'#4F25D6'}}>{profile.cover&&<Image accessibilityLabel="Cover photo" source={{uri:profile.cover}} resizeMode="cover" style={{width:'100%',height:'100%'}}/>}</Pressable>
      <View style={{padding:18,paddingTop:0,gap:14}}>
        <Pressable accessibilityRole="button" accessibilityLabel="View profile picture" onPress={()=>selectOverlay({kind:'photo',person:profile,photo:'avatar'})} style={{alignSelf:'flex-start',marginTop:-40}}><Avatar person={profile} size={74} ring/></Pressable>
        <View style={{gap:4}}><Copy size={27} weight={800}>{displayHandle(profile)}</Copy>{!!profile.bio&&<Copy color={theme.muted}>{profile.bio}</Copy>}{!demo&&<View style={{...row,gap:5}}><View style={{width:7,height:7,borderRadius:4,backgroundColor:profilePresence?.online?'#2FB66D':theme.muted}}/><Copy size={12} color={profilePresence?.online?'#2FB66D':theme.muted}>{profilePresence?.online?'Online':profilePresence?.lastSeen?'Last seen '+shortTime(profilePresence.lastSeen||''):'Offline'}</Copy></View>}</View>
        <View style={{...row,gap:22,borderTopWidth:1,borderColor:theme.border,paddingTop:12}}>
          {([{label:'Followers',count:followers},{label:'Following',count:following}]).map(({label,count})=>
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={'View '+label.toLowerCase()+(count===undefined?'':' ('+count+')')} onPress={()=>selectOverlay({kind:'connections',list:label==='Followers'?'followers':'following',person:profile})} style={{gap:2,minWidth:72,minHeight:48}}>
              <Copy size={22} weight={800}>{count?.toLocaleString()??'—'}</Copy>
              <Copy size={12} color={theme.muted}>{label}</Copy>
            </Pressable>
          )}
        </View>
        {currentStats?.error&&<Button label="Retry profile counts" variant="secondary" onPress={()=>refreshStats(value=>value+1)}/>}
        <View style={{...row,flexWrap:'wrap'}}>
          {ownProfile?<><Button label="Edit profile" variant="secondary" onPress={()=>selectOverlay({kind:'editProfile'})}/><Button label="Change username" variant="secondary" onPress={()=>selectOverlay({kind:'editUsername'})}/>{props.pickMedia&&<>
            <Button label={photoBusy==='avatar'?'Updating picture…':'Change profile picture'} leading="image" variant="secondary" disabled={!!photoBusy} onPress={()=>void uploadProfilePhoto('avatar')}/>
            <Button label={photoBusy==='cover'?'Updating cover…':'Change cover photo'} variant="secondary" disabled={!!photoBusy} onPress={()=>void uploadProfilePhoto('cover')}/>
          </>}<Button label="Share profile" leading="sh" variant="secondary" onPress={()=>{void props.share?.(sharedLink('profile',profile.id)).then(()=>notify('Profile link ready to share')).catch(fail)}}/><Button label="Settings" leading="settings" variant="secondary" onPress={()=>open('Settings')}/></>:<>
            <Button label={follows[profile.id]?'Following':currentStats?.data?.followsViewer?'Follow back':'Follow'} disabled={!demo&&!currentStats?.data} onPress={()=>void follow(profile)}/>
            <Button label="Message" leading="msg" variant="secondary" onPress={()=>void messagePerson(profile)}/>
            <Button label="Share profile" leading="sh" variant="secondary" onPress={()=>{void props.share?.(sharedLink('profile',profile.id)).then(()=>notify('Profile link ready to share')).catch(fail)}}/>
          </>}
        </View>
      </View>
    </Card>
    {ownProfile&&personalAnalytics&&<Card><Copy weight={800} size={18}>Your analytics</Copy><View style={{...row,flexWrap:'wrap',gap:18}}>{([{label:'Posts',value:personalAnalytics.posts},{label:'Likes received',value:personalAnalytics.likes},{label:'Comments received',value:personalAnalytics.comments},{label:'Reposts',value:personalAnalytics.reposts},{label:'Followers',value:personalAnalytics.followers},{label:'Following',value:personalAnalytics.following}]).map(item=><View key={item.label} style={{minWidth:95,gap:2}}><Copy weight={800} size={20}>{item.value.toLocaleString()}</Copy><Copy color={theme.muted} size={12}>{item.label}</Copy></View>)}</View></Card>}
    {profile.role==='tech'&&<Card><View style={row}><IconTile name="code"/><View style={{flex:1}}><Copy weight={800}>Tech creator</Copy></View></View></Card>}
    {section('Posts')}
    {posts.filter(p=>p.author.id===profile.id).map(post=><PostCard key={post.id} post={post} onReact={react} onOverlay={selectOverlay} onProfile={showProfile}/>)}
    {!posts.some(p=>p.author.id===profile.id)&&<Empty title="No posts to show" detail="Posts from this profile will appear here."/>}
  </>
  const settings=<>
    <Card>{section('Appearance')}<View style={row}>{(['light','dark','system'] as const).map(mode=><Button key={mode} label={mode[0].toUpperCase()+mode.slice(1)} variant={appearance===mode?'primary':'secondary'} onPress={()=>setAppearance(mode)}/>)}</View></Card>
    <Card>{section('Notifications')}<Button label={notifications?'In-app notifications on':'In-app notifications off'} variant="secondary" onPress={()=>{setNotifications(!notifications);setUnread(!notifications&&demo)}}/>{props.requestNotifications&&<Button label={deviceNotifications==='granted'?'Device notifications enabled':'Enable device notifications'} variant="secondary" disabled={deviceNotifications==='granted'} onPress={()=>void enableDeviceNotifications()}/>} {!demo&&<><View style={{...row,alignItems:'flex-start'}}><View style={{flex:1}}><Field label="Quiet hours start" placeholder="22:00" value={quietStart} onChangeText={setQuietStart} maxLength={5}/></View><View style={{flex:1}}><Field label="Quiet hours end" placeholder="07:00" value={quietEnd} onChangeText={setQuietEnd} maxLength={5}/></View></View><Button label="Save notification preferences" variant="secondary" onPress={()=>void saveNotificationPreferences()}/></>}<Copy size={12} color={theme.muted}>{deviceNotifications==='denied'?'Allow notifications in your browser or phone settings, then try again.':'Get alerts for messages and activity when dameen is in the background.'}</Copy></Card>
    {demo&&<Card>{section('Privacy and safety')}<Copy color={theme.muted}>Try the activity status control in this preview.</Copy><Button label={quietMode?'Show my activity status':'Hide my activity status'} variant="secondary" onPress={()=>setQuietMode(!quietMode)}/></Card>}
    {demo&&<ScreenLinks items={ [['Screen states','settings'],['Design system','image'],['Logo board','image']] } open={open}/>}
    {(demo||user.isAdmin)&&<Button label="Admin dashboard" leading="settings" variant="secondary" onPress={()=>open('Admin')}/>}
    <Button label="Log out" variant="danger" onPress={()=>void logout()}/>
  </>
  const demoOverview:AdminOverview={
    series:[],updatedAt:0,
    users:demoAccounts.length,newUsers:0,activeUsers:new Set(posts.map(post=>post.author.id)).size,
    techUsers:demoAccounts.filter(account=>account.person.role==='tech').length,
    verifiedUsers:demoAccounts.filter(account=>account.person.verified).length,
    teacherUsers:demoAccounts.filter(account=>account.person.teacher).length,
    posts:posts.length,comments:posts.reduce((sum,post)=>sum+post.comments,0),
    likes:posts.reduce((sum,post)=>sum+post.likes,0),reposts:posts.reduce((sum,post)=>sum+post.reposts,0),
    follows:Object.values(follows).filter(Boolean).length,messages:Object.values(chats).reduce((sum,room)=>sum+room.length,0),
    activity:posts.slice(0,8).map((post,index)=>({id:post.id,name:post.author.name,kind:'post',created:Date.now()-index*3600000,excerpt:post.body})),
  }
  function changeDemoAccount(id:string,role:Role,verified:boolean,teacher:boolean){
    const existing=demoAccounts.find(account=>account.person.id===id)
    if(!existing)return
    const person={...existing.person,role,verified:role==='tech'||verified,teacher,detail:teacher?'Teacher':role==='tech'?'Tech creator':'Student'}
    setDemoAccounts(previous=>previous.map(account=>account.person.id===id?{...account,person,independentlyVerified:verified}:account))
    setPosts(previous=>previous.map(post=>post.author.id===id?{...post,author:person}:post))
  }
  const content:Partial<Record<Page,React.ReactNode>>={
    Home:home,Explore:explore,Learn:learning,Play:play,Messages:inbox,Chat:chat,Profile:profileContent,Settings:settings,
    Lesson:<StudyLesson key={lessonId} id={lessonId} done={completedLessons.includes(lessonId)} onComplete={completeLesson}/>,
    Progress:<LearningProgress done={completedLessons} error={learningError} retry={()=>setLearningRetry(n=>n+1)} open={openLesson}/>,
    Quiz:<Quiz onBack={goBack}/>,
    Admin:(demo||user.isAdmin)&&<Suspense fallback={<Loading/>}><Admin base={base} token={token}
      sample={demo?{overview:demoOverview,accounts:demoAccounts}:undefined} onSampleChange={changeDemoAccount}/></Suspense>,
    Notifications:demo&&notifications?<Card><View style={row}><Avatar person={people[1]}/><View style={{flex:1}}><Copy weight={800}>Tobi A. liked your post</Copy><Copy color={theme.muted} size={12}>Today</Copy></View></View><View style={row}><Avatar person={people[4]}/><View style={{flex:1}}><Copy weight={800}>Code Club shared a new post</Copy><Copy color={theme.muted} size={12}>Yesterday</Copy></View></View></Card>:notificationsLoading?<Loading/>:notificationItems.length?<View style={stack}>{notificationItems.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>void openNotification(item)} style={{...row,alignItems:'flex-start',padding:13,borderRadius:16,borderWidth:1,borderColor:theme.border,backgroundColor:item.read?theme.card:theme.chip}}>{item.actor?<Avatar person={item.actor} size={42}/>:<IconTile name="bell" size={42}/>}<View style={{flex:1,gap:3}}><Copy weight={item.read?600:800}>{item.body}</Copy><Copy size={12} color={theme.muted}>{shortTime(item.created)}</Copy></View></Pressable>)}<View style={{...row,justifyContent:'space-between',flexWrap:'wrap'}}><Button label="Mark all as read" variant="secondary" onPress={()=>{void call('/notifications/read-all',{method:'PUT'});setNotificationItems(previous=>previous.map(item=>({...item,read:true})));setUnread(false)}}/><View style={row}>{notificationHistory.length>0&&<Button label="Previous" variant="plain" onPress={()=>{const previous=[...notificationHistory];setNotificationCursor(previous.pop()??'');setNotificationHistory(previous)}}/>}{notificationNextCursor&&<Button label="Next" variant="secondary" onPress={()=>{setNotificationHistory(previous=>[...previous,notificationCursor]);setNotificationCursor(notificationNextCursor)}}/>}</View></View><Copy center size={12} color={theme.muted}>Page {notificationHistory.length+1}</Copy></View>:<Empty title="You’re all caught up" detail="New activity will appear here."/>,
  }
  let sheet:React.ReactNode
  if(overlay?.kind==='connections'){
    sheet=<ConnectionList key={overlay.person.id+':'+overlay.list} base={base} token={token} profile={overlay.person} list={overlay.list} samples={demo?demoConnections(overlay.person.id,overlay.list):undefined} onProfile={showProfile}/>
  }else if(overlay?.kind==='post'){
    const post=posts.find(item=>item.id===overlay.post.id)??overlay.post
    const ownVerified=verifiedBenefits&&post.author.id===user.id
    sheet=<><PostCard detail post={post} onReact={react} onOverlay={selectOverlay} onProfile={showProfile}/><Button label="Read comments" variant="secondary" onPress={()=>selectOverlay({kind:'comments',post})}/>{ownVerified&&<View style={{...row,flexWrap:'wrap'}}>{(demo||withinEditWindow(post.time))&&<Button label="Edit post" variant="secondary" onPress={()=>{setComment(post.body);selectOverlay({kind:'editPost',post})}}/>}<Button label="Delete post" variant="danger" onPress={()=>void deletePost(post)}/></View>}</>
  }else if(overlay?.kind==='editPost'){
    sheet=<><Field label="Edit post" value={comment} onChangeText={setComment} multiline maxLength={1200} style={{minHeight:106,textAlignVertical:'top'}}/><Copy size={12} color={theme.muted}>Verified posts can be edited for one hour after publishing.</Copy><Button label={busy?'Saving…':'Save changes'} disabled={busy||!comment.trim()} onPress={()=>void editPost(overlay.post)}/></>
  }else if(overlay?.kind==='editMessage'){
    sheet=<><Field label="Edit message" value={comment} onChangeText={setComment} multiline maxLength={800}/><Copy size={12} color={theme.muted}>Verified messages can be edited for one hour after sending.</Copy><Button label={busy?'Saving…':'Save changes'} disabled={busy||!comment.trim()} onPress={()=>void editMessage(overlay.message)}/></>
  }else if(overlay?.kind==='comments'){
    const list=notes[overlay.post.id]??(demo&&overlay.post.id==='quadratics'?initialComments:[])
    sheet=<Comments key={overlay.post.id} list={list} body={comment} onBody={value=>{commentDraft.current++;setComment(value)}} busy={busy} renderGif={props.renderGif}
      replyTo={replyTarget} highlightId={overlay.targetId} onReply={item=>{commentDraft.current++;setReplyTarget(item)}} onCancelReply={()=>{commentDraft.current++;setReplyTarget(null)}} onLike={item=>void likeComment(overlay.post.id,item)}
      attachment={commentMedia&&'uri' in commentMedia?{kind:'image',url:commentMedia.uri}:commentMedia??undefined}
      onPreset={value=>{commentDraft.current+=1;setCommentMedia(value)}} onRemove={()=>{commentDraft.current+=1;setCommentMedia(null)}}
      onPhoto={props.pickCommentMedia||props.pickMedia?()=>void pickCommentPhoto():undefined} onPost={()=>void addComment(overlay.post)}
      onProfile={showProfile}/>
  }else if(overlay?.kind==='editProfile'){
    sheet=<><Field label="Real name" value={profileNameDraft} onChangeText={setProfileNameDraft} maxLength={120} autoCapitalize="words"/>
      <Field label="Bio" value={bioDraft} onChangeText={value=>setBioDraft(Array.from(value).slice(0,50).join(''))} multiline/>
      <Copy color={theme.muted} size={12}>{Array.from(bioDraft).length}/50</Copy>
      {!demo&&user.username&&<SearchVisibility label="Show profile in web search" detail="Search engines can show your username, bio and profile picture." value={profileSearchPublic} onChange={setProfileSearchPublic} disabled={busy}/>}
      <Button label={busy?'Saving…':'Save profile'} onPress={()=>void saveProfile()} disabled={busy||!profileNameDraft.trim()}/></>
  }else if(overlay?.kind==='editUsername'){
    const next=user.usernameNextChangeAt?Date.parse(user.usernameNextChangeAt):0
    const waiting=next>Date.now()
    sheet=<><Field label="Username" value={usernameDraft} onChangeText={value=>setUsernameDraft(normalizeUsername(value))} maxLength={24} autoCapitalize="none" autoCorrect={false}/>
      <Copy color={theme.muted} size={12}>{waiting?'You can change it again on '+new Date(next).toLocaleDateString()+'.':'You can change your username once every 3 days.'}</Copy>
      <Button label={busy?'Saving…':'Save username'} onPress={()=>void saveUsername()} disabled={busy||waiting||!validUsername(usernameDraft)||usernameDraft===user.username}/></>
  }else if(overlay?.kind==='photo'){
    const url=overlay.photo==='avatar'?overlay.person.avatar:overlay.person.cover
    sheet=<View style={{alignItems:'center',gap:18}}>{url?<Image accessibilityLabel={overlay.photo==='avatar'?'Profile picture':'Cover photo'} source={{uri:url}} resizeMode="contain" style={{width:'100%',height:Math.min(460,width*1.15)}}/>:overlay.photo==='avatar'?<Avatar person={overlay.person} size={160}/>:<View style={{backgroundColor:'#4F25D6',width:'100%',height:190}}/>}
      <Copy weight={800}>{displayHandle(overlay.person)}</Copy></View>
  }else if(overlay?.kind==='create'){
    sheet=<><View style={row}><Avatar person={user}/><PersonName person={user}/></View><Field label="What’s happening?" value={draft} onChangeText={setDraft} multiline maxLength={1200} style={{minHeight:106,textAlignVertical:'top'}}/>
      {attachment&&<View style={spread}><Copy size={12}>{attachment.name}</Copy><IconButton name="close" label="Remove image" onPress={()=>setAttachment(null)}/></View>}
      {props.pickMedia&&<Button label="Add image or video" leading="image" variant="secondary" onPress={()=>{void props.pickMedia?.().then(value=>{if(!value)return;if(value.kind==='video'&&(!value.duration||value.duration>videoLimit+.25)){fail(new Error('Videos can be up to '+videoLimit+' seconds.'));return}setAttachment(value)}).catch(fail)}}/>}
      {!demo&&<SearchVisibility label="Show post in web search" detail="Search engines can show this post and its media to anyone." value={postSearchPublic} onChange={setPostSearchPublic} disabled={busy}/>}
      <Button label={busy?'Posting…':'Publish post'} onPress={()=>void createPost()} disabled={busy||(!draft.trim()&&!attachment)}/></>
  }else if(overlay?.kind==='newStory'){
    const valid=storyMode==='Text'?!!comment.trim():storyMode==='Photo'?!!storyImage:storyMedia?.kind==='video'
    sheet=<>
      <Segmented options={['Text','Photo','Video']} selected={storyMode} onSelect={setStoryMode}/>
      {storyMode==='Text'&&<Motion key={storyBackground} reduced={reduced} distance={4} style={{gap:8}}><Copy size={12} weight={800}>Background colour</Copy><View style={{...row,gap:10,flexWrap:'wrap'}}>{['#4F25D6','#120D1F','#E9E0FF','#C8F53F','#F0447A','#FF6B6B','#FF9F43','#00B8A9','#5B8CFF','#B05CFF'].map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={'Use '+color+' background'} onPress={()=>setStoryBackground(color)} style={{width:38,height:38,borderRadius:19,backgroundColor:color,borderWidth:storyBackground===color?3:1,borderColor:storyBackground===color?'#fff':theme.border}}/>)}</View></Motion>}
      {storyMode==='Photo'&&<>{storyImage&&<Image source={{uri:storyImage}} style={{width:'100%',height:140,borderRadius:12}}/>}{props.pickMedia&&<Button label={storyImage?'Replace photo':'Choose photo'} leading="image" variant="secondary" onPress={()=>{void props.pickMedia?.().then(value=>{if(value&&value.kind!=='video'){setStoryImage(value.uri);setStoryMedia(value)}}).catch(fail)}}/>}</>}
      {storyMode==='Video'&&<>{storyMedia?.kind==='video'&&<Card><IconTile name="vid"/><Copy weight={800}>Video ready · {videoLimit} seconds maximum</Copy></Card>}{props.pickMedia&&<Button label={storyMedia?.kind==='video'?'Replace video':'Choose video'} leading="vid" variant="secondary" onPress={()=>{void props.pickMedia?.().then(value=>{if(!value||value.kind!=='video')return;if(!value.duration||value.duration>videoLimit+.25){fail(new Error('Story videos can be up to '+videoLimit+' seconds.'));return}setStoryImage(undefined);setStoryMedia(value)}).catch(fail)}}/>}</>}
      <Field label={storyMode==='Text'?'What’s your story?':'Caption'} value={comment} onChangeText={setComment} multiline maxLength={240}/>
      <Copy size={12} color={theme.muted}>{verifiedBenefits?'Verified accounts can keep up to '+verifiedStoryLimit+' stories live for 18 hours.':'Stories disappear 12 hours after you share them.'}</Copy>
      <Button label={busy?'Sharing…':'Share story'} disabled={!valid||busy} onPress={()=>{if(!demo){void shareStory();return}setOwnStory({text:comment.trim(),image:storyMode==='Photo'?storyImage:undefined,videoPreview:storyMode==='Video',posted:Date.now(),background:storyMode==='Text'?storyBackground:undefined});modalClose();notify('Story shared in the preview. It disappears after '+(verifiedBenefits?18:12)+' hours.')}}/>
    </>
  }else if(overlay?.kind==='share'){
    const post=posts.find(item=>item.id===overlay.post.id)??overlay.post
    sheet=<>
      <Card style={{gap:12}}>
        <View style={row}><Avatar person={post.author} size={42}/><View><PersonName person={post.author}/><Copy color={theme.muted} size={12}>Post on dameen</Copy></View></View>
        <Copy>{post.body||'Shared a post'}</Copy>
        {post.media&&post.kind==='image'&&<Image source={{uri:post.media}} resizeMode="cover" style={{width:'100%',height:180,borderRadius:14}}/>}
      </Card>
      {!demo&&post.author.id===user.id&&<SearchVisibility label="Show post in web search" detail="Search engines can show this post and its media to anyone." value={Boolean(post.searchPublic)} onChange={value=>void updatePostSearchVisibility(post,value)} disabled={busy}/>}
      {verifiedBenefits&&post.author.id===user.id&&<View style={{...row,flexWrap:'wrap'}}>{(demo||withinEditWindow(post.time))&&<Button label="Edit post" variant="secondary" onPress={()=>{setComment(post.body);selectOverlay({kind:'editPost',post})}}/>}<Button label="Delete post" variant="danger" onPress={()=>void deletePost(post)}/></View>}
      {canShare&&<Button label="Share post link" disabled={busy} onPress={()=>{void props.share?.(sharedLink('post',post.id)).then(()=>{modalClose();notify('Post link ready to share')}).catch(fail)}}/>}
    </>
  }else if(overlay?.kind==='wish'){
    sheet=<><Avatar person={people[2]} size={65}/><Field label="Write a birthday wish" value={comment} onChangeText={setComment} maxLength={300}/><Button label="Send wish" disabled={!comment.trim()} variant="fun" onPress={()=>{setWishes(previous=>[...previous,comment.trim()]);modalClose();notify('Birthday wish sent in the preview')}}/></>
  }else if(overlay?.kind==='call'&&overlay.ringing){
    const call=overlay
    sheet=<Card><PersonName person={call.person}/><Copy>Simulated voice call</Copy><Button label={call.incoming?'Accept preview call':'Connect preview call'} onPress={()=>setOverlay({...call,ringing:false})}/><Button label={call.incoming?'Decline call':'Cancel call'} variant="secondary" onPress={modalClose}/></Card>
  }else if(overlay?.kind==='call')sheet=<CallPreview video={overlay.video} person={overlay.person} onClose={modalClose}/>
  const ModalViewport=props.modalViewport??DefaultModalViewport
  const overlayTitle=overlay?.kind==='connections'?(overlay.list==='followers'?'Followers':'Following')
    :overlay?.kind==='call'?(overlay.ringing?'Ringing':overlay.video?'Video call':'Voice call')
    :overlay?.kind==='photo'?overlay.photo==='avatar'?'Profile picture':'Cover photo'
    :overlay&&overlay.kind!=='story'?{editProfile:'Edit profile',editUsername:'Change username',editPost:'Edit post',editMessage:'Edit message',comments:'Comments',share:'Share post',post:'Post detail',create:'Create post',wish:'Happy birthday, Zee!',newStory:'Create story'}[overlay.kind]:''
  const story=overlay?.kind==='story'?(demoAccounts.find(account=>account.person.id===overlay.person.id)?.person??overlay.person):null
  const liveGroup=story&&!demo?activeStories.find(group=>group.author.id===story.id):undefined
  const activeIndex=liveGroup?Math.min(storyIndex,liveGroup.stories.length-1):0
  const liveItem=liveGroup?.stories[activeIndex]
  const personalStory:{text:string;image?:string;video?:string;videoPreview?:boolean;background?:string}|null=demo?(story?.id===user.id?demoOwn:null):liveItem?{text:liveItem.text,image:liveItem.image,video:liveItem.video,background:liveItem.background}:null
  const storyPosted=demo?(story?.id===user.id?demoOwn?.posted:story?demoPosted[story.id]:undefined):liveItem?Date.parse(liveItem.created):undefined
  const storyExpires=liveItem?Date.parse(liveItem.expires):storyPosted!==undefined?storyPosted+(story?.verified?verifiedStoryLifetime:storyLifetime):undefined
  const storyText=demo?personalStory?.text??(story?.id==='ada'?'Study session after school. Bring your notes!':story?.id==='bello'?'Maths test is on Friday. Revise quadratics!':story?.id==='code'?'Code Club meets on Friday!':'See you at quiz night!'):liveItem?.text??''
  return <Design.Provider value={{theme,font,reduced,renderIcon:props.renderIcon}}><View style={{flex:1,backgroundColor:theme.bg,width:'100%'}}>
    {starting||stage==='restore'?<LoadingScreen/>:stage==='intro'?<Intro desktop={desktop} step={step} reduced={reduced} showPublicBrand={Platform.OS==='web'&&!demo} onSkip={()=>setStage('auth')} onNext={()=>step===2?setStage('auth'):setStep(step+1)} onBack={()=>setStep(step-1)}/>:stage==='auth'?<Auth base={base} demo={demo} busy={busy} error={error} submit={authenticate} onGoogle={(mode,username,dob)=>void authenticateWithGoogle(mode,username,dob)} onCancelGoogle={()=>googleRequest.current?.abort()} googlePending={googlePending} onDemo={()=>{setDemoEntered(true);setPosts(initialPosts);setChats(initialChats);setRooms(localRooms);setUnread(true);setUser(me);setPage('Home');setStage('app')}} reduced={reduced} recovering={recovering} setRecovering={setRecovering}/>:
      <View style={{flex:1,flexDirection:'row',width:'100%',maxWidth:1360,alignSelf:'center'}}>
        {desktop&&page!=='Chat'&&page!=='Messages'&&<View style={{width:222,borderRightWidth:1,borderColor:theme.border,padding:18,gap:5,backgroundColor:theme.card}}>
          <View style={{minHeight:64,justifyContent:'center',marginBottom:14}}><Logo size={40}/></View>
          {tabs.map(([name,glyph])=>navButton(name,glyph))}
          <View style={{height:1,backgroundColor:theme.border,marginVertical:9,marginHorizontal:8}}/>
          {navButton('Messages','msg')}{navButton('Notifications','bell')}
          <View style={{marginTop:10}}><Button label="Create post" leading="plus" onPress={compose}/></View>
          <View style={{flex:1}}/>
          <Pressable accessibilityRole="button" accessibilityLabel="Your profile" style={{...row,backgroundColor:theme.bg,borderRadius:14,padding:9}} onPress={()=>showProfile(user)}>
            <Avatar person={user} size={35}/><View style={{flex:1}}><PersonName person={user}/></View>
          </Pressable>
        </View>}
        <View style={{flex:1,minWidth:0,maxWidth:rail&&page!=='Chat'&&page!=='Messages'?680:undefined}}>
          <View style={{...spread,paddingHorizontal:16,minHeight:desktop?72:62,borderBottomWidth:1,borderColor:theme.border,backgroundColor:theme.card}}>
            {page==='Messages'?<><View style={{...row,flex:1}}><IconButton name="back" label="Go back" onPress={()=>navigationDepth>0?goBack():open('Home')}/><Copy weight={800} size={desktop?28:21}>Messages</Copy></View></>:page==='Chat'&&room?<>
              <View style={{...row,flex:1,minWidth:0,gap:5}}>
                <IconButton name="back" label="Go back" onPress={goBack}/>
                <Pressable accessibilityRole="button" accessibilityLabel={'Open '+displayHandle(room.person)+' profile'} onPress={()=>showProfile(room.person)} style={{...row,flex:1,minWidth:0}}>
                  <Avatar person={room.person} size={39}/>
                  <View style={{flex:1,minWidth:0}}><PersonName person={room.person}/><Copy color={theme.muted} size={11}>{demo?'Active now':presenceById[room.person.id]?.online?'Online':presenceById[room.person.id]?.lastSeen?'Last seen '+shortTime(presenceById[room.person.id]!.lastSeen!):'Away'}</Copy></View>
                </Pressable>
              </View>
              <View style={{...row,gap:0}}>
                <IconButton name="ph" label="Voice call" onPress={()=>demo?selectOverlay({kind:'call',video:false,person:room.person}):callMedia?roomCall.start(false):notify('Calls need an installed app build or a supported browser.','error')}/>
                <IconButton name="vid" label="Video call" onPress={()=>demo?selectOverlay({kind:'call',video:true,person:room.person}):callMedia?roomCall.start(true):notify('Calls need an installed app build or a supported browser.','error')}/>
              </View>
            </>:<>
            <View style={{...row,flex:1}}>
              {!desktop&&page==='Home'?<Logo size={40}/>:!tabs.some(([name])=>name===page)&&<IconButton name="back" label="Go back" onPress={goBack}/>}
              {(desktop||page!=='Home')&&<Copy weight={800} size={desktop?28:21}>{page==='Quiz'?'Quiz Duel':page==='Chat'?'Chat':page}</Copy>}
            </View>
            <View style={{...row,gap:0}}>
              <IconButton name={themeName==='dark'?'sun':'moon'} label="Toggle light or dark mode" onPress={()=>setAppearance(themeName==='light'?'dark':'light')}/>
              {!desktop&&<><View><IconButton name="bell" label="Notifications" onPress={()=>open('Notifications')}/>{unread&&<View pointerEvents="none" style={{position:'absolute',right:8,top:7,width:7,height:7,borderRadius:5,backgroundColor:theme.purple}}/>}</View><IconButton name="msg" label="Messages" onPress={()=>open('Messages')}/><Pressable accessibilityRole="button" accessibilityLabel="Your profile" style={{width:44,height:44,alignItems:'center',justifyContent:'center'}} onPress={()=>showProfile(user)}><Avatar person={user} size={31}/></Pressable></>}
            </View>
            </>}
          </View>
          {Platform.OS==='web'&&refreshing&&<RefreshIndicator reduced={reduced} color={theme.purple}/>}
          <ScrollView key={page==='Chat'?'chat:'+room?.id:page==='Profile'?'profile:'+profile.id:page} ref={scroll} testID="main-scroll" style={{flex:1}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            refreshControl={Platform.OS==='web'?undefined:<RefreshControl refreshing={refreshing} onRefresh={()=>void refreshPage()} tintColor={theme.purple} colors={[theme.purple]}/>}
            onTouchStart={event=>{
              if(Platform.OS!=='web'||pageScroll.current>2)return
              const touch=event.nativeEvent.touches[0]
              if(touch)pullStart.current={x:touch.pageX,y:touch.pageY}
            }}
            onTouchEnd={event=>{
              const origin=pullStart.current
              pullStart.current=null
              const touch=event.nativeEvent.changedTouches[0]
              if(Platform.OS==='web'&&origin&&touch&&pageScroll.current<2&&touch.pageY-origin.y>75&&Math.abs(touch.pageX-origin.x)<60)void refreshPage()
            }}
            scrollEventThrottle={64} onScroll={({nativeEvent})=>{
              const {contentOffset,contentSize,layoutMeasurement}=nativeEvent
              if(!pendingOffset.current){
                pageScroll.current=Math.max(0,contentOffset.y)
                if(tabs.some(([tab])=>tab===page))scrollOffsets.current[page]=pageScroll.current
              }
              if(page==='Chat'&&!initialChatScroll.current)stickToChatEnd.current=contentSize.height-layoutMeasurement.height-contentOffset.y<80
            }} onContentSizeChange={()=>{
              if(page==='Chat'&&stickToChatEnd.current){
                scroll.current?.scrollToEnd({animated:!initialChatScroll.current&&!reduced})
                if(room&&(chats[room.id]?.length??0)>0)initialChatScroll.current=false
              }else restorePageScroll()
            }}
            contentContainerStyle={{padding:desktop?20:13,gap:page==='Chat'?9:16,width:'100%',maxWidth:page==='Chat'?desktop?900:undefined:640,alignSelf:'center'}}>
            <Motion key={page==='Chat'?'chat:'+room?.id:page} reduced={reduced} distance={page==='Chat'?5:8} style={stack}>{content[page]??<Suspense fallback={<LoadingScreen compact/>}><FeatureScreen key={page} page={page as ExtraPage} open={open} demo={demo} user={user} startQuiz={startQuiz} completed={completedLessons.length>0} wish={()=>selectOverlay({kind:'wish'})} wishes={wishes} incomingCall={()=>selectOverlay({kind:'call',video:false,person:people[0],ringing:true,incoming:true})}/></Suspense>}</Motion></ScrollView>
          {page==='Chat'&&<KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}>
            <View style={{...row,paddingHorizontal:12,paddingVertical:9,borderTopWidth:1,borderColor:theme.border,backgroundColor:theme.card}}>
              <View style={{flex:1,minWidth:0,borderRadius:23,backgroundColor:theme.chip,borderWidth:1,borderColor:theme.border}}>
                <TextInput accessibilityLabel="Message" placeholder="Message" placeholderTextColor={theme.muted} value={message} onChangeText={setMessage} multiline maxLength={800} style={[{color:theme.text,fontSize:15,minHeight:44,maxHeight:120,paddingHorizontal:15,paddingVertical:10,textAlignVertical:'center'},font(500)]}/>
              </View>
              <View style={{opacity:busy||!message.trim()?.5:1}}><IconButton name="send" label="Send" solid onPress={()=>void send()}/></View>
            </View>
          </KeyboardAvoidingView>}
          {!desktop&&page!=='Chat'&&page!=='Messages'&&<View style={{...row,gap:0,justifyContent:'space-around',minHeight:64,paddingHorizontal:6,borderTopWidth:1,borderColor:theme.border,backgroundColor:theme.card}}>{tabs.slice(0,2).map(([name,glyph])=>navButton(name,glyph))}<View style={{width:61,alignItems:'center',marginTop:-13}}><IconButton name="plus" label="Create post" size={26} solid onPress={compose}/></View>{tabs.slice(2).map(([name,glyph])=>navButton(name,glyph))}</View>}
        </View>
        {rail&&page!=='Chat'&&page!=='Messages'&&<ScrollView style={{flex:1,maxWidth:324,borderLeftWidth:1,borderColor:theme.border}} contentContainerStyle={{padding:17,paddingTop:20,gap:15}}>
          <FeatureCard glyph="bolt" title="Daily challenge" description={featuredLesson.title} action="Start lesson" onPress={()=>openLesson(featuredLesson.id)} compact/>
          {demo&&<>
            <Card>
              <View style={row}><IconTile name="grp"/>{section('Study room')}</View>
              <View style={row}><Avatar person={people[5]} size={34}/><View style={{flex:1}}><Copy weight={800}>SS2 Maths Club</Copy><Copy color={theme.muted} size={12}>Study together after school</Copy></View></View>
              <Button label="Open group chat" variant="secondary" onPress={()=>openRoom({id:'maths',person:people[5]})}/>
            </Card>
            <Card>
              {section('People to follow')}
              {people.slice(0,3).map(person=><Pressable key={person.id} accessibilityRole="button" onPress={()=>showProfile(person)} style={{...row,minHeight:44}}>
                <Avatar person={person} size={33}/><View style={{flex:1}}><PersonName person={person}/></View>
              </Pressable>)}
            </Card>
          </>}
        </ScrollView>}
      </View>}
    {toast&&!overlay&&<Toast key={toast.id} item={toast} reduced={reduced} onDismiss={dismissToast} bottom={desktop?24:76}/>}
    <Modal presentationStyle="fullScreen" visible={overlay!==null} animationType={reduced?'none':'fade'} onRequestClose={modalClose}>
      <ModalViewport color={story?(personalStory?.background??(personalStory?.image?'#120D1F':'#4F25D6')):theme.bg}>
      {overlay?.kind==='call'&&!overlay.ringing?<CallPreview video={overlay.video} person={overlay.person} onClose={modalClose}/>:story?<View accessibilityViewIsModal style={{flex:1,backgroundColor:personalStory?.background??(personalStory?.image?'#120D1F':'#4F25D6'),padding:18}}>
        <View style={{width:'100%',maxWidth:640,alignSelf:'center',flex:1,gap:14}}>
          <View accessibilityLabel={`Story ${activeIndex+1} of ${liveGroup?.stories.length??1}`} style={{...row,gap:7}}><View style={{...row,flex:1,gap:4}}>{Array.from({length:liveGroup?.stories.length??1},(_,index)=><View key={index} style={{flex:1,height:3,borderRadius:3,backgroundColor:index<=activeIndex?lime:'rgba(255,255,255,.35)'}}/>)}</View><Copy color="#fff" size={11} weight={800}>{activeIndex+1}/{liveGroup?.stories.length??1}</Copy></View>
          <View style={spread}>
            <View style={{...row,flex:1}}><Avatar person={story} size={40}/><View style={{flex:1,gap:2}}>
              <View style={{...row,gap:5}}><Copy color="#fff" weight={800}>{displayHandle(story)}</Copy><VerifiedBadge person={story}/></View>
              {storyExpires!==undefined&&<Copy color="#fff" size={11}>{storyLeft(storyExpires-clock)} · {story?.verified?'18-hour verified story':'12-hour story'}</Copy>}
            </View></View>
            <IconButton name="close" label="Close story" tint="#fff" onPress={modalClose}/>
          </View>
          <View {...storySwipe.panHandlers} style={{flex:1,minHeight:0,justifyContent:'center',gap:16,paddingBottom:16}}>
            {personalStory?.image&&<Motion key={story.id+':'+activeIndex} reduced={reduced} axis="x" distance={10} style={{flex:1,minHeight:0}}><LazyImage uri={personalStory.image} alt="Story photo" style={{width:'100%',height:'100%',objectFit:'contain'}}/></Motion>}
            {(personalStory?.video||personalStory?.videoPreview)&&(Platform.OS==='web'&&personalStory?.video?React.createElement('video',{src:personalStory.video,controls:true,autoPlay:true,playsInline:true,style:{width:'100%',maxHeight:'70%',borderRadius:16,backgroundColor:'#000'}}):<View style={{...stack,alignItems:'center'}}><IconTile name="play" size={52} color={lime} background="#FFFFFF19"/><Copy color="#fff" weight={800}>VIDEO · 0:{story?.verified?'20':'10'} MAX</Copy></View>)}
            {!!storyText&&<Motion key={'caption:'+story.id+':'+activeIndex} reduced={reduced} axis="x" distance={10}><Copy center color="#fff" weight={800} size={personalStory?.image?18:28}>{storyText}</Copy></Motion>}
            <View pointerEvents="box-none" style={{position:'absolute',inset:0,flexDirection:'row',justifyContent:'space-between'}}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous story" onPress={()=>moveStory(-1)} style={{width:'25%',height:'100%'}}/>
              <Pressable accessibilityRole="button" accessibilityLabel="Next story" onPress={()=>moveStory(1)} style={{width:'25%',height:'100%'}}/>
            </View>
          </View>
          {!demo&&story.id!==user.id&&liveItem&&<View style={{gap:9}}>
            <View style={{...row,alignItems:'flex-end'}}>
              <View style={{flex:1}}><Field label={'Reply to '+displayHandle(story)} placeholder="Send a story reply" value={storyReplyDraft} onChangeText={setStoryReplyDraft} maxLength={500} onSubmitEditing={()=>void replyToStory(story,liveItem)}/></View>
              <Button label={storyReplyBusy?'Sending…':'Send'} disabled={storyReplyBusy||!storyReplyDraft.trim()} onPress={()=>void replyToStory(story,liveItem)}/>
            </View>
            <Button label={liveItem.liked?'Liked · '+(liveItem.likes??0):'Like story · '+(liveItem.likes??0)} variant="secondary" onPress={()=>void likeStory(story,liveItem)}/>
          </View>}
          {!demo&&story.id===user.id&&!!liveItem&&<View style={{...row,justifyContent:'center'}}>
            <Button label="Add story" variant="secondary" disabled={busy} onPress={()=>selectOverlay({kind:'newStory'})}/>
            <Button label="Delete story" variant="danger" disabled={busy} onPress={()=>void deleteStory(liveItem.id)}/>
          </View>}
        </View>
      </View>:<View accessibilityViewIsModal style={{flex:1,backgroundColor:theme.bg}}>
        <View style={{backgroundColor:theme.card,borderBottomWidth:1,borderColor:theme.border}}>
          <View style={{...row,width:'100%',maxWidth:720,alignSelf:'center',minHeight:60,paddingHorizontal:16}}>
            <IconButton name={overlayHistory.current.length?'back':'close'} label={overlayHistory.current.length?'Back':'Close'} onPress={modalClose}/>
            <Copy size={21} weight={800}>{overlayTitle}</Copy>
          </View>
        </View>
        {overlay?.kind==='comments'?<KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,width:'100%',maxWidth:720,alignSelf:'center',paddingBottom:commentKeyboardInset}}>
          {sheet}
        </KeyboardAvoidingView>:<ScrollView key={overlay?.kind} style={{flex:1}} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{width:'100%',maxWidth:720,alignSelf:'center',padding:16,paddingBottom:30,gap:14}}>
          {sheet}
        </ScrollView>}
        {toast&&overlay&&<Toast key={toast.id} item={toast} reduced={reduced} onDismiss={dismissToast} bottom={18}/>}
      </View>}
      </ModalViewport>
    </Modal>
    <Modal presentationStyle="fullScreen" visible={Boolean(!demo&&page==='Chat'&&room&&roomCall.call&&callMedia)} animationType={reduced?'none':'fade'} onRequestClose={()=>roomCall.end()}>
      <ModalViewport color="#130D25">
        {room&&roomCall.call&&callMedia&&<RoomCall key={roomCall.call.id} person={room.person} media={callMedia} call={roomCall.call} accept={roomCall.accept} end={()=>roomCall.end()} switchCamera={()=>void roomCall.switchCamera()} canSwitchCamera={roomCall.canSwitchCamera}/>} 
      </ModalViewport>
    </Modal>
  </View></Design.Provider>
}

