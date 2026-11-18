const site = 'https://dameen.app'
const defaultApi = 'https://dameeland-api.bakareferanmi96.workers.dev'

export type SearchFunction = {request: Request; env?: {PUBLIC_API_ORIGIN?: string}}

export async function publicApi({env}: SearchFunction, path: string) {
  try {
    return await fetch(new URL('/api/public/' + path, env?.PUBLIC_API_ORIGIN || defaultApi))
  } catch {
    return new Response(null, {status: 503})
  }
}

export function unavailable(message: string, status = 404) {
  return new Response(message, {
    status,
    headers: {'Cache-Control': 'no-store', ...(status === 404 ? {'X-Robots-Tag': 'noindex'} : {})},
  })
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]!)
}

type SearchPage = {
  path: string; title: string; description: string; type: 'profile' | 'article';
  image?: string; wideImage?: boolean; searchPublic: boolean; content: string;
}

export function renderSearchPage(request: Request, page: SearchPage) {
  const indexable = page.searchPublic && new URL(request.url).origin === site
  const robots = indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow'
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)
  const image = escapeHtml(page.image || site + '/og-image.png')
  const url = escapeHtml(site + page.path)
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><meta name="description" content="${description}"><meta name="robots" content="${robots}">
<link rel="canonical" href="${url}"><link rel="icon" type="image/svg+xml" href="/dameeland-logo.svg">
<meta property="og:type" content="${page.type}"><meta property="og:site_name" content="dameen"><meta property="og:title" content="${title}">
<meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="${title}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="${page.wideImage ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">
<style>body{margin:0;background:#faf8ff;color:#201632;font:16px/1.5 system-ui}main{max-width:480px;margin:8vh auto;padding:24px;overflow-wrap:anywhere}.profile{text-align:center}.avatar{width:100px;height:100px;border-radius:50%;object-fit:cover;background:#dfd1ff;margin:auto;display:grid;place-items:center;font-size:34px;font-weight:800}article{background:#fff;padding:24px;border:1px solid #e7def5;border-radius:20px}.post-body{white-space:pre-wrap}.post-media{display:block;width:100%;max-height:72vh;object-fit:contain;border-radius:12px;margin:16px 0}.action{display:inline-block;background:#6a35f0;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none}a{color:#4f25d6}h1{font-size:28px;margin:12px 0}</style></head>
<body><main class="${page.type}">${page.content}</main></body></html>`, {
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': robots},
  })
}
