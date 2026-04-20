import { useState } from 'react';

export default function TournamentOver({ champion, currentPlayerName, totalRounds }) {
  const [resetting, setResetting] = useState(false);
  const isMe = champion?.playerName === currentPlayerName;

  async function handleReset() {
    setResetting(true);
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
    } catch {
      setResetting(false);
    }
    // Server will emit new session:state which clears this screen
  }

  return (
    <div className="tournament-over">
      <div className="tournament-over__card">
        <div className="tournament-over__fireworks">🎆</div>
        <h1 className="tournament-over__heading">Tournament Over!</h1>
        <p className="tournament-over__sub">{totalRounds} rounds completed</p>

        <div className="tournament-over__champion">
          {champion ? (
            <>
              <div className="tournament-over__trophy">🏆</div>
              <p className="tournament-over__label">Overall Champion</p>
              <p className="tournament-over__name">{champion.playerName}</p>
              <p className="tournament-over__wins">{champion.wins} round{champion.wins !== 1 ? 's' : ''} won · {champion.totalPayout?.toLocaleString()} total credits</p>
              {isMe && <p className="tournament-over__congrats">That's you! 🎉</p>}
            </>
          ) : (
            <>
              <div className="tournament-over__trophy">😴</div>
              <p className="tournament-over__label">No winner — nobody played!</p>
            </>
          )}
        </div>

        <button className="tournament-over__reset-btn" onClick={handleReset} disabled={resetting}>
          {resetting ? 'Starting...' : 'Start New Tournament'}
        </button>
      </div>
    </div>
  );
}
