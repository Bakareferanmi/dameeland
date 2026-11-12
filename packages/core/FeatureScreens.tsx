import React,{useEffect,useState} from 'react'
import {View} from 'react-native'
import {lime,people,type Person} from './index'
import {Avatar,Button,Card,Copy,Field,IconTile,Logo,PersonName,ScreenLinks,Segmented,row,spread,stack,useDesign,type Glyph} from './ui'

export type ExtraPage='Leaderboard'|'Lesson'|'Teacher dashboard'|'Study timer'|'Progress'|'Games'|'Rewards'|'Birthdays'|'Birthday wall'|'Birthday celebration'|'Events'|'Screen states'|'Design system'|'Logo board'
type Open=(page:ExtraPage)=>void

function FeatureIntro({title,detail,glyph}:{title:string;detail:string;glyph:Glyph}){
  return <Card style={{backgroundColor:'#4F25D6',borderColor:'#4F25D6'}}>
    <IconTile name={glyph} color={lime} background="#FFFFFF24" size={44}/>
    <Copy color="#fff" size={28} weight={800}>{title}</Copy><Copy color="#E9DFFF">{detail}</Copy>
  </Card>
}

function StudyTimer({demo}:{demo:boolean}){
  const [duration,setDuration]=useState('25 min')
  const [remaining,setRemaining]=useState(1500)
  const [deadline,setDeadline]=useState<number|null>(null)
  const [room,setRoom]=useState(false)
  const total=parseInt(duration,10)*60
  useEffect(()=>{
    if(deadline===null)return
    const update=()=>{
      const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000))
      setRemaining(seconds)
      if(!seconds)setDeadline(null)
    }
    const timer=setInterval(update,250)
    return ()=>clearInterval(timer)
  },[deadline])
  const reset=(seconds=total)=>{setDeadline(null);setRemaining(seconds)}
  return <>
    <FeatureIntro title="Focus time" detail="Pick a duration and work through one task." glyph="bolt"/>
    <Card>
      <Segmented options={['15 min','25 min','45 min']} selected={duration} onSelect={value=>{setDuration(value);reset(parseInt(value,10)*60)}}/>
      <Copy center size={52} weight={800}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</Copy>
      {remaining===0&&<Copy center weight={800}>Session complete</Copy>}
      <Button label={deadline?'Pause':remaining<total&&remaining>0?'Resume':'Start timer'} onPress={()=>deadline?setDeadline(null):setDeadline(Date.now()+(remaining||total)*1000)}/>
      <Button label="Reset timer" variant="secondary" onPress={()=>reset()}/>
    </Card>
    {demo&&<Card><Copy size={20} weight={800}>SS2 Maths Club focus room</Copy><Copy>{room?'You’re in the practice focus room.':'Try the group focus room in the preview.'}</Copy>
      {room&&<View style={row}><Avatar person={people[0]}/><Avatar person={people[1]}/></View>}
      <Button label={room?'Leave focus room':'Join focus room'} variant="secondary" onPress={()=>setRoom(!room)}/>
    </Card>}
  </>
}

const chapters=[
  {title:'Spot a quadratic',body:'A quadratic equation has a highest power of 2. Write it as ax² + bx + c = 0, where a is not zero.'},
  {title:'Factorise the expression',body:'For x² + 5x + 6 = 0, look for two numbers that multiply to 6 and add to 5. Those numbers are 2 and 3.'},
  {title:'Find and check the roots',body:'Set each factor equal to zero. (x + 2)(x + 3) = 0 gives x = −2 or x = −3. Substitute each value into the original equation to check.'},
]

function Lesson({markComplete,completed}:{markComplete:()=>void;completed:boolean}){
  const [chapter,setChapter]=useState(0)
  return <>
    <FeatureIntro title="Quadratic equations" detail="Mathematics · 3 chapters" glyph="book"/>
    <Card><Copy size={20} weight={800}>{chapters[chapter].title}</Copy><Copy>{chapters[chapter].body}</Copy></Card>
    <Card>
      <Copy size={19} weight={800}>Chapters</Copy>
      {chapters.map((item,i)=><Button key={item.title} label={item.title} variant={i===chapter?'primary':'secondary'} onPress={()=>setChapter(i)}/>)}
    </Card>
    <Button label={completed?'Lesson complete':'Mark lesson complete'} disabled={completed} leading="check" onPress={markComplete}/>
  </>
}

function TeacherDashboard(){
  const [title,setTitle]=useState('')
  const [assignments,setAssignments]=useState(['Quadratic equations practice'])
  const roster=[{person:people[0],status:'Submitted'},{person:people[1],status:'Late'},{person:people[2],status:'Missing'}]
  return <>
    <FeatureIntro title="SS2 Mathematics" detail="Preview assignment and submission records." glyph="book"/>
    <Card><Copy size={19} weight={800}>Assign homework</Copy><Field label="Assignment title" value={title} onChangeText={setTitle} maxLength={80}/><Button label="Add assignment" disabled={!title.trim()} onPress={()=>{setAssignments(previous=>[...previous,title.trim()]);setTitle('')}}/></Card>
    <Card><Copy size={19} weight={800}>Assignments</Copy>{assignments.map((assignment,i)=><Copy key={i}>{assignment}</Copy>)}</Card>
    <Card><Copy size={19} weight={800}>Submissions</Copy>{roster.map(({person,status})=><View key={person.id} style={spread}><View style={row}><Avatar person={person} size={32}/><PersonName person={person}/></View><Copy size={12} weight={800}>{status}</Copy></View>)}</Card>
  </>
}

