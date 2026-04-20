import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBanner from '../../components/MessageBanner.jsx';

describe('MessageBanner', () => {
  it('shows error message when error prop is provided', () => {
    render(<MessageBanner error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('error takes priority over outcome', () => {
    render(<MessageBanner error="Oops" outcome="win" payout={100} />);
    expect(screen.getByText('Oops')).toBeInTheDocument();
    expect(screen.queryByText(/credits/)).not.toBeInTheDocument();
  });

  it('shows idle prompt when there is no outcome and no error', () => {
    render(<MessageBanner />);
    expect(screen.getByText('Press SPIN to play!')).toBeInTheDocument();
  });

  it('shows jackpot message for jackpot outcome', () => {
    render(<MessageBanner outcome="jackpot" payout={10000} />);
    expect(screen.getByText(/JACKPOT/)).toBeInTheDocument();
    expect(screen.getByText(/10000 credits/)).toBeInTheDocument();
  });

  it('shows win message for win outcome', () => {
    render(<MessageBanner outcome="win" payout={50} />);
    expect(screen.getByText(/You won 50 credits!/)).toBeInTheDocument();
  });

  it('shows loss message for loss outcome', () => {
    render(<MessageBanner outcome="loss" payout={0} />);
    expect(screen.getByText('No luck. Try again!')).toBeInTheDocument();
  });

  it('applies correct CSS class for error', () => {
    const { container } = render(<MessageBanner error="err" />);
    expect(container.firstChild).toHaveClass('banner--error');
  });

  it('applies correct CSS class for jackpot', () => {
    const { container } = render(<MessageBanner outcome="jackpot" payout={1000} />);
    expect(container.firstChild).toHaveClass('banner--jackpot');
  });

  it('applies correct CSS class for win', () => {
    const { container } = render(<MessageBanner outcome="win" payout={50} />);
    expect(container.firstChild).toHaveClass('banner--win');
  });
});
