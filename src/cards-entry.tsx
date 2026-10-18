import { createRoot } from 'react-dom/client'
import './index.css'
import Cards from './Cards'
import type { Student } from './api'

// Built into apps-script/Cards.html and shown in a Sheet dialog; Apps Script injects window.CFG
declare global { interface Window { CFG?: { students: Student[]; logo: string } } }

// `npm run dev` → /cards.html previews it with one sample student
const cfg = window.CFG ?? {
  logo: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  students: [{ index: '260001', name: 'Kasun Perera', center: 'Center B', slot: 'Sat 21 Sep, 10:30 AM', qr: 'https://example.vercel.app/?i=260001', wa: 'https://wa.me/94771234567' }],
}

createRoot(document.getElementById('root')!).render(<Cards cfg={cfg} />)
