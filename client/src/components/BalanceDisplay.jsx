export default function BalanceDisplay({ balance, playerName }) {
  return (
    <div className="balance">
      {playerName && <span className="balance__name">👤 {playerName}</span>}
      <span className="balance__label">Balance</span>
      <span className="balance__amount">
        {balance === null ? '---' : `${balance.toLocaleString()} credits`}
      </span>
    </div>
  );
}