function Events(){
  const [going,setGoing]=useState(false)
  const [cheered,setCheered]=useState(false)
  return <>
    <FeatureIntro title="Events and class moments" detail="Find out what’s happening in your school." glyph="grp"/>
    <Card><Copy size={21} weight={800}>Friday Quiz Night</Copy><Copy>Friday · 7:00 pm · SS2 Maths Club</Copy><Button label={going?'Cancel RSVP':'RSVP'} variant={going?'secondary':'primary'} onPress={()=>setGoing(!going)}/>{going&&<Copy>You’re going.</Copy>}</Card>
    <Card><Copy size={21} weight={800}>Code Club demo day</Copy><Copy>Celebrate the projects built by your classmates.</Copy><Button label={cheered?'Remove cheer · 25':'Cheer · 24'} variant="secondary" leading="heart" onPress={()=>setCheered(!cheered)}/></Card>
  </>
}

function Games({startQuiz}:{startQuiz:()=>void}){
  const [mode,setMode]=useState<'Word Sprint'|'Number Dash'|null>(null)
  const [answer,setAnswer]=useState('')
  const [result,setResult]=useState('')
  const start=(game:'Word Sprint'|'Number Dash')=>{setMode(game);setAnswer('');setResult('')}
  return <>
    <FeatureIntro title="Games hub" detail="Pick a quick game to play." glyph="game"/>
    <Button label="Play Quiz Duel" onPress={startQuiz}/>
    <View style={{...row,flexWrap:'wrap'}}><Button label="Word Sprint" variant="secondary" onPress={()=>start('Word Sprint')}/><Button label="Number Dash" variant="secondary" onPress={()=>start('Number Dash')}/></View>
    {mode&&<Card><Copy size={20} weight={800}>{mode}</Copy><Copy>{mode==='Word Sprint'?'Unscramble OKBO.':'What is 12 × 4?'}</Copy><Field label="Your answer" value={answer} onChangeText={setAnswer}/><Button label="Check answer" disabled={!answer.trim()} onPress={()=>setResult(answer.trim().toLowerCase()===(mode==='Word Sprint'?'book':'48')?'Correct!':'Try again.')}/>{!!result&&<Copy weight={800}>{result}</Copy>}</Card>}
  </>
}

function DesignBoard({logoOnly=false}:{logoOnly?:boolean}){
  const {theme}=useDesign()
  return <>
    <Card><Copy size={20} weight={800}>dameeland mark</Copy><View style={row}><Logo size={72}/><View style={{backgroundColor:'#4F25D6',borderRadius:12,padding:8}}><Logo size={72} variant="inverse"/></View></View></Card>
    {!logoOnly&&<Card>
      <Copy size={22} weight={800}>Plus Jakarta Sans</Copy><Copy>Body text, avatar shapes, and brand colours</Copy>
      <View style={row}><Avatar person={people[0]}/><Avatar person={people[1]}/></View>
      <View style={row}>{[theme.purple,lime,theme.bg,theme.card].map(color=><View key={color} style={{width:32,height:32,borderRadius:8,backgroundColor:color,borderWidth:1,borderColor:theme.border}}/>)}</View>
    </Card>}
  </>
}

