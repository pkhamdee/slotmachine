import GameSession from '../models/GameSession.js';
import PlayerSession from '../models/PlayerSession.js';
import HallOfFame from '../models/HallOfFame.js';
import Player from '../models/Player.js';
import gameConfig from '../config/gameConfig.js';

const SYNC_CHANNEL = 'sm:sync';

class SessionManager {
  constructor() {
    this.io = null;
    this.currentSession = null;
    this.tickInterval = null;
    this.scoreboardInterval = null;
    this._syncInterval = null;
    this._redisPub = null;
    this.roundNumber = 0;
    this._lastScoreboard = [];
    this._lastSessionState = null;
    this._lastWinner = null;
  }

  // redisPub  — ioredis client used to publish sync signals (shared with Socket.io adapter)
  // redisSub  — dedicated ioredis subscriber client (must not be in subscriber mode yet)
  init(io, redisPub, redisSub) {
    this.io = io;
    this._redisPub = redisPub || null;

    // Subscribe to sync signals so this pod reacts immediately when any other pod
    // changes state, rather than waiting for the next DB poll tick.
    if (redisSub) {
      redisSub.subscribe(SYNC_CHANNEL, (err) => {
        if (err) console.error('Redis sync subscribe error:', err.message);
      });
      redisSub.on('message', (_ch, _msg) => {
        this._syncToLocalClients().catch(() => {});
      });
    }

    // Replay last known state to each new connection.
    this.io.on('connection', async (socket) => {
      let state = this._lastSessionState ?? await this._buildStateFromDB().catch(() => null);
      if (!state) {
        const ended = await GameSession.findOne({ state: 'ended' }).sort({ endedAt: -1 }).catch(() => null);
        if (ended) {
          state = { state: 'ended', remainingSeconds: 0, roundNumber: ended.roundNumber, sessionId: ended._id };
        } else {
          state = { state: 'waiting', roundNumber: this.roundNumber };
        }
      }
      socket.emit('session:state', state);
      if (this._lastScoreboard.length) socket.emit('session:scoreboard', this._lastScoreboard);
      if (this._lastWinner) socket.emit('session:ended', this._lastWinner);
    });

    // Fallback: poll every 2 s in case Redis signals are missed.
    this._syncInterval = setInterval(() => {
      this._syncToLocalClients().catch(() => {});
    }, 2000);
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

    this.scoreboardInterval = setInterval(() => {
      this._pushScoreboard(session._id).catch(console.error);
    }, 1000);
  }

  async _endSession(session) {
    session.state = 'ended';
    session.endedAt = new Date();

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

    // Save winner before emitting so _syncToLocalClients on other pods can read it from DB.
    this._lastWinner = winnerPayload;
    this._emitState({ state: 'ended', remainingSeconds: 0, roundNumber: this.roundNumber, sessionId: session._id });
    this.io.emit('session:ended', winnerPayload);

    await this._pushScoreboard(session._id);
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
        balance: balanceMap[s.playerId] ?? 0,
        spinCount: s.spinCount,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map((s, i) => ({ rank: i + 1, playerName: s.playerName, balance: s.balance, spinCount: s.spinCount }));

    this._lastScoreboard = ranked;
    this.io.emit('session:scoreboard', ranked);
  }

  // Push all relevant events to THIS pod's local sockets by reading from MongoDB.
  // Called on every sm:sync Redis signal (near-instant) and every 2 s as a fallback.
  // io.local.emit targets only this pod — no re-entry into the Redis adapter.
  async _syncToLocalClients() {
    let state = await this._buildStateFromDB();
    let endedSession = null;

    if (!state) {
      endedSession = await GameSession.findOne({ state: 'ended' }).sort({ endedAt: -1 });
      state = endedSession
        ? { state: 'ended', remainingSeconds: 0, roundNumber: endedSession.roundNumber, sessionId: endedSession._id }
        : { state: 'waiting', roundNumber: this.roundNumber };
    }

    const last = this._lastSessionState;
    const changed =
      last?.state !== state.state ||
      last?.sessionId?.toString() !== state.sessionId?.toString();

    if (changed) {
      this._lastSessionState = state;
      this.io.local.emit('session:state', state);

      if (state.state === 'ended') {
        // Read winner from DB so all pods can emit it, not just the originating pod.
        if (!endedSession) {
          endedSession = await GameSession.findOne({ _id: state.sessionId });
        }
        const winnerPayload = endedSession?.winnerName
          ? { winnerName: endedSession.winnerName, winnerBalance: endedSession.winnerPayout, roundNumber: endedSession.roundNumber }
          : { winnerName: null, winnerBalance: 0, roundNumber: state.roundNumber };
        this._lastWinner = winnerPayload;
        this.io.local.emit('session:ended', winnerPayload);
      }

      if (state.state === 'lobby' || state.state === 'waiting') {
        this._lastWinner = null;
        this._lastScoreboard = [];
        this.io.local.emit('session:scoreboard', []);
      }
    }

    // Always refresh scoreboard during active rounds so every pod's clients stay in sync.
    if (state.state === 'active' && state.sessionId) {
      await this._pushLocalScoreboard(state.sessionId);
    }
  }

  // Like _pushScoreboard but emits only to local sockets (no Redis adapter).
  async _pushLocalScoreboard(sessionId) {
    const sessions = await PlayerSession.find({ sessionId })
      .select('playerId playerName spinCount -_id');

    if (sessions.length === 0) {
      this._lastScoreboard = [];
      this.io.local.emit('session:scoreboard', []);
      return;
    }

    const playerIds = sessions.map((s) => s.playerId);
    const players = await Player.find({ playerId: { $in: playerIds } }).select('playerId balance -_id');
    const balanceMap = Object.fromEntries(players.map((p) => [p.playerId, p.balance]));

    const ranked = sessions
      .map((s) => ({
        playerName: s.playerName,
        balance: balanceMap[s.playerId] ?? 0,
        spinCount: s.spinCount,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map((s, i) => ({ rank: i + 1, playerName: s.playerName, balance: s.balance, spinCount: s.spinCount }));

    this._lastScoreboard = ranked;
    this.io.local.emit('session:scoreboard', ranked);
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

  // Emit state via Socket.io (Redis adapter broadcasts to all pods) and publish
  // a lightweight sm:sync signal so all pods immediately call _syncToLocalClients().
  _emitState(payload) {
    this._lastSessionState = payload;
    this.io.emit('session:state', payload);
    if (this._redisPub) {
      this._redisPub.publish(SYNC_CHANNEL, '1').catch((err) => {
        console.error('Redis sync publish error:', err.message);
      });
    }
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
  }
}

export default new SessionManager();
