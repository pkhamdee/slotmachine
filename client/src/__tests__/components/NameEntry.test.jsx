import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NameEntry from '../../components/NameEntry.jsx';
import { registerPlayer } from '../../api/gameApi.js';

vi.mock('../../api/gameApi.js');
vi.mock('qrcode', () => ({
  default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('NameEntry', () => {
  it('renders the title and input', () => {
    render(<NameEntry onJoin={vi.fn()} />);
    expect(screen.getByText(/Nutanix Slot Machine/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your name...')).toBeInTheDocument();
  });

  it('pre-fills name from localStorage', () => {
    localStorage.setItem('slotPlayerName', 'Alice');
    render(<NameEntry onJoin={vi.fn()} />);
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('shows validation error when name is shorter than 2 characters', async () => {
    render(<NameEntry onJoin={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Join Game/ }));
    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
  });

  it('shows validation error for single character name', async () => {
    render(<NameEntry onJoin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your name...'), 'A');
    await userEvent.click(screen.getByRole('button', { name: /Join Game/ }));
    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
  });

  it('calls onJoin with player data on successful registration', async () => {
    const player = { playerId: 'abc', name: 'Alice', balance: 1000 };
    registerPlayer.mockResolvedValue(player);
    const onJoin = vi.fn();

    render(<NameEntry onJoin={onJoin} />);
    await userEvent.type(screen.getByPlaceholderText('Your name...'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: /Join Game/ }));

    await waitFor(() => expect(onJoin).toHaveBeenCalledWith(player));
  });

  it('saves player name to localStorage after successful registration', async () => {
    registerPlayer.mockResolvedValue({ playerId: 'abc', name: 'Alice', balance: 1000 });
    render(<NameEntry onJoin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your name...'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: /Join Game/ }));

    await waitFor(() => {
      expect(localStorage.getItem('slotPlayerName')).toBe('Alice');
    });
  });

  it('shows API error message on registration failure', async () => {
    registerPlayer.mockRejectedValue(new Error('Name is already taken'));
    render(<NameEntry onJoin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your name...'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: /Join Game/ }));

    await waitFor(() => {
      expect(screen.getByText(/Name is already taken/)).toBeInTheDocument();
    });
  });

  it('shows loading state while submitting', async () => {
    registerPlayer.mockReturnValue(new Promise(() => {})); // never resolves
    render(<NameEntry onJoin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your name...'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: /Join Game/ }));

    expect(screen.getByRole('button', { name: 'Joining...' })).toBeDisabled();
  });

  it('trims whitespace before validation and submission', async () => {
    registerPlayer.mockResolvedValue({ playerId: 'abc', name: 'Alice', balance: 1000 });
    const onJoin = vi.fn();
    render(<NameEntry onJoin={onJoin} />);
    await userEvent.type(screen.getByPlaceholderText('Your name...'), '  Alice  ');
    await userEvent.click(screen.getByRole('button', { name: /Join Game/ }));

    await waitFor(() => expect(registerPlayer).toHaveBeenCalledWith('Alice'));
  });
});
