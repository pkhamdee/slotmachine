import { useState, useEffect, useCallback } from 'react';
import { useSession } from './hooks/useSession.js';
import { getPlayer } from './api/gameApi.js';
import NameEntry from './components/NameEntry.jsx';
import SlotMachine from './components/SlotMachine.jsx';
import Scoreboard from './components/Scoreboard.jsx';
import Timer from './components/Timer.jsx';
import WinnerAnnouncement from './components/WinnerAnnouncement.jsx';
import HallOfFame from './components/HallOfFame.jsx';
import AdminPage from './components/AdminPage.jsx';

export default function App() {
  const [player, setPlayer] = useState(null);
  const [view, setView] = useState('game');
  const [showWinner, setShowWinner] = useState(false);
  const { sessionState, scoreboard, winner, balanceReset } = useSession();

  // Auto-login returning player from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem('slotPlayerId');
    if (storedId && !player) {
      getPlayer(storedId)
        .then(setPlayer)
        .catch(() => {
          localStorage.removeItem('slotPlayerId');
          localStorage.removeItem('slotPlayerName');
        });
    }
  }, []);

  // Re-fetch balance when server resets it at round start
  useEffect(() => {
    if (!player || balanceReset === 0) return;
    getPlayer(player.playerId)
      .then((p) => setPlayer((prev) => ({ ...prev, balance: p.balance })))
      .catch(console.error);
  }, [balanceReset]);

  // Show overlay when round ends with a winner
  useEffect(() => {
    if (winner && sessionState?.state === 'ended') {
      setShowWinner(true);
      setView('game'); // force back to game view so overlay is visible
    }
  }, [winner, sessionState?.state]);

  // Auto-hide overlay when admin starts next round
  useEffect(() => {
    if (sessionState?.state === 'lobby' || sessionState?.state === 'waiting') {
      setShowWinner(false);
    }
  }, [sessionState?.state]);

  const dismissWinner = useCallback(() => setShowWinner(false), []);

  if (!player) return <NameEntry onJoin={setPlayer} />;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">🎰 Nutanix Slot Machine — {player.name}</h1>
        <nav className="nav">
          <button className={`nav-btn ${view === 'game'  ? 'nav-btn--active' : ''}`} onClick={() => setView('game')}>Game</button>
          <button className={`nav-btn ${view === 'admin' ? 'nav-btn--active' : ''}`} onClick={() => setView('admin')}>Admin</button>
          <button className="nav-btn nav-btn--logout" onClick={() => {
            localStorage.removeItem('slotPlayerId');
            localStorage.removeItem('slotPlayerName');
            setPlayer(null);
          }}>Leave</button>
        </nav>
      </header>

      {view === 'admin' && <AdminPage sessionState={sessionState} scoreboard={scoreboard} />}
      {view === 'game' && (
        <div className="game-layout">
          <div className="game-main">
            <Timer sessionState={sessionState} />
            <SlotMachine player={player} setPlayer={setPlayer} sessionState={sessionState} />
          </div>
          <div className="game-sidebar">
            <HallOfFame refreshTrigger={sessionState?.state} />
            <Scoreboard scores={scoreboard} currentPlayerName={player.name} />
          </div>
        </div>
      )}

      {showWinner && winner && (
        <WinnerAnnouncement winner={winner} currentPlayerName={player.name} onDismiss={dismissWinner} />
      )}
    </div>
  );
}
