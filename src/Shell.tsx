import type { ReactNode } from 'react'
import { History, LogOut, ScanLine } from 'lucide-react'
import type { Me, Page } from './App'

const tabs: { id: Page; label: string; icon: typeof ScanLine }[] = [
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'today', label: 'Today', icon: History },
]

// Top bar with the logo and who is signed in; bottom tabs so the thumb never leaves the lower half of the phone
export default function Shell({ me, page, onPage, onLogout, children }: {
  me: Me; page: Page; onPage: (p: Page) => void; onLogout: () => void; children: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-background/85 px-4 py-3 backdrop-blur">
        <img src="/logo.png" alt="" className="size-10 drop-shadow-[0_0_12px_rgba(10,124,255,.45)]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-tight">Tute Pickup</h1>
          <p className="truncate text-sm text-muted-foreground">{me.center} · {me.name}</p>
        </div>
        <button
          onClick={onLogout}
          aria-label="Log out"
          className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <LogOut className="size-5" />
        </button>
      </header>

      <main className="flex-1 px-4 pb-28">{children}</main>

      <nav aria-label="Pages" className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => onPage(t.id)}
              aria-current={page === t.id ? 'page' : undefined}
              className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                page === t.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <t.icon className="size-6" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
