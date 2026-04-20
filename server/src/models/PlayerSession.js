import mongoose from 'mongoose';

const playerSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    playerId: { type: String, required: true },
    playerName: { type: String, required: true },
    totalPayout: { type: Number, default: 0 },
    spinCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

playerSessionSchema.index({ sessionId: 1, totalPayout: -1 });

export default mongoose.model('PlayerSession', playerSessionSchema);
