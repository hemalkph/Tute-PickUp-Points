import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CountUp from '@/components/CountUp'
import ShinyText from '@/components/ShinyText'
import SpotlightCard from '@/components/SpotlightCard'
import { api, type Res } from '../api'

type View = { kind: 'busy' | 'ok' | 'no' | 'done'; r?: Res }

export default function Scan({ prefill, onExit }: { prefill: string; onExit: (msg: string) => void }) {
  const [idx, setIdx] = useState(prefill)
  const [view, setView] = useState<View | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const idxRef = useRef<HTMLInputElement>(null)

  async function run(fn: 'check' | 'collect', index: string, tutes?: string[]) {
    if (busy) return
    setBusy(true)
    setView({ kind: 'busy' })
    const r = await api(fn, { index, picked: tutes })
    setBusy(false)
    if (r.auth === false) return onExit('Session expired – log in again')
    setPicked(r.tutes ?? []) // all ticked; untick any that are out of stock
    if (fn === 'collect' && r.ok) setIdx('')
    setView({ kind: !r.ok ? 'no' : fn === 'collect' ? 'done' : 'ok', r })
  }

  useEffect(() => {
    if (idx.length === 6) run('check', idx)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onIndex(v: string) {
    v = v.replace(/\D/g, '').slice(0, 6)
    setIdx(v)
    setView(null)
    if (v.length === 6) run('check', v)
  }

  const r = view?.r

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="idx" className="text-base">Student index</Label>
        <Input
          id="idx" ref={idxRef} inputMode="numeric" autoComplete="off" placeholder="000000" value={idx}
          onChange={e => onIndex(e.target.value)}
          className="h-20 rounded-2xl bg-card text-center text-4xl font-semibold tracking-[0.35em] md:text-4xl"
        />
        {!view && <p className="text-center text-sm text-muted-foreground">Scan the QR with the camera, or type the 6 digits.</p>}
      </div>

      {view?.kind === 'busy' && (
        <div className="rounded-3xl bg-card p-8 text-center text-xl font-medium">
          <ShinyText text="Checking…" color="#64748b" shineColor="#0A7CFF" speed={1.6} />
        </div>
      )}

      {view?.kind === 'no' && r && (
        <div role="status" className="space-y-3 rounded-3xl bg-red-50 p-6 text-red-950 ring-2 ring-red-300">
          <CircleX className="size-12 text-red-600" />
          <div>
            {r.name && <p className="text-sm font-medium text-red-800">{r.name} ({r.index})</p>}
            <p className="text-2xl font-semibold leading-snug">{r.msg}</p>
          </div>
          <Done list={r.done} tone="text-red-900/80" />
        </div>
      )}

      {view?.kind === 'ok' && r && (
        <SpotlightCard
          theme="light"
          spotlightColor="rgba(22,163,74,0.28)"
          className="space-y-5 rounded-3xl bg-green-50 p-6 text-green-950 ring-2 ring-green-300"
        >
          <div role="status" className="space-y-1">
            <p className="text-lg font-semibold">{r.name} <span className="font-normal text-green-900/70">({r.index})</span></p>
            <div className="flex items-end gap-3">
              <span className="text-7xl font-semibold leading-none tabular-nums text-green-700">
                <CountUp key={r.index} to={r.tutes!.length} duration={0.7} trigger="load" />
              </span>
              <span className="pb-1.5 text-xl font-medium">tute{r.tutes!.length > 1 ? 's' : ''} to give</span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-[#0B1530] p-4 text-white">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-sky-300" />
            <div>
              <p className="text-lg font-semibold">Check ID: NIC ends {r.nic}</p>
              {r.slot && <p className="text-sm text-white/70">Slot: {r.slot}</p>}
            </div>
          </div>

          <div className="space-y-2">
            {r.tutes!.map(t => (
              <Label key={t} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white p-3 text-lg font-medium text-foreground shadow-sm">
                <Checkbox
                  className="size-7"
                  checked={picked.includes(t)}
                  onCheckedChange={on => setPicked(p => (on ? [...p, t] : p.filter(x => x !== t)))}
                />
                {t}
              </Label>
            ))}
          </div>
          <Done list={r.done} tone="text-green-900/70" />

          <Button
            className="h-16 w-full bg-green-700 text-xl font-semibold hover:bg-green-800"
            disabled={busy || !picked.length}
            onClick={() => run('collect', idx, picked)}
          >
            Give {picked.length} ticked tute{picked.length === 1 ? '' : 's'}
          </Button>
        </SpotlightCard>
      )}

      {view?.kind === 'done' && r && (
        <div role="status" className="space-y-3 rounded-3xl bg-green-50 p-6 text-green-950 ring-2 ring-green-300">
          <CircleCheck className="size-12 text-green-600" />
          <p className="text-2xl font-semibold leading-snug">{r.msg}</p>
          <Done list={r.done} tone="text-green-900/70" />
          <Button className="h-14 w-full text-lg" onClick={() => { setView(null); idxRef.current?.focus() }}>Next student</Button>
        </div>
      )}
    </div>
  )
}

function Done({ list, tone }: { list?: string[]; tone: string }) {
  if (!list?.length) return null
  return <ul className={`space-y-1 text-sm ${tone}`}>{list.map(d => <li key={d}>{d}</li>)}</ul>
}
