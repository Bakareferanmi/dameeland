import {coreLessons} from './learningContentCore'
import {scienceLessons} from './learningContentSciences'
import {worldLessons} from './learningContentWorld'
import {subjects,type DraftLesson,type Lesson,type Question,type Subject} from './learningTypes'

export {subjects}
export type {Lesson,Question,Subject}
export type PracticeQuestion=Question&{subject:Subject;lessonId:string;lessonTitle:string}
export type PracticeTopic=Subject|'Mixed'
export const practiceTopics:readonly PracticeTopic[]=['Mixed',...subjects]
export const practiceSessionSize=10
export const lessonPassRatio=.6

const build=(draft:DraftLesson):Lesson=>({
  id:draft.id,subject:draft.subject,title:draft.title,notes:draft.notes,
  questions:draft.questions.map(([prompt,options,answer,explanation],index)=>({id:draft.id+':'+index,prompt,options,answer,explanation})),
})

const order=new Map<Subject,number>(subjects.map((subject,index)=>[subject,index]))
export const lessons:Lesson[]=[...coreLessons,...scienceLessons,...worldLessons].map(build)
  .sort((a,b)=>(order.get(a.subject)??0)-(order.get(b.subject)??0))

export const dailyLesson=(time=Date.now())=>lessons[Math.floor((time+3600000)/86400000)%lessons.length]

export const lessonsFor=(subject:Subject)=>lessons.filter(lesson=>lesson.subject===subject)

/** Correct answers needed to pass a lesson’s practice. */
export const passMark=(total:number)=>Math.max(1,Math.ceil(total*lessonPassRatio))

export const practicePool:PracticeQuestion[]=lessons.flatMap(lesson=>lesson.questions.map(question=>({...question,subject:lesson.subject,lessonId:lesson.id,lessonTitle:lesson.title})))
const poolById=new Map(practicePool.map(question=>[question.id,question]))
export const practiceQuestion=(id:string)=>poolById.get(id)

export function shuffled<T>(items:readonly T[],random=Math.random){
  const copy=[...items]
  for(let index=copy.length-1;index>0;index--){
    const swap=Math.floor(random()*(index+1))
    ;[copy[index],copy[swap]]=[copy[swap],copy[index]]
  }
  return copy
}

/** A fresh random set of questions for a practice session. */
export function practiceSession(topic:PracticeTopic,size=practiceSessionSize,random=Math.random){
  const pool=topic==='Mixed'?practicePool:practicePool.filter(question=>question.subject===topic)
  return shuffled(pool,random).slice(0,size)
}

export const isSubject=(value:unknown):value is Subject=>typeof value==='string'&&(subjects as readonly string[]).includes(value)
