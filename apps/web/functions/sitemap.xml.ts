import {publicApi, unavailable, type SearchFunction} from '../publicSearch'

export async function onRequestGet(context: SearchFunction) {
  const section = new URL(context.request.url).searchParams.get('section')
  const result = await publicApi(context, 'sitemap' + (section === null ? '' : '?section=' + encodeURIComponent(section)))
  if (!result.ok) return unavailable('Sitemap unavailable.', result.status === 404 ? 404 : 503)
  return new Response(result.body, {headers: {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store'}})
}
