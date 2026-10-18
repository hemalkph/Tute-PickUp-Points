import { createHmac, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Staff-only gateway. The browser never sees the Apps Script URL or API_SECRET:
// it logs in here, gets a signed httpOnly cookie, and every other call is forwarded with the secret.
const COOKIE = 'tute_session'
const TTL = 12 * 3600 // seconds; a shift

const { APPS_SCRIPT_URL, API_SECRET, SESSION_SECRET } = process.env

const mac = (s: string) => createHmac('sha256', SESSION_SECRET!).update(s).digest('base64url')

function sign(staff: string) {
  const body = Buffer.from(JSON.stringify({ s: staff, e: Date.now() + TTL * 1000 })).toString('base64url')
  return body + '.' + mac(body)
}

// Staff name from a valid, unexpired cookie, else null
function verify(header = ''): string | null {
  const token = header.split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
  const [body, sig] = (token ?? '').split('.')
  if (!body || !sig) return null
  const want = Buffer.from(mac(body)), got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const { s, e } = JSON.parse(Buffer.from(body, 'base64url').toString())
    return typeof s === 'string' && e > Date.now() ? s : null
  } catch {
    return null
  }
}

const cookie = (v: string, age: number) =>
  `${COOKIE}=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`

// Apps Script answers a POST with a redirect to the JSON; fetch follows it
async function script(body: object) {
  const r = await fetch(APPS_SCRIPT_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain skips a CORS preflight Apps Script can't answer
    body: JSON.stringify({ ...body, secret: API_SECRET }),
  })
  return r.json() as Promise<{ ok: boolean; msg?: string; auth?: boolean; name?: string; center?: string }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, msg: 'POST only' })
  if (!APPS_SCRIPT_URL || !API_SECRET || !SESSION_SECRET) return res.status(500).json({ ok: false, msg: 'Server not configured' })

  const fn = String(req.query.fn)
  const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
  try {
    if (fn === 'logout') {
      res.setHeader('Set-Cookie', cookie('', 0))
      return res.json({ ok: true })
    }
    if (fn === 'login') {
      const ip = String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
      const r = await script({ fn, pin: String(b.pin ?? ''), ip })
      if (r.ok) res.setHeader('Set-Cookie', cookie(sign(r.name!), TTL))
      return res.status(r.ok ? 200 : 401).json(r.ok ? { ok: true, name: r.name, center: r.center } : { ok: false, msg: r.msg })
    }
    if (!['me', 'check', 'collect', 'recent'].includes(fn)) return res.status(404).json({ ok: false, msg: 'Not found' })

    const staff = verify(req.headers.cookie)
    if (!staff) return res.status(401).json({ ok: false, auth: false, msg: 'Please log in' })
    const r = await script({ fn, staff, index: String(b.index ?? ''), picked: b.picked })
    if (r.auth === false) { // staff row removed in the sheet: drop the cookie too
      res.setHeader('Set-Cookie', cookie('', 0))
      return res.status(401).json(r)
    }
    return res.json(r)
  } catch {
    return res.status(502).json({ ok: false, msg: 'Could not reach the pickup sheet – try again' })
  }
}
