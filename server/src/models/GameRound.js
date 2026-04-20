import mongoose from 'mongoose';

const gameRoundSchema = new mongoose.Schema(
  {
    playerId:      { type: String,     required: true, index: true },
    bet:           { type: Number,     required: true },
    grid:          { type: [[String]], required: true },
    outcome:       { type: String, enum: ['win', 'loss', 'jackpot'], required: true },
    payout:        { type: Number,     required: true, default: 0 },
    matchCount:    { type: Number,     default: 0 },
    matchSymbol:   { type: String,     default: null },
    balanceBefore: { type: Number,     required: true },
    balanceAfter:  { type: Number,     required: true },
  },
  { timestamps: true }
);

export default mongoose.model('GameRound', gameRoundSchema);
