import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerPlayer, getPlayer, spinReels, getHallOfFame } from '../../api/gameApi.js';

function mockFetch(body, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── registerPlayer ─────────────────────────────────────────────────────────

describe('registerPlayer()', () => {
  it('POSTs to /api/players and returns player data', async () => {
    const player = { playerId: 'abc', name: 'Alice', balance: 1000 };
    global.fetch = mockFetch(player);

    const result = await registerPlayer('Alice');

    expect(fetch).toHaveBeenCalledWith('/api/players', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
    }));
    expect(result).toEqual(player);
  });

  it('throws when response is not ok', async () => {
    global.fetch = mockFetch({ error: 'Name is already taken' }, false, 409);
    await expect(registerPlayer('Alice')).rejects.toThrow('Name is already taken');
  });
});

// ── getPlayer ──────────────────────────────────────────────────────────────

describe('getPlayer()', () => {
  it('GETs /api/players/:id and returns player data', async () => {
    const player = { playerId: 'abc', name: 'Alice', balance: 800 };
    global.fetch = mockFetch(player);

    const result = await getPlayer('abc');

    expect(fetch).toHaveBeenCalledWith('/api/players/abc');
    expect(result).toEqual(player);
  });

  it('throws when player not found', async () => {
    global.fetch = mockFetch({}, false, 404);
    await expect(getPlayer('missing')).rejects.toThrow('Player not found');
  });
});

// ── spinReels ──────────────────────────────────────────────────────────────

describe('spinReels()', () => {
  it('POSTs to /api/players/:id/spin with bet and returns spin result', async () => {
    const spinResult = { grid: [], payout: 50, outcome: 'win', matchCount: 3, balanceAfter: 1040 };
    global.fetch = mockFetch(spinResult);

    const result = await spinReels('abc', 10);

    expect(fetch).toHaveBeenCalledWith('/api/players/abc/spin', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ bet: 10 }),
    }));
    expect(result).toEqual(spinResult);
  });

  it('throws with server error message on failure', async () => {
    global.fetch = mockFetch({ error: 'Insufficient balance' }, false, 400);
    await expect(spinReels('abc', 999)).rejects.toThrow('Insufficient balance');
  });

  it('throws default message when server returns no error field', async () => {
    global.fetch = mockFetch({}, false, 500);
    await expect(spinReels('abc', 10)).rejects.toThrow('Spin failed');
  });
});

// ── getHallOfFame ──────────────────────────────────────────────────────────

describe('getHallOfFame()', () => {
  it('GETs /api/hall-of-fame with default limit 20', async () => {
    global.fetch = mockFetch([]);

    await getHallOfFame();

    expect(fetch).toHaveBeenCalledWith('/api/hall-of-fame?limit=20');
  });

  it('GETs /api/hall-of-fame with custom limit', async () => {
    global.fetch = mockFetch([]);

    await getHallOfFame(3);

    expect(fetch).toHaveBeenCalledWith('/api/hall-of-fame?limit=3');
  });

  it('returns entries from the API', async () => {
    const entries = [{ playerName: 'Alice', wins: 5 }];
    global.fetch = mockFetch(entries);

    const result = await getHallOfFame();
    expect(result).toEqual(entries);
  });

  it('throws on failure', async () => {
    global.fetch = mockFetch({}, false, 500);
    await expect(getHallOfFame()).rejects.toThrow('Failed to fetch hall of fame');
  });
});
