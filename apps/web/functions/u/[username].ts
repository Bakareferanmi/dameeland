const apiOrigin='https://dameeland-api.bakareferanmi96.workers.dev'
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

export async function onRequestGet(context:{params:{username:string};request:Request}){
  const username=context.params.username.toLowerCase()
  if(!/^[a-z0-9_]{3,24}$/.test(username))return new Response('Profile unavailable',{status:404})
  const result=await fetch(apiOrigin+'/api/public/profiles/'+encodeURIComponent(username))
  if(!result.ok)return new Response('Profile unavailable',{status:result.status===404?404:502})
  const profile=await result.json() as {id:string;username:string;bio?:string;avatar?:string;detail:string}
  const title=escapeHtml(profile.username+' on dameen')
  const description=escapeHtml(profile.bio||profile.detail+' on dameen')
  const image=escapeHtml(profile.avatar||'https://dameen.app/og-image.png')
  const url='https://dameen.app/u/'+encodeURIComponent(profile.username)
  const link='/?profile='+encodeURIComponent(profile.id)
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}">
<meta property="og:type" content="profile"><meta property="og:site_name" content="dameen"><meta property="og:title" content="${title}">
<meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">
<style>body{margin:0;background:#faf8ff;color:#201632;font:16px/1.5 system-ui}main{max-width:480px;margin:10vh auto;padding:24px;text-align:center}.avatar{width:100px;height:100px;border-radius:50%;object-fit:cover;background:#dfd1ff;margin:auto;display:grid;place-items:center;font-size:34px;font-weight:800}a{display:inline-block;background:#6a35f0;color:white;padding:12px 24px;border-radius:12px;text-decoration:none}h1{font-size:28px}</style></head>
<body><main>${profile.avatar?`<img class="avatar" src="${image}" alt="${escapeHtml(profile.username)}'s profile photo">`:`<div class="avatar">${escapeHtml(profile.username.slice(0,2).toUpperCase())}</div>`}
<h1>${escapeHtml(profile.username)}</h1><p>${description}</p><a href="${link}">View profile on dameen</a></main></body></html>`
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60'}})
}
