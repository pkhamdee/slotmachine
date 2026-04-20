export const SYMBOLS = [
  { id: 'cherry',     label: 'Cherry',     emoji: '🍒', weight: 20, payout3: 10,  payout4: 25,  payout5: 50   },
  { id: 'watermelon', label: 'Watermelon', emoji: '🍉', weight: 18, payout3: 10,  payout4: 25,  payout5: 50   },
  { id: 'lemon',      label: 'Lemon',      emoji: '🍋', weight: 16, payout3: 15,  payout4: 30,  payout5: 75   },
  { id: 'orange',     label: 'Orange',     emoji: '🍊', weight: 14, payout3: 15,  payout4: 30,  payout5: 75   },
  { id: 'bell',       label: 'Bell',       emoji: '🔔', weight: 10, payout3: 20,  payout4: 50,  payout5: 100  },
  { id: 'bar',        label: 'BAR',        emoji: '💰', weight: 6,  payout3: 50,  payout4: 100, payout5: 250  },
  { id: 'diamond',    label: 'Diamond',    emoji: '💎', weight: 4,  payout3: 100, payout4: 250, payout5: 500  },
  { id: 'seven',      label: 'Seven',      emoji: '7️⃣',  weight: 2,  payout3: 200, payout4: 500, payout5: 1000 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

function weightedPick() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    r -= symbol.weight;
    if (r <= 0) return symbol.id;
  }
  return SYMBOLS[SYMBOLS.length - 1].id;
}

// Returns grid[col][row] — 5 columns × 3 rows
export function spinReels() {
  return Array.from({ length: 5 }, () => [weightedPick(), weightedPick(), weightedPick()]);
}

// Payline = middle row (row index 1). Matches left-to-right.
export function evaluatePayout(grid, bet) {
  const payline = grid.map((col) => col[1]);

  // 5-of-a-kind
  if (payline.every((s) => s === payline[0])) {
    const symbol = SYMBOLS.find((s) => s.id === payline[0]);
    const outcome = payline[0] === 'seven' ? 'jackpot' : 'win';
    return { outcome, payout: bet * symbol.payout5, matchCount: 5, matchSymbol: payline[0] };
  }

  // 4-of-a-kind (from left)
  if (payline[0] === payline[1] && payline[1] === payline[2] && payline[2] === payline[3]) {
    const symbol = SYMBOLS.find((s) => s.id === payline[0]);
    return { outcome: 'win', payout: bet * symbol.payout4, matchCount: 4, matchSymbol: payline[0] };
  }

  // 3-of-a-kind (from left)
  if (payline[0] === payline[1] && payline[1] === payline[2]) {
    const symbol = SYMBOLS.find((s) => s.id === payline[0]);
    return { outcome: 'win', payout: bet * symbol.payout3, matchCount: 3, matchSymbol: payline[0] };
  }

  // Cherry partial: 2+ cherries on payline pays 2×
  const cherries = payline.filter((s) => s === 'cherry').length;
  if (cherries >= 2) {
    return { outcome: 'win', payout: bet * 2, matchCount: cherries, matchSymbol: 'cherry' };
  }

  return { outcome: 'loss', payout: 0, matchCount: 0, matchSymbol: null };
}
