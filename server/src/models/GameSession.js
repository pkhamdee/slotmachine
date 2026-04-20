import mongoose from 'mongoose';

const gameSessionSchema = new mongoose.Schema(
  {
    state: { type: String, enum: ['lobby', 'active', 'ended'], default: 'lobby' },
    roundNumber: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    winnerId: { type: String },
    winnerName: { type: String },
    winnerPayout: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model('GameSession', gameSessionSchema);
