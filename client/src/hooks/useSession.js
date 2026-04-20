import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export function useSession() {
  const [sessionState, setSessionState] = useState(null);
  const [scoreboard, setScoreboard] = useState([]);
  const [winner, setWinner] = useState(null);
  const [balanceReset, setBalanceReset] = useState(0);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });

    socket.on('session:state', (data) => {
      setSessionState(data);
      if (data.state === 'lobby') {
        setWinner(null);
        // Signal App to re-fetch the player's balance (reset to 1000)
        setBalanceReset((n) => n + 1);
      }
      if (data.state === 'waiting') {
        setWinner(null);
      }
    });

    socket.on('session:scoreboard', setScoreboard);
    socket.on('session:ended', setWinner);

    return () => socket.disconnect();
  }, []);

  return { sessionState, scoreboard, winner, balanceReset };
}
