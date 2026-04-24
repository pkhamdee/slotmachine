import { useState, useEffect, useRef } from 'react';

const DURATION = 5 * 60; // 5 minutes in seconds

const CONFETTI = ['🎊', '🎉', '✨', '🌟', '💫', '🎆', '🏆', '🎇', '⭐', '🥳'];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function WinnerAnnouncement({ winner, currentPlayerName, onDismiss }) {
  const [countdown, setCountdown] = useState(DURATION);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    setCountdown(DURATION); // reset whenever a new winner arrives
  }, [winner]);

  useEffect(() => {
    if (countdown <= 0) { onDismissRef.current(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const isMe = winner?.winnerName === currentPlayerName;

  return (
    <div className="winner-overlay">
      {/* Confetti rain */}
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="confetti__piece"
            style={{
              left: `${(i / 24) * 100}%`,
              animationDelay: `${(i * 0.18) % 2.4}s`,
              animationDuration: `${2 + (i % 5) * 0.4}s`,
            }}
          >
            {CONFETTI[i % CONFETTI.length]}
          </span>
        ))}
      </div>

      <div className="winner-card">
        {winner?.winnerName ? (
          <>
            <div className="winner-trophy">🏆</div>
            <h2 className={`winner-title ${isMe ? 'winner-title--me' : ''}`}>
              {isMe ? '🎉 You won this round!' : 'Round Winner!'}
            </h2>
            <p className={`winner-name ${isMe ? 'winner-name--me' : ''}`}>
              {winner.winnerName}
            </p>
            <p className="winner-score">Balance: {(winner.winnerBalance ?? winner.winnerPayout ?? 0).toLocaleString()} credits</p>
          </>
        ) : (
          <>
            <div className="winner-trophy">😴</div>
            <h2 className="winner-title">No winner this round</h2>
          </>
        )}

        <div className="winner-countdown">
          <span className="winner-countdown__label">Back to game in</span>
          <span className="winner-countdown__time">{formatTime(countdown)}</span>
        </div>

        <button className="winner-skip" onClick={onDismiss}>
          Back to Game
        </button>
      </div>
    </div>
  );
}
