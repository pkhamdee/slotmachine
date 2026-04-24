const BASE = '/api';

export async function registerPlayer(name) {
  const res = await fetch(`${BASE}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to register player');
  }
  return res.json(); // { playerId, name, balance }
}

export async function getPlayer(playerId) {
  const res = await fetch(`${BASE}/players/${playerId}`);
  if (!res.ok) throw new Error('Player not found');
  return res.json();
}

export async function spinReels(playerId, bet) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE}/players/${playerId}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Spin failed');
    }
    return res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Server timeout — please try again');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getHallOfFame(limit = 20) {
  const res = await fetch(`${BASE}/hall-of-fame?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch hall of fame');
  return res.json();
}
