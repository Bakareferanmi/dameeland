import React,{useEffect,useState} from 'react'
import {Pressable,View} from 'react-native'
import {Button,Card,Copy,row,useDesign} from './ui'

type Seat=0|1
type Race={tokens:[number[],number[]];turn:Seat;die:number;winner?:Seat}
const start=():Race=>({tokens:[[-1,-1,-1,-1],[-1,-1,-1,-1]],turn:0,die:0})
const next=(turn:Seat):Seat=>turn===0?1:0
const track=(seat:number,position:number)=>(seat*26+position)%52
const safe=new Set([0,8,13,21,26,34,39,47])
const movable=(state:Race,position:number)=>state.die>0&&(position===-1?state.die===6:position+state.die<=56)
const circuit=[
  '6,1','6,2','6,3','6,4','6,5','5,6','4,6','3,6','2,6','1,6','0,6','0,7','0,8',
  '1,8','2,8','3,8','4,8','5,8','6,9','6,10','6,11','6,12','6,13','6,14','7,14','8,14',
  '8,13','8,12','8,11','8,10','8,9','9,8','10,8','11,8','12,8','13,8','14,8','14,7','14,6',
  '13,6','12,6','11,6','10,6','9,6','8,5','8,4','8,3','8,2','8,1','8,0','7,0','6,0',
]
const pawnColors=['#7C4DFF','#C8F53F']
function pawnSquare(seat:number,position:number,index:number){
  if(position===-1)return (seat?10+Math.floor(index/2)*2:1+Math.floor(index/2)*2)+','+(seat?10+index%2*2:1+index%2*2)
  if(position>=51)return '7,'+(seat?64-position:position-50)
  return circuit[track(seat,position)]
}

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
  if(target<51&&!safe.has(destination)){
    const enemy=next(turn)
    updated[enemy]=updated[enemy].map(value=>value>=0&&value<51&&track(enemy,value)===destination?-1:value)
  }
  return {tokens:updated,die:0,turn:die===6?turn:next(turn),winner:updated[turn].every(value=>value===56)?turn:undefined}
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
    {rules&&<Copy color={theme.muted}>Roll a six to leave the yard or roll again. Follow the cross-shaped track clockwise and enter your colour’s home lane. Land on a rival outside a marked safe square to send them back. Bring all four tokens home with exact rolls.</Copy>}
    <View style={{...row,flexWrap:'wrap'}}>
      <Button label="Vs computer" variant={local?'secondary':'primary'} onPress={()=>{if(local){setLocal(false);setRace(start())}}}/>
      <Button label="Same-device friend" variant={local?'primary':'secondary'} onPress={()=>{if(!local){setLocal(true);setRace(start())}}}/>
    </View>
    <View style={{backgroundColor:'#261743',padding:7,borderRadius:14,width:'100%',maxWidth:450,alignSelf:'center'}}>
      {Array.from({length:15},(_,line)=><View key={line} style={{flexDirection:'row'}}>
        {Array.from({length:15},(_,column)=>{
          const coordinate=line+','+column
          const square=circuit.indexOf(coordinate)
          const markers=race.tokens.flatMap((tokens,seat)=>tokens.flatMap((position,index)=>pawnSquare(seat,position,index)===coordinate?[{seat,index}]:[]))
          const yard=line<6&&column<6?0:line>8&&column>8?1:-1
          const lane=line===7&&column>0&&column<7?0:line===7&&column>7&&column<14?1:-1
          const accent=yard>=0?yard:lane>=0?lane:square===0?0:square===26?1:-1
          const background=accent>=0?pawnColors[accent]:square>=0?'#EEE8FB':'#483466'
          const available=markers.find(marker=>!computer&&race.winner===undefined&&marker.seat===race.turn&&choices.includes(marker.index))
          return <Pressable key={coordinate} accessible={!!available} accessibilityRole={available?'button':undefined} accessibilityLabel={available?'Move token '+(available.index+1):undefined} disabled={!available} onPress={()=>{if(available)setRace(current=>current===race?move(current,available.index):current)}} style={{flex:1,aspectRatio:1,borderWidth:yard>=0?0:.5,borderColor:'#261743',alignItems:'center',justifyContent:'center',backgroundColor:background}}>
            {markers.length?<View style={{width:'86%',aspectRatio:1,borderRadius:18,borderWidth:available?2:1,borderColor:available?'#FFFFFF':'#261743',backgroundColor:pawnColors[markers[0].seat],alignItems:'center',justifyContent:'center'}}><Copy size={9} weight={800} color={markers[0].seat?'#261743':'#FFFFFF'}>{markers.length>1?'×'+markers.length:markers[0].index+1}</Copy></View>:safe.has(square)?<Copy size={9} color="#261743">✦</Copy>:null}
          </Pressable>
        })}
      </View>)}
    </View>
    <View accessibilityLiveRegion="polite"><Copy weight={800}>{race.winner!==undefined?names[race.winner]+' won':names[race.turn]+' to move'+(race.die?' · Rolled '+race.die:'')}</Copy></View>
    {race.tokens.map((tokens,seat)=><View key={seat} style={{...row,flexWrap:'wrap'}}>
      <Copy color={theme.muted}>{names[seat]}</Copy>
      {tokens.map((position,index)=><Button key={index} label={(index+1)+' · '+(position<0?'Yard':position===56?'Home':position>=51?'Lane '+(position-50):'Track')} variant="secondary" disabled={computer||race.winner!==undefined||race.turn!==seat||!choices.includes(index)} onPress={()=>setRace(current=>current===race?move(current,index):current)}/>)}
    </View>)}
    {race.winner!==undefined?<Button label="Play again" onPress={()=>setRace(start())}/>:!race.die?<Button label="Roll dice" disabled={computer} onPress={()=>setRace(roll)}/>:!choices.length?<Button label="Pass turn" disabled={computer} onPress={()=>setRace(current=>current===race?{...current,die:0,turn:next(current.turn)}:current)}/>:null}
  </Card>
}
