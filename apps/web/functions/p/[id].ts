import {escapeHtml, publicApi, renderSearchPage, unavailable, type SearchFunction} from '../../publicSearch'

export async function onRequestGet(context: SearchFunction & {params: {id: string}}) {
  const id = context.params.id
  if (!/^[a-z0-9-]{8,80}$/i.test(id)) return unavailable('Post unavailable.')
  const result = await publicApi(context, 'posts/' + encodeURIComponent(id))
  if (!result.ok) return unavailable('Post unavailable.', result.status === 404 ? 404 : 503)

  const post = await result.json() as {
    id: string; body: string; created?: string; username: string; handle?: string | null;
    media?: string; image?: string; avatar?: string; kind?: 'image' | 'video'; searchPublic?: boolean;
  }
  const searchPublic = post.searchPublic === true
  const author = (searchPublic ? post.handle : post.username) || 'A dameen member'
  const heading = 'Post by ' + author + ' on dameen'
  const summary = Array.from(post.body.replace(/\s+/g, ' ').trim())
  const description = summary.slice(0, 160).join('') || heading
  const title = summary.length ? summary.slice(0, 65).join('') + (summary.length > 65 ? '…' : '') + ' | dameen' : heading
  const date = post.created ? new Intl.DateTimeFormat('en', {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(post.created)) : ''
  const timestamp = date && post.created ? `<time datetime="${escapeHtml(post.created)}">${date}</time>` : ''
  const body = post.body ? `<p class="post-body">${escapeHtml(post.body)}</p>` : ''
  const source = post.media || post.image
  const src = source ? escapeHtml(source) : ''
  const kind = post.kind || (post.image ? 'image' : undefined)
  let media = ''
  if (src && kind === 'image') media = `<img class="post-media" src="${src}" alt="Photo shared by ${escapeHtml(author)}">`
  if (src && kind === 'video') media = `<video class="post-media" src="${src}" controls playsinline preload="metadata" aria-label="Video shared by ${escapeHtml(author)}"></video>`
  return renderSearchPage(context.request, {
    path: '/p/' + encodeURIComponent(post.id), title, description, type: 'article', searchPublic,
    image: kind === 'image' ? source : searchPublic ? undefined : post.avatar,
    wideImage: kind === 'image' && Boolean(source),
    content: `<article><h1>${escapeHtml(heading)}</h1>${timestamp}${body}${media}
<a class="action" href="/?post=${encodeURIComponent(post.id)}">Open post on dameen</a></article>`,
  })
}
