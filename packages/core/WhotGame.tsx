import React,{useEffect,useState} from 'react'
import {Pressable,View} from 'react-native'
import {Button,Card,Copy,row,useDesign} from './ui'

import {shapes,type Shape,type PlayingCard,type Match,start,legal,play,draw} from './whotRules'

const shapeNames:Record<PlayingCard['shape'],string>={'●':'Circle','▲':'Triangle','■':'Square','★':'Star','✚':'Cross',Wild:'Wild'}

function CardFace({card,playable=false}:{card:PlayingCard;playable?:boolean}){
  const {theme}=useDesign()
  const color=card.shape==='Wild'?'#261448':theme.text
  return <View style={{width:54,height:75,borderRadius:10,borderWidth:2,borderColor:playable?'#A6CE27':theme.border,backgroundColor:card.shape==='Wild'?'#C8F53F':theme.card,paddingHorizontal:5,paddingVertical:3,justifyContent:'space-between'}}>
    <Copy size={11} weight={800} color={color}>{card.rank}</Copy>
    <Copy size={23} weight={800} color={color} center>{card.shape==='Wild'?'✦':card.shape}</Copy>
    <View style={{alignSelf:'flex-end'}}><Copy size={11} weight={800} color={color}>{card.rank}</Copy></View>
  </View>
}

export default function WhotGame(){
  const [match,setMatch]=useState(start)
  useEffect(()=>{
    if(match.turn!==1||match.winner!==undefined)return
    const timer=setTimeout(()=>setMatch(current=>{
      if(current!==match)return current
      const hand=current.hands[1]
      let index=hand.findIndex(card=>card.shape!=='Wild'&&legal(current,card))
      if(index<0)index=hand.findIndex(card=>card.shape==='Wild')
      if(index<0)return draw(current)
      const chosen=shapes.reduce((best,shape)=>hand.filter(card=>card.shape===shape).length>hand.filter(card=>card.shape===best).length?shape:best)
      return play(current,index,chosen)
    }),550)
    return ()=>clearTimeout(timer)
  },[match])
  return <WhotTable {...{hand:match.hands[0],opponentCount:match.hands[1].length,opponent:'Computer',top:match.pile[0],shape:match.shape,yourTurn:match.turn===0&&match.winner===undefined,won:match.winner===undefined?undefined:match.winner===0}} onDraw={()=>setMatch(current=>current.turn===0?draw(current):current)} onPlay={(index,shape)=>setMatch(current=>current.turn===0?play(current,index,shape):current)} onRestart={()=>setMatch(start())}/>
}

type TableProps={hand:PlayingCard[];opponentCount:number;opponent:string;top:PlayingCard;shape:Shape;yourTurn:boolean;won?:boolean;onDraw:()=>void;onPlay:(index:number,shape?:Shape)=>void;onRestart:()=>void}
export function WhotTable({hand,opponentCount,opponent,top,shape,yourTurn,won,onDraw,onPlay,onRestart}:TableProps){
  const {theme}=useDesign()
  const [wild,setWild]=useState<number|null>(null)
  const [showRules,setShowRules]=useState(false)
  const canPlay=(card:PlayingCard)=>card.shape==='Wild'||card.shape===shape||card.rank===top.rank
  return <Card>
    <View style={{...row,justifyContent:'space-between'}}>
      <Copy weight={800} size={23}>Whot</Copy>
      <Button label={showRules?'Hide rules':'How to play'} variant="plain" onPress={()=>setShowRules(!showRules)}/>
    </View>
    {showRules&&<Copy color={theme.muted}>Quick rules: match the shape or number. A wild lets you choose the next shape. Draw to pass your turn. First to empty their hand wins.</Copy>}
    <View style={{backgroundColor:'#352265',borderRadius:22,padding:16,gap:14,alignItems:'center'}}>
      <Copy color="#FFFFFF" weight={800}>{opponent} · {opponentCount} cards</Copy>
      <View aria-hidden style={{...row,gap:4}}>
        {Array.from({length:Math.min(5,opponentCount)},(_,i)=><View key={i} style={{width:23,height:32,borderRadius:5,borderWidth:1,borderColor:'#BCABEE',backgroundColor:'#563C92',alignItems:'center',justifyContent:'center'}}><Copy color="#C8F53F" size={12}>✦</Copy></View>)}
      </View>
      <View style={{...row,gap:22}}>
        <View style={{alignItems:'center',gap:5}}><CardFace card={top}/><Copy color="#FFFFFF" size={12}>Discard</Copy></View>
        <View style={{alignItems:'center',gap:5}}><Pressable accessibilityRole="button" accessibilityLabel="Draw a card and pass" accessibilityState={{disabled:!yourTurn||wild!==null}} disabled={!yourTurn||wild!==null} onPress={onDraw} style={({pressed})=>({width:54,height:75,borderRadius:10,backgroundColor:'#6245A7',borderColor:'#BCABEE',borderWidth:2,justifyContent:'center',alignItems:'center',opacity:pressed||!yourTurn||wild!==null?.65:1})}><Copy color="#C8F53F" size={24}>✦</Copy></Pressable><Copy color="#FFFFFF" size={12}>Draw & pass</Copy></View>
      </View>
      <Copy color="#FFFFFF" size={12}>Next shape · {shapeNames[shape]} {shape}</Copy>
      <View accessibilityLiveRegion="polite" style={{backgroundColor:'#C8F53F',paddingHorizontal:12,paddingVertical:6,borderRadius:14}}><Copy color="#261448" weight={800}>{won===true?'You won':won===false?opponent+' won':yourTurn?'Your turn':opponent+'’s turn'}</Copy></View>
    </View>
    {wild!==null&&<View style={{gap:8}}><Copy weight={800}>Choose the next shape</Copy><View style={{...row,flexWrap:'wrap'}}>
      {shapes.map(shape=><Button key={shape} label={shape+' '+shapeNames[shape]} variant="secondary" onPress={()=>{onPlay(wild,shape);setWild(null)}}/>)}
      <Button label="Cancel" variant="plain" onPress={()=>setWild(null)}/>
    </View></View>}
    <Copy weight={800}>Your hand · {hand.length} cards</Copy>
    {yourTurn&&wild===null&&<Copy size={12} color={theme.muted}>{hand.some(card=>canPlay(card))?'Tap a card with a lime border to play it.':'No matching cards. Draw to pass your turn.'}</Copy>}
    <View style={{...row,flexWrap:'wrap'}}>
      {hand.map((card,index)=>{
        const playable=yourTurn&&wild===null&&canPlay(card)
        return <Pressable key={card.shape+card.rank+':'+index} accessibilityRole="button" accessibilityLabel={shapeNames[card.shape]+' '+card.rank} accessibilityState={{disabled:!playable}} disabled={!playable} style={({pressed})=>({opacity:pressed?.78:playable?1:.65})} onPress={()=>card.shape==='Wild'?setWild(index):onPlay(index)}><CardFace card={card} playable={playable}/></Pressable>
      })}
    </View>
    {won!==undefined&&<Button label="Play again" onPress={()=>{setWild(null);onRestart()}}/>}
  </Card>
}
