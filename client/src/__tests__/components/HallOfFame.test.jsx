import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HallOfFame from '../../components/HallOfFame.jsx';
import { getHallOfFame } from '../../api/gameApi.js';

vi.mock('../../api/gameApi.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HallOfFame', () => {
  it('shows "No winners yet" when API returns empty list', async () => {
    getHallOfFame.mockResolvedValue([]);
    render(<HallOfFame refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.getByText('No winners yet')).toBeInTheDocument();
    });
  });

  it('renders player names from the API', async () => {
    getHallOfFame.mockResolvedValue([
      { playerName: 'Alice', wins: 3 },
      { playerName: 'Bob',   wins: 1 },
    ]);
    render(<HallOfFame refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows win counts with correct pluralisation', async () => {
    getHallOfFame.mockResolvedValue([
      { playerName: 'Alice', wins: 3 },
      { playerName: 'Bob',   wins: 1 },
    ]);
    render(<HallOfFame refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.getByText('3 wins')).toBeInTheDocument();
      expect(screen.getByText('1 win')).toBeInTheDocument();
    });
  });

  it('shows medal icons for top 3', async () => {
    getHallOfFame.mockResolvedValue([
      { playerName: 'A', wins: 5 },
      { playerName: 'B', wins: 3 },
      { playerName: 'C', wins: 1 },
    ]);
    render(<HallOfFame refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.getByText('🥇')).toBeInTheDocument();
      expect(screen.getByText('🥈')).toBeInTheDocument();
      expect(screen.getByText('🥉')).toBeInTheDocument();
    });
  });

  it('re-fetches when refreshTrigger changes', async () => {
    getHallOfFame.mockResolvedValue([]);
    const { rerender } = render(<HallOfFame refreshTrigger={0} />);
    await waitFor(() => expect(getHallOfFame).toHaveBeenCalledTimes(1));

    rerender(<HallOfFame refreshTrigger={1} />);
    await waitFor(() => expect(getHallOfFame).toHaveBeenCalledTimes(2));
  });

  it('fetches with limit of 3', async () => {
    getHallOfFame.mockResolvedValue([]);
    render(<HallOfFame refreshTrigger={0} />);
    await waitFor(() => {
      expect(getHallOfFame).toHaveBeenCalledWith(3);
    });
  });
});
