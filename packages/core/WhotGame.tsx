import React,{useEffect,useState} from 'react'
import {Pressable,View} from 'react-native'
import {Button,Card,Copy,row,useDesign} from './ui'

const shapes=['●','▲','■','★','✚'] as const
type Shape=typeof shapes[number]
type PlayingCard={shape:Shape|'Wild';rank:number}
type Match={hands:[PlayingCard[],PlayingCard[]];deck:PlayingCard[];pile:PlayingCard[];shape:Shape;turn:0|1;winner?:0|1}

function shuffle(cards:PlayingCard[]){
  const result=[...cards]
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1))
    ;[result[i],result[j]]=[result[j],result[i]]
  }
  return result
}

function start():Match{
  const deck=shuffle([
    ...shapes.flatMap(shape=>[1,2,3,4,5,7,8,10,11,12,13,14].map(rank=>({shape,rank}))),
    ...Array.from({length:4},():PlayingCard=>({shape:'Wild',rank:20})),
  ])
  const index=deck.findIndex(card=>card.shape!=='Wild')
  const [top]=deck.splice(index,1)
  return {hands:[deck.splice(0,5),deck.splice(0,5)],deck,pile:[top],shape:top.shape as Shape,turn:0}
}

function legal(match:Match,card:PlayingCard){
  return card.shape==='Wild'||card.shape===match.shape||card.rank===match.pile[0].rank
}

function play(match:Match,index:number,chosen?:Shape):Match{
  const {turn}=match
  const card=match.hands[turn][index]
  if(match.winner!==undefined||!card||!legal(match,card)||card.shape==='Wild'&&!chosen)return match
  const hands:[PlayingCard[],PlayingCard[]]=[...match.hands]
  hands[turn]=hands[turn].filter((_,i)=>i!==index)
  return {...match,hands,pile:[card,...match.pile],shape:card.shape==='Wild'?chosen!:card.shape,
    turn:turn===0?1:0,winner:hands[turn].length===0?turn:undefined}
}

function draw(match:Match):Match{
  const {turn}=match
  if(match.winner!==undefined)return match
  const recycling=!match.deck.length
  const [card,...deck]=recycling?shuffle(match.pile.slice(1)):match.deck
  const hands:[PlayingCard[],PlayingCard[]]=[...match.hands]
  if(card)hands[turn]=[...hands[turn],card]
  return {...match,hands,deck,pile:recycling?match.pile.slice(0,1):match.pile,turn:turn===0?1:0}
}

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
  const {theme}=useDesign()
  const [match,setMatch]=useState(start)
  const [wild,setWild]=useState<number|null>(null)
  const [showRules,setShowRules]=useState(false)
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
  const yourTurn=match.turn===0&&match.winner===undefined
  const top=match.pile[0]
  return <Card>
    <View style={{...row,justifyContent:'space-between'}}>
      <Copy weight={800} size={23}>Whot</Copy>
      <Button label={showRules?'Hide rules':'How to play'} variant="plain" onPress={()=>setShowRules(!showRules)}/>
    </View>
    {showRules&&<Copy color={theme.muted}>Quick rules: match the shape or number. A wild lets you choose the next shape. Draw to pass your turn. First to empty their hand wins.</Copy>}
    <View style={{backgroundColor:'#352265',borderRadius:22,padding:16,gap:14,alignItems:'center'}}>
      <Copy color="#FFFFFF" weight={800}>Computer · {match.hands[1].length} cards</Copy>
      <View aria-hidden style={{...row,gap:4}}>
        {Array.from({length:Math.min(5,match.hands[1].length)},(_,i)=><View key={i} style={{width:23,height:32,borderRadius:5,borderWidth:1,borderColor:'#BCABEE',backgroundColor:'#563C92',alignItems:'center',justifyContent:'center'}}><Copy color="#C8F53F" size={12}>✦</Copy></View>)}
      </View>
      <View style={{...row,gap:22}}>
        <View style={{alignItems:'center',gap:5}}><CardFace card={top}/><Copy color="#FFFFFF" size={12}>Discard</Copy></View>
        <View style={{alignItems:'center',gap:5}}><Pressable accessibilityRole="button" accessibilityLabel="Draw a card and pass" accessibilityState={{disabled:!yourTurn||wild!==null}} disabled={!yourTurn||wild!==null} onPress={()=>setMatch(current=>current.turn===0?draw(current):current)} style={({pressed})=>({width:54,height:75,borderRadius:10,backgroundColor:'#6245A7',borderColor:'#BCABEE',borderWidth:2,justifyContent:'center',alignItems:'center',opacity:pressed||!yourTurn||wild!==null?.65:1})}><Copy color="#C8F53F" size={24}>✦</Copy></Pressable><Copy color="#FFFFFF" size={12}>Draw & pass</Copy></View>
      </View>
      <Copy color="#FFFFFF" size={12}>Next shape · {shapeNames[match.shape]} {match.shape}</Copy>
      <View accessibilityLiveRegion="polite" style={{backgroundColor:'#C8F53F',paddingHorizontal:12,paddingVertical:6,borderRadius:14}}><Copy color="#261448" weight={800}>{match.winner===0?'You won':match.winner===1?'Computer won':yourTurn?'Your turn':'Computer’s turn'}</Copy></View>
    </View>
    {wild!==null&&<View style={{gap:8}}><Copy weight={800}>Choose the next shape</Copy><View style={{...row,flexWrap:'wrap'}}>
      {shapes.map(shape=><Button key={shape} label={shape+' '+shapeNames[shape]} variant="secondary" onPress={()=>{setMatch(current=>play(current,wild,shape));setWild(null)}}/>)}
      <Button label="Cancel" variant="plain" onPress={()=>setWild(null)}/>
    </View></View>}
    <Copy weight={800}>Your hand · {match.hands[0].length} cards</Copy>
    {yourTurn&&wild===null&&<Copy size={12} color={theme.muted}>{match.hands[0].some(card=>legal(match,card))?'Tap a card with a lime border to play it.':'No matching cards. Draw to pass your turn.'}</Copy>}
    <View style={{...row,flexWrap:'wrap'}}>
      {match.hands[0].map((card,index)=>{
        const playable=yourTurn&&wild===null&&legal(match,card)
        return <Pressable key={card.shape+card.rank+':'+index} accessibilityRole="button" accessibilityLabel={shapeNames[card.shape]+' '+card.rank} accessibilityState={{disabled:!playable}} disabled={!playable} style={({pressed})=>({opacity:pressed?.78:playable?1:.65})} onPress={()=>card.shape==='Wild'?setWild(index):setMatch(current=>current.turn===0?play(current,index):current)}><CardFace card={card} playable={playable}/></Pressable>
      })}
    </View>
    {match.winner!==undefined&&<Button label="Play again" onPress={()=>{setWild(null);setMatch(start())}}/>}
  </Card>
}
