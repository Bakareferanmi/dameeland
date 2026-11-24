import React,{useMemo,useState} from 'react'
import {Pressable,View} from 'react-native'
import {dailyLesson,lessons,lessonsFor,passMark,practiceSession,practiceSessionSize,shuffled,subjects,type PracticeTopic,type Question,type Subject} from './learningCatalog'
import {Button,Card,Copy,Icon,IconTile,row,spread,stack,useDesign} from './ui'

type Lesson=typeof lessons[number]
type RunnerQuestion=Question&{lessonTitle?:string}
export type PracticeStat={subject:string;correct:number;total:number;sessions:number}
export type PracticeAnswer={id:string;answer:number}

/** A fresh display order for a question's options. Answers are still reported by their original index. */
const optionOrder=(question:Question)=>shuffled(question.options.map((_,position)=>position))
const percent=(part:number,whole:number)=>whole?Math.round(part/whole*100):0

function Bar({value,label}:{value:number;label:string}){
  const {theme}=useDesign()
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:Math.round(value)}}
    style={{height:7,backgroundColor:theme.chip,borderRadius:7,overflow:'hidden'}}>
    <View style={{height:7,width:`${value}%`,backgroundColor:theme.purple}}/>
  </View>
}

/** Asks questions one at a time with instant feedback, an explanation after every answer and a review at the end. */
function Runner({questions,onFinish,onRestart,results}:{questions:RunnerQuestion[];onFinish?:(answers:number[])=>void;onRestart?:()=>void;results?:React.ReactNode}){
  const {theme}=useDesign()
  const [list,setList]=useState(questions)
  const [orders,setOrders]=useState(()=>questions.map(optionOrder))
  const [full,setFull]=useState(true)
  const [index,setIndex]=useState(0)
  const [picked,setPicked]=useState<number|null>(null)
  const [answers,setAnswers]=useState<number[]>([])
  const [streak,setStreak]=useState(0)
  const [finished,setFinished]=useState(false)
  const question=list[index]
  const begin=(next:RunnerQuestion[],complete:boolean)=>{setList(next);setOrders(next.map(optionOrder));setFull(complete);setIndex(0);setPicked(null);setAnswers([]);setStreak(0);setFinished(false)}
  const choose=(choice:number)=>{
    if(picked!==null)return
    setPicked(choice);setAnswers(current=>[...current,choice]);setStreak(current=>choice===question.answer?current+1:0)
  }
  const next=()=>{
    if(index<list.length-1){setIndex(index+1);setPicked(null);return}
    setFinished(true)
    if(full)onFinish?.(answers)
  }
  if(finished){
    const score=list.filter((item,position)=>answers[position]===item.answer).length
    const missed=list.map((item,position)=>({item,choice:answers[position]})).filter(entry=>entry.choice!==entry.item.answer)
    return <View style={stack}>
      <View accessibilityLiveRegion="polite" style={{gap:6}}>
        <Copy size={25} weight={800}>{score} / {list.length}</Copy>
        <Copy>{score===list.length?'Perfect score. Every answer was right.':percent(score,list.length)>=60?'Good work. Review the ones you missed to lock them in.':'Keep going. Review the explanations, then try again.'}</Copy>
        {full&&results}
      </View>
      {!!missed.length&&<View style={stack}>
        <Copy size={17} weight={800}>Review your mistakes</Copy>
        {missed.map(({item,choice})=><View key={item.id} style={{gap:4,borderLeftWidth:3,borderLeftColor:theme.purple,paddingLeft:12}}>
          {!!item.lessonTitle&&<Copy size={12} color={theme.muted}>{item.lessonTitle}</Copy>}
          <Copy weight={800}>{item.prompt}</Copy>
          <Copy color={theme.muted}>Your answer: {item.options[choice]}</Copy>
          <Copy weight={800}>Correct answer: {item.options[item.answer]}</Copy>
          <Copy>{item.explanation}</Copy>
        </View>)}
      </View>}
      <View style={{...row,flexWrap:'wrap'}}>
        {!!missed.length&&<Button label="Retry missed questions" variant="secondary" onPress={()=>begin(missed.map(entry=>entry.item),false)}/>}
        <Button label={onRestart?'New questions':'Try again'} onPress={onRestart??(()=>begin(questions,true))}/>
      </View>
    </View>
  }
  const answered=picked!==null
  const right=picked===question.answer
  return <View style={stack}>
    <View style={spread}>
      <Copy weight={800}>Question {index+1} of {list.length}</Copy>
      {streak>=2&&<Copy weight={800} color={theme.ink}>{streak} in a row</Copy>}
    </View>
    <Bar value={((index+(answered?1:0))/list.length)*100} label="Questions answered"/>
    <Copy size={18} weight={800}>{question.prompt}</Copy>
    {orders[index].map(position=><Button key={question.options[position]} label={question.options[position]}
      variant={answered?(position===question.answer?'fun':position===picked?'danger':'secondary'):'secondary'}
      onPress={()=>choose(position)}/>)}
    {answered&&<View accessibilityLiveRegion="polite" style={{gap:8}}>
      <Copy weight={800}>{right?'Correct!':'Not quite. The answer is '+question.options[question.answer]+'.'}</Copy>
      <Copy>{question.explanation}</Copy>
      <Button label={index===list.length-1?'See results':'Next question'} onPress={next}/>
    </View>}
  </View>
}

