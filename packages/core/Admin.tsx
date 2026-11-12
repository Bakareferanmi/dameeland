import React,{useEffect,useState} from 'react'
import {ActivityIndicator,View} from 'react-native'
import {api,type AdminAccount,type AdminAccounts,type AdminOverview,type Role} from './index'
import {Avatar,Button,Card,Copy,Field,PersonName,Segmented,row,useDesign} from './ui'

const metrics=[
  ['users','Users'],['newUsers','New users · 7 days'],['activeUsers','Active users · 7 days'],
  ['techUsers','Tech creators'],['verifiedUsers','Verified users'],['posts','Posts'],
  ['comments','Comments'],['likes','Likes'],['reposts','Reposts'],['follows','Follows'],['messages','Messages'],
] as const
const actions={signup:'joined',post:'published a post',comment:'left a comment'} as const
const message=(error:unknown)=>error instanceof Error?error.message:'Try again in a moment.'

export default function Admin({base,token,sample,onSampleChange}:{base:string;token:string;sample?:{overview:AdminOverview;accounts:AdminAccount[]};onSampleChange:(id:string,role:Role,verified:boolean)=>void}){
  const {theme}=useDesign()
  const [tab,setTab]=useState('Overview')
  const [query,setQuery]=useState(''),[revision,refresh]=useState(0)
  const [overview,setOverview]=useState<AdminOverview>()
  const [directory,setDirectory]=useState<AdminAccounts>()
  const [loading,setLoading]=useState(!sample),[saving,setSaving]=useState('')
  const [error,setError]=useState(''),[saveError,setSaveError]=useState('')
  const [cursor,setCursor]=useState('')
  useEffect(()=>{
    if(sample)return
    const controller=new AbortController()
    setLoading(true);setError('')
    const options={signal:controller.signal}
    const request=tab==='Overview'
      ?api<AdminOverview>(base,'/admin/overview',options,token).then(value=>{if(!controller.signal.aborted)setOverview(value)})
      :api<AdminAccounts>(base,'/admin/accounts?q='+encodeURIComponent(query)+'&cursor='+encodeURIComponent(cursor),options,token).then(value=>{if(!controller.signal.aborted)setDirectory(value)})
    request.catch(reason=>{if(!controller.signal.aborted)setError(message(reason))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[base,cursor,query,revision,sample,tab,token])

  const data=sample?.overview??overview
  const search=query.trim().toLowerCase().replace(/^@/,'')
  const accounts=sample?sample.accounts.filter(({person})=>(person.name+' '+(person.username??'')).toLowerCase().includes(search)):directory?.accounts
  async function change(account:AdminAccount,role:Role,verified:boolean){
    if(saving)return
    setSaveError('')
    if(sample){onSampleChange(account.person.id,role,verified);return}
    setSaving(account.person.id)
    try{
      const updated=await api<AdminAccount>(base,'/admin/accounts/'+encodeURIComponent(account.person.id),{method:'PUT',body:JSON.stringify({role,verified})},token)
      setDirectory(previous=>previous&&({...previous,accounts:previous.accounts.map(value=>value.person.id===updated.person.id?updated:value)}))
    }catch(reason){setSaveError(message(reason))}
    finally{setSaving('')}
  }

  return <>
    {sample&&<Copy size={12} color={theme.muted}>Demo data. Changes reset when you reload.</Copy>}
    <Segmented options={['Overview','Accounts']} selected={tab} onSelect={value=>{setTab(value);setSaveError('')}}/>
    {tab==='Accounts'&&<Field label="Search accounts" glyph="search" value={query} maxLength={100} onChangeText={value=>{setCursor('');setQuery(value)}}/>}
    {!!saveError&&<View accessibilityRole="alert"><Copy>{saveError}</Copy></View>}
    {error?<Card><Copy weight={800}>Couldn’t load the dashboard</Copy><Copy color={theme.muted}>{error}</Copy><Button label="Try again" onPress={()=>refresh(value=>value+1)}/></Card>
      :loading&&!sample?<ActivityIndicator accessibilityLabel="Loading admin data" color={theme.purple}/>
      :tab==='Overview'&&data?<>
        <View style={{...row,flexWrap:'wrap',alignItems:'stretch'}}>
          {metrics.map(([key,label])=><Card key={key} style={{flexBasis:'44%',flexGrow:1,gap:4,padding:12}}>
            <Copy size={25} weight={800}>{data[key].toLocaleString()}</Copy><Copy size={12} color={theme.muted}>{label}</Copy>
          </Card>)}
        </View>
        <Card>
          <Copy size={19} weight={800}>Recent activity</Copy>
          {data.activity.length?data.activity.map(item=><View key={item.kind+item.id} style={{gap:3}}>
            <Copy weight={700}>{item.name} {actions[item.kind]}</Copy>
            {!!item.excerpt&&<Copy color={theme.muted}>{item.excerpt}</Copy>}
            <Copy size={12} color={theme.muted}>{new Date(item.created).toLocaleString()}</Copy>
          </View>):<Copy color={theme.muted}>No activity yet.</Copy>}
        </Card>
      </>:tab==='Accounts'&&<>
        {accounts?.length?accounts.map(account=><Card key={account.person.id}>
          <View style={row}><Avatar person={account.person}/><View style={{flex:1}}><PersonName person={account.person}/>
            <Copy size={12} color={theme.muted}>{account.person.username?'@'+account.person.username+' · ':''}{account.person.role==='tech'?'Tech creator':'Student'}</Copy>
            {!!account.email&&<Copy size={12} color={theme.muted}>{account.email}</Copy>}
          </View></View>
          <View style={{...row,flexWrap:'wrap'}}>
            <Button label={account.person.role==='tech'?'Remove tech role':'Assign tech role'} variant="secondary" disabled={!!saving}
              onPress={()=>void change(account,account.person.role==='tech'?'student':'tech',account.independentlyVerified)}/>
            {account.person.role==='tech'?<Copy size={12} color={theme.muted}>Verified with tech role</Copy>
              :<Button label={account.independentlyVerified?'Remove badge':'Give badge'} variant="secondary" disabled={!!saving}
                onPress={()=>void change(account,'student',!account.independentlyVerified)}/>}
          </View>
        </Card>):<Copy color={theme.muted}>{search?'No matching accounts.':'No accounts yet.'}</Copy>}
        {!sample&&<View style={{...row,flexWrap:'wrap'}}>
          {!!cursor&&<Button label="First page" variant="secondary" onPress={()=>setCursor('')}/>}
          {!!directory?.nextCursor&&<Button label="Next page" variant="secondary" onPress={()=>setCursor(directory.nextCursor??'')}/>}
        </View>}
      </>}
  </>
}
