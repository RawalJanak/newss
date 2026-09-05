// Desktop-only gravity-drag filter dock (spec §4.3). Dragging a blob toward
// the dock's center reports the category as "active" to the parent, which
// feeds it into Starfield's pullFactor calls; releasing tells the parent to
// start decaying strength back to neutral (see gravity/gravityPull.js).
export default function CategoryDock({ categories, active, onDragCategory, onRelease }) {
  return (
    <div className="category-dock">
      {categories.map((cat) => (
        <button
          key={cat}
          className={'category-blob' + (cat === active ? ' active' : '')}
          onPointerDown={() => onDragCategory(cat)}
          onPointerUp={onRelease}
          onPointerLeave={onRelease}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
