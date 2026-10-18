import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import AnimatedList from '@/components/AnimatedList'
import CountUp from '@/components/CountUp'
import { api, type Res } from '../api'
import type { Me } from '../App'

// What this center has handed out today, newest first. Handy for answering "did she already get hers?"
export default function Today({ me, onExit }: { me: Me; onExit: (msg: string) => void }) {
  const [data, setData] = useState<Res | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    const r = await api('recent')
    setBusy(false)
    if (r.auth === false) return onExit('Session expired – log in again')
    setData(r)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const items = data?.items ?? []

  return (
    <section className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Today at {me.center}</h2>
        <button
          onClick={load}
          disabled={busy}
          aria-label="Refresh"
          className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
        >
          <RefreshCw className={`size-5 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[['tutes handed out', data?.total ?? 0], ['students served', data?.students ?? 0]].map(([label, n]) => (
          <div key={label as string} className="rounded-2xl bg-primary p-4 text-primary-foreground">
            <div className="text-4xl font-semibold tabular-nums">
              <CountUp key={`${label}${n}`} to={n as number} duration={0.9} trigger="load" />
            </div>
            <div className="text-sm text-primary-foreground/85">{label}</div>
          </div>
        ))}
      </div>

      {data && !items.length && (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
          Nothing handed out yet today. Scan a student to get started.
        </p>
      )}

      {items.length > 0 && (
        <AnimatedList
          theme="light"
          frame={false}
          width="100%"
          maxHeight="60dvh"
          showGradients={false}
          enableArrowNavigation={false}
          items={items.map(h => ({ id: h.index + h.time, title: h.name }))}
          renderItem={(_, i) => (
            <div className="flex w-full items-start justify-between gap-3 py-0.5">
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{items[i].name} <span className="font-normal text-muted-foreground">({items[i].index})</span></p>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{items[i].tutes.join(', ')}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{items[i].time}</p>
                <p>{items[i].staff}</p>
              </div>
            </div>
          )}
        />
      )}
    </section>
  )
}
