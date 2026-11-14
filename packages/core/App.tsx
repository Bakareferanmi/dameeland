import {browserCallMedia,RoomCall,useRoomCall,type CallMedia} from './calls'
import {readCallSignal,type CallSignal} from './callSignal'
import React,{lazy,Suspense,useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react'
import {AccessibilityInfo,Animated,BackHandler,Easing,Image,Modal,PanResponder,Platform,Pressable,ScrollView,View,useWindowDimensions,type ViewStyle} from 'react-native'
import {api,capitalizeName,normalizeUsername,usernameHint,validUsername,initialChats,initialComments,initialPosts,initials,lime,me,people,questions,slides,themes,type FollowListKind,type FollowPage,type FollowStats,type Note,type Person,type Post,type Role,type StoryGroup,type Theme} from './index'
import {Avatar,Button,Card,Copy,Design,Field,Icon,IconButton,IconTile,Logo,PersonName,ScreenLinks,Segmented,row,spread,stack,useDesign,type Glyph,type IconRendererProps} from './ui'
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
type Room={id:string;person:Person}
type Session={token:string;user:Viewer}
type AuthMode='signup'|'login'
type Credentials={firstName:string;lastName:string;username:string;email:string;password:string}
type GoogleStart={url:string;state:string;exchange:string}
type GoogleWindow={close:()=>void}
type Media={name:string;uri:string;data:Blob|{uri:string;name:string;type:string}}
type Props={
  demo:boolean; base:string; phone?:boolean; initialTheme:Theme; font:(weight:number)=>object; renderIcon:React.ComponentType<IconRendererProps>;
  loadToken?:()=>Promise<string|null>; saveToken?:(token:string|null)=>Promise<void>;
  openGoogle?:(getUrl:()=>Promise<string>)=>Promise<GoogleWindow>;
  callMedia?:CallMedia;
  modalViewport?:React.ComponentType<{color:string;children:React.ReactNode}>;
  pickMedia?:()=>Promise<Media|null>; renderGif?:GifRenderer; share?:(text:string)=>Promise<void>;
}
type Overlay={kind:'connections';list:FollowListKind;person:Person}|{kind:'comments'|'share'|'post';post:Post}|{kind:'story';person:Person}|{kind:'create'|'wish'|'newStory'}|{kind:'call';video:boolean;person:Person;ringing?:boolean;incoming?:boolean}
type PageEntry={page:Page;profile:Person;room:Room|null;overlays:Overlay[];scrollY:number}
const tabs:[Page,Glyph][]=[['Home','home'],['Learn','book'],['Explore','search'],['Play','game']]
const localRooms=people.filter(p=>p.id in initialChats).map(person=>({id:person.id,person}))
const storyPeople=[people[0],people[4],people[2],people[1]]
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2)
const json=(body:unknown,method='POST')=>({method,body:JSON.stringify(body)})
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Try again.'
const demoUsernameTaken=(username:string)=>people.some(person=>person.id===username)||[...welcomeAccounts.values()].some(account=>account.user.username===username)
const welcomeAccounts=new Map<string,{user:Person;password:string}>()
const shortTime=(value:string)=>{
  if(!value.includes('T')) return value
  const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000))
  return minutes<1?'Just now':minutes<60?minutes+'m':minutes<1440?Math.floor(minutes/60)+'h':Math.floor(minutes/1440)+'d'
}
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
function DefaultModalViewport({color,children}:{color:string;children:React.ReactNode}){
  return <View style={{flex:1,backgroundColor:color}}>{children}</View>
}

function Intro({step,onNext,onBack,onSkip,reduced,desktop}:{step:number;onNext:()=>void;onBack:()=>void;onSkip:()=>void;reduced:boolean;desktop:boolean}){
  const slide=slides[step]
  const illustration:Glyph=(['book','grp','trophy'] as const)[step]
  return <ScrollView style={{backgroundColor:'#4F25D6'}} contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:desktop?48:14}}>
    <View style={{alignSelf:'center',width:'100%',maxWidth:1056,minHeight:desktop?610:676,padding:desktop?38:18,overflow:'hidden',justifyContent:'space-between'}}>
      <View style={spread}>
        <Logo variant="inverse" size={desktop?48:40}/>
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
          <Copy color="#E9DFFF" size={desktop?18:15}>{slide.description}</Copy>
        </View>
      </Motion>
      <View style={{width:'100%',maxWidth:desktop?380:undefined,gap:6,paddingTop:18}}>
        <Button label={step===2?'Get started':'Continue'} variant="fun" onPress={onNext}/>
        {step>0&&<Pressable accessibilityRole="button" onPress={onBack} style={{...row,justifyContent:'center',minHeight:44}}><Icon name="back" color="#fff" size={17}/><Copy color="#fff" weight={800}>Back</Copy></Pressable>}
      </View>
    </View>
  </ScrollView>
}
function Auth({base,demo,busy,error,submit,onGoogle,onCancelGoogle,googlePending,onDemo,reduced}:{base:string;demo:boolean;busy:boolean;error:string;submit:(mode:'signup'|'login',values:Credentials)=>void;onGoogle:(mode:AuthMode,username:string)=>void;onCancelGoogle:()=>void;googlePending:boolean;onDemo:()=>void;reduced:boolean}){
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
  const [show,setShow]=useState(false)
  const [recovering,setRecovering]=useState(false)
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
      <Field label={mode==='signup'?'Email':'Email or username'} placeholder={mode==='signup'?'you@example.com':'Email address or @username'} value={email} onChangeText={setEmail} keyboardType={mode==='signup'?'email-address':'default'} autoCapitalize="none" autoCorrect={false} autoComplete={mode==='signup'?'email':'username'} maxLength={254}/>
      <Field label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" maxLength={128} action={show?'eyeOff':'eye'} actionLabel={show?'Hide password':'Show password'} onAction={()=>setShow(!show)}/>
      {!!error&&<View accessibilityRole="alert"><Copy color={theme.ink}>{error}</Copy></View>}
      <Button label={busy?'Please wait…':mode==='signup'?'Create account':'Log in to dameeland'} disabled={busy||mode==='signup'&&usernameStatus==='taken'} onPress={()=>submit(mode,{firstName,lastName,username:handle,email,password})}/>
      {mode==='login'&&<Button label="Forgot password or username?" variant="plain" disabled={busy} onPress={()=>setRecovering(true)}/>}
      <GoogleButton signup={mode==='signup'} disabled={busy||mode==='signup'&&usernameStatus==='taken'} onPress={()=>onGoogle(mode,handle)}/>
      {googlePending&&<Button label="Cancel Google sign-in" variant="plain" onPress={onCancelGoogle}/>}
      {demo&&<><Button label="Explore demo" variant="secondary" onPress={onDemo}/><Copy color={theme.muted} center size={12}>Preview accounts reset when you reload.</Copy></>}
      </>}
    </Motion>
  </ScrollView>
}
function StoryRow({onStory,onCreate,seen,own,others}:{onStory:(p:Person)=>void;onCreate:()=>void;seen:Set<string>;own:Person|null;others:Person[]}){
  const {theme}=useDesign()
  return <ScrollView horizontal directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{...row,gap:10,paddingVertical:1}}>
    <Pressable accessibilityRole="button" accessibilityLabel="Your story" onPress={onCreate} style={{width:52,alignItems:'center',gap:7}}>
      {own?<Avatar person={own} size={44} ring seen={seen.has(own.id)}/>:<View style={{width:52,height:52,borderRadius:26,borderWidth:1,borderStyle:'dashed',borderColor:theme.purple,backgroundColor:theme.chip,alignItems:'center',justifyContent:'center'}}><Icon name="plus" color={theme.ink}/></View>}
      <Copy size={10} weight={800}>Your story</Copy>
    </Pressable>
    {others.map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={person.name+' story'} onPress={()=>onStory(person)} style={{width:52,alignItems:'center',gap:7}}>
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
      <IconTile name={maths?'maths':'play'} size={34} color={accent} background={maths?'#FFFFFFBA':'#FFFFFF19'}/>
      <Copy color={accent} size={11} weight={800}>{maths?'MATHS NOTES':'VIDEO PREVIEW · 0:40'}</Copy>
    </View>
    <View style={{gap:5}}>
      <Copy color={ink} weight={800} size={25}>{maths?'Quadratic equations':'Build a weather app'}</Copy>
      <Copy color={maths?'#4F25D6':'#DED0FF'} size={12}>{maths?'Factorise · Complete the square · Check':'Code Club'}</Copy>
    </View>
  </View>
}

