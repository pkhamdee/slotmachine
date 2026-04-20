import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WinnerAnnouncement from '../../components/WinnerAnnouncement.jsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const winner = { winnerName: 'Alice', winnerBalance: 3000, roundNumber: 1 };

describe('WinnerAnnouncement', () => {
  it('shows winner name', () => {
    render(<WinnerAnnouncement winner={winner} currentPlayerName="Bob" onDismiss={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows winner balance', () => {
    render(<WinnerAnnouncement winner={winner} currentPlayerName="Bob" onDismiss={vi.fn()} />);
    expect(screen.getByText(/3,000 credits/)).toBeInTheDocument();
  });

  it('shows "Round Winner!" when current player is not the winner', () => {
    render(<WinnerAnnouncement winner={winner} currentPlayerName="Bob" onDismiss={vi.fn()} />);
    expect(screen.getByText('Round Winner!')).toBeInTheDocument();
  });

  it('shows "You won this round!" when current player is the winner', () => {
    render(<WinnerAnnouncement winner={winner} currentPlayerName="Alice" onDismiss={vi.fn()} />);
    expect(screen.getByText(/You won this round!/)).toBeInTheDocument();
  });

  it('shows "No winner this round" when winner has no name', () => {
    render(<WinnerAnnouncement winner={{ winnerName: null }} currentPlayerName="Bob" onDismiss={vi.fn()} />);
    expect(screen.getByText('No winner this round')).toBeInTheDocument();
  });

  it('renders Back to Game button', () => {
    render(<WinnerAnnouncement winner={winner} currentPlayerName="Bob" onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Back to Game' })).toBeInTheDocument();
  });

  it('calls onDismiss when Back to Game is clicked', () => {
    const onDismiss = vi.fn();
    render(<WinnerAnnouncement winner={winner} currentPlayerName="Bob" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Game' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('shows countdown timer text', () => {
    render(<WinnerAnnouncement winner={winner} currentPlayerName="Bob" onDismiss={vi.fn()} />);
    expect(screen.getByText('Back to game in')).toBeInTheDocument();
  });
});
