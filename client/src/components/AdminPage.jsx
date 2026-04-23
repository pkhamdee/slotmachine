import { useState, useEffect } from 'react';
import { getHallOfFame } from '../api/gameApi.js';
import AdminLogin from './AdminLogin.jsx';

function adminFetch(path, token) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  });
}

export default function AdminPage({ sessionState, scoreboard }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('adminToken') || '');
  const [hof, setHof] = useState([]);
  const [players, setPlayers] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function fetchPlayers(tok) {
    fetch('/api/admin/players', { headers: { Authorization: `Bearer ${tok}` } })
      .then(async (r) => {
        if (r.status === 401) {
          sessionStorage.removeItem('adminToken');
          setToken('');
          return;
        }
        const data = await r.json();
        if (Array.isArray(data)) setPlayers(data);
      })
      .catch(console.error);
  }

  useEffect(() => {
    if (!token) return;
    getHallOfFame(10).then(setHof).catch(console.error);
    fetchPlayers(token);

    // Poll every 8 seconds so the list updates as players join
    const interval = setInterval(() => fetchPlayers(token), 8000);
    return () => clearInterval(interval);
  }, [token, sessionState?.state]);

  if (!token) {
    return <AdminLogin onAuth={setToken} />;
  }

  async function handleAction(path, label) {
    setBusy(true);
    setMessage('');
    try {
      await adminFetch(path, token);
      setMessage(`✓ ${label}`);
      fetchPlayers(token);
    } catch (e) {
      if (e.message === 'Unauthorized') {
        // Token expired (server restarted) — force re-login
        sessionStorage.removeItem('adminToken');
        setToken('');
      }
      setMessage(`✗ ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const state = sessionState?.state;
  const roundNumber = sessionState?.roundNumber ?? 0;
  // Allow attempt when state is unknown (connecting) — server guards against double-starts
  const canStart = state !== 'lobby' && state !== 'active';

  const stateLabels = {
    waiting: 'Waiting to start',
    lobby:   'Lobby countdown',
    active:  'Round in progress',
    ended:   'Round ended',
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h2 className="admin-page__title">Admin Panel</h2>
        <button className="admin-logout" onClick={() => {
          sessionStorage.removeItem('adminToken');
          setToken('');
        }}>Logout</button>
      </div>

      {/* Status */}
      <div className="admin-status">
        <div className={`admin-status__badge admin-status__badge--${state}`}>
          {stateLabels[state] ?? 'Connecting...'}
        </div>
        {roundNumber > 0 && <span className="admin-status__round">Round {roundNumber}</span>}
      </div>

      {/* Actions */}
      <div className="admin-actions">
        <button
          className="admin-btn admin-btn--primary"
          disabled={!canStart || busy}
          onClick={() => handleAction('/api/admin/next-round', 'Next round started')}
        >
          {state === 'waiting' && roundNumber === 0 ? 'Start Game' : 'Start Next Round'}
        </button>

        <button
          className="admin-btn admin-btn--danger"
          disabled={busy}
          onClick={() => {
            if (confirm('Reset everything? This clears all rounds and Hall of Fame.')) {
              handleAction('/api/admin/reset', 'Tournament reset');
            }
          }}
        >
          Reset Tournament
        </button>

        <button
          className="admin-btn admin-btn--danger"
          disabled={busy}
          onClick={() => {
            if (confirm('Delete ALL players? They will need to re-register with a new name.')) {
              handleAction('/api/admin/purge-users', 'All players deleted');
            }
          }}
        >
          Purge Users
        </button>
      </div>

      {message && <p className="admin-message">{message}</p>}

      {/* Live scoreboard */}
      {scoreboard.length > 0 && (
        <div className="admin-section">
          <h3 className="admin-section__title">Current Round Scores</h3>
          <ol className="admin-list">
            {scoreboard.map((s) => (
              <li key={s.playerName} className="admin-list__item">
                <span className="admin-list__rank">#{s.rank}</span>
                <span className="admin-list__name">{s.playerName}</span>
                <span className="admin-list__score">{(s.balance ?? s.totalPayout ?? 0).toLocaleString()} bal</span>
                <span className="admin-list__meta">{s.spinCount} spins</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Players in tournament */}
      <div className="admin-section">
        <h3 className="admin-section__title">Players in Tournament ({players.length})</h3>
        {players.length === 0 ? (
          <p className="admin-empty">No players registered yet</p>
        ) : (
          <ol className="admin-list">
            {players.map((p, i) => (
              <li key={p.name} className="admin-list__item">
                <span className="admin-list__rank">#{i + 1}</span>
                <span className="admin-list__name">{p.name}</span>
                <span className="admin-list__score">{p.balance.toLocaleString()}</span>
                <span className="admin-list__meta">credits</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Hall of Fame */}
      <div className="admin-section">
        <h3 className="admin-section__title">Hall of Fame</h3>
        {hof.length === 0 ? (
          <p className="admin-empty">No rounds completed yet</p>
        ) : (
          <ol className="admin-list">
            {hof.map((e, i) => (
              <li key={e.playerName} className="admin-list__item">
                <span className="admin-list__rank">#{i + 1}</span>
                <span className="admin-list__name">{e.playerName}</span>
                <span className="admin-list__score">{e.wins} win{e.wins !== 1 ? 's' : ''}</span>
                <span className="admin-list__meta">{e.totalPayout.toLocaleString()} total pts</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
