export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export type Orientation = 'horizontal' | 'vertical';

export type GamePhase = 'setup' | 'placement' | 'playing' | 'gameOver';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameStats {
  playerName: string;
  wins: number;
  losses: number;
  totalShots: number;
  totalHits: number;
}

export interface Position {
  row: number;
  col: number;
}

export interface Ship {
  id: string;
  name: string;
  size: number;
  positions: Position[];
  hits: Set<string>;
}

export interface ShipConfig {
  id: string;
  name: string;
  size: number;
}

export const SHIP_CONFIGS: ShipConfig[] = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];

export interface FleetPreset {
  id: string;
  name: string;
  description: string;
  ships: ShipConfig[];
}

export const FLEET_PRESETS: FleetPreset[] = [
  {
    id: 'classic',
    name: 'Classic (1990)',
    description: '5 ships, 17 cells — Standard Milton Bradley rules',
    ships: [
      { id: 'carrier', name: 'Carrier', size: 5 },
      { id: 'battleship', name: 'Battleship', size: 4 },
      { id: 'cruiser', name: 'Cruiser', size: 3 },
      { id: 'submarine', name: 'Submarine', size: 3 },
      { id: 'destroyer', name: 'Destroyer', size: 2 },
    ],
  },
  {
    id: 'russian',
    name: 'Russian',
    description: '7 ships, 20 cells — Popular 10×10 variant',
    ships: [
      { id: 'battleship', name: 'Battleship', size: 4 },
      { id: 'cruiser1', name: 'Cruiser', size: 3 },
      { id: 'cruiser2', name: 'Cruiser', size: 3 },
      { id: 'destroyer1', name: 'Destroyer', size: 2 },
      { id: 'destroyer2', name: 'Destroyer', size: 2 },
      { id: 'destroyer3', name: 'Destroyer', size: 2 },
      { id: 'patrol', name: 'Patrol Boat', size: 1 },
    ],
  },
  {
    id: 'classic2002',
    name: 'Classic (2002)',
    description: '5 ships, 17 cells — Hasbro revised names',
    ships: [
      { id: 'carrier', name: 'Carrier', size: 5 },
      { id: 'battleship', name: 'Battleship', size: 4 },
      { id: 'destroyer', name: 'Destroyer', size: 3 },
      { id: 'submarine', name: 'Submarine', size: 3 },
      { id: 'patrol', name: 'Patrol Boat', size: 2 },
    ],
  },
  {
    id: 'salvo',
    name: 'Salvo',
    description: '6 ships, 20 cells — Advanced variant from rulebook',
    ships: [
      { id: 'carrier', name: 'Aircraft Carrier', size: 5 },
      { id: 'battleship', name: 'Battleship', size: 5 },
      { id: 'destroyer1', name: 'Destroyer', size: 3 },
      { id: 'destroyer2', name: 'Destroyer', size: 3 },
      { id: 'submarine1', name: 'Submarine', size: 2 },
      { id: 'submarine2', name: 'Submarine', size: 2 },
    ],
  },
  {
    id: 'quick',
    name: 'Quick Battle',
    description: '3 ships, 9 cells — Fast-paced game',
    ships: [
      { id: 'battleship', name: 'Battleship', size: 4 },
      { id: 'cruiser', name: 'Cruiser', size: 3 },
      { id: 'destroyer', name: 'Destroyer', size: 2 },
    ],
  },
];

export const BOARD_SIZE = 10;
export const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
