type Env = {PUBLIC_API_ORIGIN?: string}

const defaultApi = 'https://dameeland-api.bakareferanmi96.workers.dev'

export async function onRequestGet(context: {request: Request; env?: Env}) {
  const requestUrl = new URL(context.request.url)
  const target = new URL('/api/google/callback', context.env?.PUBLIC_API_ORIGIN || defaultApi)
  target.search = requestUrl.search
  const response = await fetch(target, {headers: {'Accept': 'text/html'}})
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(response.body, {status: response.status, headers})
}
