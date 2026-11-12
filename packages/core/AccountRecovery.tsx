import React,{useState} from 'react'
import {View} from 'react-native'
import {api} from './index'
import {Button,Copy,Field,Segmented,useDesign} from './ui'

type Kind='password'|'username'
type DemoAccount={user:{username?:string};password:string}

export default function AccountRecovery({base,demoEmail,findDemoAccount,onBack}:{base:string;demoEmail:string;findDemoAccount?: (email:string)=>DemoAccount|undefined;onBack:()=>void}){
  const {theme}=useDesign()
  const [kind,setKind]=useState<Kind>('password')
  const [email,setEmail]=useState(demoEmail.includes('@')?demoEmail:'')
  const [sentTo,setSentTo]=useState('')
  const [code,setCode]=useState(''),[password,setPassword]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [done,setDone]=useState(false)
  async function send(){
    const address=email.trim().toLowerCase()
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){setError('Enter your account email.');return}
    setBusy(true);setError('');setNotice('')
    try{
      if(!findDemoAccount)await api(base,'/auth/recovery/request',{method:'POST',body:JSON.stringify({email:address,kind})})
      const account=findDemoAccount?.(address)
      setSentTo(address)
      setNotice(findDemoAccount
        ?kind==='username'?(account?.user.username?'Your demo username is @'+account.user.username+'.':'Create a demo account first to try username recovery.')
          :(account?'Use this demo reset code: DAMEE1234567.':'Create a demo account first to try a password reset.')
        :kind==='username'?'If an account matches, we’ll email its username.':'If an account matches, we’ll email a reset code.')
    }catch(reason){setError(reason instanceof Error?reason.message:'Couldn’t request recovery. Try again.')}
    finally{setBusy(false)}
  }
  async function reset(){
    if(password.length<8||password.length>128){setError('Choose a password with 8 to 128 characters.');return}
    setBusy(true);setError('')
    try{
      if(findDemoAccount){
        const account=findDemoAccount(sentTo)
        if(!account||code.trim().toUpperCase()!=='DAMEE1234567')throw new Error('That demo code is invalid.')
        account.password=password
      }else await api(base,'/auth/recovery/reset',{method:'POST',body:JSON.stringify({email:sentTo,code,password})})
      setDone(true);setNotice('Password updated. You can log in now.')
    }catch(reason){setError(reason instanceof Error?reason.message:'Couldn’t reset your password. Try again.')}
    finally{setBusy(false)}
  }
  const enteringCode=kind==='password'&&!!sentTo&&!done
  return <>
    <Copy size={24} weight={800}>Recover your account</Copy>
    {!done&&<>
      <Segmented options={['Password','Username']} selected={kind==='password'?'Password':'Username'} onSelect={value=>{
        if(busy)return
        setKind(value==='Password'?'password':'username');setSentTo('');setNotice('');setError('');setCode('');setPassword('')
      }}/>
      <Field label="Account email" value={email} onChangeText={setEmail} editable={!busy&&!enteringCode} keyboardType="email-address" autoCapitalize="none" maxLength={254}/>
    </>}
    {!!notice&&<View accessibilityLiveRegion="polite"><Copy color={theme.muted}>{notice}</Copy></View>}
    {enteringCode&&<>
      <Field label="Reset code" value={code} onChangeText={setCode} autoCapitalize="characters" autoComplete="one-time-code" autoCorrect={false} maxLength={12}/>
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128}/>
    </>}
    {!!error&&<View accessibilityRole="alert"><Copy>{error}</Copy></View>}
    {!done&&<Button label={busy?'Please wait…':enteringCode?'Reset password':kind==='password'?'Email reset code':'Email my username'}
      disabled={busy} onPress={()=>void (enteringCode?reset():send())}/>}
    {enteringCode&&<Button label="Send another code" variant="plain" disabled={busy} onPress={()=>void send()}/>}
    <Button label="Back to login" variant="secondary" disabled={busy} onPress={onBack}/>
  </>
}
