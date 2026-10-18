import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from './api'
import Scan from './Scan'

// The QR opens /?i=260001. Take the index out of the address bar straight away so it isn't left in history.
const prefill = (() => {
  const i = (new URLSearchParams(location.search).get('i') || '').replace(/\D/g, '').slice(0, 6)
  if (location.search) history.replaceState(null, '', location.pathname)
  return i
})()

export type Me = { name: string; center: string }

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined) // undefined = still checking the cookie
  const [note, setNote] = useState('')

  useEffect(() => {
    api('me').then(r => setMe(r.ok ? { name: r.name!, center: r.center! } : null))
  }, [])

  if (me === undefined) return null
  if (me) return <Scan me={me} prefill={prefill} onExit={msg => { setNote(msg); setMe(null) }} />
  return <Login hasQr={!!prefill} note={note} onLogin={setMe} />
}

// A student who scans their own QR lands here and learns nothing: no name, no center, no tutes
function Login({ hasQr, note, onLogin }: { hasQr: boolean; note: string; onLogin: (m: Me) => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(note)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim() || busy) return
    setBusy(true)
    const r = await api('login', { pin })
    setBusy(false)
    if (r.ok) onLogin({ name: r.name!, center: r.center! })
    else { setErr(r.msg); setPin('') }
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-bold">Tute Pickup</h1>
      <Card>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {hasQr ? 'Show this QR code to the staff at your center.' : 'Staff only.'}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="pin">Staff PIN</Label>
              <Input id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} />
            </div>
            {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
            <Button type="submit" className="h-12 w-full text-base" disabled={busy}>Log in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
