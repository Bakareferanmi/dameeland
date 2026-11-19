import {searchSitemap} from './searchSitemap'
import {readCallSignal} from '@dameeland/core/call-signal'
import {start as startWhot,play as playWhot,draw as drawWhot,shapes as whotShapes,type Match as WhotMatch,type Shape as WhotShape} from '@dameeland/core/whot'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {bodyLimit} from 'hono/body-limit'
import {HTTPException} from 'hono/http-exception'
import {DurableObject} from 'cloudflare:workers'
import * as webpush from 'web-push'
import {lessons,commentGifs,validBirthDate,type BirthdayEntry,storyLimit,storyLifetime,verifiedStoryLimit,verifiedStoryLifetime,storyVideoLimit,verifiedStoryVideoLimit,type Story,type StoryGroup,commentStickers,capitalizeName,initials,normalizeUsername,usernameHint,validUsername,type AdminAccount,type AdminActivity,type AdminDay,type AdminOverview,type CommentAttachment,type FollowPage,type FollowStats,type Person,type Role} from '@dameeland/core'

interface Env {DB:D1Database;MEDIA:R2Bucket;STORIES:KVNamespace;ROOMS:DurableObjectNamespace<ChatRoom>;ALLOWED_ORIGIN:string;VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string;GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;GOOGLE_REDIRECT_URI?:string;ADMIN_USER_IDS?:string;RESEND_API_KEY?:string;RECOVERY_FROM?:string}
type Account={id:string;email:string;name:string;role:Role;salt:string;password_hash:string;username?:string|null;verified?:number;teacher?:number;dob?:string|null}
type PublicAccount=Pick<Account,'id'|'name'|'role'|'username'|'verified'|'teacher'|'dob'> & {email?:string;avatar_media?:string|null;cover_media?:string|null;bio?:string|null;username_changed_at?:number|null;search_public?:number}
type App={Bindings:Env;Variables:{user:PublicAccount;tokenHash:string}}
const app=new Hono<App>()
const encoder=new TextEncoder()
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')
const hash=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)))
const random=(size:number)=>hex(crypto.getRandomValues(new Uint8Array(size)))
const resetAlphabet='23456789abcdefghjklmnpqrstuvwxyz'
const randomResetCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(5)),byte=>resetAlphabet[byte&31]).join('')
const validResetCode=(code:string)=>/^(?:[2-9a-hj-np-z]{5}|[a-f0-9]{12})$/.test(code)
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):''
const mediaUrl=(key:string,url:string)=>new URL('/api/media/'+key,url).href
const person=(user:PublicAccount,url:string):Person=>({id:user.id,name:user.name,username:user.username??undefined,bio:user.bio??undefined,initials:initials(user.name),role:user.role,color:user.role==='tech'?'#CFE8FF':'#FFD9B8',detail:user.teacher?'Teacher':user.role==='tech'?'Tech creator':'Student',teacher:Boolean(user.teacher),birthday:user.dob?user.dob.slice(5):undefined,verified:user.role==='tech'||Boolean(user.verified),avatar:user.avatar_media?mediaUrl(user.avatar_media,url):undefined,cover:user.cover_media?mediaUrl(user.cover_media,url):undefined})
const readBody=async(request:Request)=>request.json<Record<string,unknown>>().catch(()=>null)
const time=(date:number)=>new Date(date).toISOString()
const now=()=>Date.now()
const sessionLifetime=30*86400000
const sessionRefreshWindow=7*86400000
const touchPresence=(db:D1Database,userId:string,online:boolean)=>db.prepare('INSERT INTO presence (user_id,online,last_seen) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET online=excluded.online,last_seen=excluded.last_seen').bind(userId,online?1:0,now()).run()
const base64Url=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const ownerEmail='bakareferanmi96@gmail.com'
const isOwner=(account:Pick<PublicAccount,'email'>)=>account.email?.toLowerCase()===ownerEmail
const isAdmin=(env:Env,account:Pick<PublicAccount,'id'|'email'>)=>isOwner(account)||(env.ADMIN_USER_IDS?.split(',').some(value=>value.trim()===account.id)??false)
const hasVerifiedBenefits=(account:Pick<PublicAccount,'role'|'verified'|'teacher'>)=>account.role==='tech'||Boolean(account.verified)||Boolean(account.teacher)
const viewer=(env:Env,account:PublicAccount,url:string)=>({...person(account,url),dob:account.dob??undefined,usernameNextChangeAt:account.username_changed_at?time(account.username_changed_at+3*86400000):undefined,isAdmin:isAdmin(env,account),searchPublic:Boolean(account.search_public)})
type NotificationKind='message'|'follow'|'comment'|'reaction'|'call'|'birthday'|'announcement'
type NotificationPreferenceRow={messages:number;follows:number;comments:number;reactions:number;calls:number;birthdays:number;announcements:number;quiet_start:string|null;quiet_end:string|null}
type WaitContext={waitUntil:(promise:Promise<unknown>)=>void}
const preferenceColumn=(kind:NotificationKind):'messages'|'follows'|'comments'|'reactions'|'calls'|'birthdays'|'announcements'=>({message:'messages',follow:'follows',comment:'comments',reaction:'reactions',call:'calls',birthday:'birthdays',announcement:'announcements'}[kind] as 'messages'|'follows'|'comments'|'reactions'|'calls'|'birthdays'|'announcements')
const quietNow=(start:string|null,end:string|null)=>{
  if(!start||!end)return false
  const current=new Date().toISOString().slice(11,16)
  return start<=end?current>=start&&current<end:current>=start||current<end
}
type PushDevice={id:string;platform:string;endpoint:string|null;token:string|null}
async function sendPush(env:Env,db:D1Database,devices:PushDevice[],title:string,body:string,entityId?:string,notificationId?:string,kind?:NotificationKind){
  const dead:string[]=[]
  if(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT){
    webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY)
    await Promise.all(devices.filter(device=>device.endpoint&&device.platform!=='android'&&device.platform!=='ios').map(async device=>{
      try{await webpush.sendNotification({endpoint:device.endpoint!,keys:JSON.parse(device.token??'{}')},JSON.stringify({title,body,entityId,notificationId,kind}))}
      catch(error){const status=error instanceof webpush.WebPushError?error.statusCode:0;if(status===404||status===410)dead.push(device.id)}
    }))
  }
  const expo=devices.filter(device=>/^(?:Exponent|Expo)PushToken\[[^\]]+\]$/.test(device.token??''))
  if(expo.length){
    const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(expo.map(device=>({to:device.token,title,body,data:{entityId,notificationId,kind},sound:'default',priority:'high',...(device.platform==='android'?{channelId:kind==='call'?'calls':'default'}:{})})))})
    if(response.ok){const result=await response.json<{data?:Array<{status:string;details?:{error?:string}}>}>();result.data?.forEach((item,index)=>{if(item.status==='error'&&item.details?.error==='DeviceNotRegistered')dead.push(expo[index].id)})}
  }
  if(dead.length)await db.prepare('DELETE FROM notification_devices WHERE id IN ('+dead.map(()=>'?').join(',')+')').bind(...dead).run()
}
async function createNotification(env:Env,ctx:WaitContext,db:D1Database,userId:string,actorId:string|undefined,kind:NotificationKind,entityId:string|undefined,body:string,groupKey?:string){
  if(!userId||userId===actorId)return
  const pref=await db.prepare('SELECT messages,follows,comments,reactions,calls,birthdays,announcements,quiet_start,quiet_end FROM notification_preferences WHERE user_id=?').bind(userId).first<NotificationPreferenceRow>()
  if(pref&&!pref[preferenceColumn(kind)])return
  const muted=!!pref&&kind!=='call'&&quietNow(pref.quiet_start,pref.quiet_end)
  const notificationId=crypto.randomUUID()
  await db.prepare('INSERT INTO notifications (id,user_id,actor_id,kind,entity_id,body,group_key,created) VALUES (?,?,?,?,?,?,?,?)').bind(notificationId,userId,actorId??null,kind,entityId??null,body,groupKey??null,now()).run()
  const devices=(await db.prepare('SELECT id,platform,endpoint,token FROM notification_devices WHERE user_id=?').bind(userId).all<PushDevice>()).results
  if(devices.length&&!muted){
    const actor=actorId?await db.prepare('SELECT username FROM users WHERE id=?').bind(actorId).first<{username:string}>():null
    ctx.waitUntil(sendPush(env,db,devices,kind==='call'?'Incoming call':'dameen',actor?.username?actor.username+' '+body:body,entityId,notificationId,kind))
  }
}
function sendAccountEmail(key:string,from:string,to:string,message:{subject:string;text:string;html?:string;idempotencyKey?:string}){
  const {idempotencyKey,...content}=message
  return fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},
    body:JSON.stringify({from,to:[to],...content}),
  })
}
const welcomeTitle='Welcome to dameen!'
const welcomeIntro='Your account is ready. Set up your profile, find your classmates, and share your first post.'
const welcomeFounders='Damiland Tech Club and BeepeeLabs'
const welcomeSite='https://dameen.app'
const welcomeEmailText=[welcomeTitle,'',welcomeIntro,'','Open dameen: '+welcomeSite,'',welcomeFounders,'Founders of dameen'].join('\n')
const welcomeEmailHtml=`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#faf8ff;font-family:Arial,sans-serif;color:#20162f">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8ff">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border:1px solid #e9e0ff;border-radius:16px">
        <tr><td style="padding:28px;font-size:16px;line-height:1.55">
          <img src="${welcomeSite}/icon-192.png" alt="dameen logo" width="64" height="64" style="display:block;border-radius:14px">
          <h1 style="margin:18px 0 8px;font-size:28px;line-height:1.2">${welcomeTitle}</h1>
          <p style="margin:0 0 22px">${welcomeIntro}</p>
          <p style="margin:0 0 24px"><a href="${welcomeSite}" style="display:inline-block;padding:10px 16px;background:#6a35f0;color:#fff;border-radius:8px;font-weight:bold;text-decoration:none">Open dameen</a></p>
          <p style="margin:0;padding-top:18px;border-top:1px solid #e9e0ff"><strong>${welcomeFounders}</strong><br>Founders of dameen</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

function queueWelcomeEmail(env:Env,ctx:WaitContext,userId:string){
  const {DB,RESEND_API_KEY,RECOVERY_FROM}=env
  if(!RESEND_API_KEY||!RECOVERY_FROM)return
  ctx.waitUntil((async()=>{
    const account=await DB.prepare('SELECT email,welcome_email_delivery_key FROM users WHERE id=? AND welcome_email_sent_at IS NULL')
      .bind(userId).first<{email:string;welcome_email_delivery_key:string}>()
    if(!account)return
    const response=await sendAccountEmail(RESEND_API_KEY,RECOVERY_FROM,account.email,{
      subject:welcomeTitle,
      text:welcomeEmailText,
      html:welcomeEmailHtml,
      idempotencyKey:'dameen/welcome/brand-v2/'+userId+'/'+account.welcome_email_delivery_key,
    })
    if(!response.ok){console.error('Welcome email delivery rejected',response.status);return}
    await DB.prepare('UPDATE users SET welcome_email_sent_at=? WHERE id=? AND welcome_email_sent_at IS NULL AND welcome_email_delivery_key=?')
      .bind(now(),userId,account.welcome_email_delivery_key).run()
  })().catch(()=>console.error('Welcome email delivery failed')))
}
async function session(env:Env,ctx:WaitContext,account:PublicAccount,url:string){
  if(isOwner(account)&&(account.role!=='tech'||!account.verified||!account.teacher)){
    await env.DB.prepare("UPDATE users SET role='tech',verified=1,teacher=1 WHERE id=?").bind(account.id).run()
    account={...account,role:'tech',verified:1,teacher:1}
  }
  const token=random(32)
  await env.DB.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await hash(token),account.id,now()+sessionLifetime).run()
  queueWelcomeEmail(env,ctx,account.id)
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
const allowedOrigins=(env:Env)=>[
  ...env.ALLOWED_ORIGIN.split(',').map(origin=>origin.trim()).filter(Boolean),
  'http://127.0.0.1:5173',
]
app.use('/api/*',async(c,next)=>cors({origin:allowedOrigins(c.env),allowMethods:['GET','POST','PUT','DELETE','OPTIONS'],allowHeaders:['Authorization','Content-Type']})(c,next))
app.use('/api/*',async(c,next)=>{
  if(c.req.method!=='POST'&&c.req.method!=='PUT')return next()
  const mediaUpload=c.req.path==='/api/posts'||c.req.path==='/api/stories'||/^\/api\/rooms\/[^/]+\/messages$/.test(c.req.path)
  const imageUpload=c.req.path.startsWith('/api/me/photos/')||/^\/api\/posts\/[^/]+\/comments$/.test(c.req.path)||/^\/api\/groups\/[^/]+\/photo$/.test(c.req.path)
  const maxSize=mediaUpload?30000000:imageUpload?5300000:8192
  return bodyLimit({maxSize,onError:()=>{throw new HTTPException(413,{message:'The request is too large.'})}})(c,next)
})
app.get('/api/health',c=>c.json({ok:true}))
app.use('/api/public/*',async(c,next)=>{
  c.header('X-Robots-Tag','noindex')
  c.header('Cache-Control','no-store')
  await next()
})
app.get('/api/public/sitemap',c=>searchSitemap(c.env.DB,c.req.query('section')))
const publicPostId=/^[a-z0-9-]{8,80}$/i
app.get('/api/public/posts/:id',async c=>{
  const id=c.req.param('id')
  if(!publicPostId.test(id))return c.json({error:'Post unavailable.'},404)
  const post=await c.env.DB.prepare(`SELECT p.id,p.body,p.created,p.media,p.media_kind,p.search_public,u.username,u.name,u.avatar_media
    FROM posts p JOIN users u ON u.id=p.author WHERE p.id=?`).bind(id)
    .first<{id:string;body:string;created:number;media:string|null;media_kind:'image'|'video'|null;search_public:number;username:string|null;name:string;avatar_media:string|null}>()
  if(!post)return c.json({error:'Post unavailable.'},404)
  const searchPublic=Boolean(post.search_public)
  return c.json({
    id:post.id,body:post.body,created:time(post.created),searchPublic,handle:post.username,username:post.username||post.name,
    avatar:post.avatar_media?mediaUrl(post.avatar_media,c.req.url):undefined,
    image:post.media&&post.media_kind==='image'?mediaUrl(post.media,c.req.url):undefined,
    media:searchPublic&&post.media?new URL('/api/public/post-media/'+post.id,c.req.url).href:undefined,
    kind:post.media_kind,
  })
})
app.get('/api/public/post-media/:id',async c=>{
  const id=c.req.param('id')
  if(!publicPostId.test(id))return c.json({error:'Media unavailable.'},404)
  const post=await c.env.DB.prepare('SELECT media FROM posts WHERE id=? AND search_public=1').bind(id).first<{media:string|null}>()
  if(!post?.media)return c.json({error:'Media unavailable.'},404)
  return storedMedia(c.env.MEDIA,post.media,'no-store')
})
app.get('/api/public/profiles/:username',async c=>{
  const username=normalizeUsername(c.req.param('username'))
  if(!validUsername(username))return c.json({error:'Profile unavailable.'},404)
  const account=await c.env.DB.prepare('SELECT id,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio,search_public FROM users WHERE username=? COLLATE NOCASE').bind(username).first<PublicAccount>()
  if(!account)return c.json({error:'Profile unavailable.'},404)
  const profile=person(account,c.req.url)
  return c.json({id:profile.id,username:profile.username,name:profile.name,bio:profile.bio,avatar:profile.avatar,cover:profile.cover,detail:profile.detail,searchPublic:Boolean(account.search_public)})
})
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
    let text=account.username?'Your dameen username is '+account.username+'.':'You can sign in to dameen with this email address.'
    if(kind==='password'){
      const code=randomResetCode()
      await DB.prepare(`INSERT INTO password_resets(user_id,code_hash,expires) VALUES (?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires`)
        .bind(account.id,await hash(code),now()+15*60000).run()
      text='Your dameen password reset code is '+code.toUpperCase()+'. It expires in 15 minutes. If you did not request this, you can ignore this email.'
    }
    c.executionCtx.waitUntil(sendAccountEmail(RESEND_API_KEY,RECOVERY_FROM,email,{
      subject:kind==='password'?'Reset your dameen password':'Your dameen username',text,
    })
      .then(response=>{if(!response.ok)console.error('Recovery email delivery rejected',response.status)})
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
  if(!emailPattern.test(email)||!validResetCode(code)||password.length<8||password.length>128)
    return c.json({error:'Enter your email, a valid reset code and a password with 8 to 128 characters.'},400)
  const db=c.env.DB
  if(!await authAllowed(db,c.req.header('CF-Connecting-IP')??'local','recovery-reset',10)
    ||!await authAllowed(db,email,'recovery-reset-email',8))
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
  const dob=body?.dob
  if(action==='signup'&&!validBirthDate(dob))return c.json({error:'Enter your date of birth.'},400)
  const validIdentifier=action==='signup'?emailPattern.test(email):emailPattern.test(identifier)||validUsername(loginUsername)
  if(!validIdentifier) return c.json({error:action==='signup'?'Enter a valid email.':'Enter your email or username and password.'},400)
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
    account={id:crypto.randomUUID(),email,name,role,salt,username,dob:dob as string,password_hash:await passwordHash(password,salt)}
    const referralCode=clean(body?.referralCode,32)
    const inviter=referralCode?await db.prepare('SELECT id FROM users WHERE invite_code=?').bind(referralCode).first<{id:string}>():null
    const write=await db.prepare('INSERT INTO users(id,email,name,role,salt,password_hash,first_name,last_name,username,dob,created,invited_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(account.id,email,name,role,salt,account.password_hash,firstName,lastName,username,dob as string,now(),inviter?.id??null).run()
    if(!write.meta.changes){
      if(await usernameTaken(db,username))return c.json({error:'That username is taken.'},409)
      return c.json({error:'An account already uses this email.'},409)
    }
  }else{
    const candidate=await passwordHash(password,account?.salt??'8d039d76714da531')
    if(!account||!equal(candidate,account.password_hash)) return c.json({error:'Email, username or password is incorrect.'},401)
  }
  return c.json(await session(c.env,c.executionCtx,account,c.req.url),action==='signup'?201:200)
})

type GoogleAttempt={mode:'signup'|'login';username:string|null;dob:string|null;referral_code:string|null;verifier:string;status:string;user_id:string|null;error:string|null}
app.post('/api/google/start',async c=>{
  const {DB,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI}=c.env
  if(!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET||!GOOGLE_REDIRECT_URI)return c.json({error:'Google sign-in is not configured.'},503)
  if(!await authAllowed(DB,c.req.header('CF-Connecting-IP')??'local','google'))return c.json({error:'Too many attempts. Try again in a few minutes.'},429)
  const body=await readBody(c.req.raw)
  const mode=body?.mode==='signup'?'signup':'login'
  const username=mode==='signup'?usernameOf(body?.username):null
  if(username!==null&&!validUsername(username))return c.json({error:usernameHint},400)
  if(username&&await usernameTaken(DB,username))return c.json({error:'That username is taken.'},409)
  const dob=mode==='signup'?body?.dob:null
  if(dob!==null&&!validBirthDate(dob))return c.json({error:'Enter your date of birth.'},400)
  const referralCode=mode==='signup'?clean(body?.referralCode,32):''
  const state=random(24),exchange=random(32),verifier=random(48)
  const challenge=base64Url(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)))
  await DB.batch([
    DB.prepare('DELETE FROM google_attempts WHERE expires<=?').bind(now()),
    DB.prepare('DELETE FROM auth_limits WHERE expires<?').bind(now()),
    DB.prepare('INSERT INTO google_attempts(state,exchange_hash,verifier,role,expires,username,dob,referral_code,mode) VALUES (?,?,?,?,?,?,?,?,?)').bind(state,await hash(exchange),verifier,'student',now()+600000,username,dob,referralCode||null,mode),
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
    ?`<title>dameen</title><meta name="viewport" content="width=device-width"><p>Google sign-in completed. Returning to dameen…</p><script>if(window.opener){window.opener.postMessage({type:'dameen-google-complete'},'https://dameen.app');window.close()}else{location.replace('https://dameen.app/?google=complete')}</script>`
    :'<title>dameen</title><p>Google sign-in did not complete. Return to dameen for details.</p>',ok?200:400)
  if(!/^[a-f0-9]{48}$/.test(state)||!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET||!GOOGLE_REDIRECT_URI)return complete(false)
  const attempt=await DB.prepare("UPDATE google_attempts SET status='processing' WHERE state=? AND status='pending' AND expires>? RETURNING verifier,username,dob,referral_code,mode").bind(state,now()).first<GoogleAttempt>()
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
      const emailAccount=await DB.prepare('SELECT id,google_sub FROM users WHERE email=?').bind(email).first<{id:string;google_sub:string|null}>()
      if(emailAccount){
        if(emailAccount.google_sub&&emailAccount.google_sub!==sub)return fail('This email is already linked to another Google account.')
        const linked=await DB.prepare('UPDATE users SET google_sub=? WHERE id=? AND (google_sub IS NULL OR google_sub=?) RETURNING id').bind(sub,emailAccount.id,sub).first<{id:string}>()
        account=linked??await DB.prepare('SELECT id FROM users WHERE google_sub=?').bind(sub).first<{id:string}>()
        if(!account)return fail('This account could not be linked to Google. Try again.')
      }else{
        if(attempt.mode!=='signup'||!attempt.username)return fail('No Google account found on dameen. Choose Sign up first.')
        const first=capitalizeName(clean(info.given_name,60)),last=capitalizeName(clean(info.family_name,60))
        if(!first||!last)return fail('Add a first and last name to your Google profile or sign up with email.')
        const inviter=attempt.referral_code?await DB.prepare('SELECT id FROM users WHERE invite_code=?').bind(attempt.referral_code).first<{id:string}>():null
        await DB.prepare('INSERT INTO users(id,email,name,role,salt,password_hash,first_name,last_name,google_sub,username,dob,created,invited_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
          .bind(crypto.randomUUID(),email,first+' '+last,'student',random(16),random(32),first,last,sub,attempt.username,attempt.dob,now(),inviter?.id??null).run()
        account=await DB.prepare('SELECT id FROM users WHERE google_sub=?').bind(sub).first<{id:string}>()
        if(!account){
          if(await usernameTaken(DB,attempt.username))return fail('That username is taken. Choose another and try again.')
          return fail('An account already uses this email. Try Google login instead.')
        }
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
  const account=await DB.prepare('SELECT id,email,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio,username_changed_at,search_public FROM users WHERE id=?').bind(claimed.user_id).first<PublicAccount>()
  if(!account)return c.json({error:'Account unavailable.'},404)
  return c.json(await session(c.env,c.executionCtx,account,c.req.url))
})
async function storedMedia(bucket:R2Bucket,id:string,cacheControl:string){
  const object=await bucket.get(id)
  if(!object)return Response.json({error:'Image unavailable.'},{status:404})
  const headers=new Headers({'X-Content-Type-Options':'nosniff','Cache-Control':cacheControl})
  object.writeHttpMetadata(headers)
  return new Response(object.body,{headers})
}
app.get('/api/media/:id',async c=>{
  const id=c.req.param('id')
  const attachment=await c.env.DB.prepare('SELECT id FROM users WHERE avatar_media=? OR cover_media=? UNION ALL SELECT id FROM posts WHERE media=? UNION ALL SELECT id FROM comments WHERE media=? UNION ALL SELECT id FROM messages WHERE media=? AND view_once=0 UNION ALL SELECT id FROM chat_groups WHERE photo_media=? LIMIT 1').bind(id,id,id,id,id,id).first()
  if(!attachment) return c.json({error:'Image unavailable.'},404)
  return storedMedia(c.env.MEDIA,id,'public, max-age=3600')
})
app.get('/api/view-once/:id/:ticket',async c=>{
  const {id,ticket}=c.req.param()
  if(!uuidPattern.test(id)||!/^[a-f0-9]{32}$/.test(ticket))return c.json({error:'Media unavailable.'},404)
  const row=await c.env.DB.prepare('SELECT media,media_token_expires FROM messages WHERE id=? AND media_token_hash=? AND view_once=1').bind(id,await hash(ticket)).first<{media:string|null;media_token_expires:number|null}>()
  if(!row?.media||!row.media_token_expires||row.media_token_expires<now())return c.json({error:'This view-once media has expired.'},410)
  return storedMedia(c.env.MEDIA,row.media,'private, no-store')
})
const storyKey=(user:string)=>'stories:'+user
type StoryRecord={id:string;text:string;media?:string;kind?:'image'|'video';background?:string;created:number;expires?:number}
const storyExpiry=(story:StoryRecord)=>story.expires??story.created+storyLifetime
async function readStories(env:Env,user:string){
  const list=await env.STORIES.get<StoryRecord[]>(storyKey(user),'json')
  return Array.isArray(list)?list:[]
}
// Stories live only in KV (one key per author) and R2, never in D1. The key expires on its own and
// every read also filters by timestamp, so a story is never served after its account-specific lifetime even if cleanup lags.
async function writeStories(env:Env,user:string,list:StoryRecord[]){
  if(!list.length)return env.STORIES.delete(storyKey(user))
  const ttl=Math.max(60,Math.ceil((Math.max(...list.map(storyExpiry))-now())/1000))
  return env.STORIES.put(storyKey(user),JSON.stringify(list),{expirationTtl:ttl})
}
const storyView=(user:string,story:StoryRecord,url:string):Story=>({id:story.id,text:story.text,kind:story.kind,background:story.background,image:story.kind==='image'&&story.media?new URL('/api/story-media/'+user+'/'+story.id,url).href:undefined,video:story.kind==='video'&&story.media?new URL('/api/story-media/'+user+'/'+story.id,url).href:undefined,created:time(story.created),expires:time(storyExpiry(story))})
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
app.get('/api/notification-public-key',c=>c.env.VAPID_PUBLIC_KEY?c.json({publicKey:c.env.VAPID_PUBLIC_KEY}):c.json({error:'Push notifications are not configured.'},503))
app.use('/api/*',async(c,next)=>{
  const header=c.req.header('Authorization')
  const ticket=c.req.path.endsWith('/socket')?c.req.header('Sec-WebSocket-Protocol')?.split(',').map(s=>s.trim()).find(s=>s.startsWith('ticket.'))?.slice(7):undefined
  const token=header?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]??ticket
  if(!token||!/^[a-f0-9]{64}$/.test(token)) return c.json({error:'Log in to continue.'},401)
  const tokenHash=await hash(token)
  let user=await c.env.DB.prepare('SELECT u.id,u.email,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio,u.username_changed_at,u.search_public FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?').bind(tokenHash,now()).first<PublicAccount>()
  if(!user) return c.json({error:'Your session has expired. Log in again.'},401)
  await c.env.DB.prepare('UPDATE sessions SET expires=? WHERE token_hash=? AND expires<?').bind(now()+sessionLifetime,tokenHash,now()+sessionRefreshWindow).run()
  if(isOwner(user)&&(user.role!=='tech'||!user.verified||!user.teacher)){
    await c.env.DB.prepare("UPDATE users SET role='tech',verified=1,teacher=1 WHERE id=?").bind(user.id).run()
    user={...user,role:'tech',verified:1,teacher:1}
  }
  c.set('user',user);c.set('tokenHash',tokenHash)
  await next()
})
type NotificationRow=Record<string,unknown>
const notificationView=(row:NotificationRow,url:string)=>({id:row.id,kind:row.kind,entityId:row.entity_id??undefined,body:row.body,groupKey:row.group_key??undefined,created:time(Number(row.created)),read:Boolean(row.read),actor:row.actor_id?person({id:String(row.actor_id),name:String(row.actor_name??''),role:row.actor_role as Role,username:row.actor_username as string|null,verified:Number(row.actor_verified??0),teacher:Number(row.actor_teacher??0),dob:row.actor_dob as string|null,avatar_media:row.actor_avatar_media as string|null,cover_media:row.actor_cover_media as string|null},url):undefined})
const notificationSelect=`SELECT n.id,n.kind,n.entity_id,n.body,n.group_key,n.created,n.read,
  u.id actor_id,u.name actor_name,u.role actor_role,u.username actor_username,u.verified actor_verified,u.teacher actor_teacher,u.dob actor_dob,u.avatar_media actor_avatar_media,u.cover_media actor_cover_media
  FROM notifications n LEFT JOIN users u ON u.id=n.actor_id`
const unreadMessageCount=(db:D1Database,user:string)=>db.prepare(`
  WITH viewer(id) AS (VALUES (?))
  SELECT COUNT(*) count FROM messages m CROSS JOIN viewer v
  LEFT JOIN chat_read_state r ON r.room=m.room AND r.user_id=v.id
  WHERE m.author!=v.id
    AND (
      EXISTS(SELECT 1 FROM rooms d WHERE d.id=m.room AND (d.first_user=v.id OR d.second_user=v.id))
      OR EXISTS(SELECT 1 FROM group_members g WHERE g.group_id=m.room AND g.user_id=v.id)
    )
    AND ((r.last_read_at IS NOT NULL AND m.created>r.last_read_at) OR (r.last_read_at IS NULL AND m.read_at IS NULL))
`).bind(user).first<{count:number}>()
app.get('/api/notifications',async c=>{
  const user=c.get('user').id
  const cursor=c.req.query('cursor')??''
  const match=/^(\d{13}):([a-f0-9-]{36})$/.exec(cursor)
  if(cursor&&!match)return c.json({error:'Invalid notification page.'},400)
  const cutoff=match?Number(match[1]):Number.MAX_SAFE_INTEGER
  const lastId=match?.[2]??''
  const {results}=await c.env.DB.prepare(`${notificationSelect}
    WHERE n.user_id=? AND (n.created<? OR (n.created=? AND n.id<?))
    ORDER BY n.created DESC,n.id DESC LIMIT 13
  `).bind(user,cutoff,cutoff,lastId).all<NotificationRow>()
  const [unread,messageUnread]=await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) count FROM notifications WHERE user_id=? AND read=0').bind(user).first<{count:number}>(),
    unreadMessageCount(c.env.DB,user),
  ])
  const items=results.slice(0,12),last=items.at(-1)
  c.header('Cache-Control','no-store')
  return c.json({unread:unread?.count??0,messageUnread:messageUnread?.count??0,nextCursor:results.length>12&&last?`${last.created}:${last.id}`:null,items:items.map(row=>notificationView(row,c.req.url))})
})
app.get('/api/notifications/:id',async c=>{
  const item=await c.env.DB.prepare(`${notificationSelect} WHERE n.id=? AND n.user_id=?`).bind(c.req.param('id'),c.get('user').id).first<NotificationRow>()
  if(!item)return c.json({error:'Notification unavailable.'},404)
  c.header('Cache-Control','no-store')
  return c.json(notificationView(item,c.req.url))
})
app.put('/api/notifications/:id/read',async c=>{
  const result=await c.env.DB.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=?').bind(c.req.param('id'),c.get('user').id).run()
  return c.json({ok:Boolean(result.meta.changes)})
})
app.put('/api/notifications/read-all',async c=>{
  await c.env.DB.prepare('UPDATE notifications SET read=1 WHERE user_id=?').bind(c.get('user').id).run()
  return c.json({ok:true})
})
app.post('/api/notifications/devices',async c=>{
  const input=await readBody(c.req.raw)
  const platform=input?.platform
  const endpoint=typeof input?.endpoint==='string'?input.endpoint.slice(0,2000):null
  const token=typeof input?.token==='string'?input.token.slice(0,1000):null
  if(!['web','pwa','android','ios'].includes(String(platform))||(!endpoint&&!token))return c.json({error:'A valid notification device is required.'},400)
  const id=crypto.randomUUID(),user=c.get('user').id,at=now()
  await c.env.DB.prepare(`INSERT INTO notification_devices (id,user_id,platform,endpoint,token,created,last_seen) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,platform,endpoint,token) DO UPDATE SET last_seen=excluded.last_seen`).bind(id,user,platform,endpoint,token,at,at).run()
  return c.json({ok:true},201)
})
app.delete('/api/notifications/devices',async c=>{
  const input=await readBody(c.req.raw)
  const endpoint=typeof input?.endpoint==='string'?input.endpoint:null
  const token=typeof input?.token==='string'?input.token:null
  if(!endpoint&&!token)return c.json({error:'A device endpoint or token is required.'},400)
  await c.env.DB.prepare('DELETE FROM notification_devices WHERE user_id=? AND (endpoint=? OR token=?)').bind(c.get('user').id,endpoint,token).run()
  return c.json({ok:true})
})
app.get('/api/notification-preferences',async c=>{
  const user=c.get('user').id
  const current=await c.env.DB.prepare('SELECT messages,follows,comments,reactions,calls,birthdays,announcements,quiet_start,quiet_end FROM notification_preferences WHERE user_id=?').bind(user).first<NotificationPreferenceRow>()
  return c.json(current??{messages:true,follows:true,comments:true,reactions:true,calls:true,birthdays:true,announcements:true,quiet_start:null,quiet_end:null})
})
app.put('/api/notification-preferences',async c=>{
  const user=c.get('user').id,input=await readBody(c.req.raw)
  const bool=(value:unknown)=>value===false?0:1
  const start=typeof input?.quiet_start==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(input.quiet_start)?input.quiet_start:null
  const end=typeof input?.quiet_end==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(input.quiet_end)?input.quiet_end:null
  await c.env.DB.prepare(`INSERT INTO notification_preferences (user_id,messages,follows,comments,reactions,calls,birthdays,announcements,quiet_start,quiet_end,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET messages=excluded.messages,follows=excluded.follows,comments=excluded.comments,reactions=excluded.reactions,calls=excluded.calls,birthdays=excluded.birthdays,announcements=excluded.announcements,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,updated=excluded.updated`).bind(user,bool(input?.messages),bool(input?.follows),bool(input?.comments),bool(input?.reactions),bool(input?.calls),bool(input?.birthdays),bool(input?.announcements),start,end,now()).run()
  return c.json({ok:true})
})
app.get('/api/me',c=>{
  const account=c.get('user')
  queueWelcomeEmail(c.env,c.executionCtx,account.id)
  return c.json(viewer(c.env,account,c.req.url))
})
app.put('/api/me/profile',async c=>{
  const input=await readBody(c.req.raw)
  const publicChoice=input?.searchPublic
  if(publicChoice!==undefined&&typeof publicChoice!=='boolean')return c.json({error:'Choose a search visibility setting.'},400)
  if(publicChoice===true&&!c.get('user').username)return c.json({error:'Choose a username before enabling search visibility.'},400)
  const name=typeof input?.name==='string'?input.name.trim().replace(/\s+/g,' '):''
  const bio=typeof input?.bio==='string'?input.bio.trim():''
  if(!name||name.length>120||typeof input?.bio!=='string'||Array.from(bio).length>50)
    return c.json({error:'Enter a name and a bio of up to 50 characters.'},400)
  const [firstName,...rest]=name.split(' ')
  const account=await c.env.DB.prepare('UPDATE users SET name=?,first_name=?,last_name=?,bio=?,search_public=COALESCE(?,search_public) WHERE id=? RETURNING id,email,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio,username_changed_at,search_public')
    .bind(name,firstName,rest.join(' '),bio,publicChoice===undefined?null:Number(publicChoice),c.get('user').id).first<PublicAccount>()
  if(!account)return c.json({error:'Profile unavailable.'},404)
  return c.json(viewer(c.env,account,c.req.url))
})
app.put('/api/me/username',async c=>{
  const username=usernameOf((await readBody(c.req.raw))?.username)
  if(!validUsername(username))return c.json({error:usernameHint},400)
  const current=c.get('user')
  if(current.username===username)return c.json(viewer(c.env,current,c.req.url))
  const changed=await c.env.DB.prepare('UPDATE users SET username=?,username_changed_at=? WHERE id=? AND (username_changed_at IS NULL OR username_changed_at<=?) RETURNING id,email,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio,username_changed_at,search_public')
    .bind(username,now(),current.id,now()-3*86400000).first<PublicAccount>().catch(error=>{
      if(String(error).includes('UNIQUE constraint failed'))return null
      throw error
    })
  if(changed)return c.json(viewer(c.env,changed,c.req.url))
  const existing=await c.env.DB.prepare('SELECT username_changed_at FROM users WHERE id=?').bind(current.id).first<{username_changed_at:number|null}>()
  if(existing?.username_changed_at&&now()-existing.username_changed_at<3*86400000)return c.json({error:'You can change your username again after '+time(existing.username_changed_at+3*86400000)+'.',nextChangeAt:time(existing.username_changed_at+3*86400000)},429)
  return c.json({error:'That username is taken.'},409)
})
app.put('/api/me/presence',async c=>{
  await touchPresence(c.env.DB,c.get('user').id,(await readBody(c.req.raw))?.online===true)
  return c.json({ok:true})
})
app.get('/api/me/analytics',async c=>{
  const data=await c.env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM posts WHERE author=?1) posts,
    (SELECT COUNT(*) FROM follows WHERE target=?1) followers,
    (SELECT COUNT(*) FROM follows WHERE follower=?1) following,
    (SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id=r.post_id WHERE p.author=?1 AND r.kind='like') likes,
    (SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id=r.post_id WHERE p.author=?1 AND r.kind='repost') reposts,
    (SELECT COUNT(*) FROM comments x JOIN posts p ON p.id=x.post_id WHERE p.author=?1) comments,
    (SELECT COUNT(*) FROM users WHERE invited_by=?1) invites`).bind(c.get('user').id).first()
  c.header('Cache-Control','no-store')
  return c.json(data)
})
app.get('/api/me/invite',async c=>{
  const id=c.get('user').id,db=c.env.DB
  let row=await db.prepare('SELECT invite_code FROM users WHERE id=?').bind(id).first<{invite_code:string|null}>()
  if(!row?.invite_code){
    const code=random(6)
    await db.prepare('UPDATE users SET invite_code=? WHERE id=? AND invite_code IS NULL').bind(code,id).run()
    row=await db.prepare('SELECT invite_code FROM users WHERE id=?').bind(id).first<{invite_code:string|null}>()
  }
  const count=await db.prepare('SELECT COUNT(*) count FROM users WHERE invited_by=?').bind(id).first<{count:number}>()
  c.header('Cache-Control','no-store')
  return c.json({code:row?.invite_code,url:'https://dameen.app/?ref='+row?.invite_code,count:count?.count??0})
})
app.get('/api/me/lessons',async c=>{
  c.header('Cache-Control','no-store')
  const {results}=await c.env.DB.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id=? ORDER BY completed_at DESC')
    .bind(c.get('user').id).all<{lesson_id:string}>()
  return c.json(results.map(row=>row.lesson_id))
})
app.put('/api/me/lessons/:id',async c=>{
  const lesson=lessons.find(item=>item.id===c.req.param('id'))
  if(!lesson)return c.json({error:'Lesson unavailable.'},404)
  const input=await readBody(c.req.raw)
  if(input?.answer!==lesson.answer)return c.json({error:'Try the practice question again.'},400)
  await c.env.DB.prepare('INSERT INTO lesson_progress (user_id,lesson_id,completed_at) VALUES (?,?,?) ON CONFLICT DO NOTHING')
    .bind(c.get('user').id,lesson.id,now()).run()
  return c.json({ok:true})
})
app.put('/api/me/birthday',async c=>{
  const dob=(await readBody(c.req.raw))?.dob
  if(!validBirthDate(dob))return c.json({error:'Enter a valid date of birth.'},400)
  const user=c.get('user')
  await c.env.DB.prepare('UPDATE users SET dob=? WHERE id=?').bind(dob,user.id).run()
  return c.json(viewer(c.env,{...user,dob},c.req.url))
})
// Birthdays are shown as month and day only. The server accepts UTC yesterday, today and tomorrow so every
// timezone gets its own "today"; the app then picks the exact local day.
const birthdayWindow=(at=now())=>Array.from({length:9},(_,index)=>index-1).map(offset=>{const day=new Date(at+offset*86400000);return {md:String(day.getUTCMonth()+1).padStart(2,'0')+'-'+String(day.getUTCDate()).padStart(2,'0'),year:day.getUTCFullYear(),offset}})
app.get('/api/birthdays',async c=>{
  const me=c.get('user')
  const window=birthdayWindow()
  const days=[...new Set([...window.map(day=>day.md),window.some(day=>day.md==='02-28')?'02-29':''].filter(Boolean))]
  const {results}=await c.env.DB.prepare(`
    SELECT id,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio FROM users
    WHERE substr(dob,6,5) IN (${days.map(()=>'?').join(',')}) AND (id=? OR id IN (SELECT target FROM follows WHERE follower=?))
    LIMIT 40
  `).bind(...days,me.id,me.id).all<PublicAccount>()
  const wishes=await c.env.DB.prepare('SELECT recipient,year FROM birthday_wishes WHERE sender=? AND year>=?').bind(me.id,window[0].year).all<{recipient:string;year:number}>()
  const wished=new Set(wishes.results.map(item=>item.recipient+':'+item.year))
  c.header('Cache-Control','no-store')
  return c.json<BirthdayEntry[]>(results.map(account=>{const match=window.find(day=>day.md===account.dob?.slice(5)||(day.md==='02-28'&&account.dob?.slice(5)==='02-29'));return {person:person(account,c.req.url),wished:window.some(day=>day.md===account.dob?.slice(5)&&wished.has(account.id+':'+day.year)),daysUntil:match?.offset??undefined}}))
})
app.get('/api/people/:id/birthday-wall',async c=>{
  const year=new Date().getUTCFullYear()
  const {results}=await c.env.DB.prepare(`SELECT w.body,w.created,u.id,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio FROM birthday_wishes w JOIN users u ON u.id=w.sender WHERE w.recipient=? AND w.year IN (?,?) ORDER BY w.created DESC LIMIT 100`).bind(c.req.param('id'),year,year-1).all<PublicAccount&{body:string;created:number}>()
  return c.json(results.map(item=>({body:item.body,created:time(item.created),author:person(item,c.req.url)})))
})
app.post('/api/people/:id/birthday-wish',async c=>{
  const me=c.get('user'),db=c.env.DB
  const target=await db.prepare('SELECT id,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio FROM users WHERE id=?').bind(c.req.param('id')).first<PublicAccount>()
  if(!target||target.id===me.id)return c.json({error:'Profile unavailable.'},404)
  const day=birthdayWindow().find(item=>item.md===target.dob?.slice(5)||item.md==='02-28'&&target.dob?.slice(5)==='02-29')
  if(!target.dob||!day)return c.json({error:'It is not '+target.name.split(' ')[0]+'’s birthday today.'},400)
  const input=await readBody(c.req.raw)
  const body=clean(input?.body,240)||('Happy birthday, '+target.name.split(' ')[0]+'! 🎂🎉')
  const wish=await db.prepare('INSERT INTO birthday_wishes (sender,recipient,year,created,body) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').bind(me.id,target.id,day.year,now(),body).run()
  if(!wish.meta.changes)return c.json({error:'You already wished '+target.name.split(' ')[0]+' a happy birthday.'},409)
  const [first,second]=[me.id,target.id].sort()
  await db.prepare('INSERT INTO rooms VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),first,second).run()
  const room=await db.prepare('SELECT id FROM rooms WHERE first_user=? AND second_user=?').bind(first,second).first<{id:string}>()
  if(!room)return c.json({error:'Could not send your wish.'},500)
  const message={id:crypto.randomUUID(),author:person(me,c.req.url),body}
  await db.prepare('INSERT INTO messages (id,room,author,body,created) VALUES (?,?,?,?,?)').bind(message.id,room.id,me.id,message.body,now()).run()
  await createNotification(c.env,c.executionCtx,db,target.id,me.id,'birthday',target.id,me.name+' sent you a birthday wish','birthday:'+target.id+':'+day.year)
  c.executionCtx.waitUntil(c.env.ROOMS.getByName(room.id).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify(message)}))
  return c.json({ok:true,room:room.id},201)
})
app.use('/api/admin/*',async(c,next)=>{
  if(!isAdmin(c.env,c.get('user')))return c.json({error:'Admin access is required.'},403)
  c.header('Cache-Control','no-store')
  await next()
})
type AdminUserRow=PublicAccount&{email:string;created:number|null;invite_count:number}
const adminAccount=(r:AdminUserRow,url:string):AdminAccount=>({
  person:person(r,url),email:r.email,created:r.created,independentlyVerified:Boolean(r.verified),inviteCount:r.invite_count??0,
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
  c.header('Cache-Control','private, max-age=28800, stale-while-revalidate=600')
  return c.json({...metrics.results[0] as Metrics,activity:activity.results as AdminActivity[],series,updatedAt})
})
app.get('/api/admin/accounts',async c=>{
  const q=clean(c.req.query('q'),100).toLowerCase().replace(/^@/,'')
  const cursor=clean(c.req.query('cursor'),64)
  const {results}=await c.env.DB.prepare(`
    SELECT u.id,u.name,u.email,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio,u.created,
      (SELECT COUNT(*) FROM users invited WHERE invited.invited_by=u.id) invite_count FROM users u
    WHERE u.id>? AND (instr(lower(u.name),?)>0 OR instr(u.username,?)>0 OR instr(u.email,?)>0)
    ORDER BY u.id LIMIT 26
  `).bind(cursor,q,q,q).all<AdminUserRow>()
  return c.json({accounts:results.slice(0,25).map(r=>adminAccount(r,c.req.url)),nextCursor:results.length>25?results[24].id:null})
})
app.put('/api/admin/accounts/:id',async c=>{
  const payload=await readBody(c.req.raw)
  if(payload?.role!=='student'&&payload?.role!=='tech'||typeof payload?.verified!=='boolean')return c.json({error:'Choose a valid role and verification status.'},400)
  if(payload.teacher!==undefined&&typeof payload.teacher!=='boolean')return c.json({error:'Choose a valid teacher status.'},400)
  const account=await c.env.DB.prepare(`
    UPDATE users SET role=CASE WHEN lower(email)=? THEN 'tech' ELSE ? END,
      verified=CASE WHEN lower(email)=? THEN 1 ELSE ? END,
      teacher=CASE WHEN lower(email)=? THEN 1 ELSE COALESCE(?,teacher) END WHERE id=?
    RETURNING id,name,email,role,username,verified,teacher,dob,avatar_media,cover_media,bio,created
  `).bind(ownerEmail,payload.role,ownerEmail,Number(payload.verified),ownerEmail,payload.teacher===undefined?null:Number(payload.teacher),c.req.param('id')).first<Omit<AdminUserRow,'invite_count'>>()
  if(!account)return c.json({error:'Account unavailable.'},404)
  const invites=await c.env.DB.prepare('SELECT COUNT(*) count FROM users WHERE invited_by=?').bind(account.id).first<{count:number}>()
  return c.json(adminAccount({...account,invite_count:invites?.count??0},c.req.url))
})
async function imageType(file:File,allowGif=false){
  if(!file.size||file.size>5*1024*1024)return null
  const head=new Uint8Array(await file.slice(0,12).arrayBuffer())
  if([137,80,78,71,13,10,26,10].every((n,i)=>head[i]===n))return 'image/png'
  if(head[0]===255&&head[1]===216&&head[2]===255)return 'image/jpeg'
  if(String.fromCharCode(...head.slice(0,4))==='RIFF'&&String.fromCharCode(...head.slice(8))==='WEBP')return 'image/webp'
  if(allowGif&&['GIF87a','GIF89a'].includes(String.fromCharCode(...head.slice(0,6))))return 'image/gif'
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
      DB.prepare(`UPDATE users SET ${column}=? WHERE id=? RETURNING id,email,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio,search_public`).bind(key,user.id),
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
    SELECT id,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio FROM users
    WHERE id=?1 OR id IN (SELECT target FROM follows WHERE follower=?1 LIMIT 40)
  `).bind(me.id).all<PublicAccount>()
  const at=now()
  const groups=await Promise.all(results.map(async author=>({author,stories:(await readStories(c.env,author.id)).filter(story=>storyExpiry(story)>at)})))
  const authors=groups.filter(group=>group.stories.length).map(group=>group.author.id)
  const likes=authors.length?(await c.env.DB.prepare(`SELECT story_id,COUNT(*) likes,MAX(user_id=?) liked FROM story_likes WHERE author_id IN (${authors.map(()=>'?').join(',')}) GROUP BY story_id`).bind(me.id,...authors).all<{story_id:string;likes:number;liked:number}>()).results:[]
  const byStory=new Map(likes.map(item=>[item.story_id,item]))
  const viewed=(await c.env.DB.prepare('SELECT story_id FROM story_views WHERE viewer_id=? AND viewed_at>?').bind(me.id,at-verifiedStoryLifetime).all<{story_id:string}>()).results
  const viewedIds=new Set(viewed.map(item=>item.story_id))
  c.header('Cache-Control','no-store')
  return c.json<StoryGroup[]>(groups.filter(group=>group.stories.length)
    .sort((a,b)=>Number(b.author.id===me.id)-Number(a.author.id===me.id)||b.stories[b.stories.length-1].created-a.stories[a.stories.length-1].created)
    .map(group=>({author:person(group.author,c.req.url),stories:group.stories.map(story=>({...storyView(group.author.id,story,c.req.url),likes:byStory.get(story.id)?.likes??0,liked:Boolean(byStory.get(story.id)?.liked),viewed:viewedIds.has(story.id)}))})))
})
app.put('/api/stories/:author/:id/view',async c=>{
  const {author,id}=c.req.param()
  const stories=await readStories(c.env,author)
  if(!stories.some(story=>story.id===id&&storyExpiry(story)>now()))return c.json({error:'Story unavailable.'},404)
  await c.env.DB.prepare('INSERT INTO story_views (viewer_id,story_id,viewed_at) VALUES (?,?,?) ON CONFLICT(viewer_id,story_id) DO NOTHING').bind(c.get('user').id,id,now()).run()
  return c.json({viewed:true})
})
app.put('/api/stories/:author/:id/like',async c=>{
  const {author,id}=c.req.param(),me=c.get('user').id
  const active=(await readBody(c.req.raw))?.active
  if(typeof active!=='boolean')return c.json({error:'Invalid story reaction.'},400)
  if(!(await readStories(c.env,author)).some(story=>story.id===id&&storyExpiry(story)>now()))return c.json({error:'Story unavailable.'},404)
  const db=c.env.DB
  const result=await db.prepare(active?'INSERT INTO story_likes(story_id,author_id,user_id) VALUES (?,?,?) ON CONFLICT DO NOTHING':'DELETE FROM story_likes WHERE story_id=? AND author_id=? AND user_id=?').bind(id,author,me).run()
  if(active&&result.meta.changes)await createNotification(c.env,c.executionCtx,db,author,me,'reaction','story:'+author+':'+id,'liked your story')
  const count=await db.prepare('SELECT COUNT(*) likes FROM story_likes WHERE story_id=?').bind(id).first<{likes:number}>()
  return c.json({likes:count?.likes??0,liked:active})
})
app.post('/api/stories',async c=>{
  const user=c.get('user')
  const verified=hasVerifiedBenefits(user)
  const id=crypto.randomUUID()
  let text='',contentType:string|null=null,file:File|null=null,kind:'image'|'video'='image',background:string|undefined
  if(c.req.header('Content-Type')?.startsWith('multipart/form-data')){
    const form=await c.req.raw.formData().catch(()=>null)
    text=clean(form?.get('text'),240)
    const requestedBackground=clean(form?.get('background'),20)
    if(['#4F25D6','#120D1F','#E9E0FF','#C8F53F','#F0447A','#FF6B6B','#FF9F43','#00B8A9','#5B8CFF','#B05CFF'].includes(requestedBackground))background=requestedBackground
    const upload:unknown=form?.get('image')??form?.get('video')
    if(upload instanceof File){
      const isVideo=upload.type.startsWith('video/')
      const duration=Number(form?.get('duration')??0)
      const videoLimit=verified?verifiedStoryVideoLimit:storyVideoLimit
      if(isVideo&&(!Number.isFinite(duration)||duration<=0||duration>videoLimit+.25))return c.json({error:'Story videos can be up to '+videoLimit+' seconds.'},400)
      contentType=isVideo&&upload.size<=25*1024*1024?upload.type:await imageType(upload)
      if(!contentType||(!isVideo&&upload.size>5*1024*1024))return c.json({error:'Choose an image under 5 MB or a video under 25 MB.'},400)
      kind=isVideo?'video':'image'
      file=upload
    }
  }else text=clean((await readBody(c.req.raw))?.text,240)
  if(!text&&!file)return c.json({error:'Write a story or add a photo.'},400)
  const at=now()
  const all=await readStories(c.env,user.id)
  const active=all.filter(story=>storyExpiry(story)>at)
  const limit=verified?verifiedStoryLimit:storyLimit
  if(active.length>=limit)return c.json({error:'You can have up to '+limit+' '+(limit===1?'story':'stories')+' at once. Delete one or wait for it to expire.'},429)
  const story:StoryRecord={id,text,created:at,expires:at+(verified?verifiedStoryLifetime:storyLifetime),media:file?id:undefined,kind:file?kind:undefined,background:kind==='image'&&background?background:undefined}
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
  await c.env.DB.prepare('DELETE FROM story_likes WHERE story_id=? AND author_id=?').bind(id,user.id).run()
  if(target.media)c.executionCtx.waitUntil(c.env.MEDIA.delete(storyMediaKey(user.id,id)).catch(()=>{}))
  return c.json({ok:true})
})
app.post('/api/logout',async c=>{
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(c.get('tokenHash')).run()
  return c.json({ok:true})
})
type PostRow=PublicAccount&{post_id:string;body:string;created:number;edited_at:number|null;media:string|null;media_kind:'image'|'video'|null;likes:number;liked:number;comments:number;reposts:number;reposted:number;rank_score:number;search_public:number}
const postProjection=`
    SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio,p.id post_id,p.body,p.created,p.edited_at,p.media,p.media_kind,p.search_public,
    (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND kind='like') likes,
    EXISTS(SELECT 1 FROM reactions r WHERE r.post_id=p.id AND r.user_id=? AND kind='like') liked,
    (SELECT COUNT(*) FROM comments x WHERE x.post_id=p.id) comments,
    (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND kind='repost') reposts,
    EXISTS(SELECT 1 FROM reactions r WHERE r.post_id=p.id AND r.user_id=? AND kind='repost') reposted,
    ((
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND kind='like') * 3 +
      (SELECT COUNT(*) FROM comments x WHERE x.post_id=p.id) * 5 +
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND kind='repost') * 7 +
      CASE WHEN u.role='tech' OR u.verified=1 OR u.teacher=1 THEN 4 ELSE 0 END
    ) * CASE WHEN u.role='tech' OR u.verified=1 OR u.teacher=1 THEN 1.2 ELSE 1 END)
      / (1 + ((strftime('%s','now') * 1000 - p.created) / 3600000.0) / 12.0) rank_score
    FROM posts p JOIN users u ON u.id=p.author
