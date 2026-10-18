import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ShinyText from '@/components/ShinyText'
import { api } from '../api'
import type { Me } from '../App'

const Aurora = lazy(() => import('@/components/Aurora')) // WebGL only on this page

// A student who scans their own QR lands here and learns nothing: no name, center or tutes
export default function Login({ hasQr, note, onLogin }: { hasQr: boolean; note: string; onLogin: (m: Me) => void }) {
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
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#0B1530] p-4">
      <div className="absolute inset-0 opacity-80" aria-hidden>
        <Suspense fallback={null}>
          <Aurora colorStops={['#0A7CFF', '#38BDF8', '#1E3A8A']} amplitude={1.1} blend={0.6} speed={0.6} />
        </Suspense>
      </div>

      <form onSubmit={submit} className="relative w-full max-w-sm space-y-5 rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/logo.png" alt="PA" className="size-24 drop-shadow-[0_0_24px_rgba(56,189,248,.7)]" />
          <h1 className="text-3xl font-semibold">
            <ShinyText text="Tute Pickup" color="#ffffff" shineColor="#7dd3fc" speed={3} />
          </h1>
          <p className="text-sm text-white/75">
            {hasQr ? 'Show this QR code to the staff at your center.' : 'Staff sign-in'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pin" className="text-white/90">Staff PIN</Label>
          <Input
            id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin}
            onChange={e => setPin(e.target.value)}
            className="h-14 border-white/25 bg-white/10 text-center text-2xl tracking-[0.35em] text-white placeholder:text-white/40 md:text-2xl"
          />
          {err && <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-medium text-red-100">{err}</p>}
        </div>

        <Button type="submit" disabled={busy} className="h-14 w-full text-base font-semibold">
          {busy ? 'Checking…' : 'Log in'}
        </Button>
      </form>
    </div>
  )
}
