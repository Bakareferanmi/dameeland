import React,{useEffect,useRef,useState} from 'react'
import {Animated,Image,PanResponder,Platform,Pressable,Text,View} from 'react-native'
import {api,messageReactionEmojis,people as samplePeople,type MessageReaction,type MessageReply,type Note,type Person,type QuotedPost} from './index'
import {Avatar,Copy,Field,Icon,PersonName,displayHandle,row,useDesign} from './ui'

/** Searches people by name or username. The sample people are used in the offline preview. */
function usePeopleSearch({query,base,token,demo,minLength}:{query:string;base:string;token?:string;demo:boolean;minLength:number}){
  const [found,setFound]=useState<Person[]>([])
  useEffect(()=>{
    const text=query.trim().toLowerCase()
    if(text.length<minLength){setFound([]);return}
    if(demo){setFound(samplePeople.filter(person=>!person.group&&person.username&&(person.username.includes(text)||person.name.toLowerCase().includes(text))).slice(0,5));return}
    if(!token){setFound([]);return}
    const controller=new AbortController()
    const timer=setTimeout(()=>{
      api<Person[]>(base,'/people?q='+encodeURIComponent(text),{signal:controller.signal},token)
        .then(list=>{if(!controller.signal.aborted)setFound(list.filter(person=>person.username).slice(0,5))})
        .catch(()=>{})
    },180)
    return ()=>{clearTimeout(timer);controller.abort()}
  },[query,base,token,demo,minLength])
  return found
}

function PersonRow({person,onPress,label}:{person:Person;onPress:()=>void;label:string}){
  const {theme}=useDesign()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed})=>({...row,minHeight:46,paddingHorizontal:10,backgroundColor:pressed?theme.chip:'transparent'})}>
    <Avatar person={person} size={30}/><View style={{flex:1,minWidth:0}}><PersonName person={person}/><Copy size={11} color={theme.muted}>@{displayHandle(person)}</Copy></View>
  </Pressable>
}

const trailingMention=/(^|\s)@([a-zA-Z0-9_]{0,24})$/
/** A text field that suggests people while you type @username, for posts and comments. */
export function MentionField({label,value,onChange,base,token,demo,placeholder,maxLength,style}:{label:string;value:string;onChange:(value:string)=>void;base:string;token?:string;demo:boolean;placeholder?:string;maxLength?:number;style?:object}){
  const {theme}=useDesign()
  const match=value.match(trailingMention)
  const found=usePeopleSearch({query:match?match[2]:'',base,token,demo,minLength:1})
  const choose=(person:Person)=>onChange(value.replace(trailingMention,(_,lead:string)=>lead+'@'+displayHandle(person)+' '))
  return <View style={{gap:8}}>
    <Field label={label} placeholder={placeholder} value={value} onChangeText={onChange} multiline maxLength={maxLength} style={style}/>
    {!!match&&found.length>0&&<View accessibilityLabel="People to tag" style={{borderRadius:13,borderWidth:1,borderColor:theme.border,backgroundColor:theme.card,overflow:'hidden'}}>
      {found.map(person=><PersonRow key={person.id} person={person} label={'Tag @'+displayHandle(person)} onPress={()=>choose(person)}/>)}
    </View>}
  </View>
}

/** Picks the co-authors for a shared post. */
export function PersonPicker({selected,onChange,max,base,token,demo,disabled}:{selected:Person[];onChange:(people:Person[])=>void;max:number;base:string;token?:string;demo:boolean;disabled?:boolean}){
  const {theme}=useDesign()
  const [query,setQuery]=useState('')
  const found=usePeopleSearch({query,base,token,demo,minLength:2}).filter(person=>!selected.some(item=>item.id===person.id))
  const full=selected.length>=max
  return <View style={{gap:8}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Copy weight={800}>Share this post</Copy><Copy size={12} color={theme.muted}>{selected.length}/{max} co-authors</Copy></View>
    {!!selected.length&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{selected.map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={'Remove @'+displayHandle(person)} disabled={disabled} onPress={()=>onChange(selected.filter(item=>item.id!==person.id))} style={{...row,gap:6,minHeight:38,paddingHorizontal:10,borderRadius:19,backgroundColor:theme.chip}}><Avatar person={person} size={22}/><Copy size={12} weight={800}>@{displayHandle(person)}</Copy><Copy size={14} color={theme.muted}>×</Copy></Pressable>)}</View>}
    {!full&&<Field label="Add a co-author" placeholder="Search name or username" glyph="search" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false}/>}
    {!full&&found.length>0&&<View style={{borderRadius:13,borderWidth:1,borderColor:theme.border,backgroundColor:theme.card,overflow:'hidden'}}>
      {found.map(person=><PersonRow key={person.id} person={person} label={'Add @'+displayHandle(person)+' as co-author'} onPress={()=>{onChange([...selected,person]);setQuery('')}}/>)}
    </View>}
    <Copy size={11} color={theme.muted}>They get an invite and show up as a co-author once they accept. A shared post has up to {max+1} people, including you.</Copy>
  </View>
}