`
const postView=(r:PostRow,url:string)=>({id:r.post_id,author:person(r,url),body:r.body,time:time(r.created),createdAt:r.created,editedAt:r.edited_at?time(r.edited_at):undefined,likes:r.likes,liked:Boolean(r.liked),comments:r.comments,reposts:r.reposts,reposted:Boolean(r.reposted),searchPublic:Boolean(r.search_public),kind:r.media_kind??undefined,media:r.media?new URL('/api/media/'+r.media,url).href:undefined})
app.get('/api/feed',async c=>{
  const id=c.get('user').id
  const following=c.req.query('following')==='1'
  const {results}=await c.env.DB.prepare(`${postProjection}
    WHERE ?=0 OR p.author=? OR EXISTS(SELECT 1 FROM follows WHERE follower=? AND target=p.author)
    ORDER BY p.created DESC LIMIT 60
  `).bind(id,id,Number(following),id,id).all<PostRow>()
  c.header('Cache-Control',c.req.query('refresh')?'no-store':'private, max-age=15, stale-while-revalidate=30')
  return c.json(results.map(r=>postView(r,c.req.url)))
})
app.get('/api/posts/:id',async c=>{
  const id=c.get('user').id
  const post=await c.env.DB.prepare(`${postProjection} WHERE p.id=?`).bind(id,id,c.req.param('id')).first<PostRow>()
  if(!post)return c.json({error:'Post unavailable.'},404)
  c.header('Cache-Control','no-store')
  return c.json(postView(post,c.req.url))
})
app.post('/api/posts',async c=>{
  const db=c.env.DB
  const user=c.get('user')
  const id=crypto.randomUUID()
  let body=''
  let media:string|null=null
  let mediaKind:'image'|'video'|null=null
  let searchPublic=false
  if(c.req.header('Content-Type')?.startsWith('multipart/form-data')){
    if(Number(c.req.header('Content-Length'))>30000000) return c.json({error:'Choose a video under 25 MB or an image under 5 MB.'},413)
    const form=await c.req.raw.formData().catch(()=>null)
    body=clean(form?.get('body'),1200)
    const publicChoice=form?.get('searchPublic')
    if(publicChoice!=null&&publicChoice!=='true'&&publicChoice!=='false')return c.json({error:'Choose a search visibility setting.'},400)
    searchPublic=publicChoice==='true'
    const file:unknown=form?.get('image')??form?.get('video')
    if(file instanceof File){
      const isVideo=file.type.startsWith('video/')
      const duration=Number(form?.get('duration')??0)
      const videoLimit=hasVerifiedBenefits(user)?verifiedStoryVideoLimit:storyVideoLimit
      if(isVideo&&(!Number.isFinite(duration)||duration<=0||duration>videoLimit+.25))return c.json({error:'Videos can be up to '+videoLimit+' seconds.'},400)
      const contentType=isVideo&&file.size<=25*1024*1024?file.type:await imageType(file)
      if(!contentType||(!isVideo&&file.size>5*1024*1024))return c.json({error:'Choose a valid image or video.'},400)
      mediaKind=isVideo?'video':'image'
      media=id
      await c.env.MEDIA.put(media,await file.arrayBuffer(),{httpMetadata:{contentType}})
    }
  }else{
    const input=await readBody(c.req.raw)
    if(input?.searchPublic!==undefined&&typeof input.searchPublic!=='boolean')return c.json({error:'Choose a search visibility setting.'},400)
    searchPublic=input?.searchPublic===true
    body=clean(input?.body,1200)
  }
  if(!body&&!media) return c.json({error:'Write a post or add an image.'},400)
  try{await db.prepare('INSERT INTO posts (id,author,body,created,media,media_kind,search_public) VALUES (?,?,?,?,?,?,?)').bind(id,user.id,body,now(),media,mediaKind,Number(searchPublic)).run()}
  catch(error){if(media) await c.env.MEDIA.delete(media);throw error}
  return c.json({id},201)
})
app.put('/api/posts/:id',async c=>{
  const user=c.get('user'),id=c.req.param('id'),db=c.env.DB
  if(!hasVerifiedBenefits(user))return c.json({error:'Post editing is available to verified accounts.'},403)
  const post=await db.prepare('SELECT author,created,media FROM posts WHERE id=?').bind(id).first<{author:string;created:number;media:string|null}>()
  if(!post||post.author!==user.id)return c.json({error:'Post unavailable.'},404)
  if(now()-post.created>3600000)return c.json({error:'Posts can be edited for one hour after publishing.'},409)
  const body=clean((await readBody(c.req.raw))?.body,1200)
  if(!body&&!post.media)return c.json({error:'Write something for this post.'},400)
  const editedAt=now()
  await db.prepare('UPDATE posts SET body=?,edited_at=? WHERE id=?').bind(body,editedAt,id).run()
  return c.json({body,editedAt:time(editedAt)})
})
app.delete('/api/posts/:id',async c=>{
  const user=c.get('user'),id=c.req.param('id'),db=c.env.DB
  if(!hasVerifiedBenefits(user))return c.json({error:'Post deletion is available to verified accounts.'},403)
  const post=await db.prepare('SELECT author,media FROM posts WHERE id=?').bind(id).first<{author:string;media:string|null}>()
  if(!post||post.author!==user.id)return c.json({error:'Post unavailable.'},404)
  await db.prepare('DELETE FROM posts WHERE id=?').bind(id).run()
  if(post.media)c.executionCtx.waitUntil(c.env.MEDIA.delete(post.media).catch(()=>{}))
  return c.json({ok:true})
})
app.put('/api/posts/:id/search-visibility',async c=>{
  const searchPublic=(await readBody(c.req.raw))?.searchPublic
  if(typeof searchPublic!=='boolean')return c.json({error:'Choose a search visibility setting.'},400)
  const post=await c.env.DB.prepare('UPDATE posts SET search_public=? WHERE id=? AND author=? RETURNING id')
    .bind(Number(searchPublic),c.req.param('id'),c.get('user').id).first()
  if(!post)return c.json({error:'Post unavailable.'},404)
  return c.json({searchPublic})
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
  if(body.active){
    const post=await db.prepare('SELECT author FROM posts WHERE id=?').bind(id).first<{author:string}>()
    if(post)await createNotification(c.env,c.executionCtx,db,post.author,user,'reaction',id,kind==='like'?'liked your post':'reposted your post','post:'+id+':reaction')
  }
  return c.json({ok:true})
})
type NoteRow=PublicAccount&{note_id:string;body:string;edited_at?:number|null}
const note=(r:NoteRow,url:string)=>({id:r.note_id,author:person(r,url),body:r.body,editedAt:r.edited_at?time(r.edited_at):undefined})
type CommentRow=NoteRow&{media:string|null;gif:keyof typeof commentGifs|null;sticker:keyof typeof commentStickers|null;parent_id:string|null;reply_to:string|null;likes:number;liked:number}
const commentView=(r:CommentRow,url:string)=>({...note(r,url),attachment:commentAttachment(r,url),parentId:r.parent_id??undefined,replyTo:r.reply_to??undefined,likes:r.likes,liked:Boolean(r.liked)})
function commentAttachment(row:Pick<CommentRow,'media'|'gif'|'sticker'>,url:string):CommentAttachment|undefined{
  if(row.media)return {kind:'image',url:mediaUrl(row.media,url)}
  if(row.gif)return {kind:'gif',id:row.gif}
  if(row.sticker)return {kind:'sticker',id:row.sticker}
}
app.get('/api/posts/:id/comments',async c=>{
  const {results}=await c.env.DB.prepare(`
    SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio,x.id note_id,x.body,x.media,x.gif,x.sticker,x.parent_id,
      parent_user.username reply_to,
      (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id=x.id) likes,
      EXISTS(SELECT 1 FROM comment_likes l WHERE l.comment_id=x.id AND l.user_id=?) liked
    FROM comments x JOIN users u ON u.id=x.author
    LEFT JOIN comments parent ON parent.id=x.parent_id LEFT JOIN users parent_user ON parent_user.id=parent.author
    WHERE x.post_id=? ORDER BY COALESCE(parent.created,x.created),x.created LIMIT 100
  `).bind(c.get('user').id,c.req.param('id')).all<CommentRow>()
  return c.json(results.map(r=>commentView(r,c.req.url)))
})
app.put('/api/comments/:id/like',async c=>{
  const id=c.req.param('id'),me=c.get('user').id
  const active=(await readBody(c.req.raw))?.active
  if(typeof active!=='boolean')return c.json({error:'Invalid comment reaction.'},400)
  const db=c.env.DB
  const comment=await db.prepare('SELECT author,post_id FROM comments WHERE id=?').bind(id).first<{author:string;post_id:string}>()
  if(!comment)return c.json({error:'Comment unavailable.'},404)
  const result=await db.prepare(active?'INSERT INTO comment_likes(comment_id,user_id) VALUES (?,?) ON CONFLICT DO NOTHING':'DELETE FROM comment_likes WHERE comment_id=? AND user_id=?').bind(id,me).run()
  if(active&&result.meta.changes)await createNotification(c.env,c.executionCtx,db,comment.author,me,'reaction','comment:'+comment.post_id+':'+id,'liked your comment')
  const count=await db.prepare('SELECT COUNT(*) likes FROM comment_likes WHERE comment_id=?').bind(id).first<{likes:number}>()
  return c.json({likes:count?.likes??0,liked:active})
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
  const parentId=clean(form?.get('parentId')??payload?.parentId,80)
  const file:unknown=form?.get('image')
  const gif=payload?.gif
  const sticker=payload?.sticker
  if((gif!==undefined&&(typeof gif!=='string'||!Object.hasOwn(commentGifs,gif)))||
     (sticker!==undefined&&(typeof sticker!=='string'||!Object.hasOwn(commentStickers,sticker)))||
     (gif!==undefined&&sticker!==undefined))return c.json({error:'Choose a GIF or sticker from the picker.'},400)
  const contentType=file instanceof File?await imageType(file,true):null
  if(multipart&&(!contentType||!(file instanceof File)))return c.json({error:'Choose a PNG, JPEG, WebP or GIF under 5 MB.'},400)
  if(!body&&!contentType&&gif===undefined&&sticker===undefined)return c.json({error:'Write a comment or add an attachment.'},400)
  const parent=parentId?await DB.prepare('SELECT x.author,u.username FROM comments x JOIN users u ON u.id=x.author WHERE x.id=? AND x.post_id=?').bind(parentId,post).first<{author:string;username:string|null}>():null
  if(parentId&&!parent)return c.json({error:'Reply target unavailable.'},404)
  const media=contentType?contentType==='image/gif'?id+'.gif':id:null
  if(media&&file instanceof File&&contentType)await MEDIA.put(media,await file.arrayBuffer(),{httpMetadata:{contentType}})
  const attachment={media,gif:(gif??null) as CommentRow['gif'],sticker:(sticker??null) as CommentRow['sticker']}
  try{
    const result=await DB.prepare(`
      INSERT INTO comments (id,post_id,author,body,created,media,gif,sticker,parent_id)
      SELECT ?,id,?,?,?,?,?,?,? FROM posts WHERE id=?
    `).bind(id,author.id,body,now(),media,attachment.gif,attachment.sticker,parentId||null,post).run()
    if(!result.meta.changes){
      if(media)await MEDIA.delete(media)
      return c.json({error:'Post unavailable.'},404)
    }
  }catch(error){if(media)await MEDIA.delete(media);throw error}
  const postOwner=await DB.prepare('SELECT author FROM posts WHERE id=?').bind(post).first<{author:string}>()
  if(parent)await createNotification(c.env,c.executionCtx,DB,parent.author,author.id,'comment','comment:'+post+':'+parentId,'replied to your comment')
  if(postOwner?.author!==parent?.author&&postOwner)await createNotification(c.env,c.executionCtx,DB,postOwner.author,author.id,'comment','comment:'+post+':'+id,'commented on your post')
  return c.json({id,author:person(author,c.req.url),body,attachment:commentAttachment(attachment,c.req.url),parentId:parentId||undefined,replyTo:parent?.username??undefined,likes:0,liked:false},201)
})
app.get('/api/people',async c=>{
  const user=c.get('user').id
  const q=clean(c.req.query('q'),60).toLowerCase()
  const {results}=await c.env.DB.prepare(`
    SELECT id,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio,
      EXISTS(SELECT 1 FROM follows WHERE follower=? AND target=u.id) following,
      EXISTS(SELECT 1 FROM follows WHERE follower=u.id AND target=?) follows_viewer,
      (SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.target=f2.target WHERE f1.follower=? AND f2.follower=u.id) mutuals,
      (SELECT COUNT(*) FROM posts p WHERE p.author=u.id) post_count
    FROM users u
    WHERE id!=? AND (instr(lower(name),?)>0 OR instr(username,?)>0)
    ORDER BY following ASC, mutuals DESC, post_count DESC, name ASC
    LIMIT 30
  `).bind(user,user,user,user,q,q.replace(/^@/,'')||q).all<PublicAccount&{following:number;follows_viewer:number;mutuals:number;post_count:number}>()
  return c.json(results.map(r=>({...person(r,c.req.url),following:Boolean(r.following),followsViewer:Boolean(r.follows_viewer)})))
})
app.get('/api/people/:id',async c=>{
  const account=await c.env.DB.prepare('SELECT id,name,role,username,verified,teacher,dob,avatar_media,cover_media,bio FROM users WHERE id=?').bind(c.req.param('id')).first<PublicAccount>()
  if(!account)return c.json({error:'Profile unavailable.'},404)
  return c.json(person(account,c.req.url))
})
app.get('/api/people/:id/follow-stats',async c=>{
  const stats=await c.env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE target=u.id) followers,
      (SELECT COUNT(*) FROM follows WHERE follower=u.id) following,
      EXISTS(SELECT 1 FROM follows WHERE follower=? AND target=u.id) followedByViewer,
      EXISTS(SELECT 1 FROM follows WHERE follower=u.id AND target=?) followsViewer
    FROM users u WHERE u.id=?
  `).bind(c.get('user').id,c.get('user').id,c.req.param('id')).first<Omit<FollowStats,'followedByViewer'|'followsViewer'> & {followedByViewer:number;followsViewer:number}>()
  if(!stats)return c.json({error:'Profile unavailable.'},404)
  return c.json({...stats,followedByViewer:Boolean(stats.followedByViewer),followsViewer:Boolean(stats.followsViewer)})
})
app.get('/api/people/:id/presence',async c=>{
  const row=await c.env.DB.prepare('SELECT online,last_seen FROM presence WHERE user_id=?').bind(c.req.param('id')).first<{online:number;last_seen:number}>()
  const lastSeen=row?.last_seen??null
  const online=Boolean(row?.online)&&!!lastSeen&&now()-lastSeen<90000
  return c.json({online,lastSeen:lastSeen?time(lastSeen):null})
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
    SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio FROM follows f
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
  if(body.active){
    const actor=c.get('user')
    await createNotification(c.env,c.executionCtx,db,target,me,'follow',me,actor.name+' started following you','follow:'+me)
  }
  return c.json({ok:true})
})
const member=(db:D1Database,room:string,user:string)=>db.prepare(`
  SELECT id FROM rooms WHERE id=? AND (first_user=? OR second_user=?)
  UNION ALL SELECT group_id id FROM group_members WHERE group_id=? AND user_id=? LIMIT 1
`).bind(room,user,user,room,user).first()
const groupAdmin=(db:D1Database,group:string,user:string)=>db.prepare("SELECT group_id FROM group_members WHERE group_id=? AND user_id=? AND role='admin'").bind(group,user).first()
const streakView=async(db:D1Database,room:string)=>{
  const row=await db.prepare('SELECT count,last_completed_at,first_sent_at,second_sent_at,expires_at FROM chat_streaks WHERE room=?').bind(room).first<{count:number;last_completed_at:number|null;first_sent_at:number|null;second_sent_at:number|null;expires_at:number|null}>()
  if(!row)return null
  if(!row.expires_at||row.expires_at<=now()){await db.prepare('DELETE FROM chat_streaks WHERE room=?').bind(room).run();return null}
  return {count:row.count,status:row.count?'active':'pending',expiresAt:time(row.expires_at),nextMilestone:[3,7,14,30,50,100].find(value=>value>row.count)??null}
}
async function recordStreakMessage(db:D1Database,room:string,user:string){
  const direct=await db.prepare('SELECT first_user,second_user FROM rooms WHERE id=?').bind(room).first<{first_user:string;second_user:string}>()
  if(!direct)return
  const at=now(),column=user===direct.first_user?'first_sent_at':'second_sent_at'
  const current=await db.prepare('SELECT expires_at FROM chat_streaks WHERE room=?').bind(room).first<{expires_at:number|null}>()
  if(!current)return
  if(!current.expires_at||current.expires_at<=at){await db.prepare('DELETE FROM chat_streaks WHERE room=?').bind(room).run();return}
  await db.prepare(`UPDATE chat_streaks SET ${column}=? WHERE room=?`).bind(at,room).run()
  await db.prepare(`UPDATE chat_streaks SET count=count+1,last_completed_at=?,expires_at=?,first_sent_at=NULL,second_sent_at=NULL
    WHERE room=? AND first_sent_at IS NOT NULL AND second_sent_at IS NOT NULL`).bind(at,at+86400000,room).run()
}
app.get('/api/rooms',async c=>{
  const user=c.get('user').id
  const paged=c.req.query('paged')==='1'
  const cursor=Math.max(0,Math.min(10000,Number.parseInt(c.req.query('cursor')??'0',10)||0))
  const [{results},{results:groupResults}]=await Promise.all([c.env.DB.prepare(`SELECT r.id room,u.id,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio,
    m.body last_body,m.created message_at,x.video call_video,x.caller call_caller,x.state call_state,x.connected_at call_connected_at,x.ended_at call_ended_at,x.created call_at,
    s.count streak_count,s.expires_at streak_expires,
    (SELECT COUNT(*) FROM messages um LEFT JOIN chat_read_state ur ON ur.room=um.room AND ur.user_id=?
      WHERE um.room=r.id AND um.author!=? AND ((ur.last_read_at IS NOT NULL AND um.created>ur.last_read_at) OR (ur.last_read_at IS NULL AND um.read_at IS NULL))) unread_count
    FROM rooms r JOIN users u ON u.id=CASE WHEN r.first_user=? THEN r.second_user ELSE r.first_user END
    LEFT JOIN messages m ON m.id=(SELECT id FROM messages WHERE room=r.id ORDER BY created DESC LIMIT 1)
    LEFT JOIN calls x ON x.id=(SELECT id FROM calls WHERE room=r.id AND (state IN ('ended','declined') OR (state IN ('offered','ringing') AND expires<?)) ORDER BY created DESC LIMIT 1)
    LEFT JOIN chat_streaks s ON s.room=r.id AND s.expires_at>?
    WHERE r.first_user=? OR r.second_user=? ORDER BY MAX(COALESCE(m.created,0),COALESCE(x.created,0)) DESC LIMIT 60`).bind(user,user,user,now(),now(),user,user).all<PublicAccount&{room:string;last_body:string|null;message_at:number|null;call_video:number|null;call_caller:string|null;call_state:string|null;call_connected_at:number|null;call_ended_at:number|null;call_at:number|null;streak_count:number|null;streak_expires:number|null;unread_count:number}>(),c.env.DB.prepare(`
    SELECT g.id room,g.name,g.created,g.photo_media,COUNT(gm2.user_id) members,m.body last_body,m.created message_at,
      (SELECT COUNT(*) FROM messages um LEFT JOIN chat_read_state ur ON ur.room=um.room AND ur.user_id=?
        WHERE um.room=g.id AND um.author!=? AND ((ur.last_read_at IS NOT NULL AND um.created>ur.last_read_at) OR (ur.last_read_at IS NULL AND um.read_at IS NULL))) unread_count
    FROM chat_groups g JOIN group_members mine ON mine.group_id=g.id AND mine.user_id=?
    JOIN group_members gm2 ON gm2.group_id=g.id
    LEFT JOIN messages m ON m.id=(SELECT id FROM messages WHERE room=g.id ORDER BY created DESC LIMIT 1)
    GROUP BY g.id ORDER BY COALESCE(m.created,g.created) DESC LIMIT 60
  `).bind(user,user,user).all<{room:string;name:string;created:number;photo_media:string|null;members:number;last_body:string|null;message_at:number|null;unread_count:number}>()])
  const directRooms=results.map(r=>{
    const latestCall=!!r.call_at&&r.call_at>(r.message_at??0)
    const duration=r.call_connected_at?Math.max(0,Math.floor(((r.call_ended_at??now())-r.call_connected_at)/1000)):0
    const label=r.call_video?'video call':'voice call'
    const callActivity=r.call_connected_at?`${r.call_video?'Video call':'Voice call'} · ${Math.floor(duration/60)}m ${String(duration%60).padStart(2,'0')}s`:r.call_state==='declined'?r.call_caller===user?'Call declined':'Declined '+label:r.call_caller===user?'No answer':'Missed '+label
    return {id:r.room,person:person(r,c.req.url),lastActivity:latestCall?callActivity:r.last_body??undefined,lastActivityAt:r.call_at&&latestCall?time(r.call_at):r.message_at?time(r.message_at):undefined,streak:r.streak_expires?{count:r.streak_count??0,status:r.streak_count?'active':'pending',expiresAt:time(r.streak_expires)}:undefined,unreadCount:r.unread_count}
  })
  const groupRooms=groupResults.map(r=>({id:r.room,person:{id:r.room,name:r.name,initials:initials(r.name),role:'tech' as const,color:'#C8F53F',detail:'Group · '+r.members+' members',group:true,avatar:r.photo_media?mediaUrl(r.photo_media,c.req.url):undefined},lastActivity:r.last_body??'Group created',lastActivityAt:time(r.message_at??r.created),unreadCount:r.unread_count}))
  const merged=[...directRooms,...groupRooms].sort((a,b)=>Date.parse(b.lastActivityAt??'')-Date.parse(a.lastActivityAt??''))
  const rooms=merged.slice(paged?cursor:0,(paged?cursor:0)+(paged?20:60))
  c.header('Cache-Control','no-store')
  return c.json(paged?{items:rooms,nextCursor:merged.length>cursor+20?String(cursor+20):null}:rooms)
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
app.get('/api/rooms/:id/streak',async c=>{
  const room=c.req.param('id'),user=c.get('user').id,db=c.env.DB
  if(!await member(db,room,user)||!await db.prepare('SELECT id FROM rooms WHERE id=?').bind(room).first())return c.json({error:'Direct conversation unavailable.'},404)
  return c.json(await streakView(db,room))
})
app.post('/api/rooms/:id/streak',async c=>{
  const room=c.req.param('id'),account=c.get('user'),db=c.env.DB
  if(!hasVerifiedBenefits(account))return c.json({error:'Chat streaks are currently available to verified users.'},403)
  if(!await member(db,room,account.id)||!await db.prepare('SELECT id FROM rooms WHERE id=?').bind(room).first())return c.json({error:'Start streaks in direct chats only.'},400)
  const at=now(),direct=await db.prepare('SELECT first_user FROM rooms WHERE id=?').bind(room).first<{first_user:string}>()
  await db.prepare(`INSERT INTO chat_streaks(room,started_by,created,first_sent_at,second_sent_at,expires_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(room) DO NOTHING`).bind(room,account.id,at,direct?.first_user===account.id?at:null,direct?.first_user===account.id?null:at,at+86400000).run()
  const other=await db.prepare('SELECT CASE WHEN first_user=? THEN second_user ELSE first_user END target FROM rooms WHERE id=?').bind(account.id,room).first<{target:string}>()
  if(other)await createNotification(c.env,c.executionCtx,db,other.target,account.id,'message',room,account.name+' started a chat streak with you 🔥','streak:'+room)
  return c.json(await streakView(db,room),201)
})
app.post('/api/groups',async c=>{
  const account=c.get('user'),db=c.env.DB,input=await readBody(c.req.raw)
  const name=clean(input?.name,50)
  const requested=Array.isArray(input?.members)?input.members.filter((id:unknown):id is string=>typeof id==='string'&&id!==account.id).slice(0,29):[]
  const members=[...new Set(requested)]
  if(name.length<2)return c.json({error:'Enter a group name with at least 2 characters.'},400)
  if(!members.length)return c.json({error:'Choose at least one group member.'},400)
  const placeholders=members.map(()=>'?').join(',')
  const valid=await db.prepare(`SELECT id FROM users WHERE id IN (${placeholders})`).bind(...members).all<{id:string}>()
  if(valid.results.length!==members.length)return c.json({error:'One of the selected members is unavailable.'},400)
  const id=crypto.randomUUID(),created=now(),all=[account.id,...members]
  await db.batch([
    db.prepare('INSERT INTO chat_groups(id,name,owner,created) VALUES (?,?,?,?)').bind(id,name,account.id,created),
    ...all.map(user=>db.prepare('INSERT INTO group_members(group_id,user_id,joined,role) VALUES (?,?,?,?)').bind(id,user,created,user===account.id?'admin':'member')),
  ])
  return c.json({id,person:{id,name,initials:initials(name),role:'tech',color:'#C8F53F',detail:'Group · '+all.length+' members',group:true}},201)
})
app.get('/api/groups/:id',async c=>{
  const id=c.req.param('id'),viewer=c.get('user').id,db=c.env.DB
  if(!await member(db,id,viewer))return c.json({error:'Group unavailable.'},404)
  const group=await db.prepare('SELECT id,name,owner,photo_media,invite_code FROM chat_groups WHERE id=?').bind(id).first<{id:string;name:string;owner:string;photo_media:string|null;invite_code:string|null}>()
  if(!group)return c.json({error:'Group unavailable.'},404)
  const {results}=await db.prepare(`SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio,gm.role member_role
    FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? ORDER BY gm.role DESC,u.name`).bind(id).all<PublicAccount&{member_role:'admin'|'member'}>()
  return c.json({id:group.id,name:group.name,photo:group.photo_media?mediaUrl(group.photo_media,c.req.url):undefined,isAdmin:results.some(item=>item.id===viewer&&item.member_role==='admin'),inviteCode:group.invite_code??undefined,members:results.map(item=>({person:person(item,c.req.url),role:item.member_role,owner:item.id===group.owner}))})
})
app.post('/api/groups/:id/members',async c=>{
  const id=c.req.param('id'),viewer=c.get('user').id,db=c.env.DB
  if(!await groupAdmin(db,id,viewer))return c.json({error:'Only group admins can add members.'},403)
  const input=await readBody(c.req.raw),members=Array.isArray(input?.members)?[...new Set(input.members.filter((value:unknown):value is string=>typeof value==='string'))].slice(0,30):[]
  if(!members.length)return c.json({error:'Choose at least one member.'},400)
  const placeholders=members.map(()=>'?').join(','),valid=await db.prepare(`SELECT id FROM users WHERE id IN (${placeholders})`).bind(...members).all<{id:string}>()
  if(valid.results.length!==members.length)return c.json({error:'One selected account is unavailable.'},400)
  await db.batch(members.map(user=>db.prepare("INSERT INTO group_members(group_id,user_id,joined,role) VALUES (?,?,?,'member') ON CONFLICT DO NOTHING").bind(id,user,now())))
  return c.json({ok:true})
})
app.put('/api/groups/:id/members/:user/admin',async c=>{
  const {id,user}=c.req.param(),viewer=c.get('user').id,db=c.env.DB
  if(!await groupAdmin(db,id,viewer))return c.json({error:'Only group admins can manage admins.'},403)
  const group=await db.prepare('SELECT owner FROM chat_groups WHERE id=?').bind(id).first<{owner:string}>(),active=(await readBody(c.req.raw))?.active
  if(typeof active!=='boolean')return c.json({error:'Choose an admin state.'},400)
  if(user===group?.owner&&!active)return c.json({error:'The group owner must remain an admin.'},409)
  const result=await db.prepare('UPDATE group_members SET role=? WHERE group_id=? AND user_id=?').bind(active?'admin':'member',id,user).run()
  if(!result.meta.changes)return c.json({error:'Member unavailable.'},404)
  return c.json({ok:true})
})
app.post('/api/groups/:id/invite',async c=>{
  const id=c.req.param('id'),viewer=c.get('user').id,db=c.env.DB
  if(!await member(db,id,viewer))return c.json({error:'Group unavailable.'},404)
  const code=random(12)
  await db.prepare('UPDATE chat_groups SET invite_code=COALESCE(invite_code,?) WHERE id=?').bind(code,id).run()
  const row=await db.prepare('SELECT invite_code FROM chat_groups WHERE id=?').bind(id).first<{invite_code:string}>()
  return c.json({code:row?.invite_code,url:'https://dameen.app/?group='+row?.invite_code})
})
app.post('/api/groups/join/:code',async c=>{
  const code=c.req.param('code'),user=c.get('user').id,db=c.env.DB
  const group=await db.prepare('SELECT id,name,photo_media FROM chat_groups WHERE invite_code=?').bind(code).first<{id:string;name:string;photo_media:string|null}>()
  if(!group)return c.json({error:'This group invite is invalid or expired.'},404)
  await db.prepare("INSERT INTO group_members(group_id,user_id,joined,role) VALUES (?,?,?,'member') ON CONFLICT DO NOTHING").bind(group.id,user,now()).run()
  const count=await db.prepare('SELECT COUNT(*) count FROM group_members WHERE group_id=?').bind(group.id).first<{count:number}>()
  return c.json({id:group.id,person:{id:group.id,name:group.name,initials:initials(group.name),role:'tech',color:'#C8F53F',detail:'Group · '+(count?.count??1)+' members',group:true,avatar:group.photo_media?mediaUrl(group.photo_media,c.req.url):undefined}})
})
app.put('/api/groups/:id/photo',async c=>{
  const id=c.req.param('id'),viewer=c.get('user').id,db=c.env.DB
  if(!await groupAdmin(db,id,viewer))return c.json({error:'Only group admins can change the group photo.'},403)
  const form=await c.req.raw.formData().catch(()=>null),upload:unknown=form?.get('image')
  if(!(upload instanceof File))return c.json({error:'Choose a group photo.'},400)
  const contentType=await imageType(upload)
  if(!contentType||upload.size>5*1024*1024)return c.json({error:'Choose an image under 5 MB.'},400)
  const media=crypto.randomUUID(),previous=await db.prepare('SELECT photo_media FROM chat_groups WHERE id=?').bind(id).first<{photo_media:string|null}>()
  await c.env.MEDIA.put(media,await upload.arrayBuffer(),{httpMetadata:{contentType}})
  await db.prepare('UPDATE chat_groups SET photo_media=? WHERE id=?').bind(media,id).run()
  if(previous?.photo_media)c.executionCtx.waitUntil(c.env.MEDIA.delete(previous.photo_media))
  return c.json({url:mediaUrl(media,c.req.url)})
})
type WhotRow={id:string;invited_by:string;accepted:number;version:number;state:string}
function whotView(row:WhotRow,user:string){
  const match=JSON.parse(row.state) as WhotMatch
  const seat=row.invited_by===user?0:1
  return {id:row.id,version:row.version,status:!row.accepted?(seat===0?'waiting':'invited'):match.winner===undefined?'playing':'finished',
    hand:row.accepted?match.hands[seat]:[],opponentCount:match.hands[1-seat].length,
    top:match.pile[0],shape:match.shape,yourTurn:Boolean(row.accepted)&&match.turn===seat,
    won:match.winner===undefined?undefined:match.winner===seat}
}
app.get('/api/rooms/:id/whot',async c=>{
  const room=c.req.param('id'), user=c.get('user').id, db=c.env.DB
  if(!await member(db,room,user))return c.json({error:'Conversation unavailable.'},404)
  const row=await db.prepare('SELECT * FROM whot_matches WHERE room=?').bind(room).first<WhotRow>()
  c.header('Cache-Control','no-store')
  return c.json(row?whotView(row,user):null)
})
app.post('/api/rooms/:id/whot',async c=>{
  const room=c.req.param('id'), account=c.get('user'), db=c.env.DB
  if(!await member(db,room,account.id))return c.json({error:'Conversation unavailable.'},404)
  const input=await readBody(c.req.raw)
  const row=await db.prepare('SELECT * FROM whot_matches WHERE room=?').bind(room).first<WhotRow>()
  if(input?.action==='invite'){
    if(row&&(JSON.parse(row.state) as WhotMatch).winner===undefined)return c.json({error:'There’s already a match in this chat.'},409)
    const id=crypto.randomUUID()
    const state=JSON.stringify(startWhot())
    const created=now()
    const statements=[
      db.prepare('INSERT INTO whot_matches (room,id,invited_by,state) VALUES (?,?,?,?) ON CONFLICT(room) DO UPDATE SET id=excluded.id,invited_by=excluded.invited_by,state=excluded.state,accepted=0,version=0 WHERE whot_matches.id=? AND whot_matches.version=?').bind(room,id,account.id,state,row?.id??'',row?.version??-1),
      db.prepare('INSERT INTO messages (id,room,author,body,created) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM whot_matches WHERE room=? AND id=?)').bind('whot-invite:'+id,room,account.id,'Invited you to play Whot. Open Whot in this chat to join.',created,room,id),
    ]
    const [write]=await db.batch(statements)
    if(!write.meta.changes)return c.json({error:'There’s already a match in this chat.'},409)
    c.executionCtx.waitUntil(c.env.ROOMS.getByName(room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify({id:'whot-invite:'+id,author:person(account,c.req.url),body:'Invited you to play Whot. Open Whot in this chat to join.',createdAt:time(created)})}))
    return c.json(whotView({id,invited_by:account.id,state,accepted:0,version:0},account.id))
  }
  if(!row||input?.id!==row.id||input.version!==row.version)return c.json({error:'The match changed. Wait for it to refresh.'},409)
  if(!row.accepted){
    if(input.action==='dismiss'){
      const write=await db.prepare('DELETE FROM whot_matches WHERE room=? AND id=? AND version=? AND accepted=0').bind(room,row.id,row.version).run()
      if(!write.meta.changes)return c.json({error:'The match changed.'},409)
      return c.json(null)
    }
    if(input.action!=='accept'||account.id===row.invited_by)return c.json({error:'Only the invited player can join.'},403)
    const write=await db.prepare('UPDATE whot_matches SET accepted=1,version=version+1 WHERE room=? AND id=? AND version=?').bind(room,row.id,row.version).run()
    if(!write.meta.changes)return c.json({error:'The match changed.'},409)
    return c.json(whotView({...row,accepted:1,version:row.version+1},account.id))
  }
  const match=JSON.parse(row.state) as WhotMatch
  if(match.winner!==undefined||match.turn!==(row.invited_by===account.id?0:1))return c.json({error:'It’s not your turn.'},409)
  const shape=whotShapes.includes(input.shape as WhotShape)?input.shape as WhotShape:undefined
  const next=input.action==='draw'?drawWhot(match):input.action==='play'&&typeof input.index==='number'&&Number.isInteger(input.index)?playWhot(match,input.index,shape):match
  if(next===match)return c.json({error:'Choose a matching card.'},400)
  const version=row.version+1
  const state=JSON.stringify(next)
  const writes=[db.prepare('UPDATE whot_matches SET state=?,version=? WHERE room=? AND id=? AND version=?').bind(state,version,room,row.id,row.version)]
  const result={id:'whot-result:'+row.id,author:person(account,c.req.url),body:account.name+' won the Whot match.',createdAt:time(now())}
  if(next.winner!==undefined)writes.push(db.prepare('INSERT OR IGNORE INTO messages (id,room,author,body,created) SELECT ?,?,?,?,? WHERE changes()=1').bind(result.id,room,account.id,result.body,Date.parse(result.createdAt)))
  const [write]=await db.batch(writes)
  if(!write.meta.changes)return c.json({error:'The match changed.'},409)
  if(next.winner!==undefined)c.executionCtx.waitUntil(c.env.ROOMS.getByName(room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify(result)}))
  return c.json(whotView({...row,state,version},account.id))
})
app.get('/api/rooms/:id/messages',async c=>{
  const room=c.req.param('id')
  if(!await member(c.env.DB,room,c.get('user').id)) return c.json({error:'Conversation unavailable.'},404)
  const paged=c.req.query('paged')==='1'
  const beforeRaw=Number(c.req.query('before'))
  const before=Number.isFinite(beforeRaw)&&beforeRaw>0?beforeRaw:now()+1
  const messageLimit=paged?31:100
  const callLimit=paged?31:40
  const [messages,calls]=await Promise.all([
    c.env.DB.prepare('SELECT u.id,u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio,m.id note_id,m.body,m.read_at,m.created,m.edited_at,m.media,m.media_kind,m.media_type,m.view_once,m.viewed_at FROM messages m JOIN users u ON u.id=m.author WHERE room=? AND m.created<? ORDER BY m.created DESC LIMIT ?').bind(room,before,messageLimit).all<NoteRow&{read_at:number|null;created:number;media:string|null;media_kind:'image'|'video'|null;media_type:'image'|'video'|'audio'|null;view_once:number;viewed_at:number|null}>(),
    c.env.DB.prepare(`SELECT x.id,x.caller,x.callee,x.video,x.state,x.created,x.expires,x.connected_at,x.ended_at,
      u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio
      FROM calls x JOIN users u ON u.id=x.caller WHERE x.room=? AND x.created<? AND (x.state IN ('ended','declined') OR (x.state IN ('offered','ringing') AND x.expires<?))
      ORDER BY x.created DESC LIMIT ?`).bind(room,before,now(),callLimit).all<CallRow&PublicAccount>(),
  ])
  const viewer=c.get('user').id
  const items=[
    ...messages.results.map(r=>{const kind=r.media_type??r.media_kind;return {...note(r,c.req.url),readAt:r.read_at?time(r.read_at):undefined,createdAt:time(r.created),chatMedia:r.media&&!r.view_once&&kind?{kind,url:mediaUrl(r.media,c.req.url)}:undefined,viewOnce:r.view_once&&kind&&kind!=='audio'?{kind,opened:Boolean(r.viewed_at),canOpen:r.id!==viewer&&!r.viewed_at}:undefined}}),
    ...calls.results.map(r=>{
      const connected=!!r.connected_at
      const label=r.video?'Video call':'Voice call'
      const body=connected?label:r.state==='declined'?(viewer===r.callee?'Declined '+label.toLowerCase():label+' declined'):(viewer===r.callee?'Missed '+label.toLowerCase():label+' · No answer')
      return {id:'call:'+r.id,author:person({...r,id:r.caller},c.req.url),body,createdAt:time(r.created),call:{id:r.id,video:Boolean(r.video),outcome:connected?'completed':r.state==='declined'?'declined':'missed',durationSeconds:connected?Math.max(0,Math.floor(((r.ended_at??now())-r.connected_at!)/1000)):0}}
    }),
  ]
  const ordered=items.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
  c.header('Cache-Control','no-store')
  if(!paged)return c.json(ordered.slice(-140))
  const page=ordered.slice(-30)
  const oldest=page[0]?.createdAt
  return c.json({items:page,nextCursor:ordered.length>30&&oldest?String(Date.parse(oldest)):null})
})
app.put('/api/rooms/:id/read',async c=>{
  const room=c.req.param('id'),user=c.get('user').id
  if(!await member(c.env.DB,room,user))return c.json({error:'Conversation unavailable.'},404)
  const at=now()
  const {results}=await c.env.DB.prepare('UPDATE messages SET read_at=? WHERE room=? AND author!=? AND read_at IS NULL RETURNING id').bind(at,room,user).all<{id:string}>()
  await c.env.DB.prepare('INSERT INTO chat_read_state(room,user_id,last_read_at) VALUES (?,?,?) ON CONFLICT(room,user_id) DO UPDATE SET last_read_at=excluded.last_read_at').bind(room,user,at).run()
  await c.env.DB.prepare("UPDATE notifications SET read=1 WHERE user_id=? AND kind='message' AND entity_id=? AND read=0").bind(user,room).run()
  const remaining=await unreadMessageCount(c.env.DB,user)
  const ids=results.map(item=>item.id)
  const readAt=time(at)
  if(ids.length)c.executionCtx.waitUntil(c.env.ROOMS.getByName(room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify({type:'read',ids,readAt})}))
  return c.json({ids,readAt,messageUnread:remaining?.count??0})
})
app.post('/api/rooms/:id/messages',async c=>{
  const room=c.req.param('id'), author=c.get('user')
  if(!await member(c.env.DB,room,author.id)) return c.json({error:'Conversation unavailable.'},404)
  const multipart=c.req.header('Content-Type')?.startsWith('multipart/form-data')
  const form=multipart?await c.req.raw.formData().catch(()=>null):null
  const payload=multipart?null:await readBody(c.req.raw)
  const body=clean(form?.get('body')??payload?.body,800)
  const upload:unknown=form?.get('image')??form?.get('video')??form?.get('audio')
  const viewOnce=form?.get('viewOnce')==='true'
  let media:string|null=null,mediaKind:'image'|'video'|'audio'|null=null,file:File|null=null,contentType:string|null=null
  if(upload instanceof File){
    if(viewOnce&&!hasVerifiedBenefits(author))return c.json({error:'View-once media is currently available to verified users.'},403)
    mediaKind=upload.type.startsWith('audio/')?'audio':upload.type.startsWith('video/')?'video':'image'
    if(viewOnce&&mediaKind==='audio')return c.json({error:'Voice notes are sent as normal chat media.'},400)
    const duration=Number(form?.get('duration')??0)
    if(viewOnce&&mediaKind==='video'&&(!Number.isFinite(duration)||duration<=0||duration>10.25))return c.json({error:'View-once videos can be up to 10 seconds.'},400)
    contentType=mediaKind!=='image'&&upload.size<=25*1024*1024?upload.type:await imageType(upload)
    const limit=mediaKind==='image'?5:25
    if(!contentType||upload.size>limit*1024*1024)return c.json({error:'This file is still too large after compression.'},400)
    media=crypto.randomUUID();file=upload
  }
  if(!body&&!file) return c.json({error:'Enter a message or choose view-once media.'},400)
  const created=now()
  const message={id:crypto.randomUUID(),author:person(author,c.req.url),body,createdAt:time(created),chatMedia:mediaKind&&!viewOnce?{kind:mediaKind,url:''}:undefined,viewOnce:mediaKind&&mediaKind!=='audio'&&viewOnce?{kind:mediaKind,opened:false,canOpen:false}:undefined}
  if(file&&media&&contentType)await c.env.MEDIA.put(media,await file.arrayBuffer(),{httpMetadata:{contentType}})
  try{await c.env.DB.prepare('INSERT INTO messages (id,room,author,body,created,media,media_kind,media_type,view_once) VALUES (?,?,?,?,?,?,?,?,?)').bind(message.id,room,author.id,body,created,media,mediaKind==='audio'?null:mediaKind,mediaKind,media&&viewOnce?1:0).run()}
  catch(error){if(media)await c.env.MEDIA.delete(media);throw error}
  await recordStreakMessage(c.env.DB,room,author.id)
  const other=await c.env.DB.prepare('SELECT CASE WHEN first_user=? THEN second_user ELSE first_user END target FROM rooms WHERE id=?').bind(author.id,room).first<{target:string}>()
  if(other)await createNotification(c.env,c.executionCtx,c.env.DB,other.target,author.id,'message',room,'sent you a message','room:'+room)
  else{
    const group=await c.env.DB.prepare('SELECT name FROM chat_groups WHERE id=?').bind(room).first<{name:string}>()
    if(group){
      const {results}=await c.env.DB.prepare('SELECT user_id FROM group_members WHERE group_id=? AND user_id!=?').bind(room,author.id).all<{user_id:string}>()
      await Promise.all(results.map(item=>createNotification(c.env,c.executionCtx,c.env.DB,item.user_id,author.id,'message',room,'sent a message in '+group.name,'room:'+room)))
    }
  }
  const response={...message,chatMedia:message.chatMedia&&media?{...message.chatMedia,url:mediaUrl(media,c.req.url)}:undefined}
  c.executionCtx.waitUntil(c.env.ROOMS.getByName(room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify(response)}))
  return c.json(response,201)
})
app.post('/api/rooms/:room/messages/:id/saved',async c=>{
  const {room,id}=c.req.param(),account=c.get('user'),db=c.env.DB
  if(!await member(db,room,account.id))return c.json({error:'Conversation unavailable.'},404)
  const media=await db.prepare('SELECT author,media_type,media_kind FROM messages WHERE id=? AND room=? AND media IS NOT NULL AND view_once=0').bind(id,room).first<{author:string;media_type:string|null;media_kind:string|null}>()
  if(!media||media.author===account.id)return c.json({error:'Media unavailable.'},404)
  await createNotification(c.env,c.executionCtx,db,media.author,account.id,'message',room,account.name+' saved your '+(media.media_type??media.media_kind??'media'),'saved:'+id+':'+account.id)
  return c.json({ok:true})
})
app.post('/api/rooms/:room/messages/:id/open-once',async c=>{
  const {room,id}=c.req.param(),user=c.get('user').id,db=c.env.DB
  if(!await member(db,room,user))return c.json({error:'Conversation unavailable.'},404)
  const ticket=random(16),expires=now()+60000
  const opened=await db.prepare('UPDATE messages SET viewed_at=?,media_token_hash=?,media_token_expires=? WHERE id=? AND room=? AND author!=? AND view_once=1 AND viewed_at IS NULL RETURNING media_kind').bind(now(),await hash(ticket),expires,id,room,user).first<{media_kind:'image'|'video'}>()
  if(!opened)return c.json({error:'This view-once media has already been opened.'},410)
  return c.json({kind:opened.media_kind,url:new URL('/api/view-once/'+id+'/'+ticket,c.req.url).href,expiresAt:time(expires)})
})
app.put('/api/rooms/:room/messages/:id',async c=>{
  const {room,id}=c.req.param(),user=c.get('user'),db=c.env.DB
  if(!await member(db,room,user.id))return c.json({error:'Conversation unavailable.'},404)
  if(!hasVerifiedBenefits(user))return c.json({error:'Message editing is available to verified accounts.'},403)
  const message=await db.prepare('SELECT author,created FROM messages WHERE id=? AND room=?').bind(id,room).first<{author:string;created:number}>()
  if(!message||message.author!==user.id)return c.json({error:'Message unavailable.'},404)
  if(now()-message.created>3600000)return c.json({error:'Messages can be edited for one hour after sending.'},409)
  const body=clean((await readBody(c.req.raw))?.body,800)
  if(!body)return c.json({error:'Enter a message.'},400)
  const editedAt=now()
  await db.prepare('UPDATE messages SET body=?,edited_at=? WHERE id=?').bind(body,editedAt,id).run()
  const updated={type:'message-updated',id,body,editedAt:time(editedAt)}
  c.executionCtx.waitUntil(c.env.ROOMS.getByName(room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify(updated)}))
  return c.json(updated)
})
app.delete('/api/rooms/:room/messages/:id',async c=>{
  const {room,id}=c.req.param(),user=c.get('user'),db=c.env.DB
  if(!await member(db,room,user.id))return c.json({error:'Conversation unavailable.'},404)
  if(!hasVerifiedBenefits(user))return c.json({error:'Message deletion is available to verified accounts.'},403)
  const result=await db.prepare('DELETE FROM messages WHERE id=? AND room=? AND author=?').bind(id,room,user.id).run()
  if(!result.meta.changes)return c.json({error:'Message unavailable.'},404)
  c.executionCtx.waitUntil(c.env.ROOMS.getByName(room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify({type:'message-deleted',id})}))
  return c.json({ok:true})
})
type CallRow={id:string;room:string;caller:string;callee:string;video:number;offer:string;answer:string|null;state:'offered'|'ringing'|'answered'|'ended'|'declined';created:number;expires:number;connected_at:number|null;ended_at:number|null}
const callState=(row:CallRow)=>row.expires<now()&&row.state!=='answered'?'ended':row.state
app.post('/api/rooms/:id/calls',async c=>{
  const room=c.req.param('id'),user=c.get('user').id
  const signal=readCallSignal((await readBody(c.req.raw))?.signal)
  if(!signal||signal.kind!=='offer')return c.json({error:'Invalid call offer.'},400)
  const peer=await c.env.DB.prepare('SELECT CASE WHEN first_user=? THEN second_user ELSE first_user END target FROM rooms WHERE id=? AND (first_user=? OR second_user=?)').bind(user,room,user,user).first<{target:string}>()
  if(!peer)return c.json({error:'Conversation unavailable.'},404)
  const at=now()
  const result=await c.env.DB.prepare('INSERT INTO calls (id,room,caller,callee,video,offer,state,created,expires) VALUES (?,?,?,?,?,? ,\'offered\',?,?) ON CONFLICT DO NOTHING').bind(signal.id,room,user,peer.target,Number(signal.video),signal.sdp,at,at+65000).run()
  if(!result.meta.changes)return c.json({error:'Call already started.'},409)
  await createNotification(c.env,c.executionCtx,c.env.DB,peer.target,user,'call','call:'+signal.id,signal.video?'is video calling you':'is voice calling you')
  return c.json({id:signal.id,state:'offered',expires:time(at+65000)},201)
})
app.get('/api/calls/incoming',async c=>{
  const {results}=await c.env.DB.prepare(`SELECT x.id,x.room,x.caller,x.callee,x.video,x.offer,x.answer,x.state,x.created,x.expires,
    u.name,u.role,u.username,u.verified,u.teacher,u.dob,u.avatar_media,u.cover_media,u.bio
    FROM calls x JOIN users u ON u.id=x.caller
    WHERE x.callee=? AND x.state IN ('offered','ringing') AND x.expires>? ORDER BY x.created DESC LIMIT 3`).bind(c.get('user').id,now()).all<CallRow&PublicAccount>()
  c.header('Cache-Control','no-store')
  return c.json(results.map(r=>({id:r.id,room:r.room,person:person({...r,id:r.caller},c.req.url),video:Boolean(r.video),offer:r.offer,state:r.state,expires:time(r.expires)})))
})
app.get('/api/calls/:id',async c=>{
  const row=await c.env.DB.prepare('SELECT * FROM calls WHERE id=? AND (caller=? OR callee=?)').bind(c.req.param('id'),c.get('user').id,c.get('user').id).first<CallRow>()
  if(!row)return c.json({error:'Call unavailable.'},404)
  c.header('Cache-Control','no-store')
  return c.json({id:row.id,room:row.room,state:callState(row),video:Boolean(row.video),offer:row.callee===c.get('user').id?row.offer:undefined,answer:row.caller===c.get('user').id?row.answer:undefined,connectedAt:row.connected_at?time(row.connected_at):undefined,expires:time(row.expires)})
})
app.put('/api/calls/:id/ringing',async c=>{
  const user=c.get('user').id,id=c.req.param('id')
  const result=await c.env.DB.prepare("UPDATE calls SET state='ringing' WHERE id=? AND callee=? AND state='offered' AND expires>? ").bind(id,user,now()).run()
  const call=await c.env.DB.prepare('SELECT state,callee,expires FROM calls WHERE id=?').bind(id).first<Pick<CallRow,'state'|'callee'|'expires'>>()
  if(call?.callee!==user||call.expires<=now()||!['ringing','answered'].includes(call.state))return c.json({error:'Call unavailable.'},404)
  return c.json({state:call.state,acknowledged:Boolean(result.meta.changes)})
})
app.put('/api/calls/:id/answer',async c=>{
  const signal=readCallSignal((await readBody(c.req.raw))?.signal)
  if(!signal||signal.kind!=='answer'||signal.id!==c.req.param('id'))return c.json({error:'Invalid call answer.'},400)
  const result=await c.env.DB.prepare("UPDATE calls SET answer=?,state='answered' WHERE id=? AND callee=? AND state IN ('offered','ringing') AND expires>?").bind(signal.sdp,signal.id,c.get('user').id,now()).run()
  if(!result.meta.changes)return c.json({error:'Call unavailable.'},404)
  return c.json({state:'answered'})
})
app.put('/api/calls/:id/connected',async c=>{
  const id=c.req.param('id'),user=c.get('user').id
  const result=await c.env.DB.prepare("UPDATE calls SET connected_at=COALESCE(connected_at,?) WHERE id=? AND (caller=? OR callee=?) AND state='answered'").bind(now(),id,user,user).run()
  if(!result.meta.changes)return c.json({error:'Call unavailable.'},404)
  return c.json({ok:true})
})
app.put('/api/calls/:id/end',async c=>{
  const user=c.get('user').id,id=c.req.param('id')
  const row=await c.env.DB.prepare('SELECT room,caller,callee,state FROM calls WHERE id=? AND (caller=? OR callee=?)').bind(id,user,user).first<Pick<CallRow,'room'|'caller'|'callee'|'state'>>()
  if(!row)return c.json({error:'Call unavailable.'},404)
  const result=await c.env.DB.prepare('UPDATE calls SET state=?,ended_at=? WHERE id=? AND state NOT IN (\'ended\',\'declined\')').bind(user===row.callee&&row.state!=='answered'?'declined':'ended',now(),id).run()
  if(result.meta.changes)c.executionCtx.waitUntil(c.env.ROOMS.getByName(row.room).fetch('https://room.internal/notify',{method:'POST',body:JSON.stringify({type:'call-history',id})}))
  return c.json({ok:true})
})
app.get('/api/rooms/:id/socket',async c=>{
  const room=c.req.param('id')
  const user=c.get('user').id
  if(!await member(c.env.DB,room,user)) return c.json({error:'Conversation unavailable.'},404)
  if(c.req.header('Upgrade')?.toLowerCase()!=='websocket') return c.json({error:'WebSocket required.'},426)
  const origin=c.req.header('Origin')
  if(origin&&!allowedOrigins(c.env).includes(origin)) return c.json({error:'Origin unavailable.'},403)
  await touchPresence(c.env.DB,user,true)
  return c.env.ROOMS.getByName(room).fetch('https://room.internal/socket',{headers:{Upgrade:'websocket','X-Room-User':user}})
})
app.onError((error,c)=>{
  if(error instanceof HTTPException)return c.json({error:error.message||'The request could not be completed.'},error.status)
  console.error(error)
  return c.json({error:'Something went wrong. Try again.'},500)
})
export class ChatRoom extends DurableObject<Env>{
  private async setPresence(user:string,online:boolean){await touchPresence(this.env.DB,user,online)}
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
    void this.setPresence(user,true)
    let envelope
    try{envelope=JSON.parse(message)}catch{return}
    if(envelope?.type==='presence')return
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
  // The active app heartbeat owns the session state. Closing a chat must not mark the app offline.

}
export default app

