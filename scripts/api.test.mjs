import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'

const base=process.env.TEST_API_URL??'http://localhost:8787'
async function request(path,{token,method='GET',body,form,status=200}={}){
  const response=await fetch(base+'/api'+path,{
    method,
    headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},
    body:form??(body?JSON.stringify(body):undefined),
  })
  assert.equal(response.status,status,method+' '+path+' '+(response.ok?'':await response.clone().text()))
  return response.json()
}
const create=async(name,role='student')=>{
  const email=randomUUID()+'@example.test'
  const password='example-passphrase-42'
  const [firstName,lastName]=name.toLowerCase().split(' ')
  const username='u_'+randomUUID().replaceAll('-','').slice(0,16)
  const result=await request('/auth/signup',{method:'POST',body:{firstName,lastName,username,email,password,role},status:201})
  return {...result,email,password,username}
}
const oneMessage=socket=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Timed out waiting for Durable Object broadcast')),5000)
  socket.addEventListener('message',event=>{clearTimeout(timer);resolve(JSON.parse(event.data))},{once:true})
})
const openSocket=(path,token)=>new Promise((resolve,reject)=>{
  const socket=new WebSocket(base.replace(/^http/,'ws')+'/api'+path,['dameeland','ticket.'+token])
  const timer=setTimeout(()=>{socket.close();reject(new Error('WebSocket handshake timed out'))},5000)
  socket.addEventListener('open',()=>{clearTimeout(timer);resolve(socket)},{once:true})
  socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('WebSocket handshake failed'))},{once:true})
})
test('local Worker persists accounts, social activity, media, and private realtime chat',async()=>{
  await request('/health')
  await request('/feed',{status:401})
  await request('/auth/signup',{method:'POST',body:{firstName:'Ada',username:'incomplete',email:'incomplete@example.test',password:'example-passphrase-42'},status:400})
  if(process.env.TEST_GOOGLE_START==='1'){
    const start=await request('/google/start',{method:'POST',body:{role:'tech'}})
    const url=new URL(start.url)
    assert.equal(url.origin,'https://accounts.google.com')
    assert.equal(url.searchParams.get('state'),start.state)
    assert.equal(url.searchParams.get('code_challenge_method'),'S256')
    const payload={state:start.state,exchange:start.exchange}
    assert.deepEqual(await request('/google/exchange',{method:'POST',body:payload,status:202}),{pending:true})
    await request('/google/exchange',{method:'POST',body:{...payload,exchange:'0'.repeat(64)},status:410})
    const cancelled=await fetch(base+'/api/google/callback?error=access_denied&state='+start.state)
    assert.equal(cancelled.status,400)
    await request('/google/exchange',{method:'POST',body:payload,status:400})
  }else{
    await request('/google/start',{method:'POST',body:{role:'student'},status:503})
  }
  const ada=await create('Ada Qa')
  assert.equal(ada.user.name,'Ada Qa')
  assert.equal(ada.user.username,ada.username)
  assert.deepEqual(await request('/auth/username?username='+ada.username.toUpperCase()),{available:false})
  assert.deepEqual(await request('/auth/username?username=unused_'+randomUUID().slice(0,8)),{available:true})
  await request('/auth/username?username=a!',{status:400})
  const duplicate=await request('/auth/signup',{method:'POST',body:{firstName:'Other',lastName:'User',username:ada.username.toUpperCase(),email:randomUUID()+'@example.test',password:ada.password},status:409})
  assert.equal(duplicate.error,'That username is taken.')
  const tobi=await create('Tobi QA','tech')
  const outsider=await create('Outside QA')
  assert.equal(tobi.user.role,'student')
  assert.equal(tobi.user.verified,false)
  assert.equal(tobi.user.isAdmin,false)
  await request('/admin/overview',{status:401})
  await request('/admin/overview',{token:tobi.token,status:403})
  await request('/admin/accounts',{token:tobi.token,status:403})
  await request('/admin/accounts/'+tobi.user.id,{token:tobi.token,method:'PUT',body:{role:'tech',verified:true},status:403})
  if(process.env.TEST_ADMIN_TOKEN){
    const token=process.env.TEST_ADMIN_TOKEN
    assert.equal((await request('/me',{token})).isAdmin,true)
    const matches=await request('/admin/accounts?q='+tobi.username,{token})
    assert.deepEqual(matches.accounts.map(account=>account.person.id),[tobi.user.id])
    const change=(role,verified)=>request('/admin/accounts/'+tobi.user.id,{token,method:'PUT',body:{role,verified}})
    const initial=await request('/admin/overview',{token})
    assert.ok(initial.users>=3&&initial.newUsers>=3&&initial.activeUsers>=3)
    assert.ok(initial.activity.some(item=>item.kind==='signup'&&item.id===tobi.user.id))
    const promoted=await change('tech',false)
    assert.equal(promoted.person.role,'tech')
    assert.equal(promoted.person.verified,true)
    assert.equal((await request('/me',{token:tobi.token})).verified,true)
    assert.equal((await request('/admin/overview',{token})).techUsers,initial.techUsers+1)
    assert.equal((await change('student',true)).person.verified,true)
    assert.equal((await change('student',false)).person.verified,false)
    const gold=await request('/admin/accounts/'+tobi.user.id,{token,method:'PUT',body:{role:'student',verified:false,teacher:true}})
    assert.equal(gold.person.teacher,true)
    assert.equal(gold.person.detail,'Teacher')
    assert.equal((await request('/me',{token:tobi.token})).teacher,true)
    assert.equal((await change('student',false)).person.teacher,true)
    await request('/admin/accounts/'+tobi.user.id,{token,method:'PUT',body:{role:'student',verified:false,teacher:'yes'},status:400})
    assert.ok((await request('/admin/overview',{token})).teacherUsers>=1)
    assert.equal((await request('/admin/accounts/'+tobi.user.id,{token,method:'PUT',body:{role:'student',verified:false,teacher:false}})).person.teacher,false)
  }
  await request('/admin/accounts/'+tobi.user.id,{token:tobi.token,method:'PUT',body:{role:'student',verified:false,teacher:true},status:403})
  await request('/auth/signup',{method:'POST',body:{...ada,firstName:'Ada',lastName:'QA'},status:409})
  await request('/auth/login',{method:'POST',body:{email:ada.email,password:'incorrect passphrase'},status:401})
  const login=await request('/auth/login',{method:'POST',body:ada})
  assert.equal((await request('/me',{token:login.token})).id,ada.user.id)
  assert.notEqual(login.token,ada.token)

  const byUsername=await request('/auth/login',{method:'POST',body:{identifier:'@'+ada.username.toUpperCase(),password:ada.password}})
  assert.equal(byUsername.user.id,ada.user.id)
  await request('/auth/login',{method:'POST',body:{identifier:ada.username,password:'incorrect passphrase'},status:401})
  if(process.env.TEST_RECOVERY_UNCONFIGURED==='1')await request('/auth/recovery/request',{method:'POST',body:{email:ada.email,kind:'password'},status:503})
  const recoveryCode=process.env.TEST_RECOVERY_CODE
  if(recoveryCode){
    const email='recovery@example.test'
    const password='new-recovery-passphrase'
    const reset={email,code:recoveryCode.toUpperCase(),password}
    await request('/auth/recovery/reset',{method:'POST',body:{...reset,email:ada.email},status:400})
    await request('/auth/recovery/reset',{method:'POST',body:reset})
    await request('/auth/recovery/reset',{method:'POST',body:reset,status:400})
    await request('/me',{token:process.env.TEST_RECOVERY_SESSION,status:401})
    const recovered=await request('/auth/login',{method:'POST',body:{identifier:'recovery_qa',password}})
    assert.equal(recovered.user.username,'recovery_qa')
  }

  const file=await readFile(new URL('../packages/core/assets/dameeland-logo.png',import.meta.url))
  const photoForm=()=>{const form=new FormData();form.append('image',new Blob([file],{type:'image/png'}),'profile.png');return form}
  await request('/me/photos/avatar',{method:'PUT',form:photoForm(),status:401})
  await request('/me/photos/avatar',{token:ada.token,method:'PUT',body:{image:'not a file'},status:400})
  const avatar=await request('/me/photos/avatar',{token:ada.token,method:'PUT',form:photoForm()})
  const covered=await request('/me/photos/cover',{token:ada.token,method:'PUT',form:photoForm()})
  assert.equal(covered.avatar,avatar.avatar)
  assert.ok(covered.cover)
  assert.deepEqual(Buffer.from(await (await fetch(covered.cover)).arrayBuffer()),file)
  const replaced=await request('/me/photos/avatar',{token:ada.token,method:'PUT',form:photoForm()})
  assert.notEqual(replaced.avatar,avatar.avatar)
  assert.equal((await fetch(avatar.avatar)).status,404)
  assert.equal((await request('/me',{token:ada.token})).avatar,replaced.avatar)
  const form=new FormData()
  form.append('body','Maths notes from the local test')
  form.append('image',new Blob([file],{type:'image/png'}),'notes.png')
  const post=await request('/posts',{token:ada.token,method:'POST',form,status:201})
  assert.equal((await request('/feed?following=1',{token:tobi.token})).some(p=>p.id===post.id),false)
  const followPath='/people/'+ada.user.id+'/follow'
  const adaStats=followPath+'-stats'
  const tobiStats='/people/'+tobi.user.id+'/follow-stats'
  assert.deepEqual(await request(adaStats,{token:tobi.token}),{followers:0,following:0,followedByViewer:false})
  await request(adaStats,{status:401})
  await request('/stories',{status:401})
  await request('/stories',{token:ada.token,method:'POST',body:{text:'   '},status:400})
  const story=await request('/stories',{token:ada.token,method:'POST',body:{text:'Study session after school'},status:201})
  assert.equal(Date.parse(story.expires)-Date.parse(story.created),12*60*60*1000)
  const photoStoryForm=new FormData()
  photoStoryForm.append('text','Notes')
  photoStoryForm.append('image',new Blob([file],{type:'image/png'}),'story.png')
  const photoStory=await request('/stories',{token:ada.token,method:'POST',form:photoStoryForm,status:201})
  assert.deepEqual(Buffer.from(await (await fetch(photoStory.image)).arrayBuffer()),file)
  assert.deepEqual((await request('/stories',{token:tobi.token})).filter(group=>group.author.id===ada.user.id),[])
  const ownStories=await request('/stories',{token:ada.token})
  assert.equal(ownStories[0].author.id,ada.user.id)
  assert.equal(ownStories[0].stories.length,2)
  await request('/people/missing/follow-stats',{token:tobi.token,status:404})
  await request(followPath,{token:tobi.token,method:'PUT',body:{active:true}})
  const seen=await request('/stories',{token:tobi.token})
  assert.deepEqual(seen.find(group=>group.author.id===ada.user.id)?.stories.map(item=>item.id),[story.id,photoStory.id])
  await request('/stories/'+story.id,{token:tobi.token,method:'DELETE',status:404})
  await request('/stories/'+photoStory.id,{token:ada.token,method:'DELETE'})
  assert.equal((await fetch(photoStory.image)).status,404)
  assert.deepEqual((await request('/stories',{token:tobi.token})).find(group=>group.author.id===ada.user.id)?.stories.map(item=>item.id),[story.id])
  await request('/stories/'+story.id,{token:ada.token,method:'DELETE'})
  assert.deepEqual((await request('/stories',{token:tobi.token})).filter(group=>group.author.id===ada.user.id),[])
  const followers=await request('/people/'+ada.user.id+'/connections/followers',{token:tobi.token})
  assert.deepEqual(followers.people.map(person=>person.id),[tobi.user.id])
  const followingList=await request('/people/'+tobi.user.id+'/connections/following',{token:tobi.token})
  assert.equal(followingList.people[0].avatar,replaced.avatar)
  assert.equal(followingList.nextCursor,null)
  assert.deepEqual((await request('/people/'+tobi.user.id+'/connections/following?cursor='+ada.user.id,{token:tobi.token})).people,[])
  const active=(await request('/feed?following=1',{token:tobi.token})).find(p=>p.id===post.id)
  const image=await fetch(active.media)
  assert.equal(image.headers.get('content-type'),'image/png')
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),file)
  assert.ok((await request('/people?q=Ada%20QA',{token:tobi.token})).some(p=>p.id===ada.user.id&&p.following))
  await request(followPath,{token:tobi.token,method:'PUT',body:{active:true}})
  assert.deepEqual(await request(adaStats,{token:tobi.token}),{followers:1,following:0,followedByViewer:true})
  assert.deepEqual(await request(tobiStats,{token:tobi.token}),{followers:0,following:1,followedByViewer:false})
  await request(followPath,{token:tobi.token,method:'PUT',body:{active:false}})
  assert.deepEqual(await request(adaStats,{token:tobi.token}),{followers:0,following:0,followedByViewer:false})
  assert.equal((await request(tobiStats,{token:tobi.token})).following,0)
  const postPath='/posts/'+post.id
  for(let attempt=0;attempt<2;attempt++) await request(postPath+'/like',{token:tobi.token,method:'PUT',body:{active:true}})
  await request(postPath+'/repost',{token:tobi.token,method:'PUT',body:{active:true}})
  const comment=await request(postPath+'/comments',{token:tobi.token,method:'POST',body:{body:'This helped!'},status:201})
  const updated=(await request('/feed',{token:tobi.token})).find(p=>p.id===post.id)
  assert.deepEqual([updated.likes,updated.comments,updated.reposts,updated.liked],[1,1,1,true])
  assert.equal((await request(postPath+'/comments',{token:ada.token}))[0].id,comment.id)

  const commentsPath=postPath+'/comments'
  const gif=await request(commentsPath,{token:tobi.token,method:'POST',body:{gif:'cheer'},status:201})
  const sticker=await request(commentsPath,{token:tobi.token,method:'POST',body:{body:'Nice work',sticker:'nice'},status:201})
  const commentPhotoForm=new FormData()
  commentPhotoForm.set('image',new Blob([file],{type:'image/png'}),'comment.png')
  const photo=await request(commentsPath,{token:tobi.token,method:'POST',form:commentPhotoForm,status:201})
  await request(commentsPath,{token:tobi.token,method:'POST',body:{gif:'__proto__'},status:400})
  await request(commentsPath,{token:tobi.token,method:'POST',body:{gif:'cheer',sticker:'nice'},status:400})
  await request(commentsPath,{token:tobi.token,method:'POST',body:{body:' '},status:400})
  await request('/posts/missing/comments',{token:tobi.token,method:'POST',form:commentPhotoForm,status:404})
  const stored=await request(commentsPath,{token:ada.token})
  assert.deepEqual(stored.find(item=>item.id===gif.id).attachment,{kind:'gif',id:'cheer'})
  assert.deepEqual(stored.find(item=>item.id===sticker.id).attachment,{kind:'sticker',id:'nice'})
  assert.deepEqual(stored.find(item=>item.id===photo.id).attachment,photo.attachment)
  assert.equal(stored.find(item=>item.id===photo.id).author.id,tobi.user.id)
  const commentImage=await fetch(photo.attachment.url)
  assert.equal(commentImage.headers.get('content-type'),'image/png')
  assert.deepEqual(Buffer.from(await commentImage.arrayBuffer()),file)
  assert.equal((await request('/feed',{token:tobi.token})).find(item=>item.id===post.id).comments,4)

  if(process.env.TEST_ADMIN_TOKEN){
    const token=process.env.TEST_ADMIN_TOKEN
    const current=await request('/admin/overview',{token})
    const monthly=await request('/admin/overview?days=30',{token})
    assert.equal(current.series.length,7)
    assert.equal(monthly.series.length,30)
    assert.equal(current.series.at(-1).day,new Date(current.updatedAt).toISOString().slice(0,10))
    assert.ok(current.series.reduce((sum,day)=>sum+day.likes,0)>=1)
    assert.ok(current.series.reduce((sum,day)=>sum+day.reposts,0)>=1)
    assert.ok(current.series.reduce((sum,day)=>sum+day.comments,0)>=4)
    await request(postPath+'/like',{token:tobi.token,method:'PUT',body:{active:false}})
    const refreshed=await request('/admin/overview',{token})
    assert.equal(refreshed.likes,current.likes-1)
    assert.equal(refreshed.series.reduce((sum,day)=>sum+day.likes,0),current.series.reduce((sum,day)=>sum+day.likes,0)-1)
  }

  const room=await request('/rooms',{token:ada.token,method:'POST',body:{target:tobi.user.id}})
  assert.equal((await request('/rooms',{token:tobi.token,method:'POST',body:{target:ada.user.id}})).id,room.id)
  const roomPath='/rooms/'+room.id
  await request(roomPath+'/messages',{token:outsider.token,status:404})
  await request(roomPath+'/messages',{token:outsider.token,method:'POST',body:{body:'intrusion'},status:404})
  const socket=await openSocket(roomPath+'/socket',tobi.token)
  try{
    const event=oneMessage(socket)
    const message=await request(roomPath+'/messages',{token:ada.token,method:'POST',body:{body:'Ready for the quiz?'},status:201})
    assert.equal((await event).id,message.id)
    assert.equal((await request(roomPath+'/messages',{token:tobi.token}))[0].body,'Ready for the quiz?')
  }finally{socket.close()}
  const caller=await openSocket(roomPath+'/socket',ada.token)
  const callee=await openSocket(roomPath+'/socket',tobi.token)
  try{
    const id='testcall123456'
    const offer={kind:'offer',id,video:true,sdp:'v=0\r\n'}
    const incoming=oneMessage(callee)
    caller.send(JSON.stringify({type:'call',signal:offer}))
    assert.deepEqual(await incoming,{type:'call',signal:offer})
    const answer={kind:'answer',id,sdp:'v=0\r\n'}
    const accepted=oneMessage(caller)
    callee.send(JSON.stringify({type:'call',signal:answer}))
    assert.deepEqual(await accepted,{type:'call',signal:answer})
    const ended=oneMessage(callee)
    caller.send(JSON.stringify({type:'call',signal:{kind:'end',id}}))
    assert.deepEqual(await ended,{type:'call',signal:{kind:'end',id}})
  }finally{caller.close();callee.close()}
  await request('/logout',{token:login.token,method:'POST'})
  await request('/me',{token:login.token,status:401})
})
