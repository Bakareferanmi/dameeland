import React,{useEffect,useState} from 'react'
import {ActivityIndicator,Platform,Pressable,Text,TextInput,View} from 'react-native'
import {api,type Person} from './index'
import {Avatar,Button,Card,Copy,Field,Segmented,displayHandle,row,useDesign} from './ui'

type Article={id:string;title:string;summary:string;author:Person;status:'draft'|'published';minutes:number;publishedAt?:string;updatedAt:string;body?:string}
type Screen={name:'list'|'mine'}|{name:'read';id:string;back:'list'|'mine'}|{name:'edit';id?:string}

const serif=Platform.select({ios:'Georgia',android:'serif',default:'Georgia, "Times New Roman", serif'})
const message=(error:unknown)=>error instanceof Error?error.message:'Try again in a moment.'
const dateLabel=(iso?:string)=>{
  if(!iso)return ''
  try{return new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}catch{return iso.slice(0,10)}
}
const readTime=(text:string)=>Math.max(1,Math.ceil(text.trim().split(/\s+/).filter(Boolean).length/200))

const sampleAuthor:Person={id:'press-sample',name:'Press Club',username:'pressclub',initials:'PC',role:'student',color:'#E9E0FF',detail:'Press Club'}
const sampleArticles:Article[]=[
  {id:'sample-1',title:'Why our school needs a quiet reading corner',summary:'A short case for one calm room in a noisy building.',author:sampleAuthor,status:'published',minutes:2,publishedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    body:'## A calm place to think\n\nEvery break time the corridors are loud. A small reading corner would give students somewhere to slow down.\n\n> Quiet is not the absence of students. It is the presence of focus.\n\nHere is what it would need:\n\n- A few shelves of donated books\n- Soft seating\n- One rule: **no phones**\n\nThe Press Club will keep collecting ideas. Share yours with a writer today.'},
  {id:'sample-2',title:'Inside the SS2 science fair',summary:'Three projects that made the judges stop and ask questions.',author:sampleAuthor,status:'published',minutes:1,publishedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    body:'## Three projects to remember\n\nThe hall was full by nine. Students explained their work to every visitor.\n\nThe water filter, the solar charger and the weather station each showed what **hands-on learning** looks like.'},
]

function Inline({text}:{text:string}){
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part,index)=>/^\*\*[^*]+\*\*$/.test(part)?<Text key={index} style={{fontWeight:'800'}}>{part.slice(2,-2)}</Text>:part)}</>
}

