import React,{createContext,useContext,useEffect,useRef,useState} from 'react'
import {Animated,Image,Platform,Pressable,Text,TextInput,View,type TextInputProps,type ViewStyle} from 'react-native'
import {danger,lime,themes,type Person} from './index'
import {art} from './art'
import {glyphs,type Glyph,type IconRendererProps} from './icons'

export type {Glyph,IconRendererProps} from './icons'
export const Design=createContext({
  theme:themes.light,
  reduced:false,
  font:(weight:number)=>({fontWeight:String(weight) as '500'|'700'|'800'}) as object,
  renderIcon:((_:IconRendererProps)=>null) as React.ComponentType<IconRendererProps>,
})
export const useDesign=()=>useContext(Design)
export const row:ViewStyle={flexDirection:'row',alignItems:'center',gap:10}
export const stack:ViewStyle={gap:16}
export const spread:ViewStyle={...row,justifyContent:'space-between'}

export function Copy({children,size=14,weight=500,color,center=false}:{children:React.ReactNode;size?:number;weight?:number;color?:string;center?:boolean}){
  const {theme,font}=useDesign()
  const lineHeight=Math.ceil(size*(size>=30?1.1:size>=20?1.22:1.42))
  return <Text style={[{color:color??theme.text,fontSize:size,lineHeight,letterSpacing:size>=24?-size*.035:size>=18?-.35:0,textAlign:center?'center':'left'},font(weight)]}>{children}</Text>
}

export function ScreenLinks<Page extends string>({items,open}:{items:readonly (readonly [Page,Glyph])[];open:(page:Page)=>void}){
  return <Card style={{gap:2,padding:12}}>
    {items.map(([page,glyph])=><Pressable key={page} accessibilityRole="button" accessibilityLabel={page} onPress={()=>open(page)} style={{...row,minHeight:50,paddingHorizontal:4}}>
      <IconTile name={glyph} size={34}/><Copy weight={800}>{page}</Copy>
    </Pressable>)}
  </Card>
}

function usePressScale(disabled=false){
  const {reduced}=useDesign()
  const scale=useRef(new Animated.Value(1)).current
  useEffect(()=>{
    if(reduced||disabled)scale.setValue(1)
    return ()=>scale.stopAnimation()
  },[disabled,reduced,scale])
  const animate=(toValue:number)=>{
    if(reduced||disabled)return
    Animated.timing(scale,{toValue,duration:toValue===1?150:90,useNativeDriver:Platform.OS!=='web',isInteraction:false}).start()
  }
  return {scale,onPressIn:()=>animate(.94),onPressOut:()=>animate(1)}
}

export function Button({label,onPress,variant='primary',disabled=false,leading,trailing}:{label:string;onPress:()=>void;variant?:'primary'|'secondary'|'fun'|'plain'|'danger';disabled?:boolean;leading?:Glyph;trailing?:Glyph}){
  const {theme}=useDesign()
  const {scale,...press}=usePressScale(disabled)
  const colors={primary:[theme.purple,'#fff'],secondary:[theme.chip,theme.ink],fun:[lime,'#1B1233'],plain:['transparent',theme.text],danger:[danger,'#fff']}
  const [backgroundColor,color]=colors[variant]
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} {...press}
    style={({pressed})=>({...row,gap:8,minHeight:46,minWidth:44,paddingHorizontal:17,borderRadius:14,justifyContent:'center',backgroundColor,opacity:disabled?.5:pressed?.75:1})}>
    <Animated.View style={{...row,gap:8,justifyContent:'center',transform:[{scale}]}}>
    {leading&&<Icon name={leading} size={18} color={color}/>}
    <Copy color={color} weight={800} size={13}>{label}</Copy>
    {trailing&&<Icon name={trailing} size={18} color={color}/>}
    </Animated.View>
  </Pressable>
}

export function Segmented({options,selected,onSelect}:{options:readonly string[];selected:string;onSelect:(option:string)=>void}){
  const {theme}=useDesign()
  return <View style={{...row,gap:4,backgroundColor:theme.chip,borderRadius:15,padding:4}}>
    {options.map(option=>{
      const active=selected===option
      return <Pressable key={option} accessibilityRole="button" accessibilityState={{selected:active}} onPress={()=>onSelect(option)}
        style={({pressed})=>({flex:1,minHeight:44,justifyContent:'center',alignItems:'center',borderRadius:11,backgroundColor:active?theme.card:'transparent',opacity:pressed?.7:1,borderWidth:1,borderColor:active?theme.border:'transparent'})}>
        <Copy size={13} color={active?theme.ink:theme.muted} weight={800}>{option}</Copy>
      </Pressable>
    })}
  </View>
}

export function Card({children,style}:{children:React.ReactNode;style?:ViewStyle}){
  const {theme}=useDesign()
  return <View style={[{backgroundColor:theme.card,borderColor:theme.border,borderWidth:1,borderRadius:20,padding:16,gap:13},style]}>{children}</View>
}

