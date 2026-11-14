import {readCallSignal} from '@dameeland/core/call-signal'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {bodyLimit} from 'hono/body-limit'
import {HTTPException} from 'hono/http-exception'
import {DurableObject} from 'cloudflare:workers'
import {commentGifs,storyLimit,storyLifetime,type Story,type StoryGroup,commentStickers,capitalizeName,initials,normalizeUsername,usernameHint,validUsername,type AdminAccount,type AdminActivity,type AdminDay,type AdminOverview,type CommentAttachment,type FollowPage,type FollowStats,type Person,type Role} from '@dameeland/core'

interface Env {DB:D1Database;MEDIA:R2Bucket;STORIES:KVNamespace;ROOMS:DurableObjectNamespace<ChatRoom>;ALLOWED_ORIGIN:string;GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;GOOGLE_REDIRECT_URI?:string;ADMIN_USER_IDS?:string;RESEND_API_KEY?:string;RECOVERY_FROM?:string}
type Account={id:string;email:string;name:string;role:Role;salt:string;password_hash:string;username?:string|null;verified?:number;teacher?:number}
type PublicAccount=Pick<Account,'id'|'name'|'role'|'username'|'verified'|'teacher'> & {avatar_media?:string|null;cover_media?:string|null}
type App={Bindings:Env;Variables:{user:PublicAccount;tokenHash:string}}
const app=new Hono<App>()
const encoder=new TextEncoder()
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')
const hash=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)))
const random=(size:number)=>hex(crypto.getRandomValues(new Uint8Array(size)))
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):''
const mediaUrl=(key:string,url:string)=>new URL('/api/media/'+key,url).href
const person=(user:PublicAccount,url:string):Person=>({id:user.id,name:user.name,username:user.username??undefined,initials:initials(user.name),role:user.role,color:user.role==='tech'?'#CFE8FF':'#FFD9B8',detail:user.teacher?'Teacher':user.role==='tech'?'Tech creator':'Student',teacher:Boolean(user.teacher),verified:user.role==='tech'||Boolean(user.verified),avatar:user.avatar_media?mediaUrl(user.avatar_media,url):undefined,cover:user.cover_media?mediaUrl(user.cover_media,url):undefined})
const readBody=async(request:Request)=>request.json<Record<string,unknown>>().catch(()=>null)
const time=(date:number)=>new Date(date).toISOString()
const now=()=>Date.now()
const base64Url=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const isAdmin=(env:Env,id:string)=>env.ADMIN_USER_IDS?.split(',').some(value=>value.trim()===id)??false
const viewer=(env:Env,account:PublicAccount,url:string)=>({...person(account,url),isAdmin:isAdmin(env,account.id)})
async function session(env:Env,account:PublicAccount,url:string){
  const token=random(32)
  await env.DB.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await hash(token),account.id,now()+7*86400000).run()
  return {token,user:viewer(env,account,url)}
}