/** The quoted post shown inside a quote post, and above the composer while quoting. */
export function QuoteEmbed({quote,onPress}:{quote:QuotedPost;onPress?:()=>void}){
  const {theme,font}=useDesign()
  const box={borderRadius:14,borderWidth:1,borderColor:theme.border,backgroundColor:theme.chip,padding:12,gap:6}
  if(quote.unavailable||!quote.author)return <View style={box}><Copy size={12} color={theme.muted}>This post isn’t available anymore.</Copy></View>
  const content=<View style={box}>
    <View style={{...row,gap:8}}><Avatar person={quote.author} size={22}/><PersonName person={quote.author}/></View>
    {!!quote.body&&<Text numberOfLines={4} style={[{color:theme.text,fontSize:13,lineHeight:19},font(500)]}>{quote.body}</Text>}
    {quote.media&&quote.kind==='image'&&<Image accessibilityLabel="Quoted post photo" source={{uri:quote.media}} resizeMode="cover" style={{width:'100%',height:120,borderRadius:10,backgroundColor:theme.card}}/>}
    {quote.kind==='video'&&<Copy size={12} color={theme.muted}>Video</Copy>}
  </View>
  return onPress?<Pressable accessibilityRole="button" accessibilityLabel={'Open post by '+displayHandle(quote.author)} onPress={onPress}>{content}</Pressable>:content
}

export const replyLabel=(reply:MessageReply)=>reply.body||(reply.kind==='image'?'Photo':reply.kind==='video'?'Video':reply.kind==='audio'?'Voice note':'Message')
/** The small preview of a message, built from the message itself. Used while replying and in the offline preview. */
export const replyFromNote=(note:Note):MessageReply=>({id:note.id,authorName:note.author.name,body:note.viewOnce?'View once media':note.body.slice(0,120),kind:note.viewOnce?undefined:note.chatMedia?.kind})

/** What a message shows above its text when it replies to another message. */
export function ReplyPreview({reply,own}:{reply:MessageReply;own:boolean}){
  const {theme,font}=useDesign()
  return <View accessibilityLabel={'Replying to '+reply.authorName} style={{flexDirection:'row',gap:8,borderRadius:10,backgroundColor:own?'#FFFFFF24':theme.chip,overflow:'hidden'}}>
    <View style={{width:4,backgroundColor:own?'#FFFFFFB8':theme.purple}}/>
    <View style={{flex:1,minWidth:0,paddingVertical:6,paddingRight:8,gap:1}}>
      {!!reply.authorName&&<Text numberOfLines={1} style={[{color:own?'#FFFFFF':theme.purple,fontSize:11},font(800)]}>{reply.authorName}</Text>}
      <Text numberOfLines={2} style={[{color:own?'#FFFFFFE0':theme.muted,fontSize:12,lineHeight:17,fontStyle:reply.deleted?'italic':'normal'},font(500)]}>{replyLabel(reply)}</Text>
    </View>
  </View>
}

/** Sets or clears one person's reaction in a message's reaction list. */
export const applyReaction=(reactions:MessageReaction[]|undefined,userId:string,emoji:string|null):MessageReaction[]=>[
  ...(reactions??[]).filter(item=>item.userId!==userId),
  ...(emoji?[{userId,emoji}]:[]),
]

/** Emoji chips under a message. Tap one to add yours or take it back. */
export function ReactionChips({reactions,viewer,own,onToggle}:{reactions?:MessageReaction[];viewer:string;own:boolean;onToggle:(emoji:string)=>void}){
  const {theme}=useDesign()
  const groups=new Map<string,{count:number;mine:boolean}>()
  for(const item of reactions??[]){
    const group=groups.get(item.emoji)??{count:0,mine:false}
    group.count++
    if(item.userId===viewer)group.mine=true
    groups.set(item.emoji,group)
  }
  if(!groups.size)return null
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:-2,alignSelf:own?'flex-end':'flex-start'}}>
    {[...groups].map(([emoji,group])=><Pressable key={emoji} accessibilityRole="button" accessibilityLabel={emoji+' reaction, '+group.count+(group.mine?', yours. Tap to remove':'. Tap to add yours')} onPress={()=>onToggle(emoji)}
      style={{...row,gap:4,minHeight:28,paddingHorizontal:9,borderRadius:14,borderWidth:1,borderColor:group.mine?theme.purple:theme.border,backgroundColor:group.mine?theme.chip:theme.card}}>
      <Copy size={14}>{emoji}</Copy>{group.count>1&&<Copy size={11} weight={800} color={theme.muted}>{group.count}</Copy>}
    </Pressable>)}
  </View>
}

