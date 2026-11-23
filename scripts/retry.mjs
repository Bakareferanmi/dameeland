// Runs a command and runs it again when it fails because the network dropped.
//
//   node scripts/retry.mjs [--attempts 3] [--delay 5] [--cwd dir] [--interactive] -- command args...
//
// Default mode watches the command's output and only retries when it mentions a network error
// (DNS failures, resets, timeouts). Real failures such as a build error or a login problem stop at once.
// --interactive keeps the terminal attached so prompts still work. The output can't be watched in
// that mode, so it retries once on any failure, except when you press Ctrl+C.
import {spawn} from 'node:child_process'

const args=process.argv.slice(2)
const split=args.indexOf('--')
if(split<0||split===args.length-1){console.error('Usage: node scripts/retry.mjs [options] -- command args...');process.exit(2)}
const options=args.slice(0,split),command=args.slice(split+1)
const option=(name,fallback)=>{const at=options.indexOf(name);return at>=0?options[at+1]:fallback}
const interactive=options.includes('--interactive')
const attempts=Math.max(1,Number(option('--attempts',interactive?2:3)))
const delay=Math.max(0,Number(option('--delay',5)))
const cwd=option('--cwd')

export const networkFailure=/EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EPIPE|UND_ERR|socket hang up|fetch failed|getaddrinfo|network (?:error|request|connection)|connectivity issue|timed? ?out/i
const quote=value=>/[\s"&|<>^()]/.test(value)?'"'+value.replaceAll('"','\\"')+'"':value

function run(){
  return new Promise(resolve=>{
    const child=spawn(command.map(quote).join(' '),{shell:true,cwd,stdio:interactive?'inherit':['inherit','pipe','pipe']})
    let seen=''
    const watch=target=>chunk=>{target.write(chunk);seen=(seen+chunk).slice(-20000)}
    if(!interactive){child.stdout.on('data',watch(process.stdout));child.stderr.on('data',watch(process.stderr))}
    child.on('error',error=>{console.error(error.message);resolve({code:1,seen:String(error)})})
    child.on('close',(code,signal)=>resolve({code:code??1,signal,seen}))
  })
}

let last={code:1}
for(let attempt=1;attempt<=attempts;attempt++){
  last=await run()
  if(last.code===0)process.exit(0)
  const interrupted=!!last.signal||last.code===130
  const retryable=!interrupted&&(interactive||networkFailure.test(last.seen))
  if(!retryable||attempt===attempts)break
  const wait=delay*attempt
  console.error(`\n[retry] Attempt ${attempt} of ${attempts} failed${interactive?'':' on a network error'}. Trying again in ${wait}s...\n`)
  await new Promise(done=>setTimeout(done,wait*1000))
}
if(last.code!==0&&!last.signal&&last.code!==130&&(interactive?attempts>1:networkFailure.test(last.seen)))console.error('\n[retry] Giving up. If this keeps happening, check your internet connection or VPN.')
process.exit(last.code)
