import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, index: true },
    balance: { type: Number, required: true, default: 1000, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Player', playerSchema);
