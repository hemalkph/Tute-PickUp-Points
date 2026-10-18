import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, type Res } from './api'
import type { Me } from './App'

type View = { cls: '' | 'ok' | 'no'; name?: string; msg: string; detail?: string; tutes?: string[] }

const tone = { '': '', ok: 'bg-green-100 text-green-900 ring-green-300', no: 'bg-red-100 text-red-900 ring-red-300' }

function detail(r: Res) {
  return [
    [r.nic && 'Check ID: NIC ends ' + r.nic, r.slot && 'Slot: ' + r.slot].filter(Boolean).join(' · '),
    ...(r.done ?? []),
  ].filter(Boolean).join('\n')
}

export default function Scan({ me, prefill, onExit }: { me: Me; prefill: string; onExit: (msg: string) => void }) {
  const [idx, setIdx] = useState(prefill)
  const [view, setView] = useState<View | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const idxRef = useRef<HTMLInputElement>(null)

  async function run(fn: 'check' | 'collect', index: string, tutes?: string[]) {
    if (busy) return
    setBusy(true)
    setView({ cls: '', msg: 'Checking…' })
    const r = await api(fn, { index, picked: tutes })
    setBusy(false)
    if (r.auth === false) return onExit('Session expired – log in again')
    setView({ cls: r.ok ? 'ok' : 'no', name: r.name ? `${r.name} (${r.index})` : '', msg: r.msg, detail: detail(r), tutes: r.tutes })
    setPicked(r.tutes ?? []) // all ticked; untick any that are out of stock
    if (fn === 'collect' && r.ok) { setIdx(''); idxRef.current?.focus() }
  }

  useEffect(() => {
    if (idx.length === 6) run('check', idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onIndex(v: string) {
    v = v.replace(/\D/g, '').slice(0, 6)
    setIdx(v)
    setView(null)
    if (v.length === 6) run('check', v)
  }

  const owed = view?.cls === 'ok' && view.tutes?.length

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Tute Pickup</h1>
          <p className="text-sm text-muted-foreground">{me.center} · {me.name}</p>
        </div>
        <Button variant="outline" onClick={() => api('logout').then(() => onExit(''))}>Log out</Button>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="idx">Student index</Label>
        <Input
          id="idx" ref={idxRef} inputMode="numeric" autoComplete="off" value={idx}
          onChange={e => onIndex(e.target.value)}
          className="h-16 text-center text-3xl tracking-[0.4em] md:text-3xl"
        />
      </div>
      <Button className="h-12 w-full text-base" disabled={busy} onClick={() => run('check', idx)}>Check</Button>

      {view && (
        <Card role="status" aria-live="polite" className={`text-center ring-2 ${tone[view.cls]}`}>
          <CardContent className="space-y-2">
            {view.name && <div className="text-xl font-bold">{view.name}</div>}
            <div className="text-lg">{view.msg}</div>
            {owed ? (
              <div className="space-y-2 text-left">
                {view.tutes!.map(t => (
                  <Label key={t} className="flex items-center gap-3 rounded-lg bg-background p-3 text-xl font-normal text-foreground">
                    <Checkbox
                      className="size-6"
                      checked={picked.includes(t)}
                      onCheckedChange={on => setPicked(p => on ? [...p, t] : p.filter(x => x !== t))}
                    />
                    {t}
                  </Label>
                ))}
              </div>
            ) : null}
            {view.detail && <div className="whitespace-pre-line text-base">{view.detail}</div>}
            {owed ? (
              <Button
                className="h-14 w-full bg-green-700 text-xl hover:bg-green-800"
                disabled={busy || !picked.length}
                onClick={() => run('collect', idx, picked)}
              >
                Give ticked tutes ✓
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
