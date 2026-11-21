import React,{useEffect,useRef} from 'react'
import {Animated,Easing,Platform,View} from 'react-native'
import {Copy,Icon,IconButton,row,useDesign} from './ui'

export type ToastMessage={id:string;message:string;tone:'success'|'error'}
export function Toast({item,reduced,onDismiss,bottom}:{item:ToastMessage;reduced:boolean;onDismiss:(id:string)=>void;bottom:number}){
  const {theme}=useDesign()
  const animation=useRef(new Animated.Value(reduced?1:0)).current
  const close=useRef(onDismiss)
  close.current=onDismiss
  const dismiss=useRef<()=>void>(()=>{})
  useEffect(()=>{
    let active=true
    const timing=(toValue:number,duration:number)=>Animated.timing(animation,{
      toValue,duration,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web',isInteraction:false,
    })
    if(reduced)animation.setValue(1)
    else timing(1,220).start()
    const finish=()=>{if(active)close.current(item.id)}
    const leave=()=>{
      clearTimeout(timer)
      if(reduced)finish()
      else timing(0,160).start(({finished})=>{if(finished)finish()})
    }
    const timer=setTimeout(leave,item.tone==='error'?5200:3500)
    dismiss.current=leave
    return ()=>{active=false;clearTimeout(timer);animation.stopAnimation()}
  },[animation,item.id,item.tone,reduced])
  const background=item.tone==='error'?'#8B2447':theme.card
  const ink=item.tone==='error'?'#FFFFFF':theme.text
  return <Animated.View testID="app-toast" style={{
    position:'absolute',alignSelf:'center',bottom,zIndex:10,maxWidth:'88%',width:380,
    borderRadius:15,borderWidth:1,borderColor:item.tone==='error'?'#8B2447':theme.border,
    backgroundColor:background,paddingLeft:10,paddingRight:2,paddingVertical:2,
    ...row,gap:7,opacity:animation,transform:[{translateY:animation.interpolate({inputRange:[0,1],outputRange:[14,0]})}],
    boxShadow:'0 5px 20px #130B3533',
  }}>
    <Icon name={item.tone==='error'?'bell':'check'} color={item.tone==='error'?'#FFFFFF':theme.ink} size={19}/>
    <View style={{flex:1}} accessibilityRole={item.tone==='error'?'alert':undefined} accessibilityLiveRegion={item.tone==='error'?'assertive':'polite'}>
      <Copy color={ink} size={12} weight={700}>{item.message}</Copy>
    </View>
    <IconButton name="close" label="Dismiss notification" onPress={()=>dismiss.current()} size={17} tint={ink}/>
  </Animated.View>
}
