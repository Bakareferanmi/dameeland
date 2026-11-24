export const subjects=['Mathematics','English','Digital Technologies','Physics','Chemistry','Biology','Economics','Geography','Government','Agricultural Science'] as const
export type Subject=typeof subjects[number]

export type Question={id:string;prompt:string;options:string[];answer:number;explanation:string}
export type Lesson={id:string;subject:Subject;title:string;notes:string[];questions:Question[]}

/** Authoring shape: [prompt, options, index of the correct option, explanation]. */
export type DraftQuestion=[string,string[],number,string]
export type DraftLesson={id:string;subject:Subject;title:string;notes:string[];questions:DraftQuestion[]}