async function passwordHash(password:string,salt:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits'])
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256))
}
function equal(left:string,right:string){
  let difference=left.length^right.length
  for(let i=0;i<left.length;i++) difference|=left.charCodeAt(i)^(right.charCodeAt(i)||0)
  return difference===0
}
async function authAllowed(db:D1Database,ip:string,flow:string,maxAttempts=25){
  const window=Math.floor(now()/600000)
  const limit=await db.prepare('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts')
    .bind(await hash(flow+':'+ip+':'+window),(window+1)*600000).first<number>('attempts')
  return (limit??0)<=maxAttempts
}
app.use('/api/*',async(c,next)=>cors({origin:[c.env.ALLOWED_ORIGIN,'http://127.0.0.1:5173'],allowMethods:['GET','POST','PUT','DELETE','OPTIONS'],allowHeaders:['Authorization','Content-Type']})(c,next))
app.use('/api/*',async(c,next)=>{
  if(c.req.method!=='POST'&&c.req.method!=='PUT')return next()
  const maxSize=c.req.path==='/api/posts'||c.req.path==='/api/stories'||c.req.path.startsWith('/api/me/photos/')||/^\/api\/posts\/[^/]+\/comments$/.test(c.req.path)?5300000:8192
  return bodyLimit({maxSize,onError:()=>{throw new HTTPException(413,{message:'The request is too large.'})}})(c,next)
})
app.get('/api/health',c=>c.json({ok:true}))
const usernameOf=(value:unknown)=>typeof value==='string'?normalizeUsername(value):''
const usernameTaken=(db:D1Database,username:string)=>db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').bind(username).first()
app.get('/api/auth/username',async c=>{
  const username=usernameOf(c.req.query('username'))
  if(!validUsername(username))return c.json({error:usernameHint},400)
  c.header('Cache-Control','no-store')
  return c.json({available:!await usernameTaken(c.env.DB,username)})
})
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
app.post('/api/auth/recovery/request',async c=>{
  const {DB,RESEND_API_KEY,RECOVERY_FROM}=c.env
  if(!RESEND_API_KEY||!RECOVERY_FROM)return c.json({error:'Email recovery is not configured yet.'},503)
  const input=await readBody(c.req.raw)
  const email=clean(input?.email,254).toLowerCase()
  const kind=input?.kind
  if(!emailPattern.test(email)||(kind!=='password'&&kind!=='username'))return c.json({error:'Enter your account email.'},400)
  const ip=c.req.header('CF-Connecting-IP')??'local'
  if(!await authAllowed(DB,ip,'recovery-request',10))return c.json({error:'Too many requests. Try again in a few minutes.'},429)
  const account=await DB.prepare('SELECT id,username FROM users WHERE email=?').bind(email).first<{id:string;username:string|null}>()
  if(account&&await authAllowed(DB,account.id,'recovery-email',3)){
    let text=account.username?'Your dameeland username is @'+account.username+'.':'You can sign in to dameeland with this email address.'
    if(kind==='password'){
      const code=random(6)
      await DB.prepare(`INSERT INTO password_resets(user_id,code_hash,expires) VALUES (?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires`)
        .bind(account.id,await hash(code),now()+15*60000).run()
      text='Your dameeland password reset code is '+code.toUpperCase()+'. It expires in 15 minutes. If you did not request this, you can ignore this email.'
    }
    c.executionCtx.waitUntil(fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:RECOVERY_FROM,to:[email],subject:kind==='password'?'Reset your dameeland password':'Your dameeland username',text}),
    }).then(response=>{if(!response.ok)console.error('Recovery email delivery rejected',response.status)})
      .catch(()=>console.error('Recovery email delivery failed')))
  }
  c.executionCtx.waitUntil(DB.batch([
    DB.prepare('DELETE FROM password_resets WHERE expires<=?').bind(now()),
    DB.prepare('DELETE FROM auth_limits WHERE expires<=?').bind(now()),
  ]))
  return c.json({ok:true})
})
app.post('/api/auth/recovery/reset',async c=>{
  const input=await readBody(c.req.raw)
  const email=clean(input?.email,254).toLowerCase()
  const code=typeof input?.code==='string'?input.code.trim().toLowerCase():''
  const password=typeof input?.password==='string'?input.password:''
  if(!emailPattern.test(email)||!/^[a-f0-9]{12}$/.test(code)||password.length<8||password.length>128)
    return c.json({error:'Enter your email, a valid reset code and a password with 8 to 128 characters.'},400)
  const db=c.env.DB
  if(!await authAllowed(db,c.req.header('CF-Connecting-IP')??'local','recovery-reset',10))
    return c.json({error:'Too many attempts. Try again in a few minutes.'},429)
  const codeHash=await hash(code)
  const salt=random(16)
  const digest=await passwordHash(password,salt)
  const validAt=now()
  const accountQuery='SELECT r.user_id FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.code_hash=? AND r.expires>? AND u.email=?'
  const [updated]=await db.batch([
    db.prepare('UPDATE users SET salt=?,password_hash=? WHERE id IN ('+accountQuery+')').bind(salt,digest,codeHash,validAt,email),
    db.prepare('DELETE FROM sessions WHERE user_id IN ('+accountQuery+')').bind(codeHash,validAt,email),
    db.prepare('DELETE FROM password_resets WHERE user_id IN ('+accountQuery+')').bind(codeHash,validAt,email),
  ])
  return updated.meta.changes?c.json({ok:true}):c.json({error:'That code is invalid or expired.'},400)
})
app.post('/api/auth/:action',async c=>{
  const action=c.req.param('action')
  if(action!=='signup'&&action!=='login') return c.json({error:'Unknown action.'},404)
  const body=await readBody(c.req.raw)
  const email=clean(body?.email,254).toLowerCase()
  const identifier=clean(body?.identifier??body?.email,254).toLowerCase()
  const loginUsername=identifier.replace(/^@/,'')
  const firstName=capitalizeName(clean(body?.firstName,60))
  const lastName=capitalizeName(clean(body?.lastName,60))
  const name=[firstName,lastName].join(' ')
  const username=usernameOf(body?.username)
  const password=typeof body?.password==='string'?body.password:''
  if(action==='signup'&&!validUsername(username))return c.json({error:usernameHint},400)
  if(action==='signup'&&(!firstName||!lastName))return c.json({error:'Enter your first and last name.'},400)
  const validIdentifier=action==='signup'?emailPattern.test(email):emailPattern.test(identifier)||validUsername(loginUsername)
  if(!validIdentifier||password.length<8||password.length>128) return c.json({error:action==='signup'?'Enter a valid email and a password with 8 to 128 characters.':'Enter your email or username and password.'},400)
  const db=c.env.DB
  if(!await authAllowed(db,c.req.header('CF-Connecting-IP')??'local','password'))return c.json({error:'Too many attempts. Try again in a few minutes.'},429)
  c.executionCtx.waitUntil(db.batch([db.prepare('DELETE FROM auth_limits WHERE expires < ?').bind(now()),db.prepare('DELETE FROM sessions WHERE expires < ?').bind(now())]))
  let account=action==='signup'||emailPattern.test(identifier)
    ?await db.prepare('SELECT * FROM users WHERE email=?').bind(action==='signup'?email:identifier).first<Account>()
    :await db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').bind(loginUsername).first<Account>()
  if(action==='signup'){
    if(account) return c.json({error:'An account already uses this email.'},409)
    const salt=random(16)
    const role='student' as const
    account={id:crypto.randomUUID(),email,name,role,salt,username,password_hash:await passwordHash(password,salt)}
    const write=await db.prepare('INSERT INTO users(id,email,name,role,salt,password_hash,first_name,last_name,username) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(account.id,email,name,role,salt,account.password_hash,firstName,lastName,username).run()
    if(!write.meta.changes){
      if(await usernameTaken(db,username))return c.json({error:'That username is taken.'},409)
      return c.json({error:'An account already uses this email.'},409)
    }
  }else{
    const candidate=await passwordHash(password,account?.salt??'8d039d76714da531')
    if(!account||!equal(candidate,account.password_hash)) return c.json({error:'Email, username or password is incorrect.'},401)
  }
  return c.json(await session(c.env,account,c.req.url),action==='signup'?201:200)
})

type GoogleAttempt={username:string|null;verifier:string;status:string;user_id:string|null;error:string|null}
app.post('/api/google/start',async c=>{
  const {DB,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI}=c.env
  if(!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET||!GOOGLE_REDIRECT_URI)return c.json({error:'Google sign-in is not configured.'},503)
  if(!await authAllowed(DB,c.req.header('CF-Connecting-IP')??'local','google'))return c.json({error:'Too many attempts. Try again in a few minutes.'},429)
  const body=await readBody(c.req.raw)
  const username=body?.mode==='signup'?usernameOf(body.username):null
  if(username!==null&&!validUsername(username))return c.json({error:usernameHint},400)
  if(username&&await usernameTaken(DB,username))return c.json({error:'That username is taken.'},409)
  const state=random(24),exchange=random(32),verifier=random(48)
  const challenge=base64Url(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)))
  await DB.batch([
    DB.prepare('DELETE FROM google_attempts WHERE expires<=?').bind(now()),
    DB.prepare('DELETE FROM auth_limits WHERE expires<?').bind(now()),
    DB.prepare('INSERT INTO google_attempts(state,exchange_hash,verifier,role,expires,username) VALUES (?,?,?,?,?,?)').bind(state,await hash(exchange),verifier,'student',now()+180000,username),
  ])
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search=new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:GOOGLE_REDIRECT_URI,response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString()
  c.header('Cache-Control','no-store')
  return c.json({url:url.href,state,exchange})
})
app.get('/api/google/callback',async c=>{
  const {DB,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI}=c.env
  c.header('Cache-Control','no-store')
  c.header('Referrer-Policy','no-referrer')
  const state=c.req.query('state')??''
  const complete=(ok:boolean)=>c.html(ok
    ?'<title>dameeland</title><p>Google sign-in completed. Return to dameeland to continue.</p>'
    :'<title>dameeland</title><p>Google sign-in did not complete. Return to dameeland for details.</p>',ok?200:400)
  if(!/^[a-f0-9]{48}$/.test(state)||!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET||!GOOGLE_REDIRECT_URI)return complete(false)
  const attempt=await DB.prepare("UPDATE google_attempts SET status='processing' WHERE state=? AND status='pending' AND expires>? RETURNING verifier,username").bind(state,now()).first<GoogleAttempt>()
  if(!attempt)return complete(false)
  const fail=async(error:string)=>{
    await DB.prepare("UPDATE google_attempts SET status='error',error=? WHERE state=?").bind(error,state).run()
    return complete(false)
  }
  const code=c.req.query('code')
  if(!code)return fail('Google sign-in was cancelled.')
  try{
    const exchange=await fetch('https://oauth2.googleapis.com/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code,client_id:GOOGLE_CLIENT_ID,client_secret:GOOGLE_CLIENT_SECRET,redirect_uri:GOOGLE_REDIRECT_URI,grant_type:'authorization_code',code_verifier:attempt.verifier}),
    })
    const tokens=await exchange.json<{access_token?:string}>()
    if(!exchange.ok||!tokens.access_token)return fail('Google sign-in could not be verified.')
    const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}})
    const info=await response.json<{sub?:string;email?:string;email_verified?:boolean;given_name?:string;family_name?:string}>()
    const sub=clean(info.sub,255),email=clean(info.email,254).toLowerCase()
    if(!response.ok||!sub||!email||info.email_verified!==true)return fail('Google did not provide a verified email.')
    let account=await DB.prepare('SELECT id FROM users WHERE google_sub=?').bind(sub).first<{id:string}>()
    if(!account){
      if(await DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return fail('An account already uses this email. Log in with your password.')
      if(!attempt.username)return fail('No Google account found on dameeland. Choose Sign up first.')
      const first=capitalizeName(clean(info.given_name,60)),last=capitalizeName(clean(info.family_name,60))
      if(!first||!last)return fail('Add a first and last name to your Google profile or sign up with email.')
      await DB.prepare('INSERT INTO users(id,email,name,role,salt,password_hash,first_name,last_name,google_sub,username) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
        .bind(crypto.randomUUID(),email,first+' '+last,'student',random(16),random(32),first,last,sub,attempt.username).run()
      account=await DB.prepare('SELECT id FROM users WHERE google_sub=?').bind(sub).first<{id:string}>()
      if(!account){
        if(await usernameTaken(DB,attempt.username))return fail('That username is taken. Choose another and try again.')
        return fail('An account already uses this email. Log in with your password.')
      }
    }
    await DB.prepare("UPDATE google_attempts SET status='complete',user_id=? WHERE state=?").bind(account.id,state).run()
    return complete(true)
  }catch{return fail('Google sign-in could not be completed. Please try again.')}
})
app.post('/api/google/exchange',async c=>{
  const body=await readBody(c.req.raw)
  const state=clean(body?.state,48),exchange=clean(body?.exchange,64)
  if(!/^[a-f0-9]{48}$/.test(state)||!/^[a-f0-9]{64}$/.test(exchange))return c.json({error:'Invalid Google sign-in request.'},400)
  const {DB}=c.env
  const key=await hash(exchange)
  const attempt=await DB.prepare('SELECT status,error FROM google_attempts WHERE state=? AND exchange_hash=? AND expires>?').bind(state,key,now()).first<GoogleAttempt>()
  c.header('Cache-Control','no-store')
  if(!attempt)return c.json({error:'Google sign-in expired. Please try again.'},410)
  if(attempt.status==='error')return c.json({error:attempt.error??'Google sign-in failed.'},400)
  if(attempt.status!=='complete')return c.json({pending:true},202)
  const claimed=await DB.prepare("DELETE FROM google_attempts WHERE state=? AND exchange_hash=? AND status='complete' AND expires>? RETURNING user_id").bind(state,key,now()).first<{user_id:string}>()
  if(!claimed)return c.json({error:'Google sign-in expired. Please try again.'},410)
  const account=await DB.prepare('SELECT id,name,role,username,verified,teacher,avatar_media,cover_media FROM users WHERE id=?').bind(claimed.user_id).first<PublicAccount>()
  if(!account)return c.json({error:'Account unavailable.'},404)
  return c.json(await session(c.env,account,c.req.url))
})
app.get('/api/media/:id',async c=>{
  const id=c.req.param('id')
  const attachment=await c.env.DB.prepare('SELECT id FROM users WHERE avatar_media=? OR cover_media=? UNION ALL SELECT id FROM posts WHERE media=? UNION ALL SELECT id FROM comments WHERE media=? LIMIT 1').bind(id,id,id,id).first()
  if(!attachment) return c.json({error:'Image unavailable.'},404)
  const object=await c.env.MEDIA.get(id)
  if(!object) return c.json({error:'Image unavailable.'},404)
  const headers=new Headers({'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'})
  object.writeHttpMetadata(headers)
  return new Response(object.body,{headers})
})
const storyKey=(user:string)=>'stories:'+user
type StoryRecord={id:string;text:string;media?:string;created:number}
const storyExpiry=(story:StoryRecord)=>story.created+storyLifetime
async function readStories(env:Env,user:string){
  const list=await env.STORIES.get<StoryRecord[]>(storyKey(user),'json')
  return Array.isArray(list)?list:[]
}
// Stories live only in KV (one key per author) and R2, never in D1. The key expires on its own and
// every read also filters by timestamp, so a story is never served after 12 hours even if cleanup lags.
async function writeStories(env:Env,user:string,list:StoryRecord[]){
  if(!list.length)return env.STORIES.delete(storyKey(user))
  const ttl=Math.max(60,Math.ceil((Math.max(...list.map(storyExpiry))-now())/1000))
  return env.STORIES.put(storyKey(user),JSON.stringify(list),{expirationTtl:ttl})
}
const storyView=(user:string,story:StoryRecord,url:string):Story=>({id:story.id,text:story.text,image:story.media?new URL('/api/story-media/'+user+'/'+story.id,url).href:undefined,created:time(story.created),expires:time(storyExpiry(story))})
const storyMediaKey=(user:string,id:string)=>'stories/'+user+'/'+id
const uuidPattern=/^[a-f0-9-]{36}$/
app.get('/api/story-media/:user/:id',async c=>{
  const {user,id}=c.req.param()
  if(!uuidPattern.test(user)||!uuidPattern.test(id))return c.json({error:'Image unavailable.'},404)
  const story=(await readStories(c.env,user)).find(item=>item.id===id&&item.media&&storyExpiry(item)>now())
  if(!story)return c.json({error:'Image unavailable.'},404)
  const object=await c.env.MEDIA.get(storyMediaKey(user,id))
  if(!object)return c.json({error:'Image unavailable.'},404)
  const remaining=Math.max(0,Math.floor((storyExpiry(story)-now())/1000))
  const headers=new Headers({'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age='+Math.min(300,remaining)})
  object.writeHttpMetadata(headers)
  return new Response(object.body,{headers})
})
app.use('/api/*',async(c,next)=>{
  const header=c.req.header('Authorization')
  const ticket=c.req.path.endsWith('/socket')?c.req.header('Sec-WebSocket-Protocol')?.split(',').map(s=>s.trim()).find(s=>s.startsWith('ticket.'))?.slice(7):undefined
  const token=header?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]??ticket
  if(!token||!/^[a-f0-9]{64}$/.test(token)) return c.json({error:'Log in to continue.'},401)
  const tokenHash=await hash(token)
  const user=await c.env.DB.prepare('SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.avatar_media,u.cover_media FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?').bind(tokenHash,now()).first<PublicAccount>()
  if(!user) return c.json({error:'Your session has expired. Log in again.'},401)
  c.set('user',user);c.set('tokenHash',tokenHash)
  await next()
})
app.get('/api/me',c=>c.json(viewer(c.env,c.get('user'),c.req.url)))
app.use('/api/admin/*',async(c,next)=>{
  if(!isAdmin(c.env,c.get('user').id))return c.json({error:'Admin access is required.'},403)
  c.header('Cache-Control','no-store')
  await next()
})
type AdminUserRow=PublicAccount&{email:string;created:number|null}
const adminAccount=(r:AdminUserRow,url:string):AdminAccount=>({
  person:person(r,url),email:r.email,created:r.created,independentlyVerified:Boolean(r.verified),
})
app.get('/api/admin/overview',async c=>{
  const updatedAt=now()
  const dayMs=86400000
  const days=c.req.query('days')==='30'?30:7
  const start=Math.floor(updatedAt/dayMs)*dayMs-(days-1)*dayMs
  const week=updatedAt-7*dayMs
  const db=c.env.DB
  type Metrics=Omit<AdminOverview,'activity'|'series'|'updatedAt'>
  const [metrics,activity,trend]=await db.batch<AdminActivity|AdminDay|Metrics>([
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM users) users,
      (SELECT COUNT(*) FROM users WHERE created>=?1) newUsers,
      (SELECT COUNT(*) FROM (
        SELECT id FROM users WHERE created>=?1 UNION SELECT author FROM posts WHERE created>=?1
        UNION SELECT author FROM comments WHERE created>=?1 UNION SELECT author FROM messages WHERE created>=?1
        UNION SELECT user_id FROM reactions WHERE created>=?1
      )) activeUsers,
      (SELECT COUNT(*) FROM users WHERE role='tech') techUsers,
      (SELECT COUNT(*) FROM users WHERE verified=1 OR role='tech') verifiedUsers,
      (SELECT COUNT(*) FROM users WHERE teacher=1) teacherUsers,
      (SELECT COUNT(*) FROM posts) posts,
      (SELECT COUNT(*) FROM comments) comments,
      (SELECT COUNT(*) FROM reactions WHERE kind='like') likes,
      (SELECT COUNT(*) FROM reactions WHERE kind='repost') reposts,
      (SELECT COUNT(*) FROM follows) follows,
      (SELECT COUNT(*) FROM messages) messages`).bind(week),
    db.prepare(`SELECT activity.id,u.name,activity.kind,activity.created,activity.excerpt
      FROM (
        SELECT id,id author,'signup' kind,created,NULL excerpt FROM users WHERE created IS NOT NULL
        UNION ALL SELECT id,author,'post',created,substr(body,1,120) FROM posts
        UNION ALL SELECT id,author,'comment',created,substr(body,1,120) FROM comments
      ) activity JOIN users u ON u.id=activity.author
      ORDER BY activity.created DESC,activity.id DESC LIMIT 20`),
    db.prepare(`SELECT strftime('%Y-%m-%d',created/1000,'unixepoch') day,
      SUM(kind='signup') signups,SUM(kind='post') posts,SUM(kind='comment') comments,
      SUM(kind='like') likes,SUM(kind='repost') reposts,SUM(kind='message') messages
      FROM (
        SELECT created,'signup' kind FROM users WHERE created>=?1
        UNION ALL SELECT created,'post' FROM posts WHERE created>=?1
        UNION ALL SELECT created,'comment' FROM comments WHERE created>=?1
        UNION ALL SELECT created,kind FROM reactions WHERE created>=?1
        UNION ALL SELECT created,'message' FROM messages WHERE created>=?1
      ) GROUP BY day`).bind(start),
  ])
  const byDay=new Map((trend.results as AdminDay[]).map(point=>[point.day,point]))
  const series=Array.from({length:days},(_,index)=>{
    const day=time(start+index*dayMs).slice(0,10)
    return byDay.get(day)??{day,signups:0,posts:0,comments:0,likes:0,reposts:0,messages:0}
  })
  return c.json({...metrics.results[0] as Metrics,activity:activity.results as AdminActivity[],series,updatedAt})
})
app.get('/api/admin/accounts',async c=>{
  const q=clean(c.req.query('q'),100).toLowerCase().replace(/^@/,'')
  const cursor=clean(c.req.query('cursor'),64)
  const {results}=await c.env.DB.prepare(`
    SELECT id,name,email,role,username,verified,teacher,avatar_media,cover_media,created FROM users
    WHERE id>? AND (instr(lower(name),?)>0 OR instr(username,?)>0 OR instr(email,?)>0)
    ORDER BY id LIMIT 26
  `).bind(cursor,q,q,q).all<AdminUserRow>()
  return c.json({accounts:results.slice(0,25).map(r=>adminAccount(r,c.req.url)),nextCursor:results.length>25?results[24].id:null})
})
app.put('/api/admin/accounts/:id',async c=>{
  const payload=await readBody(c.req.raw)
  if(payload?.role!=='student'&&payload?.role!=='tech'||typeof payload?.verified!=='boolean')return c.json({error:'Choose a valid role and verification status.'},400)
  if(payload.teacher!==undefined&&typeof payload.teacher!=='boolean')return c.json({error:'Choose a valid teacher status.'},400)
  const account=await c.env.DB.prepare(`
    UPDATE users SET role=?,verified=?,teacher=COALESCE(?,teacher) WHERE id=?
    RETURNING id,name,email,role,username,verified,teacher,avatar_media,cover_media,created
  `).bind(payload.role,Number(payload.verified),payload.teacher===undefined?null:Number(payload.teacher),c.req.param('id')).first<AdminUserRow>()
  if(!account)return c.json({error:'Account unavailable.'},404)
  return c.json(adminAccount(account,c.req.url))
})
async function imageType(file:File){
  if(!file.size||file.size>5*1024*1024)return null
  const head=new Uint8Array(await file.slice(0,12).arrayBuffer())
  if([137,80,78,71,13,10,26,10].every((n,i)=>head[i]===n))return 'image/png'
  if(head[0]===255&&head[1]===216&&head[2]===255)return 'image/jpeg'
  if(String.fromCharCode(...head.slice(0,4))==='RIFF'&&String.fromCharCode(...head.slice(8))==='WEBP')return 'image/webp'
  return null
}
app.put('/api/me/photos/:kind',async c=>{
  const kind=c.req.param('kind')
  if(kind!=='avatar'&&kind!=='cover')return c.json({error:'Unknown photo type.'},404)
  const file:unknown=(await c.req.raw.formData().catch(()=>null))?.get('image')
  const contentType=file instanceof File?await imageType(file):null
  if(!(file instanceof File)||!contentType)return c.json({error:'Choose a PNG, JPEG or WebP image under 5 MB.'},400)
  const key=crypto.randomUUID()
  const user=c.get('user')
  const column=kind==='avatar'?'avatar_media':'cover_media'
  const {DB,MEDIA}=c.env
  await MEDIA.put(key,await file.arrayBuffer(),{httpMetadata:{contentType}})
  try{
    const [previous,updated]=await DB.batch<PublicAccount>([
      DB.prepare('SELECT avatar_media,cover_media FROM users WHERE id=?').bind(user.id),
      DB.prepare(`UPDATE users SET ${column}=? WHERE id=? RETURNING id,name,role,username,verified,teacher,avatar_media,cover_media`).bind(key,user.id),
    ])
    const account=updated.results[0]
    if(!account)throw new Error('Profile unavailable.')
    const old=previous.results[0]?.[column]
    if(old)c.executionCtx.waitUntil(MEDIA.delete(old).catch(()=>{}))
    return c.json(viewer(c.env,account,c.req.url))
  }catch(error){await MEDIA.delete(key);throw error}
})
app.get('/api/stories',async c=>{
  const me=c.get('user')
  const {results}=await c.env.DB.prepare(`
    SELECT id,name,role,username,verified,teacher,avatar_media,cover_media FROM users
    WHERE id=?1 OR id IN (SELECT target FROM follows WHERE follower=?1 LIMIT 40)
  `).bind(me.id).all<PublicAccount>()
  const at=now()
  const groups=await Promise.all(results.map(async author=>({author,stories:(await readStories(c.env,author.id)).filter(story=>storyExpiry(story)>at)})))
  c.header('Cache-Control','no-store')
  return c.json<StoryGroup[]>(groups.filter(group=>group.stories.length)
    .sort((a,b)=>Number(b.author.id===me.id)-Number(a.author.id===me.id)||b.stories[b.stories.length-1].created-a.stories[a.stories.length-1].created)
    .map(group=>({author:person(group.author,c.req.url),stories:group.stories.map(story=>storyView(group.author.id,story,c.req.url))})))
})
app.post('/api/stories',async c=>{
  const user=c.get('user')
  const id=crypto.randomUUID()
  let text='',contentType:string|null=null,file:File|null=null
  if(c.req.header('Content-Type')?.startsWith('multipart/form-data')){
    const form=await c.req.raw.formData().catch(()=>null)
    text=clean(form?.get('text'),240)
    const upload:unknown=form?.get('image')
    if(upload instanceof File){
      contentType=await imageType(upload)
      if(!contentType)return c.json({error:'Choose a PNG, JPEG or WebP image under 5 MB.'},400)
      file=upload
    }
  }else text=clean((await readBody(c.req.raw))?.text,240)
  if(!text&&!file)return c.json({error:'Write a story or add a photo.'},400)
  const at=now()
  const all=await readStories(c.env,user.id)
  const active=all.filter(story=>storyExpiry(story)>at)
  if(active.length>=storyLimit)return c.json({error:'You can have up to '+storyLimit+' stories at once. Delete one or wait for it to expire.'},429)
  const story:StoryRecord={id,text,created:at,media:file?id:undefined}
  if(file&&contentType)await c.env.MEDIA.put(storyMediaKey(user.id,id),await file.arrayBuffer(),{httpMetadata:{contentType}})
  try{await writeStories(c.env,user.id,[...active,story])}
  catch(error){if(file)await c.env.MEDIA.delete(storyMediaKey(user.id,id));throw error}
  const expired=all.filter(item=>item.media&&storyExpiry(item)<=at).map(item=>storyMediaKey(user.id,item.id))
  if(expired.length)c.executionCtx.waitUntil(c.env.MEDIA.delete(expired).catch(()=>{}))
  return c.json(storyView(user.id,story,c.req.url),201)
})
app.delete('/api/stories/:id',async c=>{
  const user=c.get('user'),id=c.req.param('id')
  const all=await readStories(c.env,user.id)
  const target=all.find(story=>story.id===id)
  if(!target)return c.json({error:'Story unavailable.'},404)
  await writeStories(c.env,user.id,all.filter(story=>story.id!==id&&storyExpiry(story)>now()))
  if(target.media)c.executionCtx.waitUntil(c.env.MEDIA.delete(storyMediaKey(user.id,id)).catch(()=>{}))
  return c.json({ok:true})
})
app.post('/api/logout',async c=>{
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(c.get('tokenHash')).run()
  return c.json({ok:true})
})
type PostRow=PublicAccount&{post_id:string;body:string;created:number;media:string|null;likes:number;liked:number;comments:number;reposts:number;reposted:number}
app.get('/api/feed',async c=>{
  const id=c.get('user').id
  const following=c.req.query('following')==='1'
  const {results}=await c.env.DB.prepare(`
    SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.avatar_media,u.cover_media,p.id post_id,p.body,p.created,p.media,
    (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND kind='like') likes,
    EXISTS(SELECT 1 FROM reactions r WHERE r.post_id=p.id AND r.user_id=? AND kind='like') liked,
    (SELECT COUNT(*) FROM comments x WHERE x.post_id=p.id) comments,
    (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND kind='repost') reposts,
    EXISTS(SELECT 1 FROM reactions r WHERE r.post_id=p.id AND r.user_id=? AND kind='repost') reposted
    FROM posts p JOIN users u ON u.id=p.author
    WHERE ?=0 OR p.author=? OR EXISTS(SELECT 1 FROM follows WHERE follower=? AND target=p.author)
    ORDER BY p.created DESC LIMIT 60
  `).bind(id,id,Number(following),id,id).all<PostRow>()
  return c.json(results.map(r=>({id:r.post_id,author:person(r,c.req.url),body:r.body,time:time(r.created),likes:r.likes,liked:Boolean(r.liked),comments:r.comments,reposts:r.reposts,reposted:Boolean(r.reposted),media:r.media?new URL('/api/media/'+r.media,c.req.url).href:undefined})))
})
app.post('/api/posts',async c=>{
  const db=c.env.DB
  const id=crypto.randomUUID()
  let body=''
  let media:string|null=null
  if(c.req.header('Content-Type')?.startsWith('multipart/form-data')){
    if(Number(c.req.header('Content-Length'))>5300000) return c.json({error:'Choose an image under 5 MB.'},413)
    const form=await c.req.raw.formData().catch(()=>null)
    body=clean(form?.get('body'),1200)
    const file:unknown=form?.get('image')
    if(file instanceof File){
      const contentType=await imageType(file)
      if(!contentType)return c.json({error:'Choose a PNG, JPEG or WebP image under 5 MB.'},400)
      media=id
      await c.env.MEDIA.put(media,await file.arrayBuffer(),{httpMetadata:{contentType}})
    }
  }else body=clean((await readBody(c.req.raw))?.body,1200)
  if(!body&&!media) return c.json({error:'Write a post or add an image.'},400)
  try{await db.prepare('INSERT INTO posts VALUES (?,?,?,?,?)').bind(id,c.get('user').id,body,now(),media).run()}
  catch(error){if(media) await c.env.MEDIA.delete(media);throw error}
  return c.json({id},201)
})
app.put('/api/posts/:id/:kind',async c=>{
  const {id,kind}=c.req.param()
  if(kind!=='like'&&kind!=='repost') return c.json({error:'Unknown reaction.'},404)
  const body=await readBody(c.req.raw)
  if(typeof body?.active!=='boolean') return c.json({error:'Choose a reaction state.'},400)
  const db=c.env.DB
  if(!(await db.prepare('SELECT id FROM posts WHERE id=?').bind(id).first())) return c.json({error:'Post unavailable.'},404)
  const user=c.get('user').id
  const statement=body.active
    ?db.prepare('INSERT INTO reactions(post_id,user_id,kind,created) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(id,user,kind,now())
    :db.prepare('DELETE FROM reactions WHERE post_id=? AND user_id=? AND kind=?').bind(id,user,kind)
  await statement.run()
  return c.json({ok:true})
})
type NoteRow=PublicAccount&{note_id:string;body:string}
const note=(r:NoteRow,url:string)=>({id:r.note_id,author:person(r,url),body:r.body})
type CommentRow=NoteRow&{media:string|null;gif:keyof typeof commentGifs|null;sticker:keyof typeof commentStickers|null}
function commentAttachment(row:Pick<CommentRow,'media'|'gif'|'sticker'>,url:string):CommentAttachment|undefined{
  if(row.media)return {kind:'image',url:mediaUrl(row.media,url)}
  if(row.gif)return {kind:'gif',id:row.gif}
  if(row.sticker)return {kind:'sticker',id:row.sticker}
}
app.get('/api/posts/:id/comments',async c=>{
  const {results}=await c.env.DB.prepare(`
    SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.avatar_media,u.cover_media,x.id note_id,x.body,x.media,x.gif,x.sticker
    FROM comments x JOIN users u ON u.id=x.author WHERE post_id=? ORDER BY x.created LIMIT 100
  `).bind(c.req.param('id')).all<CommentRow>()
  return c.json(results.map(r=>({...note(r,c.req.url),attachment:commentAttachment(r,c.req.url)})))
})
app.post('/api/posts/:id/comments',async c=>{
  const {DB,MEDIA}=c.env
  const post=c.req.param('id')
  const author=c.get('user')
  const id=crypto.randomUUID()
  const multipart=c.req.header('Content-Type')?.startsWith('multipart/form-data')
  const form=multipart?await c.req.raw.formData().catch(()=>null):null
  const payload=multipart?null:await readBody(c.req.raw)
  const body=clean(form?.get('body')??payload?.body,500)
  const file:unknown=form?.get('image')
  const gif=payload?.gif
  const sticker=payload?.sticker
  if((gif!==undefined&&(typeof gif!=='string'||!Object.hasOwn(commentGifs,gif)))||
     (sticker!==undefined&&(typeof sticker!=='string'||!Object.hasOwn(commentStickers,sticker)))||
     (gif!==undefined&&sticker!==undefined))return c.json({error:'Choose a GIF or sticker from the picker.'},400)
  const contentType=file instanceof File?await imageType(file):null
  if(multipart&&(!contentType||!(file instanceof File)))return c.json({error:'Choose a PNG, JPEG or WebP image under 5 MB.'},400)
  if(!body&&!contentType&&gif===undefined&&sticker===undefined)return c.json({error:'Write a comment or add an attachment.'},400)
  const media=contentType?id:null
  if(media&&file instanceof File&&contentType)await MEDIA.put(media,await file.arrayBuffer(),{httpMetadata:{contentType}})
  const attachment={media,gif:(gif??null) as CommentRow['gif'],sticker:(sticker??null) as CommentRow['sticker']}
  try{
    const result=await DB.prepare(`
      INSERT INTO comments (id,post_id,author,body,created,media,gif,sticker)
      SELECT ?,id,?,?,?,?,?,? FROM posts WHERE id=?
    `).bind(id,author.id,body,now(),media,attachment.gif,attachment.sticker,post).run()
    if(!result.meta.changes){
      if(media)await MEDIA.delete(media)
      return c.json({error:'Post unavailable.'},404)
    }
  }catch(error){if(media)await MEDIA.delete(media);throw error}
  return c.json({id,author:person(author,c.req.url),body,attachment:commentAttachment(attachment,c.req.url)},201)
})
app.get('/api/people',async c=>{
  const user=c.get('user').id
  const q=clean(c.req.query('q'),60).toLowerCase()
  const {results}=await c.env.DB.prepare('SELECT id,name,role,username,verified,teacher,avatar_media,cover_media,EXISTS(SELECT 1 FROM follows WHERE follower=? AND target=u.id) following FROM users u WHERE id!=? AND (instr(lower(name),?)>0 OR instr(username,?)>0) ORDER BY name LIMIT 30').bind(user,user,q,q.replace(/^@/,'')||q).all<PublicAccount&{following:number}>()
  return c.json(results.map(r=>({...person(r,c.req.url),following:Boolean(r.following)})))
})
app.get('/api/people/:id/follow-stats',async c=>{
  const stats=await c.env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE target=u.id) followers,
      (SELECT COUNT(*) FROM follows WHERE follower=u.id) following,
      EXISTS(SELECT 1 FROM follows WHERE follower=? AND target=u.id) followedByViewer
    FROM users u WHERE u.id=?
  `).bind(c.get('user').id,c.req.param('id')).first<Omit<FollowStats,'followedByViewer'> & {followedByViewer:number}>()
  if(!stats)return c.json({error:'Profile unavailable.'},404)
  return c.json({...stats,followedByViewer:Boolean(stats.followedByViewer)})
})
app.get('/api/people/:id/connections/:kind',async c=>{
  const {id,kind}=c.req.param()
  if(kind!=='followers'&&kind!=='following')return c.json({error:'Unknown connections list.'},404)
  const db=c.env.DB
  if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(id).first())return c.json({error:'Profile unavailable.'},404)
  const cursor=clean(c.req.query('cursor'),80)
  const source=kind==='followers'?'target':'follower'
  const destination=kind==='followers'?'follower':'target'
  const {results}=await db.prepare(`
    SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.avatar_media,u.cover_media FROM follows f
    JOIN users u ON u.id=f.${destination}
    WHERE f.${source}=? AND f.${destination}>? ORDER BY f.${destination} LIMIT 31
  `).bind(id,cursor).all<PublicAccount>()
  const page=results.slice(0,30)
  return c.json<FollowPage>({people:page.map(user=>person(user,c.req.url)),nextCursor:results.length>30?page[29].id:null})
})
app.put('/api/people/:id/follow',async c=>{
  const target=c.req.param('id')
  const me=c.get('user').id
  const body=await readBody(c.req.raw)
  if(typeof body?.active!=='boolean'||target===me) return c.json({error:'Invalid follow request.'},400)
  const db=c.env.DB
  if(!(await db.prepare('SELECT id FROM users WHERE id=?').bind(target).first())) return c.json({error:'Profile unavailable.'},404)
  await db.prepare(body.active?'INSERT INTO follows VALUES (?,?) ON CONFLICT DO NOTHING':'DELETE FROM follows WHERE follower=? AND target=?').bind(me,target).run()
  return c.json({ok:true})
})
const member=(db:D1Database,room:string,user:string)=>db.prepare('SELECT id FROM rooms WHERE id=? AND (first_user=? OR second_user=?)').bind(room,user,user).first()
app.get('/api/rooms',async c=>{
  const user=c.get('user').id
  const {results}=await c.env.DB.prepare('SELECT r.id room,u.id,u.name,u.role,u.username,u.verified,u.teacher,u.avatar_media,u.cover_media FROM rooms r JOIN users u ON u.id=CASE WHEN first_user=? THEN second_user ELSE first_user END WHERE first_user=? OR second_user=? LIMIT 60').bind(user,user,user).all<PublicAccount&{room:string}>()
  return c.json(results.map(r=>({id:r.room,person:person(r,c.req.url)})))
})
app.post('/api/rooms',async c=>{
  const target=clean((await readBody(c.req.raw))?.target,80)
  const user=c.get('user').id
  const db=c.env.DB
  if(target===user||!(await db.prepare('SELECT id FROM users WHERE id=?').bind(target).first())) return c.json({error:'Profile unavailable.'},404)
  const [first,second]=[user,target].sort()
  await db.prepare('INSERT INTO rooms VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),first,second).run()
  const result=await db.prepare('SELECT id FROM rooms WHERE first_user=? AND second_user=?').bind(first,second).first<{id:string}>()
  return c.json(result)
})
app.get('/api/rooms/:id/messages',async c=>{
  const room=c.req.param('id')
  if(!await member(c.env.DB,room,c.get('user').id)) return c.json({error:'Conversation unavailable.'},404)
  const {results}=await c.env.DB.prepare('SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.avatar_media,u.cover_media,m.id note_id,m.body FROM messages m JOIN users u ON u.id=m.author WHERE room=? ORDER BY m.created DESC LIMIT 100').bind(room).all<NoteRow>()
  return c.json(results.reverse().map(r=>note(r,c.req.url)))
})
app.post('/api/rooms/:id/messages',async c=>{
  const room=c.req.param('id'), author=c.get('user')
  if(!await member(c.env.DB,room,author.id)) return c.json({error:'Conversation unavailable.'},404)
  const body=clean((await readBody(c.req.raw))?.body,800)
  if(!body) return c.json({error:'Enter a message.'},400)
  const message={id:crypto.randomUUID(),author:person(author,c.req.url),body}
  await c.env.DB.prepare('INSERT INTO messages VALUES (?,?,?,?,?)').bind(message.id,room,author.id,body,now()).run()
  c.executionCtx.waitUntil(c.env.ROOMS.getByName(room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify(message)}))
  return c.json(message,201)
})
app.get('/api/rooms/:id/socket',async c=>{
  const room=c.req.param('id')
  if(!await member(c.env.DB,room,c.get('user').id)) return c.json({error:'Conversation unavailable.'},404)
  if(c.req.header('Upgrade')?.toLowerCase()!=='websocket') return c.json({error:'WebSocket required.'},426)
  if(c.req.header('Origin')&&!new Set([c.env.ALLOWED_ORIGIN,'http://127.0.0.1:5173']).has(c.req.header('Origin')!)) return c.json({error:'Origin unavailable.'},403)
  return c.env.ROOMS.getByName(room).fetch('https://room.internal/socket',{headers:{Upgrade:'websocket','X-Room-User':c.get('user').id}})
})
app.onError((error,c)=>{
  if(error instanceof HTTPException)return c.json({error:error.message||'The request could not be completed.'},error.status)
  console.error(error)
  return c.json({error:'Something went wrong. Try again.'},500)
})
export class ChatRoom extends DurableObject<Env>{
  async fetch(request:Request){
    if(new URL(request.url).pathname==='/notify'&&request.method==='POST'){
      const message=await request.text()
      for(const peer of this.ctx.getWebSockets()) if(peer.readyState===WebSocket.OPEN) peer.send(message)
      return new Response(null,{status:204})
    }
    const user=request.headers.get('X-Room-User')
    if(!user||new URL(request.url).pathname!=='/socket')return new Response(null,{status:404})
    const pair=new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1],[user])
    return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':'dameeland'}})
  }
  webSocketMessage(sender:WebSocket,message:string|ArrayBuffer){
    if(typeof message!=='string'||message.length>40000)return
    const [user]=this.ctx.getTags(sender)
    if(!user)return
    let envelope
    try{envelope=JSON.parse(message)}catch{return}
    if(envelope?.type!=='call')return
    const signal=readCallSignal(envelope.signal)
    if(!signal||signal.kind==='unavailable')return
    const peers=this.ctx.getWebSockets().filter(peer=>peer.readyState===WebSocket.OPEN&&this.ctx.getTags(peer).some(tag=>tag!==user))
    const payload=JSON.stringify({type:'call',signal})
    for(const peer of peers){
      try{peer.send(payload)}catch{/* A peer can disconnect during delivery. */}
    }
    if(!peers.length&&signal.kind==='offer')sender.send(JSON.stringify({type:'call',signal:{kind:'unavailable',id:signal.id}}))
  }

}
export default app
