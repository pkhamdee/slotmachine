export default function MessageBanner({ outcome, payout, error }) {
  if (error) return <div className="banner banner--error">{error}</div>;
  if (!outcome) return <div className="banner banner--idle">Press SPIN to play!</div>;

  if (outcome === 'jackpot') {
    return <div className="banner banner--jackpot">🎉 JACKPOT! You won {payout} credits!</div>;
  }
  if (outcome === 'win') {
    return <div className="banner banner--win">You won {payout} credits!</div>;
  }
  return <div className="banner banner--loss">No luck. Try again!</div>;
}