type ScreenProps={page:ExtraPage;open:Open;demo:boolean;user:Person;startQuiz:()=>void;markComplete:()=>void;completed:boolean;wish:()=>void;wishes:string[];incomingCall:()=>void}
export default function FeatureScreen({page,open,demo,user,startQuiz,markComplete,completed,wish,wishes,incomingCall}:ScreenProps){
  const {theme}=useDesign()
  const [showBirthday,setShowBirthday]=useState(true)
  const [claimed,setClaimed]=useState(false)
  switch(page){
    case 'Lesson':return <Lesson markComplete={markComplete} completed={completed}/>
    case 'Teacher dashboard':return <TeacherDashboard/>
    case 'Study timer':return <StudyTimer demo={demo}/>
    case 'Events':return <Events/>
    case 'Games':return <Games startQuiz={startQuiz}/>
    case 'Design system':return <DesignBoard/>
    case 'Logo board':return <DesignBoard logoOnly/>
    case 'Leaderboard':return <>
      <FeatureIntro title="Quiz leaderboard" detail="This week’s Quiz Duel standings." glyph="trophy"/>
      <Card>{[people[1],people[0],people[2],user].map((person,i)=><View key={i} style={spread}><View style={row}><Copy weight={800}>{i+1}</Copy><Avatar person={person} size={34}/><PersonName person={person}/></View><Copy color={theme.ink} weight={800}>{[620,540,410,240][i]} XP</Copy></View>)}</Card>
    </>
    case 'Progress':return <>
      <FeatureIntro title="Your progress" detail="See what you’ve finished and pick up where you left off." glyph="book"/>
      <Card><Copy size={20} weight={800}>Weekly lesson goal</Copy><Copy>{completed?1:0} of 3 lessons complete</Copy><View style={{height:8,backgroundColor:theme.chip,borderRadius:4}}><View style={{width:completed?'33%':'0%',height:8,borderRadius:4,backgroundColor:theme.purple}}/></View><Button label="Open maths lesson" variant="secondary" onPress={()=>open('Lesson')}/></Card>
      <Card><Copy size={20} weight={800}>Study week</Copy><View style={{...row,flexWrap:'wrap'}}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=><View key={day} style={{padding:8,borderRadius:8,backgroundColor:(demo&&i<3)||(completed&&i===4)?theme.chip:theme.bg}}><Copy color={theme.ink} size={12}>{day}</Copy></View>)}</View></Card>
      <Card><Copy size={20} weight={800}>Subject mastery</Copy>{([['Mathematics',completed?82:72],['English',48],['Digital Technologies',60]] as const).map(([name,score])=><View key={name} style={{gap:5}}><View style={spread}><Copy>{name}</Copy><Copy>{demo||name==='Mathematics'&&completed?score:0}%</Copy></View><View style={{height:6,borderRadius:3,backgroundColor:theme.chip}}><View style={{height:6,borderRadius:3,backgroundColor:theme.purple,width:`${demo||name==='Mathematics'&&completed?score:0}%`}}/></View></View>)}</Card>
    </>
    case 'Rewards':return <>
      <FeatureIntro title="Rewards and badges" detail={claimed?'10 coins claimed today.':'Your daily reward is ready.'} glyph="trophy"/>
      <Button label={claimed?'Reward claimed':'Claim 10 coins'} disabled={claimed} onPress={()=>setClaimed(true)}/>
      <Card><Copy size={20} weight={800}>Badges</Copy><Copy>{completed?'Lesson Starter earned':'Finish a lesson to earn Lesson Starter.'}</Copy></Card>
    </>
    case 'Birthdays':return <>
      <FeatureIntro title="Birthdays" detail="Celebrate with your classmates." glyph="gift"/>
      <Card><View style={row}><Avatar person={people[2]}/><View><Copy weight={800}>Zee K. · Today</Copy><Copy size={12} color={theme.muted}>Leave a birthday wish</Copy></View></View><Button label="Open birthday wall" onPress={()=>open('Birthday wall')}/><Copy>Tobi A. · 24 October</Copy></Card>
      <Card><Copy weight={800}>Birthday visibility</Copy><Button label={showBirthday?'Hide my birthday':'Show my birthday'} variant="secondary" onPress={()=>setShowBirthday(!showBirthday)}/></Card>
      <Button label="Preview birthday celebration" variant="secondary" onPress={()=>open('Birthday celebration')}/>
    </>
    case 'Birthday wall':return <>
      <FeatureIntro title="Happy birthday, Zee!" detail="Birthday wishes from your classmates." glyph="gift"/>
      <Card><Copy weight={800}>Ada O.</Copy><Copy>Happy birthday, Zee! Have a great day.</Copy></Card>
      {wishes.map((message,i)=><Card key={i}><PersonName person={user}/><Copy>{message}</Copy></Card>)}
      <Button label="Write a wish" onPress={wish}/>
    </>
    case 'Birthday celebration':return <>
      <FeatureIntro title={`Happy birthday, ${user.name}!`} detail="Your birthday badge and 100 coins are ready in this preview." glyph="gift"/>
      <Card><IconTile name="trophy" size={46}/><Copy size={20} weight={800}>Birthday badge</Copy><Button label={claimed?'Birthday reward claimed':'Claim birthday reward'} disabled={claimed} onPress={()=>setClaimed(true)}/></Card>
    </>
    case 'Screen states':return <View style={stack}>
      <Card><Copy size={20} weight={800}>No messages yet</Copy><Copy>Start a chat from Explore.</Copy></Card>
      <Card><Copy size={20} weight={800}>No search results</Copy><Copy>Try a different name or topic.</Copy></Card>
      <Card><Copy size={20} weight={800}>Ringing</Copy><Copy>Incoming voice call from Ada O.</Copy><Button label="Preview incoming call" variant="secondary" onPress={incomingCall}/></Card>
      <Card><Copy size={20} weight={800}>Feed loading</Copy>{[90,48,72].map(width=><View key={width} style={{height:14,width:`${width}%`,borderRadius:5,backgroundColor:theme.chip}}/>)}</Card>
      <Card><Copy size={20} weight={800}>You’re offline</Copy><Copy>Reconnect to refresh your feed.</Copy></Card>
      <ScreenLinks items={ [['Design system','settings'],['Logo board','image']] } open={open}/>
    </View>
  }
}
