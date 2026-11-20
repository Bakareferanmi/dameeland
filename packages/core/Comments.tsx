import React,{useEffect,useRef,useState} from 'react'
import {Animated,Image,Pressable,ScrollView,View,Platform} from 'react-native'
import {commentGifs,commentStickers,type CommentAttachment,type Note,type Person} from './index'
import {gifImages} from './commentGifs'
import {Avatar,Button,Copy,displayHandle,Field,Icon,IconButton,LinkedText,PersonName,row,spread,useDesign} from './ui'

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
  const progress=useRef(new Animated.Value(reduced?1:0)).current
  useEffect(()=>{if(reduced){progress.setValue(1);return}Animated.timing(progress,{toValue:1,duration:220,useNativeDriver:Platform.OS!=='web',isInteraction:false}).start()},[progress,reduced])
  return <Animated.View style={{...row,alignItems:'flex-start',marginLeft:item.parentId?28:0,padding:highlighted?8:0,borderRadius:12,backgroundColor:highlighted?theme.chip:'transparent',opacity:progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[8,0]})}]}}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Open '+displayHandle(item.author)+' profile'} onPress={()=>onProfile(item.author)} hitSlop={4} style={{minWidth:40,minHeight:40,justifyContent:'center',alignItems:'center'}}><Avatar person={item.author} size={36}/></Pressable>
    <View style={{flex:1,gap:5}}>
      <Pressable accessibilityRole="button" onPress={()=>onProfile(item.author)} style={{alignSelf:'flex-start',minHeight:24,justifyContent:'center'}}><PersonName person={item.author}/></Pressable>
      {item.replyTo&&<Copy size={12} color={theme.muted}>Replying to {item.replyTo}</Copy>}
      {!!item.body&&<LinkedText>{item.body}</LinkedText>}
      {item.attachment&&<CommentMedia attachment={item.attachment} renderGif={renderGif}/>}
      <View style={row}><Button label={item.liked?'Unlike comment':'Like comment'} variant="plain" onPress={()=>onLike(item)}/>{!!item.likes&&<Copy size={12}>{item.likes}</Copy>}<Button label="Reply" variant="plain" onPress={()=>onReply(item)}/></View>
    </View>
  </Animated.View>
}

export function Comments({list,body,onBody,attachment,onPreset,onPhoto,onRemove,onPost,onProfile,onReply,onCancelReply,onLike,replyTo,highlightId,busy,renderGif}:{
  list:Note[];body:string;onBody:(value:string)=>void;attachment?:CommentAttachment;onPreset:(value:Preset)=>void;
  onPhoto?:()=>void;onRemove:()=>void;onPost:()=>void;onProfile:(person:Person)=>void;onReply:(note:Note)=>void;onCancelReply:()=>void;onLike:(note:Note)=>void;replyTo?:Note|null;highlightId?:string;busy:boolean;renderGif?:GifRenderer;
}){
  const {theme}=useDesign()
  const [picker,setPicker]=useState<'gif'|'sticker'|null>(null)
  const listRef=useRef<React.ComponentRef<typeof ScrollView>>(null)
  const options:Preset[]=picker==='gif'
    ? (Object.keys(commentGifs) as (keyof typeof commentGifs)[]).map(id=>({kind:'gif',id}))
    : (Object.keys(commentStickers) as (keyof typeof commentStickers)[]).map(id=>({kind:'sticker',id}))
  return <View style={{flex:1,gap:12,padding:16}}>
    <ScrollView ref={listRef} style={{flex:1}} keyboardShouldPersistTaps="always" keyboardDismissMode="none" contentContainerStyle={{gap:14,paddingVertical:4}}>
      {list.length?list.map(item=><View key={item.id} onLayout={event=>{if(item.id===highlightId)listRef.current?.scrollTo({y:Math.max(0,event.nativeEvent.layout.y-24),animated:true})}}><CommentEntry item={item} onProfile={onProfile} onReply={onReply} onLike={onLike} highlighted={item.id===highlightId} renderGif={renderGif}/></View>):<Copy color={theme.muted}>Be the first to leave a comment.</Copy>}
    </ScrollView>
    <View style={{gap:8,borderTopWidth:1,borderColor:theme.border,paddingTop:12}}>
      {replyTo&&<View style={spread}><Copy size={12} color={theme.muted}>Replying to {displayHandle(replyTo.author)}</Copy><IconButton name="close" label="Cancel reply" onPress={onCancelReply}/></View>}
      <Field label="Add a comment" placeholder="Write a reply…" value={body} onChangeText={onBody} multiline maxLength={500} style={{maxHeight:110}}/>
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
        <Button label={busy?'Posting…':'Post comment'} disabled={busy||(!body.trim()&&!attachment)} onPress={()=>{setPicker(null);onPost()}}/>
      </View>
    </View>
  </View>
}
