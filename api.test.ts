// Run: node api.test.ts — exercises api/[fn].ts against a fake Apps Script server
import assert from 'node:assert'
import http from 'node:http'
import { createHmac } from 'node:crypto'

const calls: any[] = []
const fake = http.createServer((req, res) => {
  let d = ''
  req.on('data', c => (d += c))
  req.on('end', () => {
    const b = JSON.parse(d)
    calls.push(b)
    const out =
      b.secret !== 'sec' ? { ok: false, msg: 'Forbidden' }
      : b.fn === 'login' ? (b.pin === '123456' ? { ok: true, name: 'Nimal', center: 'Center B' } : { ok: false, msg: 'Wrong PIN' })
      : b.staff !== 'Nimal' ? { ok: false, auth: false, msg: 'Session expired – log in again' }
      : { ok: true, msg: 'Give 1 tute', tutes: ['Tute 01'], index: b.index }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(out))
  })
})
await new Promise<void>(r => fake.listen(0, r))
process.env.APPS_SCRIPT_URL = `http://localhost:${(fake.address() as any).port}`
process.env.API_SECRET = 'sec'
process.env.SESSION_SECRET = 'session-secret'
const { default: handler } = await import('./api/[fn].ts')

async function call(fn: string, body: object = {}, cookie = '', method = 'POST') {
  const out: any = { headers: {} as Record<string, string> }
  const res: any = {
    setHeader: (k: string, v: string) => (out.headers[k] = v),
    status: (c: number) => ((out.status = c), res),
    json: (j: any) => ((out.body = j), out),
  }
  await handler({ method, query: { fn }, body, headers: { cookie, 'x-real-ip': '1.2.3.4' } } as any, res)
  out.status ??= 200
  return out
}
const session = (r: any) => r.headers['Set-Cookie'].split(';')[0]

assert.strictEqual((await call('check', {}, '', 'GET')).status, 405)
assert.strictEqual((await call('check', { index: '260001' })).status, 401, 'no cookie → 401')
assert.strictEqual(calls.length, 0, 'unauthenticated calls never reach the sheet')
assert.strictEqual((await call('check', {}, 'tute_session=forged.sig')).status, 401)

let r = await call('login', { pin: '000000' })
assert.strictEqual(r.status, 401)
assert.ok(!r.headers['Set-Cookie'], 'wrong PIN sets no cookie')

r = await call('login', { pin: '123456' })
assert.strictEqual(r.status, 200)
assert.match(r.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/)
assert.strictEqual(calls.at(-1).ip, '1.2.3.4')
const c = session(r)

r = await call('check', { index: '260001' }, c)
assert.strictEqual(r.body.ok, true)
assert.strictEqual(calls.at(-1).staff, 'Nimal')
assert.strictEqual(calls.at(-1).secret, 'sec')

// Tampered cookie body (another staff name, same signature) is rejected
const [, sig] = c.split('=')[1].split('.')
const evil = Buffer.from(JSON.stringify({ s: 'Admin', e: Date.now() + 1e6 })).toString('base64url')
assert.strictEqual((await call('check', { index: '260001' }, `tute_session=${evil}.${sig}`)).status, 401)

// Valid cookie for staff who was removed from the sheet → 401 and the cookie is cleared
const body = Buffer.from(JSON.stringify({ s: 'Ghost', e: Date.now() + 1e6 })).toString('base64url')
const ghost = `tute_session=${body}.${createHmac('sha256', 'session-secret').update(body).digest('base64url')}`
const gone = await call('me', {}, ghost)
assert.strictEqual(gone.status, 401)
assert.match(gone.headers['Set-Cookie'], /Max-Age=0/)

// Expired cookie
const old = Buffer.from(JSON.stringify({ s: 'Nimal', e: Date.now() - 1 })).toString('base64url')
assert.strictEqual((await call('me', {}, `tute_session=${old}.${createHmac('sha256', 'session-secret').update(old).digest('base64url')}`)).status, 401)

assert.strictEqual((await call('nope', {}, c)).status, 404)
assert.match((await call('logout', {}, c)).headers['Set-Cookie'], /Max-Age=0/)

fake.close()
console.log('api ok')
