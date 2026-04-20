export default function BetControls({ bet, onAdjust, disabled }) {
  return (
    <div className="bet-controls">
      <button className="bet-btn" onClick={() => onAdjust(-10)} disabled={disabled || bet <= 10}>
        -10
      </button>
      <button className="bet-btn" onClick={() => onAdjust(-1)} disabled={disabled || bet <= 1}>
        -1
      </button>
      <span className="bet-amount">Bet: {bet}</span>
      <button className="bet-btn" onClick={() => onAdjust(1)} disabled={disabled}>
        +1
      </button>
      <button className="bet-btn" onClick={() => onAdjust(10)} disabled={disabled}>
        +10
      </button>
    </div>
  );
}
