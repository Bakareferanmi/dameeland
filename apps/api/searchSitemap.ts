const origin = 'https://dameen.app'
const pageSize = 1000
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'

function xml(root: 'sitemapindex' | 'urlset', entry: 'sitemap' | 'url', paths: string[]) {
  const entries = paths.map(path => `<${entry}><loc>${origin}${path}</loc></${entry}>`).join('\n')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="${namespace}">\n${entries}\n</${root}>\n`, {
    headers: {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store'},
  })
}

export async function searchSitemap(db: D1Database, section?: string) {
  if (section === 'site') return xml('urlset', 'url', ['/', '/about/'])

  if (section === undefined) {
    const total = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM users WHERE search_public=1 AND username IS NOT NULL) AS profiles,
      (SELECT COUNT(*) FROM posts WHERE search_public=1) AS posts`).first<{profiles: number; posts: number}>()
    const paths = ['/sitemap.xml?section=site']
    for (const kind of ['profiles', 'posts'] as const) {
      const pages = Math.ceil((total?.[kind] ?? 0) / pageSize)
      for (let page = 1; page <= pages; page++) paths.push(`/sitemap.xml?section=${kind}-${page}`)
    }
    return xml('sitemapindex', 'sitemap', paths)
  }

  const match = /^(profiles|posts)-([1-9]\d{0,4})$/.exec(section)
  if (!match) return new Response('Sitemap unavailable.', {status: 404})
  const profiles = match[1] === 'profiles'
  const query = profiles
    ? 'SELECT username AS slug FROM users WHERE search_public=1 AND username IS NOT NULL ORDER BY username LIMIT ? OFFSET ?'
    : 'SELECT id AS slug FROM posts WHERE search_public=1 ORDER BY id LIMIT ? OFFSET ?'
  const {results} = await db.prepare(query).bind(pageSize, (Number(match[2]) - 1) * pageSize).all<{slug: string}>()
  if (!results.length) return new Response('Sitemap unavailable.', {status: 404})
  const prefix = profiles ? '/u/' : '/p/'
  return xml('urlset', 'url', results.map(({slug}) => prefix + encodeURIComponent(slug)))
}
