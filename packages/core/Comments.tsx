import React,{useEffect,useRef,useState} from 'react'
import {Animated,Image,Pressable,ScrollView,View,Platform} from 'react-native'
import {commentGifs,commentStickers,type CommentAttachment,type Note,type Person} from './index'
import {gifImages} from './commentGifs'
import {Avatar,Button,Copy,displayHandle,Field,Icon,IconButton,LinkedText,PersonName,row,spread,useDesign} from './ui'
import {MentionField} from './Social'

export type GifRenderer=React.ComponentType<{uri:string;label:string;animate:boolean}>
type Preset=Exclude<CommentAttachment,{kind:'image'}>

function CommentMedia({attachment,renderGif:Gif}:{attachment:CommentAttachment;renderGif?:GifRenderer}){
  const {theme,reduced}=useDesign()
  if(attachment.kind==='sticker'){
    const {emoji,label}=commentStickers[attachment.id]
    return <View style={{...row,alignSelf:'flex-start',backgroundColor:theme.chip,borderRadius:16,paddingHorizontal:12,paddingVertical:6}}>
      <Copy size={24}>{emoji}</Copy><Copy size={13} weight={800} color={theme.ink}>{label}</Copy>
    </View>
  }
  if(attachment.kind==='gif'){
    const label=commentGifs[attachment.id],uri=gifImages[attachment.id]
    return Gif?<Gif uri={uri} label={label+' GIF'} animate={!reduced}/>:<Image accessibilityLabel={label+' GIF'} source={{uri}} style={{width:96,height:64,borderRadius:10}}/>
  }
  if(attachment.url.toLowerCase().endsWith('.gif')&&Gif)return <Gif uri={attachment.url} label="Comment GIF" animate={!reduced}/>
  return <Image accessibilityLabel="Comment photo" source={{uri:attachment.url}} resizeMode="cover"
    style={{width:200,maxWidth:'100%',height:136,borderRadius:12,backgroundColor:theme.chip}}/>
}
function CommentEntry({item,onProfile,onReply,onLike,highlighted,renderGif}:{item:Note;onProfile:(person:Person)=>void;onReply:(note:Note)=>void;onLike:(note:Note)=>void;highlighted:boolean;renderGif?:GifRenderer}){
  const {reduced,theme}=useDesign()
  // Only a comment the person just wrote animates in. Loaded comments render in place so the list never pops.
  const entering=Boolean(item.pending)&&!reduced
  const progress=useRef(new Animated.Value(entering?0:1)).current
  useEffect(()=>{if(!entering)return;Animated.timing(progress,{toValue:1,duration:160,useNativeDriver:Platform.OS!=='web',isInteraction:false}).start()},[])
  return <Animated.View style={{...row,alignItems:'flex-start',marginLeft:item.parentId?28:0,padding:highlighted?8:0,borderRadius:12,backgroundColor:highlighted?theme.chip:'transparent',opacity:item.pending?Animated.multiply(progress,0.7):progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[8,0]})}]}}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Open '+displayHandle(item.author)+' profile'} onPress={()=>onProfile(item.author)} hitSlop={4} style={{minWidth:40,minHeight:40,justifyContent:'center',alignItems:'center'}}><Avatar person={item.author} size={36}/></Pressable>
    <View style={{flex:1,gap:5}}>
      <Pressable accessibilityRole="button" onPress={()=>onProfile(item.author)} style={{alignSelf:'flex-start',minHeight:24,justifyContent:'center'}}><PersonName person={item.author}/></Pressable>
      {item.replyTo&&<Copy size={12} color={theme.muted}>Replying to {item.replyTo}</Copy>}
      {!!item.body&&<LinkedText>{item.body}</LinkedText>}
      {item.attachment&&<CommentMedia attachment={item.attachment} renderGif={renderGif}/>}
      <View style={row}><Button label={item.liked?'Unlike comment':'Like comment'} variant="plain" disabled={item.pending} onPress={()=>onLike(item)}/>{!!item.likes&&<Copy size={12}>{item.likes}</Copy>}<Button label="Reply" variant="plain" disabled={item.pending} onPress={()=>onReply(item)}/></View>
    </View>
  </Animated.View>
}
function CommentSkeleton(){
  const {theme,reduced}=useDesign()
  const pulse=useRef(new Animated.Value(.55)).current
  useEffect(()=>{
    if(reduced)return
    const loop=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1,duration:700,useNativeDriver:Platform.OS!=='web',isInteraction:false}),Animated.timing(pulse,{toValue:.55,duration:700,useNativeDriver:Platform.OS!=='web',isInteraction:false})]))
    loop.start()
    return ()=>loop.stop()
  },[pulse,reduced])
  return <Animated.View accessibilityLabel="Loading comments" style={{gap:18,opacity:pulse}}>
    {[0,1,2].map(index=><View key={index} style={{...row,alignItems:'flex-start'}}>
      <View style={{width:36,height:36,borderRadius:18,backgroundColor:theme.chip}}/>
      <View style={{flex:1,gap:8}}><View style={{width:'38%',height:12,borderRadius:6,backgroundColor:theme.chip}}/><View style={{width:index===1?'92%':'74%',height:12,borderRadius:6,backgroundColor:theme.chip}}/></View>
    </View>)}
  </Animated.View>
}

