import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSession() {
  const [sessionState, setSessionState] = useState(null);
  const [scoreboard, setScoreboard] = useState([]);
  const [winner, setWinner] = useState(null);
  const [balanceReset, setBalanceReset] = useState(0);
  const countdownRef = useRef(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });

    socket.on('session:state', (data) => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      if (data.endsAt && (data.state === 'lobby' || data.state === 'active')) {
        // Count down locally from the absolute endsAt timestamp.
        // This works even if the client connects to a replica that didn't start
        // the round and therefore isn't emitting per-second tick events.
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
    });

    socket.on('session:scoreboard', setScoreboard);
    socket.on('session:ended', setWinner);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      socket.disconnect();
    };
  }, []);

  return { sessionState, scoreboard, winner, balanceReset };
}
