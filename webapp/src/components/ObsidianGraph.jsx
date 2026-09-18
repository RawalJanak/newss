import { useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import { pickColor } from '../lib.js'

const W = 700
const H = 560
const TICKS = 400
const POPUP_W = 260
const BBOX_PAD = 60

function layout(nodes, edges) {
  const nodeCopies = nodes.map((n) => ({
    ...n,
    r: n.type === 'entity' ? 5 + Math.sqrt(n.degree || 1) * 2.4 : 4,
  }))
  const linkCopies = edges.map((e) => ({ ...e }))
  const sim = forceSimulation(nodeCopies)
    // Entities repel each other so clusters stay visually separate; stories
    // barely repel at all, so they form a tight cloud around their own hub
    // instead of scattering across the canvas.
    .force('charge', forceManyBody().strength((d) => (d.type === 'entity' ? -320 : -4)))
    .force('link', forceLink(linkCopies).id((d) => d.id).distance(26))
    .force('center', forceCenter(W / 2, H / 2))
    // Without this, disconnected clusters (no story-story edges exist) only
    // repel each other and drift apart indefinitely. Entities get a weak
    // pull so they still spread out into distinct regions; stories get
    // almost none, since the link force above is what holds their cloud
    // shape together.
    .force('x', forceX(W / 2).strength((d) => (d.type === 'entity' ? 0.018 : 0.004)))
    .force('y', forceY(H / 2).strength((d) => (d.type === 'entity' ? 0.018 : 0.004)))
    .force('collide', forceCollide((d) => d.r + 1.5).iterations(3))
    .stop()
  for (let i = 0; i < TICKS; i++) sim.tick()
  return { nodes: nodeCopies, links: linkCopies }
}

// Each story is colored by the first entity it's connected to, so a
// cluster reads as one dominant color (like a discipline in a citation
// map) instead of every dot being tinted by its own unrelated news
// category.
function primaryEntityByStory(edges) {
  const map = new Map()
  edges.forEach((e) => {
    if (!map.has(e.source)) map.set(e.source, e.target)
  })
  return map
}

// A cluster's label floats above the centroid of its entity node plus all
// the stories attached to it — not pinned to the entity dot itself — the
// same way a discipline name floats over its region in a map-of-science
// graph rather than labeling one node.
function clusterLabelPositions(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const groups = new Map()
  nodes.forEach((n) => { if (n.type === 'entity') groups.set(n.id, [n]) })
  edges.forEach((e) => {
    const entity = e.target.id || e.target
    const story = byId.get(e.source.id || e.source)
    if (story && groups.has(entity)) groups.get(entity).push(story)
  })
  const positions = new Map()
  groups.forEach((members, id) => {
    const sumX = members.reduce((a, m) => a + m.x, 0)
    const sumY = members.reduce((a, m) => a + m.y, 0)
    const topY = Math.min(...members.map((m) => m.y - m.r))
    positions.set(id, { x: sumX / members.length, y: topY - 8 })
  })
  return positions
}

// Nothing gets clipped: the viewBox is sized from the settled nodes'
// actual extent, not a fixed box the layout has to fit inside. Overflow is
// a scrollbar on the container, never lost content.
function boundingViewBox(nodes) {
  if (!nodes.length) return { minX: 0, minY: 0, w: W, h: H }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r)
    minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r)
  })
  return {
    minX: minX - BBOX_PAD, minY: minY - BBOX_PAD - 20,
    w: (maxX - minX) + BBOX_PAD * 2, h: (maxY - minY) + BBOX_PAD * 2 + 20,
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
  const primaryEntity = useMemo(() => primaryEntityByStory(links), [links])
  const labelPos = useMemo(() => clusterLabelPositions(nodes, links), [nodes, links])

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
          {links.map((l, i) => {
            const s = l.source, t = l.target
            const dim = active && !(active.has(s.id) && active.has(t.id))
            return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={'oedge' + (dim ? ' dim' : '')} />
          })}

          {nodes.map((n) => {
            const dim = active && !active.has(n.id)
            const fill = nodeColor(n)
            return (
              <circle
                key={n.id}
                cx={n.x} cy={n.y} r={n.r}
                className={'onode' + (n.type === 'entity' ? ' oentity' : ' ostory') + (n.examTagged ? ' exam' : '') + (dim ? ' dim' : '')}
                style={{ fill }}
                onClick={(e) => pickNode(e, n.id)}
              >
                <title>{n.label}</title>
              </circle>
            )
          })}

          {nodes.filter((n) => n.type === 'entity').map((n) => {
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
