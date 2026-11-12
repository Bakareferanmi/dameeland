import React,{useEffect,useRef,useState} from 'react'
import {AccessibilityInfo,Animated,Easing,Image,Platform,View} from 'react-native'
import {art} from './art'

const logoSize=100
const pupilSize=13
// Eye centres in the original 56 × 56 viewBox, whose origin is (4, 8).
const eyeCentres=[20/56,36/56]
const pupilTop=30/56*logoSize-pupilSize/2

export function LoadingScreen({compact=false}:{compact?:boolean}){
  const look=useRef(new Animated.Value(0)).current
  const [animate,setAnimate]=useState(false)
  useEffect(()=>{
    let mounted=true
    AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{if(mounted)setAnimate(!reduced)}).catch(()=>{})
    const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',reduced=>setAnimate(!reduced))
    return ()=>{mounted=false;listener.remove()}
  },[])
  useEffect(()=>{
    if(!animate){look.setValue(0);return}
    const timing=(toValue:number,duration:number)=>Animated.timing(look,{
      toValue,duration,easing:Easing.inOut(Easing.cubic),useNativeDriver:Platform.OS!=='web',isInteraction:false,
    })
    const animation=Animated.loop(Animated.sequence([timing(1,260),timing(1,140),timing(-1,450),timing(-1,140),timing(0,240)]))
    animation.start()
    return ()=>animation.stop()
  },[animate,look])
  const translateX=look.interpolate({inputRange:[-1,1],outputRange:[-5,5]})
  return <View testID="dameeland-loading" accessibilityRole="progressbar" accessibilityLabel="Loading dameeland" accessibilityState={{busy:true}}
    style={{flex:compact?undefined:1,minHeight:compact?208:0,alignItems:'center',justifyContent:'center',backgroundColor:'#4F25D6',borderRadius:compact?20:0}}>
    <View style={{width:logoSize,height:logoSize}} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={{uri:art.loadingLogo}} resizeMode="contain" style={{width:logoSize,height:logoSize}}/>
      {eyeCentres.map(centre=><Animated.View key={centre} testID="logo-pupil" style={{
        position:'absolute',left:centre*logoSize-pupilSize/2,top:pupilTop,width:pupilSize,height:pupilSize,
        borderRadius:pupilSize/2,backgroundColor:'#1B1233',transform:[{translateX}],
      }}/>)}
    </View>
  </View>
}
