import React,{useEffect,useState} from 'react'
import {Pressable,View} from 'react-native'
import {Button,Card,Copy,row,useDesign} from './ui'

type Seat=0|1
type Race={tokens:[number[],number[]];turn:Seat;die:number;winner?:Seat}
const start=():Race=>({tokens:[[-1,-1,-1,-1],[-1,-1,-1,-1]],turn:0,die:0})
const next=(turn:Seat):Seat=>turn===0?1:0
const track=(seat:number,position:number)=>(seat*26+position)%52
const safe=new Set([0,8,13,21,26,34,39,47])
const movable=(state:Race,position:number)=>state.die>0&&(position===-1?state.die===6:position+state.die<=57)

function roll(state:Race):Race{
  if(state.die||state.winner!==undefined)return state
  return {...state,die:1+Math.floor(Math.random()*6)}
}
function move(state:Race,index:number):Race{
  const {turn,tokens,die}=state
  const position=tokens[turn][index]
  if(state.winner!==undefined||!movable(state,position))return state
  const target=position===-1?0:position+die
  const updated:[number[],number[]]=[[...tokens[0]],[...tokens[1]]]
  updated[turn][index]=target
  const destination=track(turn,target)
  if(target<52&&!safe.has(destination)){
    const enemy=next(turn)
    updated[enemy]=updated[enemy].map(value=>value>=0&&value<52&&track(enemy,value)===destination?-1:value)
  }
  return {tokens:updated,die:0,turn:die===6?turn:next(turn),winner:updated[turn].every(value=>value===57)?turn:undefined}
}

export default function LudoGame(){
  const {theme}=useDesign()
  const [race,setRace]=useState(start)
  const [local,setLocal]=useState(false)
  const [rules,setRules]=useState(false)
  const names=local?['Purple','Lime']:['You','Computer']
  const computer=!local&&race.turn===1
  const choices=race.tokens[race.turn].map((position,index)=>movable(race,position)?index:-1).filter(index=>index>=0)
  useEffect(()=>{
    if(!computer||race.winner!==undefined)return
    const timer=setTimeout(()=>setRace(current=>{
      if(current!==race)return current
      if(!current.die)return roll(current)
      const index=current.tokens[1].findIndex(position=>movable(current,position))
      return index===-1?{...current,die:0,turn:0}:move(current,index)
    }),600)
    return ()=>clearTimeout(timer)
  },[computer,race])
  return <Card>
    <View style={{...row,justifyContent:'space-between',flexWrap:'wrap'}}>
      <Copy size={23} weight={800}>Ludo</Copy>
      <Button label={rules?'Hide rules':'How to play'} variant="plain" onPress={()=>setRules(!rules)}/>
    </View>
    {rules&&<Copy color={theme.muted}>Roll a six to leave the yard or roll again. Land on a rival outside a safe square to send them back. Finish all four tokens with exact rolls. The track reads left to right across each row.</Copy>}
    <View style={{...row,flexWrap:'wrap'}}>
      <Button label="Vs computer" variant={local?'secondary':'primary'} onPress={()=>{if(local){setLocal(false);setRace(start())}}}/>
      <Button label="Same-device friend" variant={local?'primary':'secondary'} onPress={()=>{if(!local){setLocal(true);setRace(start())}}}/>
    </View>
    <View style={{backgroundColor:'#352265',padding:10,borderRadius:17,gap:3}}>
      {Array.from({length:4},(_,line)=><View key={line} style={{flexDirection:'row',gap:2}}>
        {Array.from({length:13},(_,column)=>{
          const square=line*13+column
          const markers=race.tokens.flatMap((tokens,seat)=>tokens.flatMap((position,index)=>position>=0&&position<52&&track(seat,position)===square?[{seat,index}]:[]))
          return <View key={square} accessibilityLabel={'Square '+(square+1)+(safe.has(square)?', safe':'')+markers.map(({seat,index})=>', '+names[seat]+' token '+(index+1)).join('')} style={{flex:1,minHeight:25,borderRadius:4,alignItems:'center',justifyContent:'center',backgroundColor:safe.has(square)?'#635286':'#463376'}}>
            {markers.length?<Copy size={11} color={markers[0].seat===0?'#E3CFFF':'#C8F53F'} weight={800}>{markers.map(marker=>marker.index+1).join('·')}</Copy>:<Copy color="#C6B8E5" size={9}>{safe.has(square)?'✦':square+1}</Copy>}
          </View>
        })}
      </View>)}
    </View>
    <View accessibilityLiveRegion="polite"><Copy weight={800}>{race.winner!==undefined?names[race.winner]+' won':names[race.turn]+' to move'+(race.die?' · Rolled '+race.die:'')}</Copy></View>
    {race.tokens.map((tokens,seat)=><View key={seat} style={{...row,flexWrap:'wrap'}}>
      <Copy color={theme.muted}>{names[seat]}</Copy>
      {tokens.map((position,index)=><Button key={index} label={(index+1)+' · '+(position<0?'Yard':position===57?'Home':position>=52?'Lane '+(position-51):'Tile '+(track(seat,position)+1))} variant="secondary" disabled={computer||race.winner!==undefined||race.turn!==seat||!choices.includes(index)} onPress={()=>setRace(current=>current===race?move(current,index):current)}/>)}
    </View>)}
    {race.winner!==undefined?<Button label="Play again" onPress={()=>setRace(start())}/>:!race.die?<Button label="Roll dice" disabled={computer} onPress={()=>setRace(roll)}/>:!choices.length?<Button label="Pass turn" disabled={computer} onPress={()=>setRace(current=>current===race?{...current,die:0,turn:next(current.turn)}:current)}/>:null}
  </Card>
}
