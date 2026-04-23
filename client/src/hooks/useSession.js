import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSession() {
  const [sessionState, setSessionState] = useState(null);
  const [scoreboard, setScoreboard] = useState([]);
  const [winner, setWinner] = useState(null);
  const [balanceReset, setBalanceReset] = useState(0);
  const countdownRef = useRef(null);
  // Tracks 'state:sessionId' so the REST poll skips events already delivered by Socket.io
  const lastStateKeyRef = useRef(null);

  useEffect(() => {
    function stateKey(data) {
      return `${data.state}:${data.sessionId ?? ''}`;
    }

    function applySessionState(data) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      if (data.endsAt && (data.state === 'lobby' || data.state === 'active')) {
        // Count down locally from the absolute endsAt so any replica works.
        const tick = () => {
          const remaining = Math.max(0, Math.round((data.endsAt - Date.now()) / 1000));
          setSessionState({ ...data, remainingSeconds: remaining });
        };
        tick();
        countdownRef.current = setInterval(tick, 1000);
      } else {
        setSessionState(data);
      }

      if (data.state === 'lobby') {
        setWinner(null);
        setBalanceReset((n) => n + 1);
      }
      if (data.state === 'waiting') {
        setWinner(null);
      }
    }

    // Force WebSocket-only transport — avoids the polling→upgrade handshake that
    // breaks across multiple K8s pods without sticky sessions.
    const socket = io({ path: '/socket.io', transports: ['websocket'] });

    socket.on('session:state', (data) => {
      lastStateKeyRef.current = stateKey(data);
      applySessionState(data);
    });
    socket.on('session:scoreboard', setScoreboard);
    socket.on('session:ended', setWinner);

    // REST poll fallback — guarantees state/balance/winner are always current even
    // when Socket.io events are missed (Redis adapter unreliable, reconnect gap, etc.).
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/sessions/current');
        if (!res.ok) return;
        const data = await res.json();
        const key = stateKey(data);
        if (key !== lastStateKeyRef.current) {
          lastStateKeyRef.current = key;
          applySessionState(data);
          // Winner is included in the REST response for ended sessions.
          if (data.state === 'ended' && data.winner) setWinner(data.winner);
        }
      } catch (_) {}
    }, 1500);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      clearInterval(poll);
      socket.disconnect();
    };
  }, []);

  return { sessionState, scoreboard, winner, balanceReset };
}
