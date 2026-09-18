import { useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import { pickColor } from '../lib.js'

const W = 700
const H = 560
const TICKS = 400
const POPUP_W = 260
const BBOX_PAD = 60
const LABEL_H = 16

function layout(nodes, edges) {
  const nodeCopies = nodes.map((n) => ({
    ...n,
    r: n.type === 'entity' ? 5 + Math.sqrt(n.degree || 1) * 2.4 : 4,
  }))
  const linkCopies = edges.map((e) => ({ ...e }))
  const sim = forceSimulation(nodeCopies)
    // Entities repel each other so clusters stay visually separate; stories
    // repel their siblings just enough to fan out into a readable spread
    // instead of piling on top of each other.
    .force('charge', forceManyBody().strength((d) => (d.type === 'entity' ? -240 : -16)))
    .force('link', forceLink(linkCopies).id((d) => d.id).distance((l) => ((l.source.type === 'entity' || l.target.type === 'entity') ? 42 : 42)))
    .force('center', forceCenter(W / 2, H / 2))
    // Without this, disconnected clusters (no story-story edges exist) only
    // repel each other and drift apart indefinitely -- a strong enough pull
    // here is what keeps a lightly-connected cluster (like a single-story
    // entity) from ending up stranded far from everything else. Stories
    // get almost none, since the link force above is what holds their
    // cloud shape together.
    .force('x', forceX(W / 2).strength((d) => (d.type === 'entity' ? 0.05 : 0.004)))
    .force('y', forceY(H / 2).strength((d) => (d.type === 'entity' ? 0.05 : 0.004)))
    .force('collide', forceCollide((d) => d.r + (d.type === 'entity' ? 1.5 : 3)).iterations(3))
    .stop()
  for (let i = 0; i < TICKS; i++) sim.tick()
  return { nodes: nodeCopies, links: linkCopies }
}

// Each story is colored by the first entity it's connected to, so a
// cluster reads as one dominant color instead of a mix of unrelated hues.
function primaryEntityByStory(edges) {
  const map = new Map()
  edges.forEach((e) => {
    if (!map.has(e.source)) map.set(e.source, e.target)
  })
  return map
}

function estCharWidth(s) {
  return String(s).length * 6.6 + 10
}

// Labels start anchored just above each entity's own node (not the whole
// cluster, which can be wide and drift into a neighbor's space), then a
// short separation pass nudges any pair whose boxes still overlap apart --
// the actual cause of the earlier overlapping-text problem.
function resolveLabelPositions(entityNodes) {
  const labels = entityNodes.map((n) => ({
    id: n.id, w: estCharWidth(n.label), h: LABEL_H,
    x: n.x, y: n.y - n.r - 10,
  }))
  for (let pass = 0; pass < 40; pass++) {
    let moved = false
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i], b = labels[j]
        const dx = Math.abs(a.x - b.x)
        const dy = Math.abs(a.y - b.y)
        const overlapX = (a.w + b.w) / 2 - dx
        const overlapY = (a.h + b.h) / 2 - dy
        if (overlapX > 0 && overlapY > 0) {
          moved = true
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 1
            if (a.x < b.x) { a.x -= push; b.x += push } else { a.x += push; b.x -= push }
          } else {
            const push = overlapY / 2 + 1
            if (a.y < b.y) { a.y -= push; b.y += push } else { a.y += push; b.y -= push }
          }
        }
      }
    }
    if (!moved) break
  }
  const positions = new Map()
  labels.forEach((l) => positions.set(l.id, { x: l.x, y: l.y }))
  return positions
}

// Nothing gets clipped: the viewBox is sized from the settled nodes' and
// labels' actual extent. Overflow is a scrollbar on the container, never
// lost content.
function boundingViewBox(nodes, labelPos) {
  if (!nodes.length) return { minX: 0, minY: 0, w: W, h: H }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r)
    minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r)
  })
  labelPos.forEach((p) => {
    minX = Math.min(minX, p.x - 60); maxX = Math.max(maxX, p.x + 60)
    minY = Math.min(minY, p.y - 12); maxY = Math.max(maxY, p.y + 12)
  })
  return {
    minX: minX - BBOX_PAD, minY: minY - BBOX_PAD,
    w: (maxX - minX) + BBOX_PAD * 2, h: (maxY - minY) + BBOX_PAD * 2,
  }
}

function isExamFlagged(n) {
  if (n.type === 'entity') return !!n.examTagged
  const r = n.exam?.relevance
  return r === 'high' || r === 'medium'
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

  const entityNodes = useMemo(() => nodes.filter((n) => n.type === 'entity'), [nodes])
  const labelPos = useMemo(() => resolveLabelPositions(entityNodes), [entityNodes])
  const box = useMemo(() => boundingViewBox(nodes, labelPos), [nodes, labelPos])
  const primaryEntity = useMemo(() => primaryEntityByStory(links), [links])

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

  function nodeColor(n) {
    if (n.type === 'entity') return pickColor(n.label)
    const entity = primaryEntity.get(n.id)
    return entity ? pickColor(entity) : pickColor(n.category)
  }

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
            <filter id="oglow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g filter="url(#oglow)">
            {links.map((l, i) => {
              const s = l.source, t = l.target
              const dim = active && !(active.has(s.id) && active.has(t.id))
              const delay = (i % 14) * 0.21 + 's'
              return (
                <line
                  key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  className={'oedge' + (dim ? ' dim' : '')}
                  style={{ animationDelay: delay }}
                />
              )
            })}

            {nodes.map((n, i) => {
              const dim = active && !active.has(n.id)
              const fill = nodeColor(n)
              const flagged = isExamFlagged(n)
              const delay = (i % 11) * 0.27 + 's'
              return (
                <circle
                  key={n.id}
                  cx={n.x} cy={n.y} r={n.r}
                  className={'onode' + (n.type === 'entity' ? ' oentity' : ' ostory') + (flagged ? ' exam' : '') + (dim ? ' dim' : '')}
                  style={{ fill, animationDelay: delay }}
                  onClick={(e) => pickNode(e, n.id)}
                >
                  <title>{n.label}{flagged ? ' (AAI exam-relevant)' : ''}</title>
                </circle>
              )
            })}
          </g>

          {entityNodes.map((n) => {
            const pos = labelPos.get(n.id) || n
            const dim = active && !active.has(n.id)
            return (
              <text
                key={'lbl-' + n.id}
                x={pos.x} y={pos.y}
                textAnchor="middle"
                className={'olabel' + (dim ? ' dim' : '')}
                style={{ fill: pickColor(n.label) }}
              >
                {n.label}
              </text>
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
