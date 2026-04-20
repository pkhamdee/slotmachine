import { useRef, useEffect, useState } from 'react';
import { SYMBOLS, SYMBOL_MAP } from '../constants/symbols.js';

function pick() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function Reel({ col, reelIndex, stoppedReels, matchCount }) {
  const isSpinning = reelIndex >= stoppedReels;
  const isWinCol = !isSpinning && matchCount > 0 && reelIndex < matchCount;

  const [cells, setCells] = useState(() => [pick(), pick(), pick()]);
  const [landing, setLanding] = useState(false);
  const intervalRef = useRef(null);
  const prevSpinning = useRef(false);

  useEffect(() => {
    const was = prevSpinning.current;
    prevSpinning.current = isSpinning;

    if (isSpinning && !was) {
      // Start spinning — cycle cells rapidly
      intervalRef.current = setInterval(() => {
        setCells([pick(), pick(), pick()]);
      }, 80);
    }

    if (!isSpinning && was && col) {
      // Reel stopped — clear interval and snap to result
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      const result = col.map((id) => SYMBOL_MAP[id] || SYMBOLS[0]);
      setCells(result);
      setLanding(true);
      setTimeout(() => setLanding(false), 550);
    }
  }, [isSpinning, col]);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div className={`reel ${isWinCol ? 'reel--winning' : ''}`}>
      <div className={`reel__cells${isSpinning ? ' reel__cells--spinning' : ''}${landing ? ' reel__cells--landing' : ''}`}>
        {cells.map((s, row) => (
          <div
            key={row}
            className={`reel__cell${isWinCol && row === 1 ? ' reel__cell--win' : ''}`}
          >
            <span className="reel__emoji">{s.emoji}</span>
          </div>
        ))}
      </div>
      <div className="reel__payline-mark" />
    </div>
  );
}
