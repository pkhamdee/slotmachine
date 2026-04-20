import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BetControls from '../../components/BetControls.jsx';

describe('BetControls', () => {
  it('displays the current bet amount', () => {
    render(<BetControls bet={25} onAdjust={vi.fn()} />);
    expect(screen.getByText('Bet: 25')).toBeInTheDocument();
  });

  it('calls onAdjust(+1) when +1 button clicked', async () => {
    const onAdjust = vi.fn();
    render(<BetControls bet={10} onAdjust={onAdjust} />);
    await userEvent.click(screen.getByText('+1'));
    expect(onAdjust).toHaveBeenCalledWith(1);
  });

  it('calls onAdjust(-1) when -1 button clicked', async () => {
    const onAdjust = vi.fn();
    render(<BetControls bet={10} onAdjust={onAdjust} />);
    await userEvent.click(screen.getByText('-1'));
    expect(onAdjust).toHaveBeenCalledWith(-1);
  });

  it('calls onAdjust(+10) when +10 button clicked', async () => {
    const onAdjust = vi.fn();
    render(<BetControls bet={10} onAdjust={onAdjust} />);
    await userEvent.click(screen.getByText('+10'));
    expect(onAdjust).toHaveBeenCalledWith(10);
  });

  it('calls onAdjust(-10) when -10 button clicked', async () => {
    const onAdjust = vi.fn();
    render(<BetControls bet={20} onAdjust={onAdjust} />);
    await userEvent.click(screen.getByText('-10'));
    expect(onAdjust).toHaveBeenCalledWith(-10);
  });

  it('disables -10 button when bet is 10', () => {
    render(<BetControls bet={10} onAdjust={vi.fn()} />);
    expect(screen.getByText('-10')).toBeDisabled();
  });

  it('disables -1 button when bet is 1', () => {
    render(<BetControls bet={1} onAdjust={vi.fn()} />);
    expect(screen.getByText('-1')).toBeDisabled();
  });

  it('does not disable +1 and +10 when not disabled prop', () => {
    render(<BetControls bet={10} onAdjust={vi.fn()} />);
    expect(screen.getByText('+1')).not.toBeDisabled();
    expect(screen.getByText('+10')).not.toBeDisabled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<BetControls bet={50} onAdjust={vi.fn()} disabled />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });
});
