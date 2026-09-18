import { useMemo, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { catColor } from '../lib.js'

const W = 800
const H = 640
const TICKS = 300

function layout(nodes, edges) {
  const nodeCopies = nodes.map((n) => ({ ...n }))
  const linkCopies = edges.map((e) => ({ ...e }))
  const sim = forceSimulation(nodeCopies)
    .force('charge', forceManyBody().strength((d) => (d.type === 'entity' ? -220 : -90)))
    .force('link', forceLink(linkCopies).id((d) => d.id).distance(70))
    .force('center', forceCenter(W / 2, H / 2))
    .force('collide', forceCollide((d) => (d.type === 'entity' ? 10 + Math.sqrt(d.degree || 1) * 4 : 6)))
    .stop()
  for (let i = 0; i < TICKS; i++) sim.tick()
  return { nodes: nodeCopies, links: linkCopies }
}

function otherEnd(link, id) {
  const s = link.source.id || link.source
  const t = link.target.id || link.target
  return s === id ? t : (t === id ? s : null)
}

function FocusPanel({ id, nodes, links }) {
  const node = nodes.find((n) => n.id === id)
  if (!node) return null
  if (node.type === 'story') {
    return (
      <div className="ofocus">
        <div className="ofocus-title">{node.label}</div>
        <a href={node.id} target="_blank" rel="noopener noreferrer" className="srcbtn">Open source</a>
      </div>
    )
  }
  const connected = links
    .filter((l) => (l.source.id || l.source) === id || (l.target.id || l.target) === id)
    .map((l) => nodes.find((n) => n.id === otherEnd(l, id)))
    .filter(Boolean)
  return (
    <div className="ofocus">
      <div className="ofocus-title">{node.label}</div>
      <ul>
        {connected.map((c) => (
          <li key={c.id}><a href={c.id} target="_blank" rel="noopener noreferrer">{c.label}</a></li>
        ))}
      </ul>
    </div>
  )
}

export default function ObsidianGraph({ graph }) {
  const [focused, setFocused] = useState(null)
  const [query, setQuery] = useState('')

  const { nodes, links } = useMemo(() => {
    if (!graph || !graph.nodes.length) return { nodes: [], links: [] }
    return layout(graph.nodes, graph.edges)
  }, [graph])

  const neighborIds = useMemo(() => {
    if (!focused) return null
    const set = new Set([focused])
    links.forEach((l) => {
      const s = l.source.id || l.source
      const t = l.target.id || l.target
      if (s === focused) set.add(t)
      if (t === focused) set.add(s)
    })
    return set
  }, [focused, links])

  const matchIds = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return new Set(nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id))
  }, [query, nodes])

  if (!graph) return <div className="empty">Loading…</div>
  if (!nodes.length) return <div className="empty">Nothing connected yet.</div>

  const active = matchIds || neighborIds

  return (
    <div className="obsidian-wrap">
      <input
        className="gsearch"
        placeholder="Search entities or stories…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <svg viewBox={'0 0 ' + W + ' ' + H} className="ograph" onClick={() => setFocused(null)}>
        {links.map((l, i) => {
          const s = l.source, t = l.target
          const dim = active && !(active.has(s.id) && active.has(t.id))
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={'oedge' + (dim ? ' dim' : '')} />
        })}
        {nodes.map((n) => {
          const dim = active && !active.has(n.id)
          const r = n.type === 'entity' ? 6 + Math.sqrt(n.degree || 1) * 3 : 5
          return (
            <g
              key={n.id}
              className={'onode' + (dim ? ' dim' : '')}
              transform={'translate(' + n.x + ',' + n.y + ')'}
              onClick={(e) => { e.stopPropagation(); setFocused(n.id) }}
            >
              {n.type === 'entity' ? (
                <rect
                  x={-r} y={-r} width={r * 2} height={r * 2}
                  transform="rotate(45)"
                  className={'oentity' + (n.examTagged ? ' exam' : '')}
                />
              ) : (
                <circle r={r} className="ostory" style={{ fill: catColor(n.category) }} />
              )}
            </g>
          )
        })}
      </svg>
      {focused && <FocusPanel id={focused} nodes={nodes} links={links} />}
    </div>
  )
}
