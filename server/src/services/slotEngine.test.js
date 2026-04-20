import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spinReels, evaluatePayout } from './slotEngine.js';

describe('spinReels()', () => {
  test('returns a 5-column grid', () => {
    const grid = spinReels();
    assert.equal(grid.length, 5);
  });

  test('each column has 3 rows', () => {
    const grid = spinReels();
    for (const col of grid) {
      assert.equal(col.length, 3);
    }
  });

  test('all cells are valid symbol ids', () => {
    const validIds = new Set([
      'cherry', 'watermelon', 'lemon', 'orange', 'bell', 'bar', 'diamond', 'seven',
    ]);
    const grid = spinReels();
    for (const col of grid) {
      for (const cell of col) {
        assert.ok(validIds.has(cell), `Unknown symbol: ${cell}`);
      }
    }
  });

  test('returns different results across multiple spins', () => {
    const results = new Set(
      Array.from({ length: 20 }, () => JSON.stringify(spinReels()))
    );
    assert.ok(results.size > 1, 'All 20 spins returned identical grids');
  });
});

describe('evaluatePayout() — five-of-a-kind', () => {
  test('5× seven pays payout5 multiplier and outcome is jackpot', () => {
    const grid = [
      ['x', 'seven', 'x'],
      ['x', 'seven', 'x'],
      ['x', 'seven', 'x'],
      ['x', 'seven', 'x'],
      ['x', 'seven', 'x'],
    ];
    const result = evaluatePayout(grid, 10);
    assert.equal(result.outcome, 'jackpot');
    assert.equal(result.payout, 10 * 1000);
    assert.equal(result.matchCount, 5);
    assert.equal(result.matchSymbol, 'seven');
  });

  test('5× cherry pays payout5 multiplier and outcome is win', () => {
    const grid = [
      ['x', 'cherry', 'x'],
      ['x', 'cherry', 'x'],
      ['x', 'cherry', 'x'],
      ['x', 'cherry', 'x'],
      ['x', 'cherry', 'x'],
    ];
    const result = evaluatePayout(grid, 5);
    assert.equal(result.outcome, 'win');
    assert.equal(result.payout, 5 * 50);
    assert.equal(result.matchCount, 5);
  });
});

describe('evaluatePayout() — four-of-a-kind', () => {
  test('4× diamond from left pays payout4 multiplier', () => {
    const grid = [
      ['x', 'diamond', 'x'],
      ['x', 'diamond', 'x'],
      ['x', 'diamond', 'x'],
      ['x', 'diamond', 'x'],
      ['x', 'lemon',   'x'],
    ];
    const result = evaluatePayout(grid, 10);
    assert.equal(result.outcome, 'win');
    assert.equal(result.payout, 10 * 250);
    assert.equal(result.matchCount, 4);
    assert.equal(result.matchSymbol, 'diamond');
  });

  test('4 matching not from left does not trigger four-of-a-kind', () => {
    const grid = [
      ['x', 'lemon',   'x'],
      ['x', 'diamond', 'x'],
      ['x', 'diamond', 'x'],
      ['x', 'diamond', 'x'],
      ['x', 'diamond', 'x'],
    ];
    const result = evaluatePayout(grid, 10);
    assert.notEqual(result.matchCount, 4);
  });
});

describe('evaluatePayout() — three-of-a-kind', () => {
  test('3× bell from left pays payout3 multiplier', () => {
    const grid = [
      ['x', 'bell',   'x'],
      ['x', 'bell',   'x'],
      ['x', 'bell',   'x'],
      ['x', 'lemon',  'x'],
      ['x', 'cherry', 'x'],
    ];
    const result = evaluatePayout(grid, 20);
    assert.equal(result.outcome, 'win');
    assert.equal(result.payout, 20 * 20);
    assert.equal(result.matchCount, 3);
    assert.equal(result.matchSymbol, 'bell');
  });
});

describe('evaluatePayout() — cherry partial', () => {
  test('2 cherries on payline pays 2× bet', () => {
    const grid = [
      ['x', 'cherry',     'x'],
      ['x', 'cherry',     'x'],
      ['x', 'lemon',      'x'],
      ['x', 'watermelon', 'x'],
      ['x', 'orange',     'x'],
    ];
    const result = evaluatePayout(grid, 15);
    assert.equal(result.outcome, 'win');
    assert.equal(result.payout, 15 * 2);
    assert.equal(result.matchSymbol, 'cherry');
  });

  test('1 cherry on payline is a loss', () => {
    const grid = [
      ['x', 'cherry',     'x'],
      ['x', 'lemon',      'x'],
      ['x', 'watermelon', 'x'],
      ['x', 'orange',     'x'],
      ['x', 'bell',       'x'],
    ];
    const result = evaluatePayout(grid, 10);
    assert.equal(result.outcome, 'loss');
    assert.equal(result.payout, 0);
  });
});

describe('evaluatePayout() — loss', () => {
  test('all-different payline returns loss with 0 payout', () => {
    const grid = [
      ['x', 'cherry',     'x'],
      ['x', 'lemon',      'x'],
      ['x', 'orange',     'x'],
      ['x', 'bell',       'x'],
      ['x', 'watermelon', 'x'],
    ];
    const result = evaluatePayout(grid, 50);
    assert.equal(result.outcome, 'loss');
    assert.equal(result.payout, 0);
    assert.equal(result.matchCount, 0);
    assert.equal(result.matchSymbol, null);
  });
});

describe('evaluatePayout() — bet multiplier', () => {
  test('payout scales linearly with bet size', () => {
    const grid = [
      ['x', 'bar', 'x'],
      ['x', 'bar', 'x'],
      ['x', 'bar', 'x'],
      ['x', 'bar', 'x'],
      ['x', 'bar', 'x'],
    ];
    const r1 = evaluatePayout(grid, 1);
    const r10 = evaluatePayout(grid, 10);
    assert.equal(r10.payout, r1.payout * 10);
  });
});
