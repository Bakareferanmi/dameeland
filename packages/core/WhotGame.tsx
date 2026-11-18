import React,{useEffect,useState} from 'react'
import {View} from 'react-native'
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

export default function WhotGame(){
  const {theme}=useDesign()
  const [match,setMatch]=useState(start)
  const [wild,setWild]=useState<number|null>(null)
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
    <Copy weight={800} size={21}>Whot · Quick rules</Copy>
    <Copy color={theme.muted}>Match the shape or number. Wild cards let you choose the next shape. First to empty their hand wins.</Copy>
    <Copy>Computer cards remaining · {match.hands[1].length}</Copy>
    <Copy size={22} weight={800} color={theme.purple}>{top.shape} {top.rank} · Next shape {match.shape}</Copy>
    <View accessibilityLiveRegion="polite"><Copy weight={800}>{match.winner===0?'You won':match.winner===1?'Computer won':yourTurn?'Your turn':'Computer’s turn'}</Copy></View>
    {wild!==null&&<View style={{...row,flexWrap:'wrap'}}>
      {shapes.map(shape=><Button key={shape} label={shape} variant="secondary" onPress={()=>{setMatch(current=>play(current,wild,shape));setWild(null)}}/>)}
      <Button label="Cancel" variant="plain" onPress={()=>setWild(null)}/>
    </View>}
    <View style={{...row,flexWrap:'wrap'}}>
      {match.hands[0].map((card,index)=><Button key={card.shape+card.rank+':'+index} label={card.shape+' '+card.rank} variant="secondary" disabled={!yourTurn||wild!==null||!legal(match,card)} onPress={()=>card.shape==='Wild'?setWild(index):setMatch(current=>current.turn===0?play(current,index):current)}/>)}
    </View>
    {match.winner===undefined?<Button label="Draw and pass" disabled={!yourTurn||wild!==null} onPress={()=>setMatch(current=>current.turn===0?draw(current):current)}/>:<Button label="Play again" onPress={()=>{setWild(null);setMatch(start())}}/>}
  </Card>
}
