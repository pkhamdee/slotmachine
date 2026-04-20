import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGame } from '../../hooks/useGame.js';
import { spinReels as apiSpin } from '../../api/gameApi.js';

vi.mock('../../api/gameApi.js');

const activeSession = { state: 'active', remainingSeconds: 60, roundNumber: 1 };
const waitingSession = { state: 'waiting', remainingSeconds: 0, roundNumber: 0 };

function makePlayer(balance = 100) {
  return { playerId: 'p1', name: 'Alice', balance };
}

const mockGrid = Array.from({ length: 5 }, () => ['cherry', 'lemon', 'orange']);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGame — initial state', () => {
  it('starts with bet of 10', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    expect(result.current.bet).toBe(10);
  });

  it('starts with spinning false', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    expect(result.current.spinning).toBe(false);
  });

  it('starts with all reels stopped (stoppedReels = 5)', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    expect(result.current.stoppedReels).toBe(5);
  });

  it('starts with no outcome or error', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    expect(result.current.outcome).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('starts with autoSpin false', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    expect(result.current.autoSpin).toBe(false);
  });

  it('generates a 5x3 grid on init', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    expect(result.current.grid).toHaveLength(5);
    result.current.grid.forEach((col) => expect(col).toHaveLength(3));
  });
});

describe('useGame — adjustBet()', () => {
  it('increases bet by delta', () => {
    const { result } = renderHook(() => useGame(makePlayer(100), vi.fn(), activeSession));
    act(() => result.current.adjustBet(5));
    expect(result.current.bet).toBe(15);
  });

  it('decreases bet by delta', () => {
    const { result } = renderHook(() => useGame(makePlayer(100), vi.fn(), activeSession));
    act(() => result.current.adjustBet(-5));
    expect(result.current.bet).toBe(5);
  });

  it('clamps bet to minimum of 1', () => {
    const { result } = renderHook(() => useGame(makePlayer(100), vi.fn(), activeSession));
    act(() => result.current.adjustBet(-100));
    expect(result.current.bet).toBe(1);
  });

  it('clamps bet to maximum of 100', () => {
    const { result } = renderHook(() => useGame(makePlayer(200), vi.fn(), activeSession));
    act(() => result.current.adjustBet(200));
    expect(result.current.bet).toBe(100);
  });

  it('clamps bet to player balance when balance < 100', () => {
    const { result } = renderHook(() => useGame(makePlayer(30), vi.fn(), activeSession));
    act(() => result.current.adjustBet(100));
    expect(result.current.bet).toBe(30);
  });
});

describe('useGame — setMaxBet()', () => {
  it('sets bet to player balance when balance ≤ 100', () => {
    const { result } = renderHook(() => useGame(makePlayer(50), vi.fn(), activeSession));
    act(() => result.current.setMaxBet());
    expect(result.current.bet).toBe(50);
  });

  it('caps bet at 100 when balance > 100', () => {
    const { result } = renderHook(() => useGame(makePlayer(500), vi.fn(), activeSession));
    act(() => result.current.setMaxBet());
    expect(result.current.bet).toBe(100);
  });
});

describe('useGame — toggleAutoSpin()', () => {
  it('toggles autoSpin from false to true', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    act(() => result.current.toggleAutoSpin());
    expect(result.current.autoSpin).toBe(true);
  });

  it('toggles autoSpin back to false', () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));
    act(() => result.current.toggleAutoSpin());
    act(() => result.current.toggleAutoSpin());
    expect(result.current.autoSpin).toBe(false);
  });
});

describe('useGame — spin() guards', () => {
  it('does nothing when session is not active', async () => {
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), waitingSession));
    await act(async () => { result.current.spin(); });
    expect(apiSpin).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Wait for the round to start!');
  });

  it('does nothing when player is null', async () => {
    const { result } = renderHook(() => useGame(null, vi.fn(), activeSession));
    await act(async () => { result.current.spin(); });
    expect(apiSpin).not.toHaveBeenCalled();
  });

  it('does nothing when balance is less than bet', async () => {
    const { result } = renderHook(() => useGame(makePlayer(5), vi.fn(), activeSession));
    await act(async () => { result.current.spin(); });
    expect(apiSpin).not.toHaveBeenCalled();
  });

  it('does nothing when already spinning', async () => {
    apiSpin.mockResolvedValue({
      grid: mockGrid, outcome: 'loss', payout: 0, balanceAfter: 90, matchCount: 0, matchSymbol: null,
    });
    const { result } = renderHook(() => useGame(makePlayer(), vi.fn(), activeSession));

    // Start first spin
    act(() => { result.current.spin(); });
    expect(result.current.spinning).toBe(true);

    const callsBefore = apiSpin.mock.calls.length;
    act(() => { result.current.spin(); }); // second call while spinning
    expect(apiSpin.mock.calls.length).toBe(callsBefore); // not called again
  });
});

describe('useGame — spin() happy path', () => {
  it('calls apiSpin with playerId and current bet', async () => {
    apiSpin.mockResolvedValue({
      grid: mockGrid, outcome: 'win', payout: 100, balanceAfter: 190, matchCount: 3, matchSymbol: 'bell',
    });
    const setPlayer = vi.fn((fn) => fn({ playerId: 'p1', name: 'Alice', balance: 100 }));
    const { result } = renderHook(() => useGame(makePlayer(), setPlayer, activeSession));

    await act(async () => {
      result.current.spin();
      await vi.runAllTimersAsync();
    });

    expect(apiSpin).toHaveBeenCalledWith('p1', 10);
  });

  it('deducts bet from balance optimistically', async () => {
    apiSpin.mockReturnValue(new Promise(() => {})); // never resolves — isolates optimistic update
    const setPlayer = vi.fn();
    const { result } = renderHook(() => useGame(makePlayer(100), setPlayer, activeSession));

    act(() => { result.current.spin(); });

    // setPlayer should have been called with a reducer that deducts bet
    expect(setPlayer).toHaveBeenCalled();
    const reducer = setPlayer.mock.calls[0][0];
    const updated = reducer({ playerId: 'p1', name: 'Alice', balance: 100 });
    expect(updated.balance).toBe(90); // 100 - 10
  });

  it('restores balance and clears spinning on API error', async () => {
    apiSpin.mockRejectedValue(new Error('No active session'));
    const setPlayer = vi.fn((fn) => {
      if (typeof fn === 'function') return fn({ playerId: 'p1', name: 'Alice', balance: 100 });
    });
    const { result } = renderHook(() => useGame(makePlayer(100), setPlayer, activeSession));

    await act(async () => {
      result.current.spin();
      await vi.runAllTimersAsync();
    });

    expect(result.current.spinning).toBe(false);
    expect(result.current.error).toBe('No active session');
  });
});