export function ArticleBody({text,size=17}:{text:string;size?:number}){
  const {theme}=useDesign()
  const base={fontFamily:serif,fontSize:size,lineHeight:Math.round(size*1.6),color:theme.text}
  const blocks=text.split(/\n{2,}/).map(block=>block.trim()).filter(Boolean)
  return <View style={{gap:size*.9}}>
    {blocks.map((block,index)=>{
      if(/^#\s/.test(block))return <Text key={index} style={{...base,fontSize:size*1.55,lineHeight:Math.round(size*1.9),fontWeight:'800'}}><Inline text={block.replace(/^#\s+/,'')}/></Text>
      if(/^##\s/.test(block))return <Text key={index} style={{...base,fontSize:size*1.28,lineHeight:Math.round(size*1.7),fontWeight:'800',marginTop:size*.4}}><Inline text={block.replace(/^##\s+/,'')}/></Text>
      const lines=block.split('\n')
      if(lines.every(line=>/^>\s?/.test(line)))return <View key={index} style={{borderLeftWidth:4,borderColor:theme.purple,paddingLeft:14}}><Text style={{...base,fontStyle:'italic'}}><Inline text={lines.map(line=>line.replace(/^>\s?/,'')).join('\n')}/></Text></View>
      if(lines.every(line=>/^[-*]\s/.test(line)))return <View key={index} style={{gap:6}}>{lines.map((line,at)=><View key={at} style={{flexDirection:'row',gap:10,paddingRight:8}}><Text style={base}>•</Text><Text style={{...base,flex:1}}><Inline text={line.replace(/^[-*]\s+/,'')}/></Text></View>)}</View>
      return <Text key={index} style={base}><Inline text={block}/></Text>
    })}
  </View>
}

function Byline({article}:{article:Article}){
  const {theme}=useDesign()
  return <View style={{...row,gap:8}}>
    <Avatar person={article.author} size={26}/>
    <Copy size={12} color={theme.muted}>@{displayHandle(article.author)} · {article.minutes} min read{article.publishedAt?' · '+dateLabel(article.publishedAt):''}</Copy>
  </View>
}

function ArticleCard({article,onPress}:{article:Article;onPress:()=>void}){
  const {theme}=useDesign()
  return <Pressable accessibilityRole="button" accessibilityLabel={'Read '+article.title} onPress={onPress}>
    <Card style={{gap:8}}>
      {article.status==='draft'&&<Copy size={11} weight={800} color={theme.purple}>DRAFT</Copy>}
      <Text style={{fontFamily:serif,fontSize:21,lineHeight:28,fontWeight:'800',color:theme.text}}>{article.title}</Text>
      {!!article.summary&&<Copy color={theme.muted}>{article.summary}</Copy>}
      <Byline article={article}/>
    </Card>
  </Pressable>
}

function Reader({base,token,demo,id,onBack,onEdit,canEdit}:{base:string;token:string;demo:boolean;id:string;onBack:()=>void;onEdit:(id:string)=>void;canEdit:boolean}){
  const {theme}=useDesign()
  const [article,setArticle]=useState<Article|null>(demo?sampleArticles.find(item=>item.id===id)??null:null)
  const [error,setError]=useState('')
  const [size,setSize]=useState(17)
  useEffect(()=>{
    if(demo)return
    let active=true
    setError('')
    api<Article>(base,'/articles/'+encodeURIComponent(id),{},token).then(value=>{if(active)setArticle(value)}).catch(reason=>{if(active)setError(message(reason))})
    return ()=>{active=false}
  },[base,demo,id,token])
  return <View style={{gap:16,width:'100%',maxWidth:680,alignSelf:'center'}}>
    <View style={{...row,justifyContent:'space-between'}}>
      <Button label="Back to articles" leading="back" variant="plain" onPress={onBack}/>
      <View style={row}>
        <Button label="A−" variant="secondary" disabled={size<=14} onPress={()=>setSize(value=>Math.max(14,value-1))}/>
        <Button label="A+" variant="secondary" disabled={size>=24} onPress={()=>setSize(value=>Math.min(24,value+1))}/>
      </View>
    </View>
    {error?<Card><Copy weight={800}>Couldn’t open this article</Copy><Copy color={theme.muted}>{error}</Copy></Card>
      :!article?<ActivityIndicator accessibilityLabel="Loading article" color={theme.purple}/>
      :<>
        {article.status==='draft'&&<Copy size={12} weight={800} color={theme.purple}>DRAFT · only you can see this</Copy>}
        <Text style={{fontFamily:serif,fontSize:size*1.8,lineHeight:Math.round(size*2.25),fontWeight:'800',color:theme.text}}>{article.title}</Text>
        {!!article.summary&&<Text style={{fontFamily:serif,fontSize:size*1.1,lineHeight:Math.round(size*1.7),color:theme.muted}}>{article.summary}</Text>}
        <Byline article={article}/>
        <View style={{height:1,backgroundColor:theme.border}}/>
        <ArticleBody text={article.body??''} size={size}/>
        {canEdit&&!demo&&<Button label="Edit article" variant="secondary" onPress={()=>onEdit(article.id)}/>}
      </>}
  </View>
}

function Editor({base,token,id,onBack,onSaved}:{base:string;token:string;id?:string;onBack:()=>void;onSaved:(id:string,published:boolean)=>void}){
  const {theme,font}=useDesign()
  const [title,setTitle]=useState(''),[summary,setSummary]=useState(''),[text,setText]=useState('')
  const [published,setPublished]=useState(false)
  const [loading,setLoading]=useState(Boolean(id)),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false)
  const [error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false)
  useEffect(()=>{
    if(!id)return
    let active=true
    api<Article>(base,'/articles/'+encodeURIComponent(id),{},token).then(value=>{
      if(!active)return
      setTitle(value.title);setSummary(value.summary);setText(value.body??'');setPublished(value.status==='published')
    }).catch(reason=>{if(active)setError(message(reason))}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[base,id,token])
  const add=(snippet:string)=>setText(previous=>(previous&&!previous.endsWith('\n\n')?previous+(previous.endsWith('\n')?'\n':'\n\n'):previous)+snippet)
  const words=text.trim().split(/\s+/).filter(Boolean).length
  async function save(publish:boolean){
    if(busy)return
    setBusy(true);setError('')
    try{
      const payload=JSON.stringify({title,summary,body:text,publish})
      const result=id?await api<{id:string}>(base,'/articles/'+encodeURIComponent(id),{method:'PUT',body:payload},token):await api<{id:string}>(base,'/articles',{method:'POST',body:payload},token)
      onSaved(result.id,publish)
    }catch(reason){setError(message(reason))}finally{setBusy(false)}
  }
  async function remove(){
    if(!id||busy)return
    if(!confirmDelete){setConfirmDelete(true);return}
    setBusy(true)
    try{await api(base,'/articles/'+encodeURIComponent(id),{method:'DELETE'},token);onBack()}
    catch(reason){setError(message(reason));setBusy(false)}
  }
  if(loading)return <ActivityIndicator accessibilityLabel="Loading article" color={theme.purple}/>
  return <View style={{gap:14,width:'100%',maxWidth:680,alignSelf:'center'}}>
    <View style={{...row,justifyContent:'space-between'}}>
      <Button label="Back" leading="back" variant="plain" onPress={onBack}/>
      <Segmented options={['Write','Preview']} selected={preview?'Preview':'Write'} onSelect={value=>setPreview(value==='Preview')}/>
    </View>
    {preview?<>
      <Text style={{fontFamily:serif,fontSize:32,lineHeight:40,fontWeight:'800',color:theme.text}}>{title||'Untitled article'}</Text>
      {!!summary&&<Text style={{fontFamily:serif,fontSize:19,lineHeight:29,color:theme.muted}}>{summary}</Text>}
      <View style={{height:1,backgroundColor:theme.border}}/>
      <ArticleBody text={text||'Nothing written yet.'}/>
    </>:<>
      <Field label="Headline" placeholder="A clear, specific title" value={title} onChangeText={setTitle} maxLength={140}/>
      <Field label="Standfirst" placeholder="One sentence that makes people want to read on" value={summary} onChangeText={setSummary} maxLength={240}/>
      <View style={{...row,flexWrap:'wrap',gap:8}}>
        <Button label="Heading" variant="secondary" onPress={()=>add('## ')}/>
        <Button label="Quote" variant="secondary" onPress={()=>add('> ')}/>
        <Button label="List" variant="secondary" onPress={()=>add('- ')}/>
        <Button label="Bold" variant="secondary" onPress={()=>setText(previous=>previous+'**bold text**')}/>
      </View>
      <TextInput accessibilityLabel="Article body" multiline scrollEnabled={false} value={text} onChangeText={setText} maxLength={30000} placeholder={'Start writing…\n\nLeave a blank line between paragraphs.'} placeholderTextColor={theme.muted} textAlignVertical="top"
        style={[{minHeight:300,padding:14,borderRadius:13,borderWidth:1,borderColor:theme.border,backgroundColor:theme.card,color:theme.text,fontFamily:serif,fontSize:17,lineHeight:27},font(500),{fontFamily:serif}]}/>
    </>}
    <Copy size={12} color={theme.muted}>{words.toLocaleString()} {words===1?'word':'words'} · {readTime(text)} min read · Use ## for headings, &gt; for quotes, - for lists and **bold**.</Copy>
    {!!error&&<View accessibilityRole="alert"><Copy color="#D13438" weight={800}>{error}</Copy></View>}
    <View style={{...row,flexWrap:'wrap'}}>
      <Button label={busy?'Saving…':published?'Update article':'Publish'} disabled={busy} onPress={()=>void save(true)}/>
      <Button label={published?'Unpublish to drafts':'Save draft'} variant="secondary" disabled={busy} onPress={()=>void save(false)}/>
      {!!id&&<Button label={confirmDelete?'Tap again to delete':'Delete'} variant="danger" disabled={busy} onPress={()=>void remove()}/>}
    </View>
  </View>
}

export default function Press({base,token,demo}:{base:string;token:string;demo:boolean}){
  const {theme}=useDesign()
  const [screen,setScreen]=useState<Screen>({name:'list'})
  const [canWrite,setCanWrite]=useState(false)
  const [items,setItems]=useState<Article[]|null>(demo?sampleArticles:null)
  const [next,setNext]=useState<string|null>(null)
  const [mine,setMine]=useState<Article[]|null>(null)
  const [error,setError]=useState(''),[more,setMore]=useState(false),[revision,setRevision]=useState(0)
  useEffect(()=>{
    if(demo||!token)return
    let active=true
    api<{canWrite:boolean}>(base,'/articles/access',{},token).then(value=>{if(active)setCanWrite(value.canWrite)}).catch(()=>{})
    return ()=>{active=false}
  },[base,demo,token])
  useEffect(()=>{
    if(demo||screen.name!=='list')return
    let active=true
    setError('')
    api<{items:Article[];nextCursor:string|null}>(base,'/articles',{},token).then(value=>{if(active){setItems(value.items);setNext(value.nextCursor)}}).catch(reason=>{if(active)setError(message(reason))})
    return ()=>{active=false}
  },[base,demo,revision,screen.name,token])
  useEffect(()=>{
    if(demo||screen.name!=='mine')return
    let active=true
    setError('')
    api<Article[]>(base,'/articles/mine',{},token).then(value=>{if(active)setMine(value)}).catch(reason=>{if(active)setError(message(reason))})
    return ()=>{active=false}
  },[base,demo,revision,screen.name,token])
  async function loadMore(){
    if(!next||more)return
    setMore(true)
    try{const value=await api<{items:Article[];nextCursor:string|null}>(base,'/articles?cursor='+encodeURIComponent(next),{},token);setItems(previous=>[...(previous??[]),...value.items]);setNext(value.nextCursor)}
    catch(reason){setError(message(reason))}finally{setMore(false)}
  }
  if(screen.name==='read')return <Reader base={base} token={token} demo={demo} id={screen.id} canEdit={canWrite} onBack={()=>{setRevision(value=>value+1);setScreen({name:screen.back})}} onEdit={id=>setScreen({name:'edit',id})}/>
  if(screen.name==='edit')return <Editor base={base} token={token} id={screen.id} onBack={()=>{setRevision(value=>value+1);setScreen({name:canWrite?'mine':'list'})}} onSaved={(id,published)=>{setRevision(value=>value+1);setScreen(published?{name:'read',id,back:'mine'}:{name:'mine'})}}/>
  const list=screen.name==='mine'?mine:items
  return <View style={{gap:14,width:'100%',maxWidth:680,alignSelf:'center'}}>
    <View style={{gap:4}}>
      <Copy size={22} weight={800}>Press Club</Copy>
      <Copy color={theme.muted}>Stories, opinions and reports written by students.</Copy>
    </View>
    {canWrite&&<View style={{gap:12}}>
      <Segmented options={['Articles','My articles']} selected={screen.name==='mine'?'My articles':'Articles'} onSelect={value=>setScreen({name:value==='My articles'?'mine':'list'})}/>
      <Button label="Write an article" leading="plus" onPress={()=>setScreen({name:'edit'})}/>
    </View>}
    {error?<Card><Copy weight={800}>Couldn’t load articles</Copy><Copy color={theme.muted}>{error}</Copy><Button label="Try again" onPress={()=>setRevision(value=>value+1)}/></Card>
      :!list?<ActivityIndicator accessibilityLabel="Loading articles" color={theme.purple}/>
      :list.length?list.map(article=><ArticleCard key={article.id} article={article} onPress={()=>setScreen({name:'read',id:article.id,back:screen.name==='mine'?'mine':'list'})}/>)
      :<Card><Copy weight={800}>{screen.name==='mine'?'You haven’t written anything yet':'No articles yet'}</Copy><Copy color={theme.muted}>{screen.name==='mine'?'Tap “Write an article” to start your first piece.':'Articles from the Press Club will appear here.'}</Copy></Card>}
    {screen.name==='list'&&!!next&&!error&&<Button label={more?'Loading…':'Load more articles'} variant="secondary" disabled={more} onPress={()=>void loadMore()}/>}
    {!canWrite&&!demo&&<Copy size={12} color={theme.muted}>Want to write for the Press Club? Ask an admin to give your account writer access.</Copy>}
  </View>
}
