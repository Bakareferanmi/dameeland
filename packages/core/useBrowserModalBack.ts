import {useLayoutEffect,useRef} from 'react'
import {Platform} from 'react-native'

const marker='dameelandModal'
type Marker={owner:string;depth:number}

export function useBrowserModalBack(depth:number,closeToDepth:(depth:number)=>void){
  const owner=useRef<string|null>(null)
  const returning=useRef(false)

  useLayoutEffect(()=>{
    if(Platform.OS!=='web')return
    owner.current??=Date.now().toString(36)+Math.random().toString(36).slice(2)
    const {history}=window
    const browserDepth=()=>{
      const entry=history.state?.[marker] as Marker|undefined
      return entry?.owner===owner.current?entry.depth:0
    }
    const sync=()=>{
      if(returning.current)return
      const current=browserDepth()
      if(current>depth){
        returning.current=true
        history.go(depth-current)
        return
      }
      for(let next=current+1;next<=depth;next++){
        history.pushState({...history.state,[marker]:{owner:owner.current,depth:next}},'')
      }
    }
    const onBack=()=>{
      const current=browserDepth()
      if(returning.current){
        returning.current=false
        sync()
      }else if(current<depth){
        closeToDepth(current)
      }else if(current>depth){
        // Forward can revisit an old entry after the modal's state was discarded.
        sync()
      }
    }
    window.addEventListener('popstate',onBack)
    sync()
    return ()=>window.removeEventListener('popstate',onBack)
  },[depth,closeToDepth])
}
