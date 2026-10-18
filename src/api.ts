export type Student = { index: string; name: string; center: string; slot: string; qr: string; wa: string }

export type Res = {
  ok: boolean
  msg: string
  auth?: false // session missing or expired
  name?: string
  center?: string
  index?: string
  tutes?: string[]
  done?: string[]
  nic?: string
  slot?: string
}

type Fn = 'login' | 'logout' | 'me' | 'check' | 'collect'

// Everything goes through the Vercel API (api/[fn].ts); the session is an httpOnly cookie
export async function api(fn: Fn, body: object = {}): Promise<Res> {
  if (import.meta.env.MODE === 'mock') return mock(fn, body as any)
  try {
    const r = await fetch('/api/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = (await r.json()) as Res
    return r.status === 401 && fn !== 'login' ? { ...j, auth: false } : j
  } catch {
    return { ok: false, msg: 'No connection – try again' }
  }
}

// `npm run dev` preview with fake data: PIN 123456, index 260001
let loggedIn = false
async function mock(fn: Fn, b: { pin?: string; index?: string; picked?: string[] }): Promise<Res> {
  await new Promise(r => setTimeout(r, 300))
  if (fn === 'login') {
    loggedIn = b.pin === '123456'
    return loggedIn ? { ok: true, msg: '', name: 'Nimal', center: 'Center B' } : { ok: false, msg: 'Wrong PIN' }
  }
  if (fn === 'logout') { loggedIn = false; return { ok: true, msg: '' } }
  if (!loggedIn) return { ok: false, auth: false, msg: 'Please log in' }
  if (fn === 'me') return { ok: true, msg: '', name: 'Nimal', center: 'Center B' }
  if (b.index !== '260001') return { ok: false, msg: 'Index not found' }
  const base = { name: 'Kasun Perera', index: b.index, nic: '5678', slot: 'Sat 21 Sep, 10:30 AM' }
  return fn === 'check'
    ? { ...base, ok: true, msg: 'Give 3 tutes', tutes: ['Tute 02', 'Tute 05', 'Tute 06'], done: ['Has Tute 01 (Center B, 14 Sep)'] }
    : { ...base, ok: true, msg: 'Recorded – given: ' + b.picked!.join(', '), tutes: [] }
}
