import { useGame } from '../hooks/useGame.js';
import Reel from './Reel.jsx';

export default function SlotMachine({ player, setPlayer, sessionState }) {
  const {
    bet, grid, outcome, payout, matchCount,
    spinning, stoppedReels, error, autoSpin,
    spin, adjustBet, setMaxBet, toggleAutoSpin,
  } = useGame(player, setPlayer, sessionState);

  const isActive = sessionState?.state === 'active';
  const canSpin = !spinning && isActive && (player?.balance ?? 0) >= bet;

  // Win display banner
  const bannerText = (() => {
    if (error) return error;
    if (!isActive) {
      if (sessionState?.state === 'lobby') return '⏳  Round starting soon…';
      if (sessionState?.state === 'ended') return '🏁  Round Over — Waiting for admin';
      return '⏳  Waiting for next round…';
    }
    if (spinning) return '🎰  Spinning…';
    if (outcome === 'jackpot') return `🎉  JACKPOT!  +${payout} credits`;
    if (outcome === 'win') return `✨  You win  +${payout} credits`;
    if (outcome === 'loss') return '❌  No win this time. Spin again!';
    return '🎯  Good luck! Place your bet and spin!';
  })();

  const bannerMod = outcome === 'jackpot' ? 'jackpot'
    : outcome === 'win'    ? 'win'
    : error || !isActive   ? 'info'
    : spinning             ? 'spinning'
    : 'idle';

  const spinLabel = !isActive
    ? sessionState?.state === 'lobby' ? 'WAIT' : 'OVER'
    : spinning ? '…' : 'SPIN';

  return (
    <div className="casino-machine">
      {/* Status banner */}
      <div className={`casino-banner casino-banner--${bannerMod}`}>{bannerText}</div>

      {/* Reel window */}
      <div className="casino-window">
        <div className="casino-reels">
          {[0, 1, 2, 3, 4].map((i) => (
            <Reel
              key={i}
              col={grid?.[i] ?? null}
              reelIndex={i}
              stoppedReels={stoppedReels}
              matchCount={matchCount}
            />
          ))}
        </div>
        {/* Payline line across the middle */}
        <div className="casino-payline" />
      </div>

      {/* Controls bar */}
      <div className="casino-controls">
        {/* BET controls */}
        <div className="casino-bet-group">
          <button
            className="casino-adj-btn"
            onClick={() => adjustBet(-10)}
            disabled={spinning || !isActive}
          >−</button>
          <div className="casino-stat">
            <span className="casino-stat__label">BET</span>
            <span className="casino-stat__value">{bet}</span>
          </div>
          <button
            className="casino-adj-btn"
            onClick={() => adjustBet(10)}
            disabled={spinning || !isActive}
          >+</button>
        </div>

        {/* Auto + Max */}
        <div className="casino-extra-btns">
          <button
            className={`casino-extra-btn ${autoSpin ? 'casino-extra-btn--active' : ''}`}
            onClick={toggleAutoSpin}
            disabled={!isActive}
          >
            {autoSpin ? 'STOP' : 'AUTO'}
          </button>
          <button
            className="casino-extra-btn"
            onClick={setMaxBet}
            disabled={spinning || !isActive}
          >
            MAX
          </button>
        </div>

        {/* SPIN button */}
        <button
          className={`casino-spin-btn${spinning ? ' casino-spin-btn--spinning' : ''}${!canSpin ? ' casino-spin-btn--off' : ''}`}
          onClick={spin}
          disabled={!canSpin}
        >
          {spinLabel}
        </button>

        {/* WIN + BALANCE grouped together */}
        <div className="casino-stat-group">
          <div className="casino-stat">
            <span className="casino-stat__label">WIN</span>
            <span className={`casino-stat__value ${outcome && payout > 0 ? 'casino-stat__value--lit' : ''}`}>
              {outcome && payout > 0 ? payout : 0}
            </span>
          </div>
          <div className="casino-stat-divider" />
          <div className="casino-stat">
            <span className="casino-stat__label">BALANCE</span>
            <span className="casino-stat__value">{player?.balance ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
