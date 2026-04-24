import { useState, useCallback, useRef, useEffect } from 'react';
import { spinReels as apiSpin } from '../api/gameApi.js';
import { SYMBOLS } from '../constants/symbols.js';

const MIN_SPIN_MS = 2000;
const REEL_STOP_INTERVAL = 380;

function randomGrid() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id)
  );
}

export function useGame(player, setPlayer, sessionState) {
  const [bet, setBet] = useState(10);
  const [grid, setGrid] = useState(() => randomGrid());
  const [outcome, setOutcome] = useState(null);
  const [payout, setPayout] = useState(null);
  const [matchCount, setMatchCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState(5);
  const [error, setError] = useState(null);
  const [autoSpin, setAutoSpin] = useState(false);

  const pendingResult = useRef(null);
  const spinTimers = useRef([]);
  const autoSpinRef = useRef(false);
  const spinRef = useRef(null);
  const preBetBalance = useRef(null);
  const spinAbortedRef = useRef(false);

  const clearSpinTimers = () => {
    spinTimers.current.forEach(clearTimeout);
    spinTimers.current = [];
  };

  const spin = useCallback(async () => {
    if (spinning || !player || player.balance < bet) return;
    if (sessionState?.state !== 'active') {
      setError('Wait for the round to start!');
      return;
    }

    clearSpinTimers();
    setSpinning(true);
    setStoppedReels(0);
    setOutcome(null);
    setError(null);
    pendingResult.current = null;
    spinAbortedRef.current = false;

    // Immediately deduct bet so balance feels responsive
    preBetBalance.current = player.balance;
    setPlayer((prev) => ({ ...prev, balance: prev.balance - bet }));

    try {
      const [result] = await Promise.all([
        apiSpin(player.playerId, bet),
        new Promise((r) => setTimeout(r, MIN_SPIN_MS)),
      ]);

      if (spinAbortedRef.current) return;
      pendingResult.current = result;

      // Stagger reel stops left-to-right
      for (let i = 1; i <= 5; i++) {
        const delay = (i - 1) * REEL_STOP_INTERVAL;
        const t = setTimeout(() => {
          setStoppedReels(i);
          if (i === 5) {
            const r = pendingResult.current;
            if (r) {
              setGrid(r.grid);
              setOutcome(r.outcome);
              setPayout(r.payout);
              setMatchCount(r.matchCount || 0);
              setPlayer((prev) => ({ ...prev, balance: r.balanceAfter }));
            }
            setSpinning(false);
          }
        }, delay);
        spinTimers.current.push(t);
      }
    } catch (e) {
      if (spinAbortedRef.current) return;
      setError(e.message);
      // Restore balance on error
      if (preBetBalance.current !== null) {
        setPlayer((prev) => ({ ...prev, balance: preBetBalance.current }));
        preBetBalance.current = null;
      }
      clearSpinTimers();
      setStoppedReels(5);
      setSpinning(false);
    }
  }, [spinning, player, bet, sessionState, setPlayer]);

  useEffect(() => { spinRef.current = spin; }, [spin]);
  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  // Auto-spin: trigger next spin after current finishes
  useEffect(() => {
    if (!spinning && autoSpin && sessionState?.state === 'active' && (player?.balance ?? 0) >= bet) {
      const t = setTimeout(() => {
        if (autoSpinRef.current) spinRef.current?.();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [spinning, autoSpin, sessionState?.state, player?.balance, bet]);

  // Abort in-flight spin and restore balance when round ends mid-spin
  useEffect(() => {
    if (sessionState?.state !== 'active' && spinning) {
      spinAbortedRef.current = true;
      spinTimers.current.forEach(clearTimeout);
      spinTimers.current = [];
      setSpinning(false);
      setStoppedReels(5);
      if (preBetBalance.current !== null) {
        setPlayer((prev) => ({ ...prev, balance: preBetBalance.current }));
        preBetBalance.current = null;
      }
    }
  }, [sessionState?.state, spinning, setPlayer]);

  // Stop auto-spin when round ends or balance insufficient
  useEffect(() => {
    if (sessionState?.state !== 'active' || (player?.balance ?? 0) < bet) {
      setAutoSpin(false);
    }
  }, [sessionState?.state, player?.balance, bet]);

  const adjustBet = useCallback(
    (delta) => {
      setBet((prev) => Math.max(1, Math.min(prev + delta, Math.min(player?.balance ?? 100, 100))));
    },
    [player]
  );

  const setMaxBet = useCallback(() => {
    setBet(Math.min(player?.balance ?? 1, 100));
  }, [player]);

  const toggleAutoSpin = useCallback(() => {
    setAutoSpin((prev) => !prev);
  }, []);

  return {
    bet, grid, outcome, payout, matchCount,
    spinning, stoppedReels, error, autoSpin,
    spin, adjustBet, setMaxBet, toggleAutoSpin,
  };
}
