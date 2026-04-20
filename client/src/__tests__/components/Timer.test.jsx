import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Timer from '../../components/Timer.jsx';

describe('Timer', () => {
  it('renders nothing when sessionState is null', () => {
    const { container } = render(<Timer sessionState={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows waiting message in waiting state', () => {
    render(<Timer sessionState={{ state: 'waiting', remainingSeconds: 0, roundNumber: 0 }} />);
    expect(screen.getByText(/Waiting for admin/)).toBeInTheDocument();
  });

  it('shows lobby countdown', () => {
    render(<Timer sessionState={{ state: 'lobby', remainingSeconds: 8, roundNumber: 1 }} />);
    expect(screen.getByText(/Round starting in/)).toBeInTheDocument();
    expect(screen.getByText('8s')).toBeInTheDocument();
  });

  it('shows active countdown', () => {
    render(<Timer sessionState={{ state: 'active', remainingSeconds: 90, roundNumber: 2 }} />);
    expect(screen.getByText(/Time left/)).toBeInTheDocument();
    expect(screen.getByText('90s')).toBeInTheDocument();
  });

  it('shows round over for ended state', () => {
    render(<Timer sessionState={{ state: 'ended', remainingSeconds: 0, roundNumber: 1 }} />);
    expect(screen.getByText('Round over')).toBeInTheDocument();
  });

  it('shows round number label', () => {
    render(<Timer sessionState={{ state: 'active', remainingSeconds: 60, roundNumber: 3 }} />);
    expect(screen.getByText('Round 3')).toBeInTheDocument();
  });

  it('applies urgent class when active and ≤10 seconds remain', () => {
    const { container } = render(
      <Timer sessionState={{ state: 'active', remainingSeconds: 5, roundNumber: 1 }} />
    );
    expect(container.firstChild).toHaveClass('timer--urgent');
  });

  it('does not apply urgent class when more than 10 seconds remain', () => {
    const { container } = render(
      <Timer sessionState={{ state: 'active', remainingSeconds: 30, roundNumber: 1 }} />
    );
    expect(container.firstChild).not.toHaveClass('timer--urgent');
  });

  it('does not apply urgent class in lobby state even at low time', () => {
    const { container } = render(
      <Timer sessionState={{ state: 'lobby', remainingSeconds: 3, roundNumber: 1 }} />
    );
    expect(container.firstChild).not.toHaveClass('timer--urgent');
  });
});
