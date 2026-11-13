export type CallSignal =
  | {kind:'offer';id:string;video:boolean;sdp:string}
  | {kind:'answer';id:string;sdp:string}
  | {kind:'end'|'busy'|'unavailable';id:string}

export function readCallSignal(value:unknown):CallSignal|null {
  if(!value||typeof value!=='object')return null
  const signal=value as Record<string,unknown>
  if(typeof signal.id!=='string'||!/^[a-z0-9]{12,64}$/.test(signal.id))return null
  if(signal.kind==='end'||signal.kind==='busy'||signal.kind==='unavailable')return {kind:signal.kind,id:signal.id}
  if(typeof signal.sdp!=='string'||signal.sdp.length>32000||!signal.sdp.startsWith('v=0'))return null
  if(signal.kind==='answer')return {kind:'answer',id:signal.id,sdp:signal.sdp}
  if(signal.kind==='offer'&&typeof signal.video==='boolean')return {kind:'offer',id:signal.id,sdp:signal.sdp,video:signal.video}
  return null
}
