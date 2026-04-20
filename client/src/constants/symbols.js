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

export const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
