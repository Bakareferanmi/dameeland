import React,{useState} from 'react'
import {Image,Pressable,ScrollView,View} from 'react-native'
import {commentGifs,commentStickers,type CommentAttachment,type Note,type Person} from './index'
import {gifImages} from './commentGifs'
import {Avatar,Button,Copy,Field,Icon,IconButton,PersonName,row,spread,useDesign} from './ui'

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
  return <Image accessibilityLabel="Comment photo" source={{uri:attachment.url}} resizeMode="cover"
    style={{width:200,maxWidth:'100%',height:136,borderRadius:12,backgroundColor:theme.chip}}/>
}

export function Comments({list,body,onBody,attachment,onPreset,onPhoto,onRemove,onPost,onProfile,busy,renderGif}:{
  list:Note[];body:string;onBody:(value:string)=>void;attachment?:CommentAttachment;onPreset:(value:Preset)=>void;
  onPhoto?:()=>void;onRemove:()=>void;onPost:()=>void;onProfile:(person:Person)=>void;busy:boolean;renderGif?:GifRenderer;
}){
  const {theme}=useDesign()
  const [picker,setPicker]=useState<'gif'|'sticker'|null>(null)
  const options:Preset[]=picker==='gif'
    ? (Object.keys(commentGifs) as (keyof typeof commentGifs)[]).map(id=>({kind:'gif',id}))
    : (Object.keys(commentStickers) as (keyof typeof commentStickers)[]).map(id=>({kind:'sticker',id}))
  return <>
    <ScrollView style={{maxHeight:260}} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:14,paddingVertical:4}}>
      {list.length?list.map(item=><View key={item.id} style={{...row,alignItems:'flex-start'}}>
        <Pressable accessibilityRole="button" accessibilityLabel={'Open '+item.author.name+' profile'} onPress={()=>onProfile(item.author)}
          hitSlop={4} style={{minWidth:40,minHeight:40,justifyContent:'center',alignItems:'center'}}>
          <Avatar person={item.author} size={36}/>
        </Pressable>
        <View style={{flex:1,gap:5}}>
          <Pressable accessibilityRole="button" onPress={()=>onProfile(item.author)} style={{alignSelf:'flex-start',minHeight:24,justifyContent:'center'}}>
            <PersonName person={item.author}/>
          </Pressable>
          {!!item.body&&<Copy>{item.body}</Copy>}
          {item.attachment&&<CommentMedia attachment={item.attachment} renderGif={renderGif}/>}
        </View>
      </View>):<Copy color={theme.muted}>Be the first to leave a comment.</Copy>}
    </ScrollView>
    <View style={{gap:8,borderTopWidth:1,borderColor:theme.border,paddingTop:12}}>
      <Field label="Add a comment" placeholder="Write a reply…" value={body} onChangeText={onBody} editable={!busy} maxLength={500}/>
      {attachment&&<View style={{...spread,alignItems:'flex-start'}}>
        <CommentMedia attachment={attachment} renderGif={renderGif}/><IconButton name="close" label="Remove attachment" onPress={onRemove}/>
      </View>}
      {!!picker&&<ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{...row,gap:8}}>
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
  </>
}
