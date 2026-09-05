const REGIONS = [
  ['news', 'News'],
  ['markets', 'Markets'],
  ['glossary', 'Glossary'],
]

export default function RegionSwitcher({ region, onSwitch }) {
  return (
    <nav className="region-switcher">
      {REGIONS.map(([id, label]) => (
        <button key={id} className={region === id ? 'on' : ''} onClick={() => onSwitch(id)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
