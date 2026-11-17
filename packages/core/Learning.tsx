import React,{useState} from 'react'
import {View} from 'react-native'
import {dailyLesson,lessons,subjects,type Subject} from './learningCatalog'
import {Button,Card,Copy,IconTile,row,stack,useDesign} from './ui'

type Lesson=typeof lessons[number]

export function Learning({featured,done,onLesson,onTimer,onProgress}:{featured:Lesson;done:string[];onLesson:(id:string)=>void;onTimer:()=>void;onProgress:()=>void}){
  return <View style={stack}>
    <Card>
      <IconTile name="bolt"/>
      <Copy size={19} weight={800}>Today’s lesson</Copy>
      <Copy>{featured.subject} · {featured.title}</Copy>
      <Button label="Start lesson" onPress={()=>onLesson(featured.id)}/>
    </Card>
    <View style={{...row,flexWrap:'wrap'}}>
      <Button label="Study timer" leading="bolt" variant="secondary" onPress={onTimer}/>
      <Button label="Progress" leading="check" variant="secondary" onPress={onProgress}/>
    </View>
    {subjects.map(subject=><Card key={subject}>
      <Copy size={19} weight={800}>{subject}</Copy>
      {lessons.filter(lesson=>lesson.subject===subject).map(lesson=><Button key={lesson.id} label={lesson.title}
        leading={done.includes(lesson.id)?'check':'book'} variant="secondary" onPress={()=>onLesson(lesson.id)}/>)}
    </Card>)}
  </View>
}

export function StudyLesson({id,done,onComplete}:{id:string;done:boolean;onComplete:(id:string,answer:number)=>Promise<void>}){
  const lesson=lessons.find(item=>item.id===id)??dailyLesson()
  const {theme}=useDesign()
  const [answer,setAnswer]=useState<number|null>(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const correct=answer===lesson.answer
  const choose=async(index:number)=>{
    if(saving||correct)return
    setAnswer(index);setError('')
    if(index!==lesson.answer||done)return
    setSaving(true)
    try{await onComplete(lesson.id,index)}
    catch{setError('Couldn’t save your progress. Try again.');setAnswer(null)}
    finally{setSaving(false)}
  }
  return <View style={stack}>
    <Card>
      <Copy color={theme.ink} weight={800}>{lesson.subject}</Copy>
      <Copy size={25} weight={800}>{lesson.title}</Copy>
      {lesson.notes.map(note=><Copy key={note}>{note}</Copy>)}
    </Card>
    <Card>
      <Copy size={19} weight={800}>Practice</Copy>
      <Copy>{lesson.question}</Copy>
      {lesson.options.map((option,index)=><Button key={option} label={option}
        disabled={saving||correct} variant={answer===index?(correct?'fun':'danger'):'secondary'}
        onPress={()=>void choose(index)}/>)}
      {!!error&&<Copy color={theme.ink}>{error}</Copy>}
      {answer!==null&&<View accessibilityLiveRegion="polite">
        <Copy weight={800}>{correct?'Correct!':'Try another answer.'}</Copy>
        {correct&&<Copy>{lesson.explanation}</Copy>}
      </View>}
      {done&&<Copy weight={800}>Lesson complete</Copy>}
    </Card>
  </View>
}

export function LearningProgress({done,error,retry,open}:{done:string[];error:boolean;retry:()=>void;open:(id:string)=>void}){
  const completed=lessons.filter(lesson=>done.includes(lesson.id))
  const subjectProgress=(subject:Subject)=>completed.filter(lesson=>lesson.subject===subject).length
  return <View style={stack}>
    <Card>
      <Copy size={20} weight={800}>Lessons completed</Copy>
      {error?<Button label="Retry loading progress" variant="secondary" onPress={retry}/>:<>
        <Copy>{completed.length} of {lessons.length}</Copy>
        {subjects.map(subject=><View key={subject} style={{...row,justifyContent:'space-between'}}>
          <Copy>{subject}</Copy><Copy weight={800}>{subjectProgress(subject)} of {lessons.filter(lesson=>lesson.subject===subject).length}</Copy>
        </View>)}
      </>}
    </Card>
    {!!completed.length&&<Card>
      <Copy size={19} weight={800}>Review completed lessons</Copy>
      {completed.map(lesson=><Button key={lesson.id} label={lesson.title} variant="secondary" onPress={()=>open(lesson.id)}/>)}
    </Card>}
  </View>
}
