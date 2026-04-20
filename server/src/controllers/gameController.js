import { randomUUID } from 'crypto';
import Player from '../models/Player.js';
import GameRound from '../models/GameRound.js';
import PlayerSession from '../models/PlayerSession.js';
import { spinReels, evaluatePayout } from '../services/slotEngine.js';
import sessionManager from '../services/SessionManager.js';

export async function registerPlayer(req, res) {
  const { name } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }

  const cleanName = name.trim();

  const existing = await Player.findOne({ name: cleanName });
  if (existing) {
    return res.status(409).json({ error: 'Name is already taken. Please choose a different name.' });
  }

  const player = await Player.create({ playerId: randomUUID(), name: cleanName, balance: 1000 });
  res.json({ playerId: player.playerId, name: player.name, balance: player.balance });
}

export async function getPlayer(req, res) {
  const player = await Player.findOne({ playerId: req.params.playerId });
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json({ playerId: player.playerId, name: player.name, balance: player.balance });
}

export async function spin(req, res) {
  const session = sessionManager.getCurrentSession();
  if (!session || session.state !== 'active') {
    return res.status(403).json({ error: 'No active session. Wait for the next round.' });
  }

  const { playerId } = req.params;
  const bet = Number(req.body.bet);

  if (!Number.isInteger(bet) || bet < 1) {
    return res.status(400).json({ error: 'Bet must be a positive integer' });
  }

  const player = await Player.findOne({ playerId });
  if (!player) return res.status(404).json({ error: 'Player not found' });
  if (player.balance < bet) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const grid = spinReels();
  const { outcome, payout, matchCount, matchSymbol } = evaluatePayout(grid, bet);
  const netChange = payout - bet;

  const updated = await Player.findOneAndUpdate(
    { playerId, balance: { $gte: bet } },
    { $inc: { balance: netChange } },
    { new: true }
  );
  if (!updated) return res.status(400).json({ error: 'Insufficient balance' });

  await GameRound.create({
    playerId,
    bet,
    grid,
    outcome,
    payout,
    matchCount,
    matchSymbol,
    balanceBefore: player.balance,
    balanceAfter: updated.balance,
  });

  if (payout > 0) {
    sessionManager
      .recordPayout(session._id, playerId, player.name, payout)
      .catch(console.error);
  } else {
    PlayerSession.findOneAndUpdate(
      { sessionId: session._id, playerId },
      { $inc: { spinCount: 1 }, $setOnInsert: { playerName: player.name, totalPayout: 0 } },
      { upsert: true }
    ).catch(console.error);
  }

  res.json({
    grid,
    outcome,
    payout,
    matchCount,
    matchSymbol,
    bet,
    balanceBefore: player.balance,
    balanceAfter: updated.balance,
  });
}

export async function getHistory(req, res) {
  const { playerId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const skip = Number(req.query.skip) || 0;

  const rounds = await GameRound.find({ playerId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('bet grid outcome payout balanceAfter createdAt');

  res.json(rounds);
}