export function Field({label,glyph,action,onAction,actionLabel,style,onFocus,onBlur,...props}:TextInputProps&{label:string;glyph?:Glyph;action?:Glyph;onAction?:()=>void;actionLabel?:string}){
  const {theme,font}=useDesign()
  const [focused,setFocused]=useState(false)
  return <View style={{gap:7,flexShrink:1}}>
    <Copy size={13} weight={800}>{label}</Copy>
    <View style={{...row,gap:8,paddingLeft:glyph?13:0,borderRadius:13,borderWidth:1,borderColor:focused?theme.purple:theme.border,backgroundColor:theme.card}}>
      {glyph&&<Icon name={glyph} color={theme.muted} size={19}/>}
      <TextInput accessibilityLabel={label} placeholderTextColor={theme.muted} {...props}
        onFocus={event=>{setFocused(true);onFocus?.(event)}} onBlur={event=>{setFocused(false);onBlur?.(event)}}
        style={[{flex:1,minWidth:0,color:theme.text,minHeight:48,paddingHorizontal:glyph?0:13,paddingVertical:11,fontSize:14},font(500),style]}/>
      {action&&onAction&&actionLabel&&<IconButton name={action} label={actionLabel} onPress={onAction} size={19}/>}
    </View>
  </View>
}

export function Avatar({person,size=44,ring=false,seen=false}:{person:Person;size?:number;ring?:boolean;seen?:boolean}){
  const {theme}=useDesign()
  const radius=person.role==='tech'?size*.28:size/2
  return <View style={ring?{borderWidth:1.5,borderColor:seen?theme.border:theme.purple,borderRadius:radius+4,padding:3}:undefined}>
    <View style={{width:size,height:size,borderRadius:radius,backgroundColor:person.color,overflow:'hidden',alignItems:'center',justifyContent:'center'}}><Copy color="#1B1233" size={size*.29} weight={800}>{person.initials}</Copy>{person.avatar&&<Image accessibilityLabel={person.name+' profile photo'} source={{uri:person.avatar}} resizeMode="cover" style={{position:'absolute',width:size,height:size}}/>}</View>
  </View>
}

export function PersonName({person}:{person:Person}){
  const {theme}=useDesign()
  return <View style={{...row,gap:5}}>
    <Copy weight={800}>{person.name}</Copy>
    {person.verified&&<View accessibilityLabel="Verified" style={{backgroundColor:theme.purple,width:16,height:16,borderRadius:8,alignItems:'center',justifyContent:'center'}}><Icon name="check" size={11} color="#fff" strong/></View>}
  </View>
}

export function Logo({variant='brand',size=40}:{variant?:'brand'|'inverse';size?:number}){
  const {theme}=useDesign()
  const uri=variant==='inverse'||theme===themes.dark?art.limeLogo:art.purpleLogo
  return <Image
    accessibilityLabel="dameeland"
    source={{uri}}
    resizeMode="contain"
    style={{width:size,height:size,flexShrink:0}}
  />
}

export function Icon({name,color,size=22,strong=false}:{name:Glyph;color?:string;size?:number;strong?:boolean}){
  const {theme,renderIcon:Renderer}=useDesign()
  const ink=color??theme.text
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width:size,height:size}}>
    <Renderer icon={glyphs[name]} size={size} color={ink} strokeWidth={strong?2.1:1.7} fill={name==='heartOn'?ink:'none'}/>
  </View>
}

export function IconTile({name,color,background,size=38}:{name:Glyph;color?:string;background?:string;size?:number}){
  const {theme}=useDesign()
  return <View style={{width:size,height:size,borderRadius:size*.29,backgroundColor:background??theme.chip,alignItems:'center',justifyContent:'center'}}>
    <Icon name={name} size={Math.round(size*.49)} color={color??theme.ink}/>
  </View>
}

export function IconButton({name,label,onPress,active=false,solid=false,count,size=21,tint}:{name:Glyph;label:string;onPress:()=>void;active?:boolean;solid?:boolean;count?:number;size?:number;tint?:string}){
  const {theme}=useDesign()
  const {scale,...press}=usePressScale()
  const color=tint??(solid?'#fff':active?theme.ink:theme.muted)
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} {...press}
    style={({pressed})=>({...row,gap:6,minHeight:44,minWidth:44,paddingHorizontal:9,borderRadius:14,backgroundColor:solid?theme.purple:active?theme.chip:'transparent',justifyContent:'center',opacity:pressed?.68:1})}>
    <Animated.View style={{...row,gap:6,transform:[{scale}]}}>
    <Icon name={name} color={color} size={size} strong={solid||active}/>
    {count!==undefined&&<Copy color={color} size={12} weight={700}>{count}</Copy>}
    </Animated.View>
  </Pressable>
}
