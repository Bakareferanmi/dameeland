import React,{useState} from 'react'
import {Pressable,ScrollView,View} from 'react-native'
import type {AdminDay,AdminOverview} from './index'
import {Card,Copy,row,spread,useDesign} from './ui'

const metrics=[['signups','Signups'],['posts','Posts'],['comments','Comments'],['likes','Likes'],['reposts','Reposts'],['messages','Messages']] as const
const dayMs=86400000
const dayLabel=(day:string)=>new Date(day+'T00:00:00Z').toLocaleDateString(undefined,{timeZone:'UTC',month:'short',day:'numeric'})
export function sampleAdminSeries(data:AdminOverview,days:number):AdminDay[]{
  const today=Math.floor(Date.now()/dayMs)*dayMs
  const weights=[2,1,3,2,4,3,5]
  const totalWeight=weights.reduce((sum,weight)=>sum+weight,0)
  const totals=[data.newUsers,data.posts,data.comments,data.likes,data.reposts,data.messages]
  return Array.from({length:days},(_,index)=>{
    const weightIndex=index-(days-weights.length)
    const before=weights.slice(0,Math.max(0,weightIndex)).reduce((sum,weight)=>sum+weight,0)
    const after=before+(weights[weightIndex]??0)
    const counts=totals.map(total=>Math.floor(total*after/totalWeight)-Math.floor(total*before/totalWeight))
    return {day:new Date(today-(days-1-index)*dayMs).toISOString().slice(0,10),signups:counts[0],posts:counts[1],comments:counts[2],likes:counts[3],reposts:counts[4],messages:counts[5]}
  })
}

export default function AdminChart({series,days,onRange}:{series:AdminDay[];days:number;onRange:(days:number)=>void}){
  const {theme}=useDesign()
  const [metric,setMetric]=useState<(typeof metrics)[number][0]>('posts')
  const [selected,setSelected]=useState('')
  const point=series.find(item=>item.day===selected)??series.at(-1)
  const label=metrics.find(([key])=>key===metric)?.[1]??'Posts'
  const peak=Math.max(1,...series.map(item=>item[metric]))
  const total=series.reduce((sum,item)=>sum+item[metric],0)

  return <Card>
    <View style={{...spread,flexWrap:'wrap'}}>
      <Copy size={19} weight={800}>Activity over time</Copy>
      <View style={{...row,gap:6}}>
        {[7,30].map(range=><Pressable key={range} accessibilityRole="button" accessibilityState={{selected:range===days}}
          onPress={()=>{setSelected('');onRange(range)}} style={{minHeight:44,minWidth:54,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:range===days?theme.chip:theme.card}}>
          <Copy color={range===days?theme.ink:theme.muted} weight={800} size={12}>{range} days</Copy>
        </Pressable>)}
      </View>
    </View>
    <View style={{...row,gap:5,flexWrap:'wrap'}}>
      {metrics.map(([key,name])=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected:metric===key}}
        onPress={()=>setMetric(key)} style={{minHeight:44,paddingHorizontal:8,justifyContent:'center',borderRadius:10,backgroundColor:metric===key?theme.chip:theme.card}}>
        <Copy size={12} weight={800} color={metric===key?theme.ink:theme.muted}>{name}</Copy>
      </Pressable>)}
    </View>
    {point?<>
      <View style={spread}>
        <Copy weight={800}>{total.toLocaleString()} {label.toLowerCase()} in {days} days</Copy>
        <Copy size={12} color={theme.muted}>{dayLabel(point.day)} · {point[metric].toLocaleString()}</Copy>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={days===30}
        contentContainerStyle={{flexGrow:1,minWidth:'100%'}}>
        <View style={{...row,gap:4,flexGrow:1,alignItems:'flex-end',borderBottomWidth:1,borderColor:theme.border}}>
          {series.map(item=><Pressable key={item.day} accessibilityRole="button"
            accessibilityLabel={dayLabel(item.day)+', '+item[metric]+' '+label.toLowerCase()}
            accessibilityState={{selected:point.day===item.day}} onPress={()=>setSelected(item.day)}
            style={{flex:1,minWidth:44,height:112,justifyContent:'flex-end',paddingHorizontal:3}}>
            <View style={{height:Math.max(2,Math.round(item[metric]/peak*108)),backgroundColor:theme.purple,opacity:point.day===item.day?1:.46,borderRadius:5}}/>
          </Pressable>)}
        </View>
      </ScrollView>
      <View style={spread}><Copy size={11} color={theme.muted}>{dayLabel(series[0].day)}</Copy><Copy size={11} color={theme.muted}>{dayLabel(series.at(-1)!.day)} · UTC</Copy></View>
    </>:<Copy size={13} color={theme.muted}>Loading chart…</Copy>}
  </Card>
}
