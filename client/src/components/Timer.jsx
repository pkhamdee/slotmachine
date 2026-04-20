export default function Timer({ sessionState }) {
  if (!sessionState) return null;

  const { state, remainingSeconds, roundNumber } = sessionState;
  const isUrgent = state === 'active' && remainingSeconds <= 10;
  const roundLabel = roundNumber ? `Round ${roundNumber}` : '';

  return (
    <div className={`timer timer--${state} ${isUrgent ? 'timer--urgent' : ''}`}>
      {roundLabel && <span className="timer__round">{roundLabel}</span>}
      {roundLabel && state !== 'waiting' && <span className="timer__divider">·</span>}
      {state === 'waiting' && <span className="timer__label">Waiting for admin to start next round</span>}
      {state === 'lobby'   && <><span className="timer__label">Round starting in</span><span className="timer__count">{remainingSeconds}s</span></>}
      {state === 'active'  && <><span className="timer__label">Time left</span><span className="timer__count">{remainingSeconds}s</span></>}
      {state === 'ended'   && <span className="timer__label">Round over</span>}
    </div>
  );
}
