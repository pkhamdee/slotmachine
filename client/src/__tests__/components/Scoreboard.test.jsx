import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Scoreboard from '../../components/Scoreboard.jsx';

const mockScores = [
  { rank: 1, playerName: 'Alice', balance: 2500, spinCount: 40 },
  { rank: 2, playerName: 'Bob',   balance: 1800, spinCount: 30 },
  { rank: 3, playerName: 'Carol', balance: 1200, spinCount: 20 },
  { rank: 4, playerName: 'Dave',  balance:  900, spinCount: 15 },
];

describe('Scoreboard', () => {
  it('shows empty state when scores list is empty', () => {
    render(<Scoreboard scores={[]} />);
    expect(screen.getByText('No spins yet this round')).toBeInTheDocument();
  });

  it('renders all player names', () => {
    render(<Scoreboard scores={mockScores} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Dave')).toBeInTheDocument();
  });

  it('shows formatted balances', () => {
    render(<Scoreboard scores={mockScores} />);
    expect(screen.getByText('2,500')).toBeInTheDocument();
    expect(screen.getByText('1,800')).toBeInTheDocument();
  });

  it('shows spin counts', () => {
    render(<Scoreboard scores={mockScores} />);
    expect(screen.getByText('40 spins')).toBeInTheDocument();
    expect(screen.getByText('30 spins')).toBeInTheDocument();
  });

  it('shows medal icons for ranks 1, 2, 3', () => {
    render(<Scoreboard scores={mockScores} />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('shows #N for ranks beyond top 3', () => {
    render(<Scoreboard scores={mockScores} />);
    expect(screen.getByText('#4')).toBeInTheDocument();
  });

  it('highlights the current player row', () => {
    render(<Scoreboard scores={mockScores} currentPlayerName="Bob" />);
    const bobItem = screen.getByText('Bob').closest('li');
    expect(bobItem).toHaveClass('scoreboard__item--me');
  });

  it('does not highlight other players', () => {
    render(<Scoreboard scores={mockScores} currentPlayerName="Bob" />);
    const aliceItem = screen.getByText('Alice').closest('li');
    expect(aliceItem).not.toHaveClass('scoreboard__item--me');
  });

  it('shows 0 balance safely when balance is undefined', () => {
    const scores = [{ rank: 1, playerName: 'Ghost', balance: undefined, spinCount: 0 }];
    render(<Scoreboard scores={scores} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
