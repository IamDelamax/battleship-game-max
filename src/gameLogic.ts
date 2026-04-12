import {
  CellState,
  Orientation,
  Position,
  Ship,
  ShipConfig,
  BOARD_SIZE,
  SHIP_CONFIGS,
} from './types';

export function createEmptyBoard(): CellState[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 'empty' as CellState)
  );
}

export function posKey(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

export function canPlaceShip(
  board: CellState[][],
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): boolean {
  // Collect all cells the ship would occupy
  const shipCells: Position[] = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    if (r >= BOARD_SIZE || c >= BOARD_SIZE) return false;
    if (board[r][c] !== 'empty') return false;
    shipCells.push({ row: r, col: c });
  }

  // Check all 8 neighbors around each ship cell for adjacent ships
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  for (const cell of shipCells) {
    for (const [dr, dc] of directions) {
      const nr = cell.row + dr;
      const nc = cell.col + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      // Skip if the neighbor is part of the ship being placed
      if (shipCells.some((sc) => sc.row === nr && sc.col === nc)) continue;
      if (board[nr][nc] !== 'empty') return false;
    }
  }

  return true;
}

export function placeShipOnBoard(
  board: CellState[][],
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): { newBoard: CellState[][]; positions: Position[] } {
  const newBoard = board.map((r) => [...r]);
  const positions: Position[] = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    newBoard[r][c] = 'ship';
    positions.push({ row: r, col: c });
  }
  return { newBoard, positions };
}

export function getShipPositions(
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): Position[] {
  const positions: Position[] = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    positions.push({ row: r, col: c });
  }
  return positions;
}

export function isShipSunk(ship: Ship): boolean {
  return ship.hits.size === ship.size;
}

export function allShipsSunk(ships: Ship[]): boolean {
  return ships.every(isShipSunk);
}

export function processAttack(
  board: CellState[][],
  ships: Ship[],
  row: number,
  col: number
): { newBoard: CellState[][]; result: 'hit' | 'miss' | 'sunk'; sunkShipId?: string } {
  const newBoard = board.map((r) => [...r]);
  const cell = newBoard[row][col];

  if (cell === 'ship') {
    const key = posKey({ row, col });
    let sunkShipId: string | undefined;

    for (const ship of ships) {
      const isOnShip = ship.positions.some((p) => p.row === row && p.col === col);
      if (isOnShip) {
        ship.hits.add(key);
        if (isShipSunk(ship)) {
          for (const pos of ship.positions) {
            newBoard[pos.row][pos.col] = 'sunk';
          }
          sunkShipId = ship.id;
          return { newBoard, result: 'sunk', sunkShipId };
        }
        break;
      }
    }
    newBoard[row][col] = 'hit';
    return { newBoard, result: 'hit' };
  }

  newBoard[row][col] = 'miss';
  return { newBoard, result: 'miss' };
}

// AI Logic
interface AIState {
  mode: 'hunt' | 'target';
  targetQueue: Position[];
  hitPositions: Position[];
  triedPositions: Set<string>;
}

export function createAIState(): AIState {
  return {
    mode: 'hunt',
    targetQueue: [],
    hitPositions: [],
    triedPositions: new Set(),
  };
}

function getAdjacentCells(pos: Position): Position[] {
  const adjacent: Position[] = [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ];
  return adjacent.filter(
    (p) => p.row >= 0 && p.row < BOARD_SIZE && p.col >= 0 && p.col < BOARD_SIZE
  );
}

export function getAIMove(aiState: AIState): Position {
  // Target mode: attack cells adjacent to hits
  while (aiState.targetQueue.length > 0) {
    const target = aiState.targetQueue.shift()!;
    const key = posKey(target);
    if (!aiState.triedPositions.has(key)) {
      aiState.triedPositions.add(key);
      return target;
    }
  }

  // Hunt mode: random targeting with checkerboard pattern for efficiency
  aiState.mode = 'hunt';
  const candidates: Position[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 0 && !aiState.triedPositions.has(posKey({ row: r, col: c }))) {
        candidates.push({ row: r, col: c });
      }
    }
  }
  // If no checkerboard cells left, try all remaining cells
  if (candidates.length === 0) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!aiState.triedPositions.has(posKey({ row: r, col: c }))) {
          candidates.push({ row: r, col: c });
        }
      }
    }
  }

  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  aiState.triedPositions.add(posKey(choice));
  return choice;
}

export function updateAIAfterAttack(
  aiState: AIState,
  pos: Position,
  result: 'hit' | 'miss' | 'sunk'
): void {
  if (result === 'hit') {
    aiState.mode = 'target';
    aiState.hitPositions.push(pos);
    const adjacent = getAdjacentCells(pos);
    for (const adj of adjacent) {
      if (!aiState.triedPositions.has(posKey(adj))) {
        aiState.targetQueue.push(adj);
      }
    }
  } else if (result === 'sunk') {
    // Clear target queue related to the sunk ship and reset to hunt
    aiState.hitPositions = [];
    aiState.targetQueue = [];
    if (aiState.targetQueue.length === 0) {
      aiState.mode = 'hunt';
    }
  }
}

export function placeShipsRandomly(): {
  board: CellState[][];
  ships: Ship[];
} {
  let board = createEmptyBoard();
  const ships: Ship[] = [];

  for (const config of SHIP_CONFIGS) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      const orientation: Orientation =
        Math.random() < 0.5 ? 'horizontal' : 'vertical';
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);

      if (canPlaceShip(board, row, col, config.size, orientation)) {
        const { newBoard, positions } = placeShipOnBoard(
          board,
          row,
          col,
          config.size,
          orientation
        );
        board = newBoard;
        ships.push({
          id: config.id,
          name: config.name,
          size: config.size,
          positions,
          hits: new Set(),
        });
        placed = true;
      }
      attempts++;
    }
  }

  return { board, ships };
}

export function createShipFromConfig(config: ShipConfig, positions: Position[]): Ship {
  return {
    id: config.id,
    name: config.name,
    size: config.size,
    positions,
    hits: new Set(),
  };
}
