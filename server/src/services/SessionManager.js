import GameSession from '../models/GameSession.js';
import PlayerSession from '../models/PlayerSession.js';
import HallOfFame from '../models/HallOfFame.js';
import Player from '../models/Player.js';
import gameConfig from '../config/gameConfig.js';

class SessionManager {
  constructor() {
    this.io = null;
    this.currentSession = null;
    this.tickInterval = null;
    this.scoreboardInterval = null;
    this.roundNumber = 0;
    this._lastScoreboard = [];
    this._lastSessionState = null;
    this._lastWinner = null;
  }

  init(io) {
    this.io = io;

    // Replay last known state to each new connection.
    // For pods that never processed startNextRound, build state from DB.
    this.io.on('connection', async (socket) => {
      let state = this._lastSessionState ?? await this._buildStateFromDB().catch(() => null);
      if (!state) {
        // Also check for an ended session so the winner overlay replays correctly.
        const ended = await GameSession.findOne({ state: 'ended' }).sort({ endedAt: -1 }).catch(() => null);
        if (ended) state = { state: 'ended', remainingSeconds: 0, roundNumber: ended.roundNumber, sessionId: ended._id };
      }
      if (state) socket.emit('session:state', state);
      if (this._lastScoreboard.length) socket.emit('session:scoreboard', this._lastScoreboard);
      if (this._lastWinner) socket.emit('session:ended', this._lastWinner);
    });

  }

  getCurrentSession() {
    return this.currentSession;
  }

  async start() {
    await GameSession.updateMany(
      { state: { $in: ['lobby', 'active'] } },
      { $set: { state: 'ended', endedAt: new Date() } }
    );
    this.roundNumber = 0;
    this._enterWaiting();
  }

  async startNextRound() {
    const live = await GameSession.findOne({ state: { $in: ['lobby', 'active'] } });
    if (live) throw new Error('A round is already in progress');
    await this._beginLobby();
  }

  async resetTournament() {
    this._clearTimers();
    this.roundNumber = 0;
    this._lastWinner = null;
    this._lastScoreboard = [];
    this.currentSession = null;

    await Promise.all([
      GameSession.deleteMany({}),
      PlayerSession.deleteMany({}),
      HallOfFame.deleteMany({}),
    ]);

    this._enterWaiting();
  }

  // ── Private ────────────────────────────────────────────────────────────

