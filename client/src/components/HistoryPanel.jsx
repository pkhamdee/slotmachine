import { SYMBOL_MAP } from '../constants/symbols.js';

export default function HistoryPanel({ history }) {
  if (!history.length) return null;

  return (
    <div className="history">
      <h3>Recent Spins</h3>
      <table className="history__table">
        <thead>
          <tr>
            <th>Reels</th>
            <th>Bet</th>
            <th>Payout</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {history.map((round, i) => (
            <tr key={round.roundId ?? round._id ?? i} className={`history__row history__row--${round.outcome}`}>
              <td>
                {(round.payline ?? []).map((id) => SYMBOL_MAP[id]?.emoji ?? id).join(' ')}
              </td>
              <td>{round.bet}</td>
              <td>{round.payout}</td>
              <td>{round.balanceAfter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
