import HallOfFame from '../models/HallOfFame.js';
import Player from '../models/Player.js';
import sessionManager from '../services/SessionManager.js';
import { adminSessionToken } from '../middleware/adminAuth.js';

export function adminLogin(req, res) {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  res.json({ token: adminSessionToken });
}

export async function getHallOfFame(req, res) {
  const limit = Math.min(Number(req.query.limit) || 3, 100);
  const entries = await HallOfFame.aggregate([
    {
      $group: {
        _id: '$winnerPlayerId',
        playerName: { $first: '$winnerName' },
        wins: { $sum: 1 },
        totalPayout: { $sum: '$winnerPayout' },
      },
    },
    { $sort: { wins: -1, totalPayout: -1 } }, // most wins first; total payout breaks ties
    { $limit: limit },
    { $project: { _id: 0, playerName: 1, wins: 1, totalPayout: 1 } },
  ]);
  res.json(entries);
}

export function getSessionState(req, res) {
  const session = sessionManager.getCurrentSession();
  if (!session) return res.json({ state: 'waiting', roundNumber: 0 });
  res.json({ state: session.state, sessionId: session._id, roundNumber: session.roundNumber });
}

export async function startNextRound(req, res) {
  try {
    await sessionManager.startNextRound();
    res.json({ ok: true, message: 'Next round started' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function resetTournament(req, res) {
  await sessionManager.resetTournament();
  res.json({ ok: true, message: 'Tournament reset' });
}

export async function purgeUsers(req, res) {
  await Player.deleteMany({});
  res.json({ ok: true, message: 'All players deleted' });
}

export async function listPlayers(req, res) {
  const players = await Player.find({}).sort({ name: 1 }).select('name balance -_id');
  res.json(players);
}
