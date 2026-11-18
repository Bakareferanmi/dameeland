import React,{useEffect,useRef,useState} from 'react'
import {api} from './index'
import {Button,Card,Copy} from './ui'
import {WhotTable} from './WhotGame'
import type {PlayingCard,Shape} from './whotRules'

type MatchView={id:string;version:number;status:'invited'|'waiting'|'playing'|'finished';hand:PlayingCard[];opponentCount:number;top:PlayingCard;shape:Shape;yourTurn:boolean;won?:boolean}
export default function FriendWhot({base,token,room,opponent}:{base:string;token:string;room:string;opponent:string}){
  const [match,setMatch]=useState<MatchView|null>()
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const sending=useRef(false)
  const path='/rooms/'+encodeURIComponent(room)+'/whot'
  useEffect(()=>{
    const controller=new AbortController()
    let reading=false
    const refresh=async()=>{
      if(reading||sending.current)return
      reading=true
      try{
        const result=await api<MatchView|null>(base,path,{signal:controller.signal},token)
        if(!controller.signal.aborted&&!sending.current)setMatch(current=>current&&result&&current.id===result.id&&current.version>result.version?current:result)
      }catch{
        if(!controller.signal.aborted)setError('Couldn’t sync the match. Retrying…')
      }finally{reading=false}
    }
    void refresh()
    const timer=setInterval(refresh,2500)
    return ()=>{controller.abort();clearInterval(timer)}
  },[base,path,token])
  async function act(action:string,index?:number,shape?:Shape){
    if(sending.current)return
    sending.current=true
    setBusy(true)
    setError('')
    try{
      setMatch(await api<MatchView|null>(base,path,{method:'POST',body:JSON.stringify({action,id:match?.id,version:match?.version,index,shape})},token))
    }catch(reason){setError(reason instanceof Error?reason.message:'Couldn’t update the match.')}
    finally{sending.current=false;setBusy(false)}
  }
  return <>
    {!!error&&<Copy>{error}</Copy>}
    {!match||match.status==='invited'||match.status==='waiting'?<Card>
      <Copy weight={800}>Whot with {opponent}</Copy>
      {match===undefined?<Copy>Checking for a match…</Copy>:match===null?<Button label="Send invite" disabled={busy} onPress={()=>void act('invite')}/>:match.status==='invited'?<Button label="Accept invite" disabled={busy} onPress={()=>void act('accept')}/>:<Copy>Waiting for {opponent} to join.</Copy>}
      {!!match&&<Button label={match.status==='waiting'?'Cancel invite':'Decline invite'} variant="plain" disabled={busy} onPress={()=>void act('dismiss')}/>}
    </Card>:<WhotTable key={match.id} {...match} opponent={opponent} yourTurn={match.yourTurn&&!busy&&match.status==='playing'} onDraw={()=>void act('draw')} onPlay={(index,shape)=>void act('play',index,shape)} onRestart={()=>void act('invite')}/>}
  </>
}