/** The bar that opens on a long press: pick a reaction or reply. */
export function MessageActions({current,onReact,onReply,onClose}:{current?:string;onReact:(emoji:string|null)=>void;onReply:()=>void;onClose:()=>void}){
  const {theme}=useDesign()
  return <View accessibilityLabel="Message actions" style={{...row,flexWrap:'wrap',gap:6,paddingHorizontal:12,paddingVertical:9,backgroundColor:theme.card,borderTopWidth:1,borderColor:theme.border}}>
    {messageReactionEmojis.map(emoji=><Pressable key={emoji} accessibilityRole="button" accessibilityLabel={'React '+emoji} onPress={()=>onReact(current===emoji?null:emoji)} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:current===emoji?theme.chip:'transparent',borderWidth:current===emoji?1:0,borderColor:theme.purple}}><Copy size={22}>{emoji}</Copy></Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Reply to message" onPress={onReply} style={{...row,gap:6,minHeight:44,paddingHorizontal:14,borderRadius:22,backgroundColor:theme.chip}}><Icon name="back" color={theme.purple} size={18}/><Copy weight={800} size={13} color={theme.purple}>Reply</Copy></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Close message actions" onPress={onClose} style={{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'}}><Copy size={18} color={theme.muted}>×</Copy></Pressable>
  </View>
}

/** Drag a message sideways to reply to it, the way chat apps do. Your own messages swipe left, theirs swipe right. */
export function SwipeToReply({children,own,onReply,onLongPress,disabled=false}:{children:React.ReactNode;own:boolean;onReply:()=>void;onLongPress?:()=>void;disabled?:boolean}){
  const {theme}=useDesign()
  const x=useRef(new Animated.Value(0)).current
  const direction=own?-1:1
  const reply=useRef(onReply)
  reply.current=onReply
  const armed=useRef(false)
  const native=Platform.OS!=='web'
  // On touch screens in a browser, let horizontal drags reach the swipe and stop them selecting text. Mouse users keep text selection.
  const touchWeb=Platform.OS==='web'&&typeof window!=='undefined'&&!!window.matchMedia?.('(pointer: coarse)').matches
  const touchStyle=touchWeb?({userSelect:'none',touchAction:'pan-y'} as object):undefined
  const settle=()=>Animated.spring(x,{toValue:0,useNativeDriver:native,bounciness:0}).start()
  const pan=useRef(PanResponder.create({
    onMoveShouldSetPanResponder:(_,gesture)=>gesture.dx*direction>10&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.6,
    onPanResponderGrant:()=>{armed.current=false},
    onPanResponderMove:(_,gesture)=>{const distance=Math.max(0,Math.min(64,gesture.dx*direction*.8));x.setValue(distance*direction);armed.current=distance>=44},
    onPanResponderRelease:()=>{if(armed.current)reply.current();armed.current=false;settle()},
    onPanResponderTerminate:()=>{armed.current=false;settle()},
  })).current
  if(disabled)return <View style={{alignSelf:own?'flex-end':'flex-start',maxWidth:'84%'}}>{children}</View>
  const reveal=x.interpolate({inputRange:own?[-44,0]:[0,44],outputRange:own?[1,0]:[0,1],extrapolate:'clamp'})
  return <View style={{alignSelf:own?'flex-end':'flex-start',maxWidth:'84%'}}>
    <Animated.View pointerEvents="none" style={{position:'absolute',top:0,bottom:0,[own?'right':'left']:8,justifyContent:'center',opacity:reveal,transform:[{scale:reveal}]}}>
      <View style={{width:30,height:30,borderRadius:15,backgroundColor:theme.chip,alignItems:'center',justifyContent:'center'}}><Icon name="back" color={theme.purple} size={17}/></View>
    </Animated.View>
    <Animated.View {...pan.panHandlers} style={[{transform:[{translateX:x}]},touchStyle]}>
      <Pressable accessibilityHint="Swipe sideways to reply. Press and hold for reactions." onLongPress={onLongPress} delayLongPress={320}>{children}</Pressable>
    </Animated.View>
  </View>
}
