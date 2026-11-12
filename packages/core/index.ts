export const themes = {
  light: { bg:'#FAF8FF', card:'#FFFFFF', border:'#E2DBF5', text:'#1B1233', muted:'#5A5274', purple:'#6A35F0', deep:'#4F25D6', ink:'#4F25D6', chip:'#EEE8FC' },
  dark: { bg:'#120D1F', card:'#1D1630', border:'#2E2548', text:'#F4F0FF', muted:'#A99FC6', purple:'#7C4DFF', deep:'#4F25D6', ink:'#C9B8FF', chip:'#2E2548' },
}
export const lime = '#C8F53F'
export const danger = '#D13438'
export type Theme = keyof typeof themes
export type Role = 'student' | 'tech'
export const usernameHint = 'Use 3–24 letters, numbers or underscores.'
export const normalizeUsername = (value:string) => value.trim().toLowerCase()
export const validUsername = (value:string) => /^[a-z0-9_]{3,24}$/.test(value)
export const capitalizeName = (value:string) => value.replace(/^(\s*)(\p{L})/u,(_,space:string,letter:string)=>space+letter.toUpperCase())
export type Person = {id:string; name:string; initials:string; role:Role; color:string; detail:string; verified?:boolean; group?:boolean; avatar?:string; cover?:string; username?:string}
export type Viewer = Person & {isAdmin?:boolean}
export type AdminAccount = {person:Person;email:string;created:number|null;independentlyVerified:boolean}
export type AdminActivity = {id:string;name:string;kind:'signup'|'post'|'comment';created:number;excerpt?:string}
export type AdminDay = {day:string;signups:number;posts:number;comments:number;likes:number;reposts:number;messages:number}
export type AdminOverview = {
  series:AdminDay[];updatedAt:number;
  users:number;newUsers:number;activeUsers:number;techUsers:number;verifiedUsers:number;
  posts:number;comments:number;likes:number;reposts:number;follows:number;messages:number;
  activity:AdminActivity[];
}
export type AdminAccounts = {accounts:AdminAccount[];nextCursor:string|null}
export type FollowListKind = 'followers'|'following'
export type FollowPage = {people:Person[]; nextCursor:string|null}
export type FollowStats = {followers:number; following:number; followedByViewer:boolean}
export type Post = {id:string; author:Person; body:string; likes:number; liked:boolean; comments:number; reposts:number; reposted:boolean; time:string; kind?:'image'|'video'; media?:string}
export const commentGifs = {cheer:'Cheer',sparkle:'Sparkle',highfive:'High five'} as const
export const commentStickers = {
  nice:{label:'Nice!',emoji:'✨'},
  smart:{label:'Big brain',emoji:'🧠'},
  done:{label:'You got this',emoji:'💪'},
  laugh:{label:'Too funny',emoji:'😂'},
} as const
export type CommentAttachment =
  | {kind:'image';url:string}
  | {kind:'gif';id:keyof typeof commentGifs}
  | {kind:'sticker';id:keyof typeof commentStickers}
export type Note = {id:string; author:Person; body:string; attachment?:CommentAttachment}
export const me:Person = {id:'you',name:'You',initials:'YO',role:'student',color:lime,detail:'Student'}
export const people:Person[] = [
  {id:'ada',name:'Ada O.',initials:'AO',role:'student',color:'#FFD9B8',detail:'SS2 · Student',verified:true},
  {id:'tobi',name:'Tobi A.',initials:'TB',role:'tech',color:'#CFE8FF',detail:'Tech · Code Club',verified:true},
  {id:'zee',name:'Zee K.',initials:'ZK',role:'student',color:'#FFE9A8',detail:'Student'},
  {id:'bello',name:'Mr. Bello',initials:'MB',role:'student',color:'#E9E0FF',detail:'Maths teacher',verified:true},
  {id:'code',name:'Code Club',initials:'CC',role:'tech',color:lime,detail:'Tech · School club',verified:true,group:true},
  {id:'maths',name:'SS2 Maths Club',initials:'SS',role:'tech',color:'#FFD6E8',detail:'Group · 24 members',group:true},
  {id:'squad',name:'JS Study Squad',initials:'JS',role:'tech',color:'#FFE9A8',detail:'Group · 112 members',group:true},
]
export const initialPosts:Post[] = [
  {id:'quadratics',author:people[0],body:'Finally cracked quadratic equations! Made a one-page cheat sheet for the class.',kind:'image',likes:128,comments:14,reposts:6,liked:false,reposted:false,time:'2h'},
  {id:'weather',author:people[4],body:'Build a tiny weather app in 40 seconds.',kind:'video',likes:340,comments:32,reposts:41,liked:false,reposted:false,time:'5h'},
]
export const initialComments:Note[] = [
  {id:'teacher',author:people[3],body:'Great work Ada. Share this with the whole class.'},
  {id:'classmate',author:people[1],body:'The factorising tip saved me on the last test.'},
]
export const slides = [
  {title:'Hang out. Learn. Have fun.',description:'Chat with friends, share your day, study together and play games.',post:'Quiz night at 7, who is in?',action:'Count me in!',likes:24,tilt:'-4deg'},
  {title:'Your crew, your space',description:'Make groups for your class, club or team and keep the fun going.',post:'New study group for SS2. Join us after school!',action:'Join',likes:18,tilt:'3deg'},
  {title:'Play and win',description:'Take on quizzes and games with friends and earn badges.',post:'Won my first Word Sprint game today!',action:'Congrats!',likes:52,tilt:'-3deg'},
]
export const questions = [
  {text:'What is x if 2x + 6 = 14?',options:['3','4','5','7'],answer:1},
  {text:'Which of these is a prime number?',options:['21','27','29','33'],answer:2},
  {text:'What is 3² + 4²?',options:['12','25','49','7'],answer:1},
]
export const initialChats:Record<string,Note[]> = {
  ada:[{id:'m1',author:people[0],body:'Did you see the maths cheat sheet I posted?'},{id:'m2',author:me,body:'Yes! The quadratic part is so clear'}],
  maths:[{id:'m3',author:people[1],body:'Quiz is on Friday!'}],
  code:[{id:'m4',author:people[4],body:'We’re meeting after school on Friday.'}],
}
export const initials = (name:string) => name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')
export async function api<T>(base:string,path:string,options:RequestInit={},token?:string):Promise<T>{
  const headers = new Headers(options.headers)
  if(typeof options.body === 'string') headers.set('Content-Type','application/json')
  if(token) headers.set('Authorization','Bearer '+token)
  const response = await fetch(base.replace(/\/$/,'')+'/api'+path,{...options,headers})
  const result = await response.json() as {error?:string}
  if(!response.ok) throw new Error(result.error ?? 'Something went wrong. Try again.')
  return result as unknown as T
}
