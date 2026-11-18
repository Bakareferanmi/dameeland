import React,{useEffect,useRef,useState} from 'react'
import {AccessibilityInfo,Animated,Easing,Image,Platform,View} from 'react-native'
import {art} from './art'

const logoSize=116
const pupilSize=13
// Eye centres in the original 56 × 56 viewBox, whose origin is (4, 8).
const eyeCentres=[20/56,36/56]
const pupilTop=30/56*logoSize-pupilSize/2

export function LoadingScreen({compact=false}:{compact?:boolean}){
  const look=useRef(new Animated.Value(0)).current
  const pulse=useRef(new Animated.Value(1)).current
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
  useEffect(()=>{
    if(!animate){pulse.setValue(1);return}
    const animation=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1.045,duration:900,easing:Easing.inOut(Easing.quad),useNativeDriver:Platform.OS!=='web',isInteraction:false}),Animated.timing(pulse,{toValue:1,duration:900,easing:Easing.inOut(Easing.quad),useNativeDriver:Platform.OS!=='web',isInteraction:false})]))
    animation.start()
    return ()=>animation.stop()
  },[animate,pulse])
  const translateX=look.interpolate({inputRange:[-1,1],outputRange:[-5,5]})
  if(Platform.OS==='web'&&!compact)return React.createElement('div',{
    className:'dameen-loading-screen',role:'progressbar','aria-label':'Loading dameen','aria-busy':true,
  },React.createElement('svg',{className:'dameen-loading-mark',viewBox:'0 0 64 64','aria-hidden':true},
    React.createElement('rect',{width:64,height:64,rx:18,fill:'#6A35F0'}),
    React.createElement('path',{d:'M10 52C10 32 19 18 32 18C45 18 54 32 54 52Q54 54 52 54H12Q10 54 10 52Z',fill:'#C8F53F'}),
    React.createElement('circle',{cx:24,cy:38,r:8.5,fill:'#fff'}),
    React.createElement('circle',{cx:40,cy:38,r:8.5,fill:'#fff'}),
    React.createElement('circle',{className:'dameen-loading-pupil left',cx:26.2,cy:36.2,r:3.7,fill:'#1B1233'}),
    React.createElement('circle',{className:'dameen-loading-pupil right',cx:42.2,cy:36.2,r:3.7,fill:'#1B1233'}),
  ))
  return <View testID="dameeland-loading" accessibilityRole="progressbar" accessibilityLabel="Loading dameen" accessibilityState={{busy:true}}
    style={{flex:compact?undefined:1,minHeight:compact?208:0,alignItems:'center',justifyContent:'center',backgroundColor:'#4F25D6',borderRadius:compact?20:0}}>
    <Animated.View style={{width:logoSize,height:logoSize,transform:[{scale:pulse}]}} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={{uri:art.loadingLogo}} resizeMode="contain" style={{width:logoSize,height:logoSize}}/>
      {eyeCentres.map(centre=><Animated.View key={centre} testID="logo-pupil" style={{
        position:'absolute',left:centre*logoSize-pupilSize/2,top:pupilTop,width:pupilSize,height:pupilSize,
        borderRadius:pupilSize/2,backgroundColor:'#1B1233',transform:[{translateX}],
      }}/>)}
    </Animated.View>
  </View>
}

