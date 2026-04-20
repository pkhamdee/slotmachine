export default function Scoreboard({ scores, currentPlayerName }) {
  return (
    <div className="scoreboard">
      <h2 className="scoreboard__title">🏆 Top Players</h2>
      {scores.length === 0 ? (
        <p className="scoreboard__empty">No spins yet this round</p>
      ) : (
        <ol className="scoreboard__list">
          {scores.map((entry) => (
            <li
              key={entry.playerName}
              className={`scoreboard__item ${entry.playerName === currentPlayerName ? 'scoreboard__item--me' : ''}`}
            >
              <span className="scoreboard__rank">
                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
              </span>
              <span className="scoreboard__name">{entry.playerName}</span>
              <span className="scoreboard__score">{(entry.balance ?? 0).toLocaleString()}</span>
              <span className="scoreboard__spins">{entry.spinCount} spins</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