  _clearTimers() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    if (this.scoreboardInterval) clearInterval(this.scoreboardInterval);
    this.scoreboardInterval = null;
  }

  _enterWaiting() {
    this._clearTimers();
    this._lastWinner = null;
    this._emitState({ state: 'waiting', roundNumber: this.roundNumber });
    this._lastScoreboard = [];
    this.io?.emit('session:scoreboard', []);
  }

  async _beginLobby() {
    this._clearTimers();
    this.roundNumber += 1;
    const { lobbyDuration, sessionDuration } = gameConfig;

    // Reset every player's balance to 1000 at the start of each round
    await Player.updateMany({}, { $set: { balance: 1000 } });

    const session = await GameSession.create({
      state: 'lobby',
      roundNumber: this.roundNumber,
      durationSeconds: sessionDuration,
    });
    this.currentSession = session;
    this._lastWinner = null;
    this._lastScoreboard = [];
    this.io.emit('session:scoreboard', []);

    // endsAt lets any replica (and the client) calculate remaining time independently
    const endsAt = session.createdAt.getTime() + lobbyDuration * 1000;
    let remaining = lobbyDuration;
    this._emitState({ state: 'lobby', remainingSeconds: remaining, endsAt, roundNumber: this.roundNumber, sessionId: session._id });

    this.tickInterval = setInterval(async () => {
      remaining--;
      this._emitState({ state: 'lobby', remainingSeconds: remaining, endsAt, roundNumber: this.roundNumber, sessionId: session._id });
      if (remaining <= 0) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
        await this._beginActive(session);
      }
    }, 1000);
  }

  async _beginActive(session) {
    session.state = 'active';
    session.startedAt = new Date();
    await session.save();
    this.currentSession = session;

    const endsAt = session.startedAt.getTime() + gameConfig.sessionDuration * 1000;
    let remaining = gameConfig.sessionDuration;
    this._emitState({ state: 'active', remainingSeconds: remaining, endsAt, roundNumber: this.roundNumber, sessionId: session._id });

    this.tickInterval = setInterval(async () => {
      remaining--;
      this._emitState({ state: 'active', remainingSeconds: remaining, endsAt, roundNumber: this.roundNumber, sessionId: session._id });
      if (remaining <= 0) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
        if (this.scoreboardInterval) clearInterval(this.scoreboardInterval);
        this.scoreboardInterval = null;
        await this._endSession(session);
      }
    }, 1000);

    // Push scoreboard every second
    this.scoreboardInterval = setInterval(() => {
      this._pushScoreboard(session._id).catch(console.error);
    }, 1000);
  }

  async _endSession(session) {
    session.state = 'ended';
    session.endedAt = new Date();

    // Find all players who participated this session, rank by current balance
    const sessions = await PlayerSession.find({ sessionId: session._id }).select('playerId playerName');
    let topPlayer = null;

    if (sessions.length > 0) {
      const playerIds = sessions.map((s) => s.playerId);
      const players = await Player.find({ playerId: { $in: playerIds } }).select('playerId balance');
      const balanceMap = Object.fromEntries(players.map((p) => [p.playerId, p.balance]));

      const ranked = sessions
        .map((s) => ({ playerId: s.playerId, playerName: s.playerName, balance: balanceMap[s.playerId] ?? 0 }))
        .sort((a, b) => b.balance - a.balance);

      topPlayer = ranked[0];
    }

    if (topPlayer) {
      session.winnerId = topPlayer.playerId;
      session.winnerName = topPlayer.playerName;
      session.winnerPayout = topPlayer.balance;

      await HallOfFame.create({
        sessionId: session._id,
        winnerName: topPlayer.playerName,
        winnerPlayerId: topPlayer.playerId,
        winnerPayout: topPlayer.balance,
      });
    }

    await session.save();
    this.currentSession = session;

    const winnerPayload = topPlayer
      ? { winnerName: topPlayer.playerName, winnerBalance: topPlayer.balance, roundNumber: this.roundNumber }
      : { winnerName: null, winnerBalance: 0, roundNumber: this.roundNumber };

    this._emitState({ state: 'ended', remainingSeconds: 0, roundNumber: this.roundNumber, sessionId: session._id });
    this._lastWinner = winnerPayload;
    this.io.emit('session:ended', winnerPayload);

    await this._pushScoreboard(session._id);

    // Wait for admin to start the next round — do NOT auto-transition
  }

  async _pushScoreboard(sessionId) {
    const sessions = await PlayerSession.find({ sessionId })
      .select('playerId playerName spinCount -_id');

    if (sessions.length === 0) {
      this._lastScoreboard = [];
      this.io.emit('session:scoreboard', []);
      return;
    }

    const playerIds = sessions.map((s) => s.playerId);
    const players = await Player.find({ playerId: { $in: playerIds } }).select('playerId balance -_id');
    const balanceMap = Object.fromEntries(players.map((p) => [p.playerId, p.balance]));

    const ranked = sessions
      .map((s) => ({
        playerName: s.playerName,
        balance: balanceMap[s.playerId] ?? 0,   // current credit balance, NOT accumulated payouts
        spinCount: s.spinCount,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map((s, i) => ({ rank: i + 1, playerName: s.playerName, balance: s.balance, spinCount: s.spinCount }));

    this._lastScoreboard = ranked;
    this.io.emit('session:scoreboard', ranked);
  }

  // Reconstruct current session state from MongoDB so any replica can serve it.
  async _buildStateFromDB() {
    const session = await GameSession.findOne({ state: { $in: ['lobby', 'active'] } }).sort({ createdAt: -1 });
    if (!session) return null;
    if (session.state === 'lobby') {
      const endsAt = session.createdAt.getTime() + gameConfig.lobbyDuration * 1000;
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      return { state: 'lobby', remainingSeconds: remaining, endsAt, roundNumber: session.roundNumber, sessionId: session._id };
    }
    if (session.state === 'active') {
      const endsAt = session.startedAt.getTime() + session.durationSeconds * 1000;
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      return { state: 'active', remainingSeconds: remaining, endsAt, roundNumber: session.roundNumber, sessionId: session._id };
    }
    return null;
  }

  _emitState(payload) {
    this._lastSessionState = payload;
    this.io.emit('session:state', payload);
  }

  async pushScoreboard(sessionId) {
    await this._pushScoreboard(sessionId);
  }

  async recordPayout(sessionId, playerId, playerName, payout) {
    await PlayerSession.findOneAndUpdate(
      { sessionId, playerId },
      { $inc: { totalPayout: payout, spinCount: 1 }, $setOnInsert: { playerName } },
      { upsert: true }
    );
    // Scoreboard is pushed by the 3-second interval — no per-spin push needed
  }
}

export default new SessionManager();
