import BoardCard from './BoardCard.jsx'
import './HighlightedBoards.css'

// "Highlighted Boards" — the 2-3 most recent boards shown as larger feature
// cards above the full grid. Hidden entirely when there are no boards yet
// (HomePage decides) so the page never shows an empty highlight strip.
export default function HighlightedBoards({ boards, onDeleteBoard }) {
  if (!boards || boards.length === 0) return null

  return (
    <section className="highlighted" aria-label="Highlighted boards">
      <div className="section-head">
        <div className="section-head__titles">
          <h2 className="section-head__title t-h2">Highlighted boards</h2>
          <p className="section-head__sub t-body-md">Freshly created spaces worth a look.</p>
        </div>
      </div>

      <div className="highlighted__grid">
        {boards.map((b) => (
          <BoardCard key={b.id} {...b} featured onDelete={onDeleteBoard} />
        ))}
      </div>
    </section>
  )
}
