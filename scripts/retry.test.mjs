import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

// Each run of the fake command appends a line to a counter file, so the test can see how many times it ran.
function retry(extra,script){
  const counter=join(mkdtempSync(join(tmpdir(),'retry-')),'runs.txt')
  writeFileSync(counter,'')
  const child=join(tmpdir(),'retry-child-'+Math.random().toString(36).slice(2)+'.mjs')
  writeFileSync(child,"import {appendFileSync} from 'node:fs'\nappendFileSync(process.argv[2],'x')\n"+script)
  const result=spawnSync(process.execPath,['scripts/retry.mjs','--delay','0',...extra,'--',process.execPath,child,counter],{encoding:'utf8'})
  return {...result,runs:readFileSync(counter,'utf8').length}
}

test('retries a network failure and stops once it works',()=>{
  const result=retry([],"if(process.argv[2]&&(await import('node:fs')).readFileSync(process.argv[2],'utf8').length<3){console.error('getaddrinfo EAI_AGAIN api.expo.dev');process.exit(1)}")
  assert.equal(result.status,0)
  assert.equal(result.runs,3)
})

test('gives up after the last attempt with the same exit code',()=>{
  const result=retry(['--attempts','2'],"console.error('fetch failed');process.exit(7)")
  assert.equal(result.status,7)
  assert.equal(result.runs,2)
})

test('does not retry a real failure',()=>{
  const result=retry([],"console.error('Type error in App.tsx');process.exit(2)")
  assert.equal(result.status,2)
  assert.equal(result.runs,1)
})

test('interactive mode retries once on any failure',()=>{
  const result=retry(['--interactive'],"process.exit(1)")
  assert.equal(result.status,1)
  assert.equal(result.runs,2)
})

test('passes arguments with spaces through',()=>{
  const result=spawnSync(process.execPath,['scripts/retry.mjs','--','node','-e','console.log(process.argv[1])','two words'],{encoding:'utf8'})
  assert.equal(result.status,0)
  assert.equal(result.stdout.trim(),'two words')
})
