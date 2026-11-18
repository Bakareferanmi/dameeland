const apiOrigin='https://dameeland-api.bakareferanmi96.workers.dev'
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

export async function onRequestGet(context:{params:{id:string}}){
  const id=context.params.id
  if(!/^[a-z0-9-]{8,80}$/i.test(id))return new Response('Post unavailable',{status:404})
  const result=await fetch(apiOrigin+'/api/public/posts/'+encodeURIComponent(id))
  if(!result.ok)return new Response('Post unavailable',{status:result.status===404?404:502})
  const post=await result.json() as {id:string;body:string;username:string;avatar?:string;image?:string}
  const handle=escapeHtml(post.username)
  const title=escapeHtml(post.username+' on dameen')
  const description=escapeHtml((post.body||'See this post on dameen').slice(0,240))
  const image=escapeHtml(post.image||post.avatar||'https://dameen.app/og-image.png')
  const url='https://dameen.app/p/'+encodeURIComponent(post.id)
  const link='/?post='+encodeURIComponent(post.id)
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="dameen"><meta property="og:title" content="${title}">
<meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="Post by ${handle} on dameen"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="${post.image?'summary_large_image':'summary'}"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">
<style>body{margin:0;background:#faf8ff;color:#201632;font:16px/1.5 system-ui}main{max-width:560px;margin:9vh auto;padding:24px}.card{background:white;padding:24px;border:1px solid #e7def5;border-radius:20px;box-shadow:0 12px 35px #25104610}h1{font-size:21px;margin:0 0 12px}.photo{width:100%;max-height:440px;object-fit:cover;border-radius:14px}p{white-space:pre-wrap;overflow-wrap:anywhere}a{display:inline-block;background:#6a35f0;color:white;padding:12px 24px;border-radius:12px;text-decoration:none}</style></head>
<body><main><div class="card"><h1>${handle} on dameen</h1><p>${description}</p>${post.image?`<img class="photo" src="${image}" alt="Post by ${handle}">`:''}<p><a href="${link}">Open post on dameen</a></p></div></main></body></html>`
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60'}})
}