function PostCard({post,onReact,onOverlay,onProfile,detail=false}:{post:Post;detail?:boolean;onReact:(p:Post,k:'like'|'repost')=>void;onOverlay:(o:Overlay)=>void;onProfile:(p:Person)=>void}){
  const {theme}=useDesign()
  return <Card style={{padding:14,gap:9}}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Open '+post.author.name+' profile'} onPress={()=>onProfile(post.author)} style={row}><Avatar person={post.author} size={40}/><View style={{flex:1}}><PersonName person={post.author}/><Copy color={theme.muted} size={12}>{post.author.detail} · {shortTime(post.time)}</Copy></View></Pressable>
    {!!post.body&&(detail?<Copy size={15}>{post.body}</Copy>:<Pressable accessibilityRole="button" accessibilityLabel="Open post details" onPress={()=>onOverlay({kind:'post',post})} style={{minHeight:32,justifyContent:'center'}}><Copy size={15}>{post.body}</Copy></Pressable>)}
    {post.media?<Image accessibilityLabel="Post attachment" source={{uri:post.media}} resizeMode="cover" style={{width:'100%',height:195,borderRadius:14,backgroundColor:theme.chip}}/>:post.kind&&<PreviewMedia kind={post.kind}/>}
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
    {entries.map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={'View '+person.name+' profile'} onPress={()=>onProfile(person)} style={{...row,minHeight:52}}>
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
  return <Card style={{padding:22}}><Copy weight={800} size={19}>{title}</Copy><Copy color={theme.muted}>{detail}</Copy>{action&&onPress&&<Button label={action} variant="secondary" onPress={onPress}/>}</Card>
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
  return <View style={{backgroundColor:'#120D1F',borderRadius:24,padding:24,alignItems:'center',gap:18}}><Copy color="#C9B8FF" weight={800}>{video?'Video call preview':'Voice call preview'}</Copy><Avatar person={person} size={90} ring/><Copy color="#fff" size={24} weight={800}>{person.name}</Copy><Copy color="#C9B8FF">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · Simulated call</Copy><View style={row}><Button label={muted?'Unmute':'Mute'} onPress={()=>setMuted(!muted)} variant="secondary"/><Button label="End call" onPress={onClose} variant="danger"/></View></View>
}
export default function App(props:Props){
  const {demo,base,font,phone}=props
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
  const [user,setUser]=useState<Viewer>(me),[token,setToken]=useState('')
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
  const [ownStory,setOwnStory]=useState<{text:string;image?:string;videoPreview?:boolean}|null>(null)
  const [storyMode,setStoryMode]=useState('Text')
  const [storyImage,setStoryImage]=useState<string>()
  const [storyMedia,setStoryMedia]=useState<Media|null>(null)
  const [liveStories,setLiveStories]=useState<StoryGroup[]>([])
  const [storyIndex,setStoryIndex]=useState(0)
  const [storyRefresh,setStoryRefresh]=useState(0)
  const [clock,setClock]=useState(()=>Date.now())
  const [wishes,setWishes]=useState<string[]>([])
  const [lessonComplete,setLessonComplete]=useState(false)
  const [voicePlaying,setVoicePlaying]=useState(false)
  const [quietMode,setQuietMode]=useState(false)
  const [query,setQuery]=useState(''),[results,setResults]=useState<Person[]>([])
  const [searching,setSearching]=useState(false),[searchError,setSearchError]=useState('')
  const [follows,setFollows]=useState<Record<string,boolean>>({})
  const [rooms,setRooms]=useState<Room[]>(demo?localRooms:[])
  const [room,setRoom]=useState<Room|null>(null)
  const [inboxTab,setInboxTab]=useState('Chats')
  const [profile,setProfile]=useState<Person>(me)
  const [photoBusy,setPhotoBusy]=useState<'avatar'|'cover'|null>(null)
  const photoLock=useRef(false)
  const [profileStats,setProfileStats]=useState<{id:string; data?:FollowStats; error?:boolean}|null>(null)
  const [statsRefresh,refreshStats]=useState(0)
  const [notes,setNotes]=useState<Record<string,Note[]>>({})
  const [chats,setChats]=useState<Record<string,Note[]>>(demo?initialChats:{})
  const [draft,setDraft]=useState(''),[attachment,setAttachment]=useState<Media|null>(null)
  const [message,setMessage]=useState(''),[comment,setComment]=useState('')
  const [commentMedia,setCommentMedia]=useState<Media|Exclude<CommentAttachment,{kind:'image'}>|null>(null)
  const commentDraft=useRef(0)
  const clearComment=()=>{commentDraft.current+=1;setComment('');setCommentMedia(null)}
  const [unread,setUnread]=useState(demo)
  const [notifications,setNotifications]=useState(true)
  const pending=useRef(new Set<string>())
  const scroll=useRef<React.ComponentRef<typeof ScrollView>>(null)
  const scrollOffsets=useRef<Partial<Record<Page,number>>>({})
  const pendingOffset=useRef<{page:Page;y:number}|null>(null)
  const stickToChatEnd=useRef(true)
  const initialChatScroll=useRef(true)
  const replyTimers=useRef<ReturnType<typeof setTimeout>[]>([])
  const demoSession=useRef(0)
  const [retry,setRetry]=useState(0)
  const call=<T,>(path:string,options?:RequestInit)=>api<T>(base,path,options,token)
  const notify=(message:string,tone:ToastMessage['tone']='success')=>setToast({id:uid(),message,tone})
  const dismissToast=(id:string)=>setToast(current=>current?.id===id?null:current)
  const fail=(reason:unknown)=>notify(errorMessage(reason),'error')
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
    if(stage!=='restore')return
    let alive=true
    async function restore(){
      try{
        const stored=await props.loadToken?.()
        if(!stored){if(alive)setStage('intro');return}
        const account=await api<Viewer>(base,'/me',{},stored)
        if(alive){setToken(stored);setUser(account);setStage('app')}
      }catch{if(alive)setStage('intro')}
    }
    void restore()
    return ()=>{alive=false}
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
    let alive=true
    setSearching(true);setSearchError('')
    const timer=setTimeout(()=>{
      api<(Person&{following:boolean})[]>(base,'/people?q='+encodeURIComponent(query),{},token)
        .then(data=>{if(alive){setResults(data);setFollows(previous=>({...previous,...Object.fromEntries(data.map(p=>[p.id,p.following]))}))}})
        .catch(reason=>{if(alive)setSearchError(errorMessage(reason))})
        .finally(()=>{if(alive)setSearching(false)})
    },180)
    return ()=>{alive=false;clearTimeout(timer)}
  },[base,demo,token,query,page,retry])
  useEffect(()=>{
    if(demo||!token||page!=='Messages')return
    let alive=true
    setLoading(true);setFeedError('')
    api<Room[]>(base,'/rooms',{},token).then(data=>{if(alive)setRooms(data)}).catch(reason=>{if(alive)setFeedError(errorMessage(reason))}).finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  },[base,demo,token,page,retry])
  const roomId=room?.id
  const chatSocket=useRef<WebSocket|null>(null)
  const [chatConnected,setChatConnected]=useState(false)
  const webCallMedia=React.useMemo(browserCallMedia,[])
  const callMedia=props.callMedia??webCallMedia
  const sendCall=(signal:CallSignal)=>{
    const socket=chatSocket.current
    if(socket?.readyState!==WebSocket.OPEN)return false
    try{socket.send(JSON.stringify({type:'call',signal}));return true}catch{return false}
  }
  const roomCall=useRoomCall(callMedia,page==='Chat'?roomId:undefined,sendCall,message=>notify(message))
  const receiveCall=useRef(roomCall.receive)
  receiveCall.current=roomCall.receive
  useEffect(()=>{
    if(demo||!token||page!=='Chat'||!roomId)return
    let active=true
    const endpoint=base||((typeof window!=='undefined'&&window.location?.origin)||'')
    const url=endpoint.replace(/^http/,'ws').replace(/\/$/,'')+'/api/rooms/'+roomId+'/socket'
    const refresh=()=>api<Note[]>(base,'/rooms/'+roomId+'/messages',{},token)
      .then(data=>{if(active){setChats(previous=>({...previous,[roomId]:[...data,...(previous[roomId]??[]).filter(m=>!data.some(n=>n.id===m.id))].slice(-100)}));setFeedError('')}})
      .catch(reason=>{if(active)setFeedError(errorMessage(reason))})
    const socket=new WebSocket(url,['dameeland','ticket.'+token])
    chatSocket.current=socket
    socket.onopen=()=>{if(active){setChatConnected(true);void refresh()}}
    socket.onclose=()=>{if(active)setChatConnected(false)}
    socket.onmessage=event=>{
      if(!active)return
      let data
      try{data=JSON.parse(String(event.data))}catch{return}
      if(data?.type==='call'){
        const signal=readCallSignal(data.signal)
        if(signal)void receiveCall.current(signal)
        return
      }
      const item=data as Note
      setChats(previous=>({...previous,[roomId]:[...(previous[roomId]??[]).filter(m=>m.id!==item.id),item]}))
    }
    void refresh()
    const poll=setInterval(()=>{if(socket.readyState!==WebSocket.OPEN)void refresh()},3500)
    return ()=>{active=false;setChatConnected(false);clearInterval(poll);if(chatSocket.current===socket)chatSocket.current=null;socket.close()}
  },[base,demo,token,page,roomId])
  useEffect(()=>{
    if(demo||!token||page!=='Home')return
    let alive=true
    const load=()=>api<StoryGroup[]>(base,'/stories',{},token).then(data=>{if(alive)setLiveStories(data)}).catch(()=>{})
    void load()
    const timer=setInterval(()=>{setClock(Date.now());void load()},60000)
    return ()=>{alive=false;clearInterval(timer)}
  },[base,demo,token,page,storyRefresh])
  // Stories vanish 12 hours after posting: hide them on the client as soon as they expire, not only on the next refresh.
  const activeStories=React.useMemo(()=>liveStories.map(group=>({...group,stories:group.stories.filter(item=>Date.parse(item.expires)>clock)})).filter(group=>group.stories.length),[liveStories,clock])
  const storyId=overlay?.kind==='story'?overlay.person.id:null
  const moveStory=useCallback((direction:1|-1)=>{
    if(!storyId)return
    const queue=demo?(ownStory?[user,...storyPeople]:storyPeople):activeStories.map(group=>group.author)
    const index=queue.findIndex(person=>person.id===storyId)
    if(index<0)return
    const count=demo?1:activeStories[index].stories.length
    const inner=storyIndex+direction
    if(inner>=0&&inner<count){setStoryIndex(inner);return}
    const next=queue[index+direction]
    if(!next&&direction===-1)return
    if(next)setSeen(previous=>new Set(previous).add(next.id))
    setStoryIndex(0)
    setOverlay(current=>current?.kind==='story'&&current.person.id===storyId?(next?{kind:'story',person:next}:null):current)
  },[storyId,storyIndex,ownStory,user,demo,activeStories])
  useEffect(()=>{
    if(!storyId)return
    const timer=setTimeout(()=>moveStory(1),6500)
    return ()=>clearTimeout(timer)
  },[storyId,moveStory])
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
    if(next==='Notifications')setUnread(false)
  }
  function dismissOverlays(){
    overlayHistory.current=[]
    setOverlay(null)
    clearComment()
  }
  function open(next:Page,details?:{profile?:Person;room?:Room}){
    const sameDestination=next===page&&(!details?.profile||details.profile.id===profile.id)&&(!details?.room||details.room.id===room?.id)
    const isTab=tabs.some(([tab])=>tab===next)
    if(sameDestination&&!overlay){
      if(isTab)scroll.current?.scrollTo({y:0,animated:!reduced})
      return
    }
    if(isTab)pageHistory.current=[]
    else pageHistory.current.push({page,profile,room,scrollY:pageScroll.current,overlays:overlay?[...overlayHistory.current,overlay]:[]})
    if(overlay)dismissOverlays()
    if(details?.profile)setProfile(details.profile)
    if(details?.room)setRoom(details.room)
    changePage(next,isTab?scrollOffsets.current[next]??0:0)
  }
  const startQuiz=()=>open('Quiz')
  useEffect(()=>{
    if(demo||!token||page!=='Profile')return
    const id=profile.id
    const controller=new AbortController()
    setProfileStats(previous=>previous?.id===id&&previous.data?previous:null)
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
    if(!voicePlaying)return
    const timer=setTimeout(()=>setVoicePlaying(false),8000)
    return ()=>clearTimeout(timer)
  },[voicePlaying])
  const showProfile=(person:Person)=>open('Profile',{profile:demo?demoAccounts.find(account=>account.person.id===person.id)?.person??person:person})
  const selectOverlay=(value:Overlay)=>{
    if(value.kind==='newStory'){setStoryMode('Text');setStoryImage(undefined);setStoryMedia(null)}
    if(overlay)overlayHistory.current.push(overlay)
    clearComment()
    setOverlay(value)
    if(value.kind==='story'){setStoryIndex(0);setSeen(previous=>new Set(previous).add(value.person.id))}
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
    const name=[firstName,lastName].join(' ')
    const isEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const loginUsername=email.replace(/^@/,'')
    if((!isEmail&&(mode==='signup'||!validUsername(loginUsername)))||values.password.length<8){
      setError(mode==='signup'?'Enter a valid email and a password with at least 8 characters.':'Enter your email or username and password.');return
    }
    setBusy(true);setError('')
    try{
      if(demo){
        const saved=mode==='signup'||isEmail?welcomeAccounts.get(email):[...welcomeAccounts.values()].find(account=>account.user.username===loginUsername)
        if(mode==='login'&&(!saved||saved.password!==values.password))throw new Error('Email, username or password is incorrect.')
        if(mode==='signup'&&saved)throw new Error('An account already uses this email.')
        if(mode==='signup'&&demoUsernameTaken(username))throw new Error('That username is taken.')
        const account=saved?.user??{...me,name,username,initials:initials(name)}
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
  async function authenticateWithGoogle(mode:AuthMode,username:string){
    if(busy)return
    setError('')
    if(demo||!props.openGoogle){setError('Google sign-in is available in the connected app. Use Explore demo to continue here.');return}
    if(mode==='signup'&&!validUsername(username)){setError('Choose a username to sign up with Google. '+usernameHint);return}
    setBusy(true)
    const controller=new AbortController()
    googleRequest.current=controller
    setGooglePending(true)
    let googleWindow:GoogleWindow|undefined
    try{
      let attempt:GoogleStart|undefined
      googleWindow=await props.openGoogle(async()=>{
        attempt=await api<GoogleStart>(base,'/google/start',{...json({mode,username}),signal:controller.signal})
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
      setPosts(demo?initialPosts:[]);setNotes({});setChats(demo?initialChats:{});setFollows({});setProfileStats(null)
      setRooms(demo?localRooms:[]);setRoom(null);setDraft('');setAttachment(null);clearComment();setMessage('');setSeen(new Set());setOwnStory(null);setLiveStories([]);setStoryIndex(0);setStoryMedia(null);setWishes([]);setLessonComplete(false);setVoicePlaying(false);setQuietMode(false);setFollowingOnly(false)
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
      if(demo)setPosts(previous=>[{id:uid(),author:user,body:draft.trim(),media:attachment?.uri,time:'Just now',likes:0,comments:0,reposts:0,liked:false,reposted:false},...previous])
      else{
        const form=new FormData()
        form.append('body',draft.trim())
        if(attachment?.data instanceof Blob)form.append('image',attachment.data,attachment.name)
        else if(attachment)form.append('image',attachment.data as unknown as Blob)
        await call('/posts',attachment?{method:'POST',body:form}:json({body:draft}))
        setRetry(n=>n+1)
      }
      setDraft('');setAttachment(null);dismissOverlays();setFollowingOnly(false);open('Home');notify('Post shared')
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  async function shareStory(){
    if(busy)return
    setBusy(true)
    try{
      const form=new FormData()
      form.append('text',comment.trim())
      if(storyMode==='Photo'&&storyMedia){
        if(storyMedia.data instanceof Blob)form.append('image',storyMedia.data,storyMedia.name)
        else form.append('image',storyMedia.data as unknown as Blob)
      }
      await call('/stories',{method:'POST',body:form})
      setStoryRefresh(n=>n+1)
      modalClose();notify('Story shared. It disappears after 12 hours.')
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
      const media=await props.pickMedia?.()
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
        item={id:uid(),author:user,body,attachment:commentMedia&&'uri' in commentMedia?{kind:'image',url:commentMedia.uri}:commentMedia??undefined}
      }else{
        let request=json({body,...(commentMedia&&'kind' in commentMedia?{[commentMedia.kind]:commentMedia.id}:{})}) as RequestInit
        if(commentMedia&&'uri' in commentMedia){
          const form=new FormData()
          form.append('body',body)
          if(commentMedia.data instanceof Blob)form.append('image',commentMedia.data,commentMedia.name)
          else form.append('image',commentMedia.data as unknown as Blob)
          request={method:'POST',body:form}
        }
        item=await call<Note>('/posts/'+post.id+'/comments',request)
      }
      if(session!==demoSession.current)return
      setNotes(previous=>({...previous,[post.id]:[...(previous[post.id]??(demo&&post.id==='quadratics'?initialComments:[])),item]}))
      setPosts(previous=>previous.map(p=>p.id===post.id?{...p,comments:p.comments+1}:p))
      if(revision===commentDraft.current)clearComment()
    }catch(reason){if(session===demoSession.current)fail(reason)}
    finally{pending.current.delete(key);setBusy(false)}
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
        replyTimers.current.push(setTimeout(()=>{if(session===demoSession.current)append({id:uid(),author:room.person,body:'Thanks for the message! See you at school.'})},950))
      }
    }catch(reason){fail(reason)}finally{setBusy(false)}
  }
  const goBack=()=>{
    const previous=pageHistory.current.pop()
    if(!previous){changePage('Home',scrollOffsets.current.Home??0);return}
    setProfile(previous.profile)
    setRoom(previous.room)
    overlayHistory.current=previous.overlays.slice(0,-1)
    setOverlay(previous.overlays.at(-1)??null)
    if(previous.page==='Chat'){
      stickToChatEnd.current=false
      initialChatScroll.current=false
    }
    changePage(previous.page,previous.scrollY)
  }
  useEffect(()=>{
    if(Platform.OS!=='android'||stage!=='app'||overlay||(!pageHistory.current.length&&page==='Home'))return
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{if(roomCall.call)roomCall.end();else goBack();return true})
    return ()=>subscription.remove()
  })

  const displayedPosts=demo&&followingOnly?posts.filter(p=>p.author.id===user.id||follows[p.author.id]):posts
  const displayedPeople=demo?people.map(person=>demoAccounts.find(account=>account.person.id===person.id)?.person??person).filter(p=>(p.name+' '+p.detail).toLowerCase().includes(query.trim().toLowerCase())):results
  const canShare=Boolean(props.share)
  const overlayDepth=overlay?overlayHistory.current.length+1:0
  const closeToDepth=(depth:number)=>{
    const previous=depth>0?overlayHistory.current[depth-1]:null
    overlayHistory.current=overlayHistory.current.slice(0,Math.max(0,depth-1))
    setOverlay(previous??null)
    clearComment()
  }
  const modalClose=()=>closeToDepth(overlayDepth-1)
  useBrowserModalBack(overlayDepth,closeToDepth)
  const compose=()=>selectOverlay({kind:'create'})
  const section=(title:string)=> <Copy size={19} weight={800}>{title}</Copy>
  const failure=<Empty title="Couldn’t connect" detail={feedError} action="Try again" onPress={()=>setRetry(n=>n+1)}/>
  const navButton=(name:Page,glyph:Glyph)=>{
    const active=page===name||name==='Messages'&&page==='Chat'||tabs.some(([tab])=>tab===name)&&pageHistory.current[0]?.page===name
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
  const hasOwnStory=demo?!!ownStory:activeStories.some(group=>group.author.id===user.id)
  const home=<>
    {(demo||token)&&<View style={{paddingHorizontal:2}}><StoryRow onStory={person=>selectOverlay({kind:'story',person})} onCreate={()=>selectOverlay(hasOwnStory?{kind:'story',person:user}:{kind:'newStory'})} seen={seen} own={hasOwnStory?user:null} others={demo?storyPeople:activeStories.map(group=>group.author).filter(author=>author.id!==user.id)}/></View>}
    <Segmented options={['For you','Following']} selected={followingOnly?'Following':'For you'} onSelect={value=>setFollowingOnly(value==='Following')}/>
    {feedError?failure:loading?<Loading/>:displayedPosts.length?displayedPosts.map(post=><PostCard key={post.id} post={post} onReact={react} onOverlay={selectOverlay} onProfile={showProfile}/>):<Empty title={followingOnly?'Your following feed is empty':'Start the conversation'} detail={followingOnly?'Follow classmates to see their posts here.':'Share the first post with your classmates.'} action={followingOnly?'Find people':'Create post'} onPress={followingOnly?()=>open('Explore'):compose}/>}
    {demo&&!followingOnly&&<View style={{...row,flexWrap:'wrap'}}>
      <Button label="Birthdays" leading="gift" variant="secondary" onPress={()=>open('Birthdays')}/>
      <Button label="Events" leading="grp" variant="secondary" onPress={()=>open('Events')}/>
    </View>}
  </>
  const explore=<>
    <Field label="Search" glyph="search" placeholder="Search people, groups, topics" value={query} onChangeText={setQuery} autoCapitalize="none"/>
    {demo&&!query&&<Card>{section('Trending in your school')}<View style={{...row,flexWrap:'wrap'}}>{['#QuizFriday','#StudyTogether','#WordSprint'].map(tag=><Button key={tag} label={tag} variant="secondary" onPress={()=>setQuery(tag)}/>)}</View></Card>}
    {section(query?'Search results':'Discover people')}
    {searchError?<Empty title="Search unavailable" detail={searchError} action="Try again" onPress={()=>setRetry(n=>n+1)}/>:searching?<Loading/>:displayedPeople.length?displayedPeople.map(person=><Card key={person.id} style={spread}><Pressable accessibilityRole="button" accessibilityLabel={'Open '+person.name+' profile'} onPress={()=>showProfile(person)} style={{...row,flex:1}}><Avatar person={person}/><View style={{flex:1}}><PersonName person={person}/><Copy color={theme.muted} size={12}>{person.detail}</Copy></View></Pressable><Button label={follows[person.id]?'Following':'Follow'} variant={follows[person.id]?'secondary':'primary'} onPress={()=>void follow(person)}/></Card>):<Empty title="No results" detail={query?'Try a different name or clear the search.':'Classmates will appear here after they sign up.'}/>}
  </>
  const learning=<>
    <FeatureCard glyph="bolt" title="Daily challenge" description="Solve 3 quick questions" action="Start" onPress={startQuiz}/>
    <ScreenLinks items={ [['Lesson','book'],['Study timer','bolt'],['Progress','check'],...(demo?[['Teacher dashboard','grp'] as const]:[])] } open={open}/>
    {section('Your subjects')}
    {([{name:'Mathematics',value:72,glyph:'maths'},{name:'English',value:48,glyph:'type'},{name:'Digital Technologies',value:60,glyph:'code'}] as const).map(({name,value,glyph})=><Card key={name}>
      <View style={row}><IconTile name={glyph}/><View style={{flex:1}}><Copy weight={800}>{name}</Copy></View><Copy size={12} weight={800} color={theme.ink}>{demo?value:0}%</Copy></View>
      <Meter percent={demo?value:0}/>
    </Card>)}
  </>
  const play=<>
    <FeatureCard glyph="trophy" title="Quiz Duel" description="Race through questions and win XP." action="Play quiz" onPress={startQuiz}/>
    <ScreenLinks items={ [['Games','game'],...(demo?[['Leaderboard','trophy'] as const,['Rewards','gift'] as const]:[])] } open={open}/>
  </>
  const roomList=rooms.filter(r=>inboxTab==='Chats'?!r.person.group:inboxTab==='Groups'?r.person.group:false)
  const inbox=<>
    <Segmented options={['Chats','Groups','Requests']} selected={inboxTab} onSelect={setInboxTab}/>
    {demo&&inboxTab==='Chats'&&<Card>{section('Active now')}<View style={row}>{[people[0],people[1],people[2]].map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={'Message '+person.name} onPress={()=>void messagePerson(person)}><Avatar person={person} ring size={42}/></Pressable>)}</View></Card>}
    {feedError?failure:loading?<Loading/>:roomList.length?roomList.map(r=><Pressable key={r.id} accessibilityRole="button" accessibilityLabel={'Open conversation with '+r.person.name} onPress={()=>openRoom(r)}><Card style={row}><Avatar person={r.person} size={50}/><View style={{flex:1}}><PersonName person={r.person}/><Copy color={theme.muted} size={12}>{chats[r.id]?.at(-1)?.body??'Open conversation'}</Copy></View></Card></Pressable>):<Empty title={inboxTab==='Chats'?'No messages yet':inboxTab==='Groups'?'No groups yet':'No message requests'} detail={inboxTab==='Chats'?'Find a classmate and start a chat.':inboxTab==='Groups'?'Group conversations are available in the preview.':'New requests will appear here.'} action={inboxTab==='Chats'?'Find people':undefined} onPress={()=>open('Explore')}/>}
  </>
  const chat=room&&<>
    <Card style={spread}><View style={{...row,flex:1}}><Avatar person={room.person}/><View style={{flex:1}}><PersonName person={room.person}/><Copy color={theme.muted} size={12}>{demo?'Active now':'Direct message'}</Copy></View></View>{demo&&<View style={{...row,gap:0}}><IconButton name="ph" label="Voice call" onPress={()=>selectOverlay({kind:'call',video:false,person:room.person})}/><IconButton name="vid" label="Video call" onPress={()=>selectOverlay({kind:'call',video:true,person:room.person})}/></View>}</Card>
    {!demo&&callMedia&&<View style={{...row,flexWrap:'wrap'}}>
      <Button label="Voice call" leading="ph" variant="secondary" disabled={!chatConnected||!!roomCall.call} onPress={()=>roomCall.start(false)}/>
      <Button label="Video call" leading="vid" variant="secondary" disabled={!chatConnected||!!roomCall.call} onPress={()=>roomCall.start(true)}/>
      {!chatConnected&&<Copy size={12}>Waiting for chat connection…</Copy>}
    </View>}
    {!demo&&callMedia&&roomCall.call&&<Card>
      <RoomCall key={roomCall.call.id} person={room.person} media={callMedia} call={roomCall.call} accept={roomCall.accept} end={()=>roomCall.end()}/>
    </Card>}
    {demo&&room.person.group&&<Card><Copy weight={800}>Pinned message</Copy><Copy>Bring one practice question to the next study session.</Copy><Button label="Join group voice call" leading="ph" variant="secondary" onPress={()=>selectOverlay({kind:'call',video:false,person:room.person,ringing:true})}/></Card>}
    {demo&&room.id==='ada'&&<Card><Copy size={12} color={theme.muted}>Call log · Voice call · 2 min</Copy><Button label={voicePlaying?'Stop voice note preview':'Preview voice note · 0:08'} leading="play" variant="secondary" onPress={()=>setVoicePlaying(!voicePlaying)}/>{voicePlaying&&<Copy>Transcript: Can we revise quadratic equations after school?</Copy>}</Card>}
    {!!feedError&&<Empty title="Reconnecting" detail={feedError}/>}
    {(chats[room.id]??[]).map(item=>{const own=item.author.id===user.id;return <View key={item.id} style={{alignSelf:own?'flex-end':'flex-start',backgroundColor:own?theme.purple:theme.card,maxWidth:'80%',borderRadius:18,borderBottomLeftRadius:own?18:5,borderBottomRightRadius:own?5:18,borderWidth:1,borderColor:own?theme.purple:theme.border,padding:12}}><Copy color={own?'#fff':theme.text}>{item.body}</Copy></View>})}
    {!(chats[room.id]?.length)&&!feedError&&<Empty title="Say hello" detail="Messages are visible to both people in this conversation."/>}
  </>
  const ownProfile=profile.id===user.id
  const currentStats=profileStats?.id===profile.id?profileStats:undefined
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
      <View style={{height:136,backgroundColor:'#4F25D6'}}>{profile.cover&&<Image accessibilityLabel="Cover photo" source={{uri:profile.cover}} resizeMode="cover" style={{width:'100%',height:'100%'}}/>}</View>
      <View style={{padding:18,paddingTop:0,gap:14}}>
        <View style={{alignSelf:'flex-start',marginTop:-40}}><Avatar person={profile} size={74} ring/></View>
        <View style={{gap:4}}><Copy size={27} weight={800}>{profile.name}</Copy>{profile.username&&<Copy color={theme.ink}>@{profile.username}</Copy>}<Copy color={theme.muted}>{profile.detail}</Copy></View>
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
          {ownProfile?<>{props.pickMedia&&<>
            <Button label={photoBusy==='avatar'?'Updating picture…':'Change profile picture'} leading="image" variant="secondary" disabled={!!photoBusy} onPress={()=>void uploadProfilePhoto('avatar')}/>
            <Button label={photoBusy==='cover'?'Updating cover…':'Change cover photo'} variant="secondary" disabled={!!photoBusy} onPress={()=>void uploadProfilePhoto('cover')}/>
          </>}<Button label="Settings" leading="settings" variant="secondary" onPress={()=>open('Settings')}/></>:<>
            <Button label={follows[profile.id]?'Following':'Follow'} disabled={!demo&&!currentStats?.data} onPress={()=>void follow(profile)}/>
            <Button label="Message" leading="msg" variant="secondary" onPress={()=>void messagePerson(profile)}/>
          </>}
        </View>
      </View>
    </Card>
    {profile.role==='tech'&&<Card><View style={row}><IconTile name="code"/><View style={{flex:1}}><Copy weight={800}>Tech creator</Copy></View></View></Card>}
    {section('Posts')}
    {posts.filter(p=>p.author.id===profile.id).map(post=><PostCard key={post.id} post={post} onReact={react} onOverlay={selectOverlay} onProfile={showProfile}/>)}
    {!posts.some(p=>p.author.id===profile.id)&&<Empty title="No posts to show" detail="Posts from this profile will appear here."/>}
  </>
  const settings=<>
    <Card>{section('Appearance')}<View style={row}>{(['light','dark','system'] as const).map(mode=><Button key={mode} label={mode[0].toUpperCase()+mode.slice(1)} variant={appearance===mode?'primary':'secondary'} onPress={()=>setAppearance(mode)}/>)}</View></Card>
    <Card>{section('Notifications')}<Button label={notifications?'In-app notifications on':'In-app notifications off'} variant="secondary" onPress={()=>{setNotifications(!notifications);setUnread(!notifications&&demo)}}/></Card>
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
    Quiz:<Quiz onBack={goBack}/>,
    Admin:(demo||user.isAdmin)&&<Suspense fallback={<Loading/>}><Admin base={base} token={token}
      sample={demo?{overview:demoOverview,accounts:demoAccounts}:undefined} onSampleChange={changeDemoAccount}/></Suspense>,
    Notifications:demo&&notifications?<Card><View style={row}><Avatar person={people[1]}/><View style={{flex:1}}><Copy weight={800}>Tobi A. liked your post</Copy><Copy color={theme.muted} size={12}>Today</Copy></View></View><View style={row}><Avatar person={people[4]}/><View style={{flex:1}}><Copy weight={800}>Code Club shared a new post</Copy><Copy color={theme.muted} size={12}>Yesterday</Copy></View></View></Card>:<Empty title="You’re all caught up" detail="New activity will appear here."/>,
  }
  let sheet:React.ReactNode
  if(overlay?.kind==='connections'){
    sheet=<ConnectionList key={overlay.person.id+':'+overlay.list} base={base} token={token} profile={overlay.person} list={overlay.list} samples={demo?demoConnections(overlay.person.id,overlay.list):undefined} onProfile={showProfile}/>
  }else if(overlay?.kind==='post'){
    const post=posts.find(item=>item.id===overlay.post.id)??overlay.post
    sheet=<><PostCard detail post={post} onReact={react} onOverlay={selectOverlay} onProfile={showProfile}/><Button label="Read comments" variant="secondary" onPress={()=>selectOverlay({kind:'comments',post})}/></>
  }else if(overlay?.kind==='comments'){
    const list=notes[overlay.post.id]??(demo&&overlay.post.id==='quadratics'?initialComments:[])
    sheet=<Comments key={overlay.post.id} list={list} body={comment} onBody={setComment} busy={busy} renderGif={props.renderGif}
      attachment={commentMedia&&'uri' in commentMedia?{kind:'image',url:commentMedia.uri}:commentMedia??undefined}
      onPreset={value=>{commentDraft.current+=1;setCommentMedia(value)}} onRemove={()=>{commentDraft.current+=1;setCommentMedia(null)}}
      onPhoto={props.pickMedia?()=>void pickCommentPhoto():undefined} onPost={()=>void addComment(overlay.post)}
      onProfile={showProfile}/>
  }else if(overlay?.kind==='create'){
    sheet=<><View style={row}><Avatar person={user}/><PersonName person={user}/></View><Field label="What’s happening?" value={draft} onChangeText={setDraft} multiline maxLength={1200} style={{minHeight:106,textAlignVertical:'top'}}/>
      {attachment&&<View style={spread}><Copy size={12}>{attachment.name}</Copy><IconButton name="close" label="Remove image" onPress={()=>setAttachment(null)}/></View>}
      {props.pickMedia&&<Button label="Add image" leading="image" variant="secondary" onPress={()=>{void props.pickMedia?.().then(value=>{if(value)setAttachment(value)}).catch(fail)}}/>}
      <Button label={busy?'Posting…':'Publish post'} onPress={()=>void createPost()} disabled={busy||(!draft.trim()&&!attachment)}/></>
  }else if(overlay?.kind==='newStory'){
    const valid=storyMode==='Text'?!!comment.trim():storyMode==='Photo'?!!storyImage:true
    sheet=<>
      <Segmented options={demo?['Text','Photo','Video']:['Text','Photo']} selected={storyMode} onSelect={setStoryMode}/>
      {storyMode==='Photo'&&<>{storyImage&&<Image source={{uri:storyImage}} style={{width:'100%',height:140,borderRadius:12}}/>}{props.pickMedia&&<Button label={storyImage?'Replace photo':'Choose photo'} leading="image" variant="secondary" onPress={()=>{void props.pickMedia?.().then(value=>{if(value){setStoryImage(value.uri);setStoryMedia(value)}}).catch(fail)}}/>}</>}
      {storyMode==='Video'&&<Card><IconTile name="vid"/><Copy>Try the video story layout with a sample preview.</Copy></Card>}
      <Field label={storyMode==='Text'?'What’s your story?':'Caption'} value={comment} onChangeText={setComment} multiline maxLength={240}/>
      {!demo&&<Copy size={12} color={theme.muted}>Stories disappear 12 hours after you share them.</Copy>}
      <Button label={busy?'Sharing…':'Share story'} disabled={!valid||busy} onPress={()=>{if(!demo){void shareStory();return}setOwnStory({text:comment.trim(),image:storyMode==='Photo'?storyImage:undefined,videoPreview:storyMode==='Video'});modalClose();notify('Story shared in the preview')}}/>
    </>
  }else if(overlay?.kind==='share'){
    sheet=<><Copy>{overlay.post.body||'Image post'}</Copy>{canShare&&<Button label="Share post text" onPress={()=>{void props.share?.(overlay.post.body).then(()=>{modalClose();notify('Post text ready to share')}).catch(fail)}}/>}</>
  }else if(overlay?.kind==='wish'){
    sheet=<><Avatar person={people[2]} size={65}/><Field label="Write a birthday wish" value={comment} onChangeText={setComment} maxLength={300}/><Button label="Send wish" disabled={!comment.trim()} variant="fun" onPress={()=>{setWishes(previous=>[...previous,comment.trim()]);modalClose();notify('Birthday wish sent in the preview')}}/></>
  }else if(overlay?.kind==='call'&&overlay.ringing){
    const call=overlay
    sheet=<Card><PersonName person={call.person}/><Copy>Simulated voice call</Copy><Button label={call.incoming?'Accept preview call':'Connect preview call'} onPress={()=>setOverlay({...call,ringing:false})}/><Button label={call.incoming?'Decline call':'Cancel call'} variant="secondary" onPress={modalClose}/></Card>
  }else if(overlay?.kind==='call')sheet=<CallPreview video={overlay.video} person={overlay.person} onClose={modalClose}/>
  const ModalViewport=props.modalViewport??DefaultModalViewport
  const overlayTitle=overlay?.kind==='connections'?(overlay.list==='followers'?'Followers':'Following')
    :overlay?.kind==='call'?(overlay.ringing?'Ringing':overlay.video?'Video call':'Voice call')
    :overlay&&overlay.kind!=='story'?{comments:'Comments',share:'Share post',post:'Post detail',create:'Create post',wish:'Happy birthday, Zee!',newStory:'Create story'}[overlay.kind]:''
  const story=overlay?.kind==='story'?(demoAccounts.find(account=>account.person.id===overlay.person.id)?.person??overlay.person):null
  const liveGroup=story&&!demo?activeStories.find(group=>group.author.id===story.id):undefined
  const activeIndex=liveGroup?Math.min(storyIndex,liveGroup.stories.length-1):0
  const liveItem=liveGroup?.stories[activeIndex]
  const personalStory:{text:string;image?:string;videoPreview?:boolean}|null=demo?(story?.id===user.id?ownStory:null):liveItem?{text:liveItem.text,image:liveItem.image}:null
  const storyText=demo?personalStory?.text??(story?.id==='ada'?'Study session after school. Bring your notes!':story?.id==='code'?'Code Club meets on Friday!':'See you at quiz night!'):liveItem?.text??''
  return <Design.Provider value={{theme,font,reduced,renderIcon:props.renderIcon}}><View style={{flex:1,backgroundColor:theme.bg,width:'100%'}}>
    {starting||stage==='restore'?<LoadingScreen/>:stage==='intro'?<Intro desktop={desktop} step={step} reduced={reduced} onSkip={()=>setStage('auth')} onNext={()=>step===2?setStage('auth'):setStep(step+1)} onBack={()=>setStep(step-1)}/>:stage==='auth'?<Auth base={base} demo={demo} busy={busy} error={error} submit={authenticate} onGoogle={(mode,username)=>void authenticateWithGoogle(mode,username)} onCancelGoogle={()=>googleRequest.current?.abort()} googlePending={googlePending} onDemo={()=>{setUser(me);setPage('Home');setStage('app')}} reduced={reduced}/>:
      <View style={{flex:1,flexDirection:'row',width:'100%',maxWidth:1360,alignSelf:'center'}}>
        {desktop&&<View style={{width:222,borderRightWidth:1,borderColor:theme.border,padding:18,gap:5,backgroundColor:theme.card}}>
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
        <View style={{flex:1,minWidth:0,maxWidth:rail?680:undefined}}>
          <View style={{...spread,paddingHorizontal:16,minHeight:desktop?72:62,borderBottomWidth:1,borderColor:theme.border,backgroundColor:theme.card}}>
            <View style={{...row,flex:1}}>
              {!desktop&&page==='Home'?<Logo size={40}/>:!tabs.some(([name])=>name===page)&&<IconButton name="back" label="Go back" onPress={goBack}/>}
              {(desktop||page!=='Home')&&<Copy weight={800} size={desktop?28:21}>{page==='Quiz'?'Quiz Duel':page==='Chat'?'Chat':page}</Copy>}
            </View>
            <View style={{...row,gap:0}}>
              <IconButton name={themeName==='dark'?'sun':'moon'} label="Toggle light or dark mode" onPress={()=>setAppearance(themeName==='light'?'dark':'light')}/>
              {!desktop&&<><View><IconButton name="bell" label="Notifications" onPress={()=>open('Notifications')}/>{unread&&<View pointerEvents="none" style={{position:'absolute',right:8,top:7,width:7,height:7,borderRadius:5,backgroundColor:theme.purple}}/>}</View><IconButton name="msg" label="Messages" onPress={()=>open('Messages')}/><Pressable accessibilityRole="button" accessibilityLabel="Your profile" style={{width:44,height:44,alignItems:'center',justifyContent:'center'}} onPress={()=>showProfile(user)}><Avatar person={user} size={31}/></Pressable></>}
            </View>
          </View>
          <ScrollView key={page==='Chat'?'chat:'+room?.id:page==='Profile'?'profile:'+profile.id:page} ref={scroll} testID="main-scroll" style={{flex:1}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
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
            contentContainerStyle={{padding:desktop?20:13,gap:16,width:'100%',maxWidth:640,alignSelf:'center'}}>
            <Motion key={page} reduced={reduced} distance={0} style={stack}>{content[page]??<Suspense fallback={<LoadingScreen compact/>}><FeatureScreen key={page} page={page as ExtraPage} open={open} demo={demo} user={user} startQuiz={startQuiz} completed={lessonComplete} markComplete={()=>setLessonComplete(true)} wish={()=>selectOverlay({kind:'wish'})} wishes={wishes} incomingCall={()=>selectOverlay({kind:'call',video:false,person:people[0],ringing:true,incoming:true})}/></Suspense>}</Motion></ScrollView>
          {page==='Chat'&&<View style={{...row,padding:10,borderTopWidth:1,borderColor:theme.border,backgroundColor:theme.card}}><View style={{flex:1}}><Field label="Message" placeholder="Write a message" value={message} onChangeText={setMessage} onSubmitEditing={()=>void send()} maxLength={800}/></View><View style={{alignSelf:'flex-end'}}><Button label="Send" trailing="send" disabled={busy||!message.trim()} onPress={()=>void send()}/></View></View>}
          {!desktop&&<View style={{...row,gap:0,justifyContent:'space-around',minHeight:64,paddingHorizontal:6,borderTopWidth:1,borderColor:theme.border,backgroundColor:theme.card}}>{tabs.slice(0,2).map(([name,glyph])=>navButton(name,glyph))}<View style={{width:61,alignItems:'center',marginTop:-13}}><IconButton name="plus" label="Create post" size={26} solid onPress={compose}/></View>{tabs.slice(2).map(([name,glyph])=>navButton(name,glyph))}</View>}
        </View>
        {rail&&<ScrollView style={{flex:1,maxWidth:324,borderLeftWidth:1,borderColor:theme.border}} contentContainerStyle={{padding:17,paddingTop:20,gap:15}}>
          <FeatureCard glyph="bolt" title="Daily challenge" description="Three quick maths questions." action="Start challenge" onPress={startQuiz} compact/>
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
      <ModalViewport color={story?(personalStory?.image?'#120D1F':'#4F25D6'):theme.bg}>
      {story?<View accessibilityViewIsModal style={{flex:1,backgroundColor:personalStory?.image?'#120D1F':'#4F25D6',padding:18}}>
        <View style={{width:'100%',maxWidth:640,alignSelf:'center',flex:1,gap:14}}>
          <View style={{...row,gap:4}}>{Array.from({length:liveGroup?.stories.length??1},(_,index)=><View key={index} style={{flex:1,height:3,borderRadius:3,backgroundColor:index<=activeIndex?lime:'rgba(255,255,255,.35)'}}/>)}</View>
          <View style={spread}>
            <View style={{...row,flex:1}}><Avatar person={story} size={40}/><Copy color="#fff" weight={800}>{story.name}</Copy></View>
            <IconButton name="close" label="Close story" tint="#fff" onPress={modalClose}/>
          </View>
          <View {...storySwipe.panHandlers} style={{flex:1,minHeight:0,justifyContent:'center',gap:16,paddingBottom:16}}>
            {personalStory?.image&&<Image accessibilityLabel="Story photo" source={{uri:personalStory.image}} resizeMode="contain" style={{width:'100%',flex:1,minHeight:0}}/>}
            {personalStory?.videoPreview&&<View style={{...row,justifyContent:'center'}}><IconTile name="vid"/><Copy color="#fff">Video story preview</Copy></View>}
            {!!storyText&&<Copy center color="#fff" weight={800} size={personalStory?.image?18:28}>{storyText}</Copy>}
            <View style={{position:'absolute',inset:0,flexDirection:'row'}}>
              <Pressable accessibilityRole="button" accessibilityLabel="Next story" onPress={()=>moveStory(1)} style={{flex:1}}/>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous story" onPress={()=>moveStory(-1)} style={{flex:1}}/>
            </View>
          </View>
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
        <ScrollView key={overlay?.kind} style={{flex:1}} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{width:'100%',maxWidth:720,alignSelf:'center',padding:16,paddingBottom:30,gap:14}}>
          {sheet}
        </ScrollView>
        {toast&&overlay&&<Toast key={toast.id} item={toast} reduced={reduced} onDismiss={dismissToast} bottom={18}/>}
      </View>}
      </ModalViewport>
    </Modal>
  </View></Design.Provider>
}