export function Comments({list,body,onBody,attachment,onPreset,onPhoto,onRemove,onPost,onProfile,onReply,onCancelReply,onLike,replyTo,highlightId,header,loading=false,failed=false,onRetry,renderGif,base,token,demo}:{
  list:Note[];body:string;onBody:(value:string)=>void;attachment?:CommentAttachment;onPreset:(value:Preset)=>void;
  onPhoto?:()=>void;onRemove:()=>void;onPost:()=>void;onProfile:(person:Person)=>void;onReply:(note:Note)=>void;onCancelReply:()=>void;onLike:(note:Note)=>void;replyTo?:Note|null;highlightId?:string;header?:React.ReactNode;loading?:boolean;failed?:boolean;onRetry?:()=>void;renderGif?:GifRenderer;base?:string;token?:string;demo?:boolean;
}){
  const {theme}=useDesign()
  const [picker,setPicker]=useState<'gif'|'sticker'|null>(null)
  const listRef=useRef<React.ComponentRef<typeof ScrollView>>(null)
  const last=list.at(-1)
  // Lazy list: the post, composer and first comments paint on the first frame, the rest fill in a chunk per frame.
  const [visible,setVisible]=useState(6)
  useEffect(()=>{
    if(visible>=list.length)return
    const frame=requestAnimationFrame(()=>setVisible(count=>count+10))
    return ()=>cancelAnimationFrame(frame)
  },[visible,list.length])
  const highlightIndex=highlightId?list.findIndex(item=>item.id===highlightId):-1
  const cap=Math.max(visible,highlightIndex+1,last?.pending?list.length:0)
  useEffect(()=>{if(last?.pending)requestAnimationFrame(()=>listRef.current?.scrollToEnd({animated:true}))},[last?.id,last?.pending])
  const options:Preset[]=picker==='gif'
    ? (Object.keys(commentGifs) as (keyof typeof commentGifs)[]).map(id=>({kind:'gif',id}))
    : (Object.keys(commentStickers) as (keyof typeof commentStickers)[]).map(id=>({kind:'sticker',id}))
  return <View style={{flex:1,gap:12,padding:16}}>
    <ScrollView ref={listRef} style={{flex:1}} keyboardShouldPersistTaps="always" keyboardDismissMode="none" contentContainerStyle={{gap:14,paddingVertical:4}}>
      {header}
      {list.length?list.slice(0,cap).map(item=><View key={item.clientId??item.id} onLayout={event=>{if(item.id===highlightId)listRef.current?.scrollTo({y:Math.max(0,event.nativeEvent.layout.y-24),animated:true})}}><CommentEntry item={item} onProfile={onProfile} onReply={onReply} onLike={onLike} highlighted={item.id===highlightId} renderGif={renderGif}/></View>):loading?<CommentSkeleton/>:failed?<View style={{gap:8,alignItems:'flex-start'}}><Copy color={theme.muted}>Couldn’t load comments.</Copy>{onRetry&&<Button label="Try again" variant="secondary" onPress={onRetry}/>}</View>:<Copy color={theme.muted}>Be the first to leave a comment.</Copy>}
    </ScrollView>
    <View style={{gap:8,borderTopWidth:1,borderColor:theme.border,paddingTop:12}}>
      {replyTo&&<View style={spread}><Copy size={12} color={theme.muted}>Replying to {displayHandle(replyTo.author)}</Copy><IconButton name="close" label="Cancel reply" onPress={onCancelReply}/></View>}
      <MentionField label="Add a comment" placeholder="Write a reply… tag people with @" value={body} onChange={onBody} base={base??''} token={token} demo={demo??true} maxLength={500} style={{maxHeight:110}}/>
      {attachment&&<View style={{...spread,alignItems:'flex-start'}}>
        <CommentMedia attachment={attachment} renderGif={renderGif}/><IconButton name="close" label="Remove attachment" onPress={onRemove}/>
      </View>}
      {!!picker&&<ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{...row,gap:8}}>
        {options.map(option=>{
          const label=option.kind==='gif'?commentGifs[option.id]+' GIF':commentStickers[option.id].label+' sticker'
          return <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={label} onPress={()=>{onPreset(option);setPicker(null)}}
            style={{padding:3,borderRadius:12,borderWidth:1,borderColor:theme.border}}>
            <CommentMedia attachment={option} renderGif={renderGif}/>
          </Pressable>
        })}
      </ScrollView>}
      <View style={{...spread,gap:2,flexWrap:'wrap'}}>
        <View style={{...row,gap:1}}>
          {onPhoto&&<IconButton name="image" label="Upload comment photo" onPress={()=>{setPicker(null);onPhoto()}}/>}
          <Pressable accessibilityRole="button" accessibilityLabel="Add GIF" accessibilityState={{expanded:picker==='gif'}} onPress={()=>setPicker(picker==='gif'?null:'gif')}
            style={{minHeight:44,minWidth:44,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:picker==='gif'?theme.chip:'transparent'}}>
            <Copy weight={800} color={theme.ink} size={13}>GIF</Copy>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Add sticker" accessibilityState={{expanded:picker==='sticker'}} onPress={()=>setPicker(picker==='sticker'?null:'sticker')}
            style={{minHeight:44,minWidth:44,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:picker==='sticker'?theme.chip:'transparent'}}>
            <Icon name="sticker" color={theme.ink} size={21}/>
          </Pressable>
        </View>
        <Button label="Post comment" disabled={!body.trim()&&!attachment} onPress={()=>{setPicker(null);onPost()}}/>
      </View>
    </View>
  </View>
}
