/**
 * Integration tests targeting the 6 bugs fixed in commit 0dfe1f9.
 *
 * Bug 1: Direct mutation of React state (ship hits) — processAttack must be immutable
 * Bug 2: AI forgets partially-hit ships when sinking another
 * Bug 3: Dead/unreachable code in AI logic (always-true condition)
 * Bug 4: Ships could be placed touching each other
 * Bug 5: No keyboard shortcut for ship rotation ('R' key)
 * Bug 6: Stale closure in AI turn processing (refs vs. closures)
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  createEmptyBoard,
  canPlaceShip,
  placeShipOnBoard,
  processAttack,
  createAIState,
  updateAIAfterAttack,
  posKey,
  allShipsSunk,
} from '../gameLogic';
import { CellState, Ship, Position } from '../types';
import { placeShipsRandomly } from '../gameLogic';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ship at given positions with optional pre-existing hits. */
function makeShip(
  id: string,
  name: string,
  positions: Position[],
  hitKeys: string[] = []
): Ship {
  return {
    id,
    name,
    size: positions.length,
    positions,
    hits: new Set(hitKeys),
  };
}

/** Place a ship directly onto a board (mutates the board). */
function placeOnBoard(board: CellState[][], positions: Position[]): void {
  for (const p of positions) {
    board[p.row][p.col] = 'ship';
  }
}

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Bug 1: processAttack() must return NEW ship objects (immutable updates)
// ===========================================================================
describe('Bug 1 — Immutable state in processAttack', () => {
  it('returns a new ships array with a new Ship object on hit', () => {
    const board = createEmptyBoard();
    const shipPositions: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    placeOnBoard(board, shipPositions);

    const originalShip = makeShip('cruiser', 'Cruiser', shipPositions);
    const ships = [originalShip];

    const { newShips, result } = processAttack(board, ships, 0, 0);

    expect(result).toBe('hit');
    // The returned array must be a different reference
    expect(newShips).not.toBe(ships);
    // The hit ship object must be a different reference
    expect(newShips[0]).not.toBe(originalShip);
    // The original ship's hits set must be unchanged
    expect(originalShip.hits.size).toBe(0);
    // The new ship's hits set must contain the hit
    expect(newShips[0].hits.size).toBe(1);
    expect(newShips[0].hits.has(posKey({ row: 0, col: 0 }))).toBe(true);
  });

  it('returns a new ships array with a new Ship object on sunk', () => {
    const board = createEmptyBoard();
    const shipPositions: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    placeOnBoard(board, shipPositions);

    // Ship already has 1 hit — one more sinks it
    const originalShip = makeShip('destroyer', 'Destroyer', shipPositions, [
      posKey({ row: 0, col: 0 }),
    ]);
    const ships = [originalShip];

    const { newShips, result, sunkShipId } = processAttack(board, ships, 0, 1);

    expect(result).toBe('sunk');
    expect(sunkShipId).toBe('destroyer');
    expect(newShips).not.toBe(ships);
    expect(newShips[0]).not.toBe(originalShip);
    // Original must still only have 1 hit
    expect(originalShip.hits.size).toBe(1);
    // New ship must have 2 hits
    expect(newShips[0].hits.size).toBe(2);
  });

  it('does not mutate ships array on a miss', () => {
    const board = createEmptyBoard();
    const shipPositions: Position[] = [{ row: 5, col: 5 }];
    placeOnBoard(board, shipPositions);

    const ship = makeShip('sub', 'Submarine', shipPositions);
    const ships = [ship];

    const { newShips, result } = processAttack(board, ships, 0, 0);

    expect(result).toBe('miss');
    // On a miss, the ships array can be returned as-is (no mutation needed)
    expect(newShips[0].hits.size).toBe(0);
  });

  it('does not mutate the hits Set of non-targeted ships', () => {
    const board = createEmptyBoard();
    const ship1Pos: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    const ship2Pos: Position[] = [
      { row: 5, col: 5 },
      { row: 5, col: 6 },
    ];
    placeOnBoard(board, ship1Pos);
    placeOnBoard(board, ship2Pos);

    const ship1 = makeShip('destroyer', 'Destroyer', ship1Pos);
    const ship2 = makeShip('sub', 'Submarine', ship2Pos);
    const ships = [ship1, ship2];

    const { newShips } = processAttack(board, ships, 0, 0);

    // ship2 should not have been modified
    expect(newShips[1]).toBe(ship2);
    expect(ship2.hits.size).toBe(0);
  });
});

