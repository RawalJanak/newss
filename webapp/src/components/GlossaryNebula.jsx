import { useMemo, useState } from 'react'

export default function GlossaryNebula({ data }) {
  const [q, setQ] = useState('')
  const all = useMemo(() => {
    const seen = new Set(), out = []
    data.forEach((a) => {
      ;(a.terms || []).forEach((t) => {
        const k = t.term.toLowerCase()
        if (seen.has(k)) return
        seen.add(k)
        out.push({ term: t.term, meaning: t.meaning })
      })
    })
    out.sort((x, y) => x.term.localeCompare(y.term))
    return out
  }, [data])

  const f = q ? all.filter((t) => (t.term + ' ' + t.meaning).toLowerCase().includes(q.toLowerCase())) : all

  return (
    <div className="mobile-list">
      <input className="gsearch" placeholder="Search a word, e.g. WPI or hydraulic" value={q} onChange={(e) => setQ(e.target.value)} />
      {f.length
        ? f.map((t, i) => <div className="gitem" key={i}><b>{t.term}</b><span>{t.meaning}</span></div>)
        : <div className="empty">No match.</div>}
    </div>
  )
}
