import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BalanceDisplay from '../../components/BalanceDisplay.jsx';

describe('BalanceDisplay', () => {
  it('shows formatted balance with credits label', () => {
    render(<BalanceDisplay balance={1500} />);
    expect(screen.getByText('1,500 credits')).toBeInTheDocument();
  });

  it('shows --- when balance is null', () => {
    render(<BalanceDisplay balance={null} />);
    expect(screen.getByText('---')).toBeInTheDocument();
  });

  it('shows player name when provided', () => {
    render(<BalanceDisplay balance={1000} playerName="Alice" />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it('does not show name element when playerName is omitted', () => {
    render(<BalanceDisplay balance={1000} />);
    expect(screen.queryByText(/👤/)).not.toBeInTheDocument();
  });

  it('shows 0 balance as 0 credits, not ---', () => {
    render(<BalanceDisplay balance={0} />);
    expect(screen.getByText('0 credits')).toBeInTheDocument();
  });
});