// ===========================================================================
// Bug 2: AI must retain hits on other ships when sinking one
// ===========================================================================
describe('Bug 2 — AI retains targeting data for unsunk ships after a sink', () => {
  it('stays in target mode after sinking a ship if hits remain on another ship', () => {
    const aiState = createAIState();

    // Simulate hits on two different ships
    const hitOnShipA: Position = { row: 2, col: 3 };
    const hitOnShipB: Position = { row: 7, col: 7 };

    // Record hits
    updateAIAfterAttack(aiState, hitOnShipA, 'hit');
    updateAIAfterAttack(aiState, hitOnShipB, 'hit');

    expect(aiState.mode).toBe('target');
    expect(aiState.hitPositions).toHaveLength(2);

    // Now ship A is sunk — only remove ship A's positions
    const sunkShipAPositions: Position[] = [
      { row: 2, col: 3 },
      { row: 2, col: 4 },
    ];

    updateAIAfterAttack(
      aiState,
      { row: 2, col: 4 },
      'sunk',
      sunkShipAPositions
    );

    // AI must stay in target mode because hitOnShipB is still unsunk
    expect(aiState.mode).toBe('target');
    // Only ship B's hit should remain
    expect(aiState.hitPositions).toHaveLength(1);
    expect(posKey(aiState.hitPositions[0])).toBe(posKey(hitOnShipB));
    // Target queue should have been rebuilt from ship B's remaining hit
    expect(aiState.targetQueue.length).toBeGreaterThan(0);
  });

  it('reverts to hunt mode after sinking a ship when no other hits remain', () => {
    const aiState = createAIState();

    const hitOnShip: Position = { row: 3, col: 3 };
    updateAIAfterAttack(aiState, hitOnShip, 'hit');
    expect(aiState.mode).toBe('target');

    // Sink the ship
    const sunkPositions: Position[] = [
      { row: 3, col: 3 },
      { row: 3, col: 4 },
    ];
    updateAIAfterAttack(aiState, { row: 3, col: 4 }, 'sunk', sunkPositions);

    expect(aiState.mode).toBe('hunt');
    expect(aiState.hitPositions).toHaveLength(0);
    expect(aiState.targetQueue).toHaveLength(0);
  });

  it('rebuilds target queue from remaining hits after a sink', () => {
    const aiState = createAIState();

    // Hit two cells on different ships
    updateAIAfterAttack(aiState, { row: 0, col: 0 }, 'hit');
    updateAIAfterAttack(aiState, { row: 5, col: 5 }, 'hit');

    // Clear the target queue to simulate all queued cells having been tried
    aiState.targetQueue = [];

    // Sink the ship at (0,0)
    updateAIAfterAttack(
      aiState,
      { row: 0, col: 1 },
      'sunk',
      [{ row: 0, col: 0 }, { row: 0, col: 1 }]
    );

    // The queue should be rebuilt from the remaining hit at (5,5)
    expect(aiState.mode).toBe('target');
    expect(aiState.targetQueue.length).toBeGreaterThan(0);
    // All queued positions should be adjacent to (5,5)
    for (const pos of aiState.targetQueue) {
      const dr = Math.abs(pos.row - 5);
      const dc = Math.abs(pos.col - 5);
      expect(dr + dc).toBe(1); // adjacent (not diagonal)
    }
  });
});

// ===========================================================================
// Bug 3: Dead code eliminated — both branches in sunk handler are reachable
// ===========================================================================
describe('Bug 3 — No dead code in updateAIAfterAttack sunk branch', () => {
  it('reaches the "remaining hits" branch (mode stays target)', () => {
    const aiState = createAIState();

    updateAIAfterAttack(aiState, { row: 1, col: 1 }, 'hit');
    updateAIAfterAttack(aiState, { row: 8, col: 8 }, 'hit');

    // Sink first ship — remaining hits exist → target mode
    updateAIAfterAttack(
      aiState,
      { row: 1, col: 2 },
      'sunk',
      [{ row: 1, col: 1 }, { row: 1, col: 2 }]
    );

    expect(aiState.mode).toBe('target');
    expect(aiState.hitPositions.length).toBeGreaterThan(0);
  });

  it('reaches the "no remaining hits" branch (mode goes to hunt)', () => {
    const aiState = createAIState();

    updateAIAfterAttack(aiState, { row: 1, col: 1 }, 'hit');

    // Sink the only hit ship — no remaining hits → hunt mode
    updateAIAfterAttack(
      aiState,
      { row: 1, col: 2 },
      'sunk',
      [{ row: 1, col: 1 }, { row: 1, col: 2 }]
    );

    expect(aiState.mode).toBe('hunt');
    expect(aiState.hitPositions).toHaveLength(0);
    expect(aiState.targetQueue).toHaveLength(0);
  });
});

