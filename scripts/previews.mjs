import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'

const output=resolve(process.argv[2]??'previews')
await mkdir(output,{recursive:true})
const fontLicense=await readFile('packages/core/assets/PLUS-JAKARTA-SANS-OFL.txt','utf8')
const iconLicense=await readFile('packages/core/assets/HUGEICONS-LICENSE.txt','utf8')
const licenseComment='<!-- Embedded Plus Jakarta Sans and Hugeicons licenses\n'+(fontLicense+'\n'+iconLicense).replaceAll('--','–')+'\n-->\n'
const web=await readFile('apps/web/dist/index.html','utf8')
await writeFile(resolve(output,'dameeland-web-preview.html'),web.replace('<html lang="en">',licenseComment+'<html lang="en" data-preview="true">'))

const dir='apps/mobile/dist'
const expo=await readFile(dir+'/index.html','utf8')
const script=expo.match(/<script src="([^"]+)" defer><\/script>/)
if(!script)throw new Error('Expo did not emit its web entry point.')
const bundle=await readFile(dir+script[1],'utf8')
const chunkDir=dirname(script[1])
const chunkFiles=(await readdir(dir+chunkDir)).filter(file=>file.endsWith('.js')&&chunkDir+'/'+file!==script[1])
const chunks=Object.fromEntries(await Promise.all(chunkFiles.map(async file=>{
  const path=chunkDir+'/'+file
  const bytes=await readFile(dir+path)
  return [path,'data:text/javascript;base64,'+bytes.toString('base64')]
})))
const offlineChunks=`<script>
(()=>{
  const chunks=${JSON.stringify(chunks)};
  const pending=new Map();
  const load=globalThis.__loadBundleAsync;
  globalThis.__loadBundleAsync=(path)=>{
    if(!Object.hasOwn(chunks,path))return load(path);
    if(!pending.has(path))pending.set(path,new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.onload=()=>{script.remove();resolve()};
      script.onerror=()=>{script.remove();pending.delete(path);reject(new Error('Unable to load '+path))};
      script.src=chunks[path];
      document.head.appendChild(script);
    }));
    return pending.get(path);
  };
})();
</script>`
const fonts=await Promise.all([['500','Medium'],['700','Bold'],['800','ExtraBold']].map(async ([weight,name])=>{
  const family=`PlusJakartaSans_${weight}${name}`
  const bytes=await readFile(`node_modules/@expo-google-fonts/plus-jakarta-sans/${weight}${name}/${family}.ttf`)
  return `@font-face{font-family:${family};src:url(data:font/ttf;base64,${bytes.toString('base64')}) format("truetype");font-display:swap}`
}))
const interactions=await readFile('apps/web/interactions.css','utf8')
const style='<style>'+interactions+fonts.join('')+'html,body{height:100%;height:100dvh;margin:0;background:#171027}body{display:grid;place-items:center}#root{width:min(390px,100vw);height:min(844px,100dvh);overflow:hidden;box-shadow:0 24px 90px #08051391}@media(min-width:440px) and (min-height:875px){#root{border-radius:30px}}</style>'
const mobile=expo.replace('<html lang="en">',licenseComment+'<html lang="en" data-preview="true">').replace('</head>',style+'</head>').replace(script[0],()=>'<script>'+bundle.replace(/<\/script/gi,'<\\/script')+'</script>'+offlineChunks)
await writeFile(resolve(output,'dameeland-mobile-preview.html'),mobile)
