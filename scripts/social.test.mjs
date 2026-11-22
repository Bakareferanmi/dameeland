import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'

const base=process.env.TEST_API_URL??'http://localhost:8787'
async function request(path,{token,method='GET',body,form,status=200}={}){
  const response=await fetch(base+'/api'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:form??(body?JSON.stringify(body):undefined)})
  assert.equal(response.status,status,method+' '+path+' '+await response.clone().text())
  return response.json()
}
const birth=()=>{const day=new Date(Date.now()+100*86400000);return '2008-'+String(day.getUTCMonth()+1).padStart(2,'0')+'-'+String(day.getUTCDate()).padStart(2,'0')}
const create=async name=>{
  const username='u_'+randomUUID().replaceAll('-','').slice(0,16)
  const [firstName,lastName]=name.toLowerCase().split(' ')
  const result=await request('/auth/signup',{method:'POST',body:{firstName,lastName,username,email:randomUUID()+'@example.test',password:'example-passphrase-42',role:'student',dob:birth()},status:201})
  return {...result,username}
}

test('shared posts allow at most three people and need acceptance',async()=>{
  const [a,b,c,d]=await Promise.all(['Ada One','Bee Two','Cy Three','Di Four'].map(create))
  await request('/posts',{token:a.token,method:'POST',body:{body:'too many',coAuthors:[b.user.id,c.user.id,d.user.id]},status:400})
  const {id}=await request('/posts',{token:a.token,method:'POST',body:{body:'shared hello',coAuthors:[b.user.id,c.user.id]},status:201})
  const asB=await request('/posts/'+id,{token:b.token})
  assert.equal(asB.coAuthorInvite,true)
  const publicView=await request('/posts/'+id,{token:d.token})
  assert.equal(publicView.coAuthors,undefined,'pending invites are private')
  await request('/posts/'+id+'/coauthor',{token:b.token,method:'PUT',body:{accept:true}})
  await request('/posts/'+id+'/coauthor',{token:d.token,method:'PUT',body:{accept:true},status:404})
  const after=await request('/posts/'+id,{token:d.token})
  assert.deepEqual(after.coAuthors.map(entry=>entry.person.id),[b.user.id])
  await request('/posts/'+id+'/coauthor',{token:c.token,method:'PUT',body:{accept:false}})
  assert.equal((await request('/posts/'+id,{token:a.token})).coAuthors.length,1)
})

test('quote posts embed the original and tell its author',async()=>{
  const [a,b]=await Promise.all(['Quo One','Quo Two'].map(create))
  const {id}=await request('/posts',{token:a.token,method:'POST',body:{body:'original thought'},status:201})
  await request('/posts',{token:b.token,method:'POST',body:{body:'',quoteOf:id},status:400})
  const quote=await request('/posts',{token:b.token,method:'POST',body:{body:'I agree',quoteOf:id},status:201})
  const view=await request('/posts/'+quote.id,{token:a.token})
  assert.equal(view.quote.id,id)
  assert.equal(view.quote.body,'original thought')
  const inbox=(await request('/notifications',{token:a.token})).items
  assert.ok(inbox.some(item=>item.body.includes('quoted your post')))
})

test('@mentions notify tagged people once',async()=>{
  const [a,b]=await Promise.all(['Men One','Men Two'].map(create))
  await request('/posts',{token:a.token,method:'POST',body:{body:'hey @'+b.username+' and @'+b.username},status:201})
  const inbox=(await request('/notifications',{token:b.token})).items
  assert.equal(inbox.filter(item=>item.body.includes('mentioned you in a post')).length,1)
})

test('chat replies and reactions work in a conversation',async()=>{
  const [a,b]=await Promise.all(['Cha One','Cha Two'].map(create))
  const room=await request('/rooms',{token:a.token,method:'POST',body:{target:b.user.id}})
  const first=await request('/rooms/'+room.id+'/messages',{token:a.token,method:'POST',body:{body:'first'},status:201})
  const reply=await request('/rooms/'+room.id+'/messages',{token:b.token,method:'POST',body:{body:'answer',replyTo:first.id},status:201})
  assert.equal(reply.reply.body,'first')
  await request('/rooms/'+room.id+'/messages',{token:b.token,method:'POST',body:{body:'x',replyTo:randomUUID()},status:404})
  await request('/rooms/'+room.id+'/messages/'+first.id+'/reaction',{token:b.token,method:'PUT',body:{emoji:'🔥'}})
  await request('/rooms/'+room.id+'/messages/'+first.id+'/reaction',{token:b.token,method:'PUT',body:{emoji:'🙃'},status:400})
  const list=await request('/rooms/'+room.id+'/messages',{token:a.token})
  const messages=list.messages??list
  const target=messages.find(item=>item.id===first.id)
  assert.deepEqual(target.reactions,[{userId:b.user.id,emoji:'🔥'}])
  assert.equal(messages.find(item=>item.id===reply.id).reply.authorName.length>0,true)
  await request('/rooms/'+room.id+'/messages/'+first.id+'/reaction',{token:b.token,method:'PUT',body:{emoji:null}})
})