// ===========================================================================
// Bug 4: Ships must have at least one cell of separation (including diagonals)
// ===========================================================================
describe('Bug 4 — Ship spacing enforcement in canPlaceShip', () => {
  it('rejects a ship placed directly adjacent horizontally', () => {
    const board = createEmptyBoard();
    // Place a 2-cell ship at (3,3)-(3,4)
    const { newBoard } = placeShipOnBoard(board, 3, 3, 2, 'horizontal');

    // Try to place another ship immediately to the right at (3,5)
    const allowed = canPlaceShip(newBoard, 3, 5, 2, 'horizontal');
    expect(allowed).toBe(false);
  });

  it('rejects a ship placed directly adjacent vertically', () => {
    const board = createEmptyBoard();
    // Place a 3-cell ship at (2,5)-(4,5)
    const { newBoard } = placeShipOnBoard(board, 2, 5, 3, 'vertical');

    // Try to place a ship immediately below at (5,5)
    const allowed = canPlaceShip(newBoard, 5, 5, 2, 'vertical');
    expect(allowed).toBe(false);
  });

  it('rejects a ship placed diagonally adjacent', () => {
    const board = createEmptyBoard();
    // Place a 2-cell ship at (3,3)-(3,4)
    const { newBoard } = placeShipOnBoard(board, 3, 3, 2, 'horizontal');

    // Try to place a ship at (4,5) — diagonally adjacent to (3,4)
    const allowed = canPlaceShip(newBoard, 4, 5, 2, 'horizontal');
    expect(allowed).toBe(false);
  });

  it('allows a ship placed with one cell gap', () => {
    const board = createEmptyBoard();
    // Place a 2-cell ship at (3,3)-(3,4)
    const { newBoard } = placeShipOnBoard(board, 3, 3, 2, 'horizontal');

    // Place a ship at (3,6) — two cells away (gap at col 5)
    const allowed = canPlaceShip(newBoard, 3, 6, 2, 'horizontal');
    expect(allowed).toBe(true);
  });

  it('rejects a ship touching an existing ship at a corner', () => {
    const board = createEmptyBoard();
    // Place a 3-cell ship vertically at (0,0)-(2,0)
    const { newBoard } = placeShipOnBoard(board, 0, 0, 3, 'vertical');

    // Try to place a ship at (3,1) — diagonally adjacent to (2,0)
    const allowed = canPlaceShip(newBoard, 3, 1, 2, 'horizontal');
    expect(allowed).toBe(false);
  });

  it('allows a ship placed diagonally with one cell gap', () => {
    const board = createEmptyBoard();
    // Place a 2-cell ship at (0,0)-(0,1)
    const { newBoard } = placeShipOnBoard(board, 0, 0, 2, 'horizontal');

    // Place a ship at (2,3) — far enough away
    const allowed = canPlaceShip(newBoard, 2, 3, 2, 'horizontal');
    expect(allowed).toBe(true);
  });

  it('enforces spacing during random placement (all ships spaced)', () => {
    // Run several times to increase confidence
    for (let trial = 0; trial < 20; trial++) {
      const { board, ships } = placeShipsRandomly();

      // For every ship cell, check that no non-self neighbor is also a ship
      for (const ship of ships) {
        for (const pos of ship.positions) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = pos.row + dr;
              const nc = pos.col + dc;
              if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
                if (board[nr][nc] === 'ship') {
                  // Must be part of the same ship
                  const isOwnCell = ship.positions.some(
                    (p) => p.row === nr && p.col === nc
                  );
                  if (!isOwnCell) {
                    // Check if it belongs to ANY other ship
                    const belongsToOtherShip = ships.some(
                      (other) =>
                        other.id !== ship.id &&
                        other.positions.some(
                          (p) => p.row === nr && p.col === nc
                        )
                    );
                    expect(belongsToOtherShip).toBe(false);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

// ===========================================================================
// Bug 5: 'R' key rotates ship during placement phase
// ===========================================================================
describe('Bug 5 — Keyboard shortcut R for ship rotation', () => {
  it('pressing R toggles orientation during placement', () => {
    render(<App />);

    // In placement phase, the orientation button should show "Horizontal"
    const orientationButton = screen.getByText(/Orientation:/);
    expect(orientationButton.textContent).toContain('Horizontal');

    // Press 'R' key
    fireEvent.keyDown(window, { key: 'r' });

    // Should now show Vertical
    expect(orientationButton.textContent).toContain('Vertical');

    // Press 'R' again
    fireEvent.keyDown(window, { key: 'R' });

    // Should toggle back to Horizontal
    expect(orientationButton.textContent).toContain('Horizontal');
  });

  it('R key does not toggle orientation outside placement phase', () => {
    render(<App />);

    // Click "Random Placement" to move to playing phase
    const randomButton = screen.getByText('Random Placement');
    fireEvent.click(randomButton);

    // Now pressing 'R' should not change anything (no orientation button visible)
    fireEvent.keyDown(window, { key: 'r' });

    // The orientation button should not be present in playing phase
    expect(screen.queryByText(/Orientation:/)).toBeNull();
  });

  it('orientation button label includes (R) hint', () => {
    render(<App />);

    const button = screen.getByText(/Orientation:/);
    expect(button.textContent).toContain('(R)');
  });
});

// ===========================================================================
// Bug 6: Stale closure — processAttack in setTimeout must use latest state
// ===========================================================================
describe('Bug 6 — processAttack uses latest state via refs (no stale closures)', () => {
  it('processAttack returns correct results when called with fresh state', () => {
    // This tests the core issue: if processAttack is called with stale ship data,
    // it would produce wrong results. We simulate sequential attacks to verify
    // the returned newShips accurately reflect cumulative state.

    const board = createEmptyBoard();
    const shipPositions: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    placeOnBoard(board, shipPositions);

    const ship = makeShip('cruiser', 'Cruiser', shipPositions);
    const ships = [ship];

    // First attack
    const result1 = processAttack(board, ships, 0, 0);
    expect(result1.result).toBe('hit');
    expect(result1.newShips[0].hits.size).toBe(1);

    // CORRECT behavior: use result1.newShips for the second attack (simulating ref usage)
    const result2 = processAttack(result1.newBoard, result1.newShips, 0, 1);
    expect(result2.result).toBe('hit');
    expect(result2.newShips[0].hits.size).toBe(2);

    // STALE behavior would be: using original `ships` again
    // This would only show 1 hit instead of 2, proving the bug
    const staleResult = processAttack(result1.newBoard, ships, 0, 1);
    // With immutable updates, using stale ships would show only 1 hit
    expect(staleResult.newShips[0].hits.size).toBe(1);
    // This proves the fix is needed: stale data produces wrong hit count
  });

  it('allShipsSunk detects sunk status only with up-to-date ship data', () => {
    const shipPositions: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];

    // Ship with no hits
    const originalShip = makeShip('destroyer', 'Destroyer', shipPositions);

    // Ship with both positions hit (as returned by processAttack)
    const sunkShip = makeShip('destroyer', 'Destroyer', shipPositions, [
      posKey({ row: 0, col: 0 }),
      posKey({ row: 0, col: 1 }),
    ]);

    // Using stale (original) data would miss the game-over
    expect(allShipsSunk([originalShip])).toBe(false);
    // Using fresh data correctly detects game over
    expect(allShipsSunk([sunkShip])).toBe(true);
  });

  it('sequential processAttack calls accumulate hits correctly via newShips', () => {
    // Simulates what happens in the setTimeout callback:
    // The AI attacks, gets newShips back, and the next attack must use newShips
    const board = createEmptyBoard();
    const positions: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    placeOnBoard(board, positions);

    const ship = makeShip('destroyer', 'Destroyer', positions);
    let currentShips = [ship];
    let currentBoard = board;

    // Attack 1: hit
    const r1 = processAttack(currentBoard, currentShips, 0, 0);
    expect(r1.result).toBe('hit');
    currentShips = r1.newShips;
    currentBoard = r1.newBoard;

    // Attack 2: should sink (2nd and final cell)
    const r2 = processAttack(currentBoard, currentShips, 0, 1);
    expect(r2.result).toBe('sunk');
    expect(r2.sunkShipId).toBe('destroyer');
    expect(allShipsSunk(r2.newShips)).toBe(true);
  });
});
