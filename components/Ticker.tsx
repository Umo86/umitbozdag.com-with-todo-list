// Show-name ticker: a slow marquee of the productions, CSS-driven,
// paused on hover and disabled under reduced motion.
const SHOWS = [
  "UK Construction Week",
  "Gastech",
  "Breakbulk Europe",
  "Breakbulk Americas",
  "Spring Fair",
  "Pure London",
];

function Run({ hidden = false }: { hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined}>
      {SHOWS.map((s) => (
        <span key={s}>
          <span className="ticker-item">{s}</span>
          <span className="ticker-sep" aria-hidden="true">
            ●
          </span>
        </span>
      ))}
    </span>
  );
}

export default function Ticker() {
  return (
    <div className="ticker" aria-label="Selected productions">
      <div className="ticker-track">
        <Run />
        <Run hidden />
      </div>
    </div>
  );
}
