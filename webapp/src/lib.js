// Ported straight from the original app/index.html vanilla build. Behaviour
// unchanged — these are pure string helpers, still used with
// dangerouslySetInnerHTML for the digest body/highlight text because that
// content is first-party (written by our own build script), not user input.

export function ago(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const h = (Date.now() - d) / 36e5
  if (h < 1) return Math.max(1, Math.round(h * 60)) + 'm ago'
  if (h < 24) return Math.round(h) + 'h ago'
  return Math.round(h / 24) + 'd ago'
}

const TIER = {
  corroborated: ['ok', 'Confirmed'],
  primary: ['ok', 'Official source'],
  thin: ['warn', '2 sources'],
  single: ['', '1 source'],
}

export function tierTag(a) {
  const t = TIER[a.confidence] || TIER.single
  const lbl = a.confidence === 'corroborated' && a.publisher_count ? a.publisher_count + ' sources' : t[1]
  return { cls: t[0], label: lbl, must: a.importance === 'high' }
}

// highlight figures so numbers stop hiding inside sentences
export function hl(s) {
  return String(s).replace(
    /(₹[\d,.]+(?:\s?(?:lakh|crore|cr|bn|billion|trillion)?)|\$[\d,.]+(?:\s?(?:bn|billion|million|mn|trillion)?)|\b\d[\d,]*(?:\.\d+)?%|\bRs\s?[\d,.]+(?:\s?(?:lakh|crore|cr)?)|\b\d{2,3},\d{3}(?:\.\d+)?\b)/g,
    '<mark>$1</mark>'
  )
}

export function bodyHtml(t) {
  return String(t || '')
    .split(/\n\s*\n/)
    .map((b) => {
      b = b.trim()
      if (!b) return ''
      if (b.indexOf('## ') === 0) return '<h2>' + escapeHtml(b.slice(3)) + '</h2>'
      if (/^[-*] /.test(b)) {
        return (
          '<ul>' +
          b
            .split(/\n/)
            .map((li) => '<li>' + hl(escapeHtml(li.replace(/^[-*] /, ''))).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</li>')
            .join('') +
          '</ul>'
        )
      }
      return '<p>' + hl(escapeHtml(b)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>'
    })
    .join('')
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export const CATEGORY_ORDER = [
  'Markets', 'Economy & Policy', 'Business', 'Startups', 'AI', 'Innovation',
  'Geopolitics', 'India', 'Aviation', 'World', 'Analysis',
  'Sports', 'Entertainment', 'Science', 'Education', 'Government', 'Exam',
]
