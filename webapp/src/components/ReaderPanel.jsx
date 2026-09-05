import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ago, tierTag, hl, bodyHtml, escapeHtml } from '../lib.js'

function ExamRail({ a }) {
  const e = a.exam
  if (!e || e.relevance === 'none' || e.relevance === 'unscored') return null
  const facts = e.facts || []
  if (!facts.length && !e.drill) return null
  return (
    <aside className="examrail">
      <h3>For the exam</h3>
      {facts.map((f, i) => (
        <div className="efact" key={i}>
          <div className="ekind">{f.kind}</div>
          <div className="etext" dangerouslySetInnerHTML={{ __html: hl(escapeHtml(f.fact)) }} />
          <div className="eas">as of {f.as_of}</div>
        </div>
      ))}
      {e.drill && (
        <details className="edrill">
          <summary>Test yourself</summary>
          <p>{e.drill.q}</p>
          <ol>{(e.drill.options || []).map((o, i) => <li key={i}>{o}</li>)}</ol>
          <p className="eans">Answer: {String(e.drill.answer)}</p>
        </details>
      )}
    </aside>
  )
}

export default function ReaderPanel({ article, onClose, reducedMotion }) {
  useEffect(() => {
    document.body.style.overflow = article ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [article])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && article) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [article, onClose])

  const transition = reducedMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }

  return (
    <AnimatePresence>
      {article && (
        <motion.div
          className="reader-panel"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={transition}
        >
          <ReaderContent article={article} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ReaderContent({ article: a, onClose }) {
  const t = tierTag(a)
  const hasRail = a.exam && a.exam.relevance !== 'none' && a.exam.relevance !== 'unscored' &&
    ((a.exam.facts || []).length || a.exam.drill)

  return (
    <>
      <div className="rbar"><button className="back" onClick={onClose}>← Back</button></div>
      <article className={'art' + (hasRail ? '' : ' norail')}>
        {a.image_url && <img className="lead" src={a.image_url} alt="" onError={(e) => (e.target.style.display = 'none')} />}
        <div className="tagrow" style={{ marginTop: 16 }}>
          <span className="cat">{a.category}</span>
          {t.must && <span className="tag must">Must read</span>}
          <span className={'tag ' + t.cls}>{t.label}</span>
        </div>
        <h1>{a.title}</h1>
        <div className="byline">
          {a.source} · {ago(a.published)} · {a.read_min} min · {a.region === 'india' ? 'India' : 'Global'}
        </div>
        <ExamRail a={a} />
        {a.simple && a.simple.length > 0 && (
          <div className="simple">
            <h3>In plain English</h3>
            <ul>{a.simple.map((s, i) => <li key={i} dangerouslySetInnerHTML={{ __html: hl(escapeHtml(s)) }} />)}</ul>
          </div>
        )}
        {a.key_numbers && a.key_numbers.length > 0 && (
          <div className="nums">
            {a.key_numbers.map((n, i) => (
              <div className="num" key={i}><div className="v">{n.value}</div><div className="l">{n.label}</div></div>
            ))}
          </div>
        )}
        {a.terms && a.terms.length > 0 && (
          <div className="gloss">
            <h3>Words explained</h3>
            {a.terms.map((t2, i) => (
              <div className="gitem" key={i}><b>{t2.term}</b><span>{t2.meaning}</span></div>
            ))}
          </div>
        )}
        <details className="full">
          <summary>Read the full story</summary>
          <div className="body" dangerouslySetInnerHTML={{ __html: bodyHtml(a.body) }} />
        </details>
        {a.sources && a.sources.length > 0 && (
          <div className="verify">
            <h3>Checked against {a.sources.length} {a.sources.length === 1 ? 'source' : 'sources'}</h3>
            {a.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.source} ↗</a>
            ))}
          </div>
        )}
        {a.discussion && (
          <div className="verify">
            <h3>People are discussing this</h3>
            <a href={a.discussion.url} target="_blank" rel="noopener noreferrer">{a.discussion.title} ↗</a>
            <div className="note">{a.discussion.subreddit} · {a.discussion.score} points · {a.discussion.comments} comments</div>
          </div>
        )}
        <a className="srcbtn" href={a.url} target="_blank" rel="noopener noreferrer">Read the original ↗</a>
        <div className="note">
          Written for this digest from the reporting listed above. The plain-English summary and analysis are ours.
          Confidence shows how many independent publishers carried the story, not whether they are right. Not financial advice.
        </div>
      </article>
    </>
  )
}
