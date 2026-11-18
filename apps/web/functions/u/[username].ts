import {escapeHtml, publicApi, renderSearchPage, unavailable, type SearchFunction} from '../../publicSearch'

export async function onRequestGet(context: SearchFunction & {params: {username: string}}) {
  const username = context.params.username.toLowerCase()
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return unavailable('Profile unavailable.')
  const result = await publicApi(context, 'profiles/' + encodeURIComponent(username))
  if (!result.ok) return unavailable('Profile unavailable.', result.status === 404 ? 404 : 503)

  const profile = await result.json() as {id: string; username: string; bio?: string; avatar?: string; detail: string; searchPublic?: boolean}
  const handle = escapeHtml(profile.username)
  const avatar = profile.avatar
    ? `<img class="avatar" src="${escapeHtml(profile.avatar)}" alt="${handle}'s profile photo">`
    : `<div class="avatar" aria-hidden="true">${handle.slice(0, 2).toUpperCase()}</div>`
  const description = profile.bio || profile.detail + ' on dameen'
  const link = '/?profile=' + encodeURIComponent(profile.id)
  return renderSearchPage(context.request, {
    path: '/u/' + encodeURIComponent(profile.username), title: profile.username + ' on dameen',
    description, image: profile.avatar, type: 'profile', searchPublic: profile.searchPublic === true,
    content: `${avatar}<h1>${handle}</h1><p>${escapeHtml(description)}</p><a class="action" href="${link}">View profile on dameen</a>`,
  })
}
