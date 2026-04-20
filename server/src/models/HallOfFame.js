import mongoose from 'mongoose';

const hallOfFameSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    winnerName: { type: String, required: true },
    winnerPlayerId: { type: String, required: true },
    winnerPayout: { type: Number, required: true },
  },
  { timestamps: true }
);

hallOfFameSchema.index({ createdAt: -1 });

export default mongoose.model('HallOfFame', hallOfFameSchema);
