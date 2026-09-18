import { useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import { catHue } from '../lib.js'

const W = 700
const H = 560
const TICKS = 400
const POPUP_W = 260
const BBOX_PAD = 140

function layout(nodes, edges) {
  const nodeCopies = nodes.map((n) => ({ ...n }))
  const linkCopies = edges.map((e) => ({ ...e }))
  const sim = forceSimulation(nodeCopies)
    // Entities repel each other hard so hubs never overlap into an
    // unreadable pile; stories barely repel at all, so they hug their hub
    // tightly instead of scattering.
    .force('charge', forceManyBody().strength((d) => (d.type === 'entity' ? -260 : -8)))
    .force('link', forceLink(linkCopies).id((d) => d.id).distance((l) => (l.target.type === 'entity' || l.source.type === 'entity' ? 60 : 60)))
    .force('center', forceCenter(W / 2, H / 2))
    // Without this, disconnected clusters (no story-story edges exist) only
    // repel each other and drift apart indefinitely. Entities get a weak
    // pull so they still spread out; stories get almost none, since their
    // own link force is what should hold them near their hub.
    .force('x', forceX(W / 2).strength((d) => (d.type === 'entity' ? 0.02 : 0.006)))
    .force('y', forceY(H / 2).strength((d) => (d.type === 'entity' ? 0.02 : 0.006)))
    .force('collide', forceCollide((d) => (d.type === 'entity' ? 20 + Math.sqrt(d.degree || 1) * 6 : 6)).iterations(3))
    .stop()
  for (let i = 0; i < TICKS; i++) sim.tick()
  return { nodes: nodeCopies, links: linkCopies }
}

// Nothing gets clipped: the viewBox is sized from the settled nodes'
// actual extent (padded for label text), not a fixed box the layout has to
// fit inside. Overflow is a scrollbar on the container, never lost content.
function boundingViewBox(nodes) {
  if (!nodes.length) return { minX: 0, minY: 0, w: W, h: H }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
  })
  return {
    minX: minX - BBOX_PAD, minY: minY - BBOX_PAD,
    w: (maxX - minX) + BBOX_PAD * 2, h: (maxY - minY) + BBOX_PAD * 2,
  }
}

function otherEnd(link, id) {
  const s = link.source.id || link.source
  const t = link.target.id || link.target
  return s === id ? t : (t === id ? s : null)
}

function FocusPanel({ id, nodes, links, pos, onClose }) {
  const node = nodes.find((n) => n.id === id)
  if (!node) return null
  const style = { left: pos.x, top: pos.y }
  if (node.type === 'story') {
    return (
      <div className="ofocus" style={style}>
        <button className="ofocus-close" onClick={onClose} aria-label="Close">×</button>
        <div className="ofocus-title">{node.label}</div>
        <div className="ofocus-meta">{node.category}{node.date ? ' · ' + String(node.date).slice(0, 10) : ''}</div>
        <a href={node.id} target="_blank" rel="noopener noreferrer" className="srcbtn">Open source</a>
      </div>
    )
  }
  const connected = links
    .filter((l) => (l.source.id || l.source) === id || (l.target.id || l.target) === id)
    .map((l) => nodes.find((n) => n.id === otherEnd(l, id)))
    .filter(Boolean)
  return (
    <div className="ofocus" style={style}>
      <button className="ofocus-close" onClick={onClose} aria-label="Close">×</button>
      <div className="ofocus-title">{node.label}</div>
      <div className="ofocus-meta">{connected.length} connected {connected.length === 1 ? 'story' : 'stories'}</div>
      <ul>
        {connected.map((c) => (
          <li key={c.id}><a href={c.id} target="_blank" rel="noopener noreferrer">{c.label}</a></li>
        ))}
      </ul>
    </div>
  )
}

