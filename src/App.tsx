import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './pages/Login'
import Scan from './pages/Scan'
import Today from './pages/Today'
import Shell from './Shell'

// The QR opens /?i=260001. Take the index out of the address bar straight away so it isn't left in history.
const prefill = (() => {
  const i = (new URLSearchParams(location.search).get('i') || '').replace(/\D/g, '').slice(0, 6)
  if (location.search) history.replaceState(null, '', location.pathname)
  return i
})()

export type Me = { name: string; center: string }
export type Page = 'scan' | 'today'

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined) // undefined = still checking the cookie
  const [note, setNote] = useState('')
  const [page, setPage] = useState<Page>('scan')

  useEffect(() => {
    api('me').then(r => setMe(r.ok ? { name: r.name!, center: r.center! } : null))
  }, [])

  const exit = (msg: string) => { setNote(msg); setMe(null); setPage('scan') }

  if (me === undefined) return null
  if (!me) return <Login hasQr={!!prefill} note={note} onLogin={setMe} />
  return (
    <Shell me={me} page={page} onPage={setPage} onLogout={() => api('logout').then(() => exit(''))}>
      {/* Scan stays mounted so a half-finished check survives a peek at Today */}
      <div hidden={page !== 'scan'}><Scan prefill={prefill} onExit={exit} /></div>
      {page === 'today' && <Today me={me} onExit={exit} />}
    </Shell>
  )
}