export function Learning({featured,done,onLesson,onPractice,onTimer,onProgress}:{featured:Lesson;done:string[];onLesson:(id:string)=>void;onPractice:(topic:PracticeTopic)=>void;onTimer:()=>void;onProgress:()=>void}){
  const {theme}=useDesign()
  const [open,setOpen]=useState<Subject|null>(null)
  return <View style={stack}>
    <Card>
      <IconTile name="bolt"/>
      <Copy size={19} weight={800}>Today’s lesson</Copy>
      <Copy>{featured.subject} · {featured.title}</Copy>
      <Button label="Start lesson" onPress={()=>onLesson(featured.id)}/>
    </Card>
    <Card>
      <Copy size={19} weight={800}>Mixed practice</Copy>
      <Copy color={theme.muted}>{practiceSessionSize} random questions from all {subjects.length} subjects, with instant feedback.</Copy>
      <Button label="Start mixed practice" variant="fun" leading="bolt" onPress={()=>onPractice('Mixed')}/>
    </Card>
    <View style={{...row,flexWrap:'wrap'}}>
      <Button label="Study timer" leading="bolt" variant="secondary" onPress={onTimer}/>
      <Button label="Progress" leading="check" variant="secondary" onPress={onProgress}/>
    </View>
    {subjects.map(subject=>{
      const subjectLessons=lessonsFor(subject)
      const complete=subjectLessons.filter(lesson=>done.includes(lesson.id)).length
      const expanded=open===subject
      return <Card key={subject}>
        <Pressable accessibilityRole="button" accessibilityLabel={subject+', '+complete+' of '+subjectLessons.length+' lessons complete'} accessibilityState={{expanded}}
          onPress={()=>setOpen(expanded?null:subject)} style={{...row,minHeight:44}}>
          <View style={{flex:1,gap:8}}>
            <Copy size={19} weight={800}>{subject}</Copy>
            <Bar value={percent(complete,subjectLessons.length)} label={subject+' lessons complete'}/>
          </View>
          <Copy color={theme.muted} weight={800}>{complete}/{subjectLessons.length}</Copy>
          <View style={{transform:[{rotate:expanded?'90deg':'0deg'}]}}><Icon name="arrow" color={theme.muted}/></View>
        </Pressable>
        {expanded&&<>
          {subjectLessons.map(lesson=><Button key={lesson.id} label={lesson.title}
            leading={done.includes(lesson.id)?'check':'book'} variant="secondary" onPress={()=>onLesson(lesson.id)}/>)}
          <Button label={'Practice '+subject} variant="fun" leading="bolt" onPress={()=>onPractice(subject)}/>
        </>}
      </Card>
    })}
  </View>
}

export function StudyLesson({id,done,onComplete}:{id:string;done:boolean;onComplete:(id:string,answers:number[])=>Promise<void>}){
  const lesson=lessons.find(item=>item.id===id)??dailyLesson()
  const {theme}=useDesign()
  const [started,setStarted]=useState(false)
  const [status,setStatus]=useState<'saving'|'saved'|'short'|'error'|null>(null)
  const [latest,setLatest]=useState<number[]>([])
  const needed=passMark(lesson.questions.length)
  const finish=async(answers:number[])=>{
    setLatest(answers)
    const score=lesson.questions.filter((question,position)=>answers[position]===question.answer).length
    if(score<needed){setStatus('short');return}
    if(done){setStatus('saved');return}
    setStatus('saving')
    try{await onComplete(lesson.id,answers);setStatus('saved')}
    catch{setStatus('error')}
  }
  const outcome=<>
    {status==='saving'&&<Copy color={theme.muted}>Saving your progress…</Copy>}
    {status==='saved'&&<Copy weight={800}>Lesson complete</Copy>}
    {status==='short'&&<Copy weight={800}>Score at least {needed} out of {lesson.questions.length} to complete this lesson.</Copy>}
    {status==='error'&&<>
      <Copy weight={800}>Couldn’t save your progress.</Copy>
      <Button label="Retry saving" variant="secondary" onPress={()=>void finish(latest)}/>
    </>}
  </>
  return <View style={stack}>
    <Card>
      <Copy color={theme.ink} weight={800}>{lesson.subject}</Copy>
      <Copy size={25} weight={800}>{lesson.title}</Copy>
      {lesson.notes.map(note=><Copy key={note}>{note}</Copy>)}
    </Card>
    <Card>
      <Copy size={19} weight={800}>Practice</Copy>
      {started?<Runner questions={lesson.questions} onFinish={answers=>void finish(answers)} results={outcome}/>:<>
        <Copy>{lesson.questions.length} questions. Answer {needed} or more correctly to complete the lesson. You see an explanation after every answer.</Copy>
        {done&&<Copy weight={800}>Lesson complete</Copy>}
        <Button label={done?'Practice again':'Start practice'} onPress={()=>setStarted(true)}/>
      </>}
    </Card>
  </View>
}

