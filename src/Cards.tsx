import { useEffect, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Student } from './api'

// Error correction "H" survives ~30% damage; the logo covers ~6% of the code, so it still scans.
function draw(s: Student, logo: HTMLImageElement) {
  const qr = qrcode(0, 'H')
  qr.addData(s.qr)
  qr.make()
  const n = qr.getModuleCount(), cell = 10, quiet = 4 * cell, size = n * cell + 2 * quiet
  const c = document.createElement('canvas')
  c.width = size
  c.height = size + 80
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#000'
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
    if (qr.isDark(r, k)) g.fillRect(quiet + k * cell, quiet + r * cell, cell, cell)
  }
  const L = Math.round(n * 0.24) * cell, x = (size - L) / 2
  g.fillStyle = '#fff'
  g.fillRect(x - cell, x - cell, L + 2 * cell, L + 2 * cell)
  g.drawImage(logo, x, x, L, L)
  g.textAlign = 'center'
  g.fillStyle = '#111'
  g.font = 'bold 30px system-ui, sans-serif'
  g.fillText(s.name, size / 2, size + 20, size - 20)
  g.fillStyle = '#555'
  g.font = '24px system-ui, sans-serif'
  g.fillText(s.index + ' · ' + s.center, size / 2, size + 56, size - 20)
  return c.toDataURL('image/png')
}

export default function Cards({ cfg }: { cfg: { students: Student[]; logo: string } }) {
  const [imgs, setImgs] = useState<Record<string, string> | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    const logo = new Image()
    logo.onload = () => setImgs(Object.fromEntries(cfg.students.map(s => [s.index, draw(s, logo)])))
    logo.src = cfg.logo
  }, [cfg])

  const shown = cfg.students.filter(s => (s.name + ' ' + s.index).toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <main className="space-y-3 bg-muted p-4 print:bg-white print:p-0">
      <div className="flex gap-2 print:hidden">
        <Input placeholder="Search name or index" aria-label="Search name or index" value={q} onChange={e => setQ(e.target.value)} />
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">
        {imgs
          ? `${cfg.students.length} students. Download the QR, then tap WhatsApp to open a chat with the message ready, and attach the image.`
          : 'Building QR codes…'}
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 print:gap-1.5">
        {imgs && shown.map(s => (
          <Card key={s.index} className="break-inside-avoid p-2.5 text-center">
            <img src={imgs[s.index]} alt={'QR code for ' + s.index} className="block w-full" />
            <div className="text-xs text-muted-foreground print:hidden">{s.slot ? 'Slot: ' + s.slot : 'No pickup slot set'}</div>
            <div className="flex justify-center gap-1.5 print:hidden">
              <a className={buttonVariants({ size: 'sm' })} href={imgs[s.index]} download={s.index + '.png'}>Download</a>
              {s.wa && (
                <a className={buttonVariants({ size: 'sm' }) + ' bg-green-700 hover:bg-green-800'} href={s.wa} target="_blank" rel="noopener">WhatsApp</a>
              )}
            </div>
          </Card>
        ))}
      </div>
    </main>
  )
}
