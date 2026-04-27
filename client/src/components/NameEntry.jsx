import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { registerPlayer } from '../api/gameApi.js';

export default function NameEntry({ onJoin }) {
  const storedName = localStorage.getItem('slotPlayerName') || '';
  const [name, setName] = useState(storedName);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  // Generate QR code pointing to this page's URL
  useEffect(() => {
    if (!canvasRef.current) return;
    const url = window.location.origin;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 160,
      margin: 4,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const player = await registerPlayer(name.trim());
      localStorage.setItem('slotPlayerName', player.name);
      localStorage.setItem('slotPlayerId', player.playerId);
      onJoin(player);
    } catch (e) {
      const msg = e.message.includes('already taken')
        ? 'Name is already taken. Use the same browser/device you originally joined with, or ask an admin to purge players.'
        : e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="name-entry">
      <div className="name-entry__card">
        <h1 className="name-entry__title">🎰 Nutanix Slot Machine</h1>
        <p className="name-entry__subtitle">Enter your name to join the game</p>
        <form onSubmit={handleSubmit} className="name-entry__form">
          <input
            className="name-entry__input"
            type="text"
            placeholder="Your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          {error && <p className="name-entry__error">{error}</p>}
          <button className="name-entry__btn" type="submit" disabled={loading}>
            {loading ? 'Joining...' : 'Join Game'}
          </button>
        </form>

        {/* QR code for mobile players */}
        <div className="name-entry__qr">
          <canvas ref={canvasRef} className="name-entry__qr-canvas" />
          <p className="name-entry__qr-label">Scan to join on your phone</p>
        </div>
      </div>
    </div>
  );
}