export function Practice({topic,onSave}:{topic:PracticeTopic;onSave:(topic:PracticeTopic,answers:PracticeAnswer[])=>Promise<void>}){
  const {theme}=useDesign()
  const [round,setRound]=useState(0)
  const [status,setStatus]=useState<'saving'|'saved'|'error'|null>(null)
  const [latest,setLatest]=useState<PracticeAnswer[]>([])
  const questions=useMemo(()=>practiceSession(topic),[topic,round])
  const save=async(answers:PracticeAnswer[])=>{
    setLatest(answers);setStatus('saving')
    try{await onSave(topic,answers);setStatus('saved')}
    catch{setStatus('error')}
  }
  const outcome=<>
    {status==='saving'&&<Copy color={theme.muted}>Saving your result…</Copy>}
    {status==='saved'&&<Copy color={theme.muted}>Saved to your progress.</Copy>}
    {status==='error'&&<>
      <Copy weight={800}>Couldn’t save this result.</Copy>
      <Button label="Retry saving" variant="secondary" onPress={()=>void save(latest)}/>
    </>}
  </>
  return <View style={stack}>
    <Card>
      <Copy size={25} weight={800}>{topic==='Mixed'?'Mixed practice':topic+' practice'}</Copy>
      <Copy color={theme.muted}>{questions.length} random questions{topic==='Mixed'?' from every subject':''}. Each answer shows an explanation straight away.</Copy>
    </Card>
    <Card>
      <Runner key={round} questions={questions} results={outcome}
        onFinish={answers=>void save(questions.map((question,position)=>({id:question.id,answer:answers[position]})))}
        onRestart={()=>{setStatus(null);setRound(current=>current+1)}}/>
    </Card>
  </View>
}

export function LearningProgress({done,error,retry,open,practice,onPractice}:{done:string[];error:boolean;retry:()=>void;open:(id:string)=>void;practice:PracticeStat[];onPractice:(topic:PracticeTopic)=>void}){
  const {theme}=useDesign()
  const completed=lessons.filter(lesson=>done.includes(lesson.id))
  const stat=(subject:Subject)=>practice.find(item=>item.subject===subject)
  const weakest=practice.filter(item=>item.total>=5&&(subjects as readonly string[]).includes(item.subject))
    .sort((a,b)=>a.correct/a.total-b.correct/b.total)[0]
  return <View style={stack}>
    <Card>
      <Copy size={20} weight={800}>Lessons completed</Copy>
      {error?<Button label="Retry loading progress" variant="secondary" onPress={retry}/>:<>
        <Copy>{completed.length} of {lessons.length}</Copy>
        {subjects.map(subject=>{
          const total=lessonsFor(subject).length,count=completed.filter(lesson=>lesson.subject===subject).length
          return <View key={subject} style={{gap:6}}>
            <View style={spread}><Copy>{subject}</Copy><Copy weight={800}>{count} of {total}</Copy></View>
            <Bar value={percent(count,total)} label={subject+' lessons complete'}/>
          </View>
        })}
      </>}
    </Card>
    <Card>
      <Copy size={19} weight={800}>Practice accuracy</Copy>
      {practice.length?subjects.map(subject=>{
        const item=stat(subject)
        return item?<View key={subject} style={spread}>
          <Copy>{subject}</Copy><Copy weight={800}>{percent(item.correct,item.total)}% · {item.total} answered</Copy>
        </View>:null
      }):<Copy color={theme.muted}>Finish a practice session to see how you are doing in each subject.</Copy>}
      {weakest&&<Button label={'Practise '+weakest.subject} variant="fun" leading="bolt" onPress={()=>onPractice(weakest.subject as Subject)}/>}
      <Button label="Start mixed practice" variant="secondary" onPress={()=>onPractice('Mixed')}/>
    </Card>
    {!!completed.length&&<Card>
      <Copy size={19} weight={800}>Review completed lessons</Copy>
      {completed.map(lesson=><Button key={lesson.id} label={lesson.title} variant="secondary" onPress={()=>open(lesson.id)}/>)}
    </Card>}
  </View>
}
