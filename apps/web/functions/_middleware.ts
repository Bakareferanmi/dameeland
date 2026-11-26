// Security headers for every response served from dameen.app: the app shell, the /p and /u pages, the sitemap and the Google callback.
// They live here rather than in _headers because _headers does not apply to Function responses.
interface Env {PUBLIC_API_ORIGIN?: string; CSP_MODE?: string}

const defaultApi = 'https://dameeland-api.bakareferanmi96.workers.dev'

// The app talks to one API origin: fetch and WebSocket for data, and plain <img>/<video>/<audio> for uploaded media.
// If the API ever moves to its own domain, set PUBLIC_API_ORIGIN for this project (the other functions read it too) or change defaultApi, or the app's requests will be blocked.
const appPolicy = (api: string) => [
  "default-src 'self'",
  "script-src 'self'",
  // React Native Web writes inline style attributes and a runtime stylesheet, so styles need 'unsafe-inline'. Scripts do not.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${api}`,
  `media-src 'self' data: blob: ${api}`,
  "font-src 'self' data:",
  `connect-src 'self' ${api} ${api.replace(/^http/, 'ws')}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

// The Google callback page is built from fixed strings (nothing from the request is echoed) and needs one inline redirect script.
const callbackPolicy = "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

// Set only when the response does not already carry the header, so a Function can still choose its own value.
const baseline: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), bluetooth=(), display-capture=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000',
}

export async function onRequest({request, env, next}: {request: Request; env?: Env; next: () => Promise<Response>}) {
  const response = await next()
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(baseline)) if (!headers.has(name)) headers.set(name, value)
  if ((headers.get('Content-Type') ?? '').includes('text/html')) {
    const policy = new URL(request.url).pathname.startsWith('/api/google/callback') ? callbackPolicy : appPolicy((env?.PUBLIC_API_ORIGIN || defaultApi).replace(/\/$/, ''))
    // Report-only logs violations in the browser console without blocking anything. Set CSP_MODE=enforce once the console is clean.
    headers.set(env?.CSP_MODE === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', policy)
  }
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers})
}