export default function ObsidianGraph({ graph }) {
  const wrapRef = useRef(null)
  const [focused, setFocused] = useState(null)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })
  const [query, setQuery] = useState('')

  const { nodes, links } = useMemo(() => {
    if (!graph || !graph.nodes.length) return { nodes: [], links: [] }
    return layout(graph.nodes, graph.edges)
  }, [graph])

  const box = useMemo(() => boundingViewBox(nodes), [nodes])

  const hues = useMemo(() => {
    const set = new Set()
    nodes.forEach((n) => { if (n.type === 'story') set.add(catHue(n.category)) })
    return [...set]
  }, [nodes])

  // Every entity gets its own distinct vivid hue (hashed from its own name,
  // not a shared amber for all of them) so hubs are actually distinguishable
  // at a glance. Exam-tagged ones are marked with a bright ring instead of
  // taking over the whole fill color.
  const entityHues = useMemo(() => {
    const set = new Set()
    nodes.forEach((n) => { if (n.type === 'entity') set.add(catHue(n.label)) })
    return [...set]
  }, [nodes])

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

  function pickNode(e, id) {
    e.stopPropagation()
    const wrapRect = wrapRef.current.getBoundingClientRect()
    let x = e.clientX - wrapRect.left + 12
    let y = e.clientY - wrapRect.top + 12
    x = Math.min(x, wrapRect.width - POPUP_W - 8)
    y = Math.min(y, wrapRect.height - 40)
    setPopupPos({ x: Math.max(8, x), y: Math.max(8, y) })
    setFocused(id)
  }

  const svgW = Math.max(box.w, W)
  const svgH = Math.max(box.h, H)

  return (
    <div className="obsidian-wrap" ref={wrapRef}>
      <input
        className="gsearch"
        placeholder="Search entities or stories…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="ograph-scroll">
        <svg
          viewBox={box.minX + ' ' + box.minY + ' ' + box.w + ' ' + box.h}
          width={svgW}
          height={svgH}
          className="ograph"
          onClick={() => setFocused(null)}
        >
          <defs>
            {hues.map((hue) => (
              <radialGradient key={'s' + hue} id={'grad-cat-' + hue} cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor={'hsl(' + hue + ' 75% 74%)'} />
                <stop offset="60%" stopColor={'hsl(' + hue + ' 65% 55%)'} />
                <stop offset="100%" stopColor={'hsl(' + hue + ' 55% 36%)'} />
              </radialGradient>
            ))}
            {entityHues.map((hue) => (
              <radialGradient key={'e' + hue} id={'grad-ent-' + hue} cx="32%" cy="26%" r="80%">
                <stop offset="0%" stopColor={'hsl(' + hue + ' 90% 82%)'} />
                <stop offset="55%" stopColor={'hsl(' + hue + ' 80% 62%)'} />
                <stop offset="100%" stopColor={'hsl(' + hue + ' 70% 38%)'} />
              </radialGradient>
            ))}
          </defs>

          {links.map((l, i) => {
            const s = l.source, t = l.target
            const dim = active && !(active.has(s.id) && active.has(t.id))
            return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={'oedge' + (dim ? ' dim' : '')} />
          })}

          {nodes.map((n) => {
            const dim = active && !active.has(n.id)
            const r = n.type === 'entity' ? 16 + Math.sqrt(n.degree || 1) * 5 : 6
            const fill = n.type === 'entity'
              ? 'url(#grad-ent-' + catHue(n.label) + ')'
              : 'url(#grad-cat-' + catHue(n.category) + ')'
            return (
              <g
                key={n.id}
                className={'onode' + (dim ? ' dim' : '')}
                transform={'translate(' + n.x + ',' + n.y + ')'}
                onClick={(e) => pickNode(e, n.id)}
              >
                <title>{n.label}</title>
                {n.type === 'entity' ? (
                  <rect
                    x={-r} y={-r} width={r * 2} height={r * 2}
                    rx={4}
                    transform="rotate(45)"
                    className={'oentity' + (n.examTagged ? ' exam' : '')}
                    style={{ fill }}
                  />
                ) : (
                  <circle r={r} className="ostory" style={{ fill }} />
                )}
                {n.type === 'entity' && (
                  <text x={r + 8} y={4} className={'olabel entity' + (dim ? ' dim' : '')}>{n.label}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {focused && (
        <FocusPanel id={focused} nodes={nodes} links={links} pos={popupPos} onClose={() => setFocused(null)} />
      )}
    </div>
  )
}
