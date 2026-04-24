const BASE = '/api';

function fetchWithTimeout(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .catch((e) => {
      if (e.name === 'AbortError') throw new Error('Connection timed out — please try again');
      // Browsers report network failures as "Load failed" (Safari) or "Failed to fetch" (Chrome).
      // Normalise to a single user-friendly message.
      throw new Error('Cannot reach server — check your connection and try again');
    })
    .finally(() => clearTimeout(timeoutId));
}

export async function registerPlayer(name) {
  const res = await fetchWithTimeout(`${BASE}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to register');
  }
  return res.json(); // { playerId, name, balance }
}

export async function getPlayer(playerId) {
  const res = await fetchWithTimeout(`${BASE}/players/${playerId}`, {}, 5000);
  if (!res.ok) throw new Error('Player not found');
  return res.json();
}

export async function spinReels(playerId, bet) {
  const res = await fetchWithTimeout(
    `${BASE}/players/${playerId}/spin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet }),
    },
    8000,
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Spin failed');
  }
  return res.json();
}

export async function getHallOfFame(limit = 20) {
  const res = await fetchWithTimeout(`${BASE}/hall-of-fame?limit=${limit}`, {}, 5000);
  if (!res.ok) throw new Error('Failed to fetch hall of fame');
  return res.json();
}
