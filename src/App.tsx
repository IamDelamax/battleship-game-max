import { useState, useCallback, useRef } from 'react';
import {
  CellState,
  Orientation,
  Position,
  Ship,
  ShipConfig,
  GamePhase,
  SHIP_CONFIGS,
  BOARD_SIZE,
  COL_LABELS,
} from './types';
import {
  createEmptyBoard,
  canPlaceShip,
  placeShipOnBoard,
  getShipPositions,
  processAttack,
  allShipsSunk,
  placeShipsRandomly,
  createShipFromConfig,
  createAIState,
  getAIMove,
  updateAIAfterAttack,
  isShipSunk,
} from './gameLogic';

type AIStateType = ReturnType<typeof createAIState>;

function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('placement');
  const [playerBoard, setPlayerBoard] = useState<CellState[][]>(createEmptyBoard());
  const [enemyBoard, setEnemyBoard] = useState<CellState[][]>(createEmptyBoard());
  const [playerShips, setPlayerShips] = useState<Ship[]>([]);
  const [enemyShips, setEnemyShips] = useState<Ship[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [currentShipIndex, setCurrentShipIndex] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [message, setMessage] = useState('Place your Carrier (5 cells)');
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);
  const [hoverCells, setHoverCells] = useState<Position[]>([]);
  const [hoverValid, setHoverValid] = useState(false);
  const [lastHit, setLastHit] = useState<Position | null>(null);
  const aiStateRef = useRef<AIStateType>(createAIState());

  const currentShipConfig: ShipConfig | undefined = SHIP_CONFIGS[currentShipIndex];

  const handlePlacementClick = useCallback(
    (row: number, col: number) => {
      if (!currentShipConfig) return;
      if (!canPlaceShip(playerBoard, row, col, currentShipConfig.size, orientation))
        return;

      const { newBoard, positions } = placeShipOnBoard(
        playerBoard,
        row,
        col,
        currentShipConfig.size,
        orientation
      );
      setPlayerBoard(newBoard);

      const newShip = createShipFromConfig(currentShipConfig, positions);
      const updatedShips = [...playerShips, newShip];
      setPlayerShips(updatedShips);

      const nextIndex = currentShipIndex + 1;
      if (nextIndex >= SHIP_CONFIGS.length) {
        // All ships placed, start the game
        const { board: aBoard, ships: aShips } = placeShipsRandomly();
        setEnemyBoard(aBoard);
        setEnemyShips(aShips);
        setGamePhase('playing');
        setMessage('Your turn! Click on the enemy board to attack.');
        setCurrentShipIndex(nextIndex);
      } else {
        setCurrentShipIndex(nextIndex);
        setMessage(
          `Place your ${SHIP_CONFIGS[nextIndex].name} (${SHIP_CONFIGS[nextIndex].size} cells)`
        );
      }
      setHoverCells([]);
    },
    [playerBoard, playerShips, currentShipIndex, orientation, currentShipConfig]
  );

  const handlePlacementHover = useCallback(
    (row: number, col: number) => {
      if (!currentShipConfig) return;
      const positions = getShipPositions(row, col, currentShipConfig.size, orientation);
      const valid = canPlaceShip(playerBoard, row, col, currentShipConfig.size, orientation);
      setHoverCells(positions.filter((p) => p.row < BOARD_SIZE && p.col < BOARD_SIZE));
      setHoverValid(valid);
    },
    [playerBoard, currentShipConfig, orientation]
  );

  const handleAttack = useCallback(
    (row: number, col: number) => {
      if (gamePhase !== 'playing' || !isPlayerTurn) return;
      const cell = enemyBoard[row][col];
      if (cell === 'hit' || cell === 'miss' || cell === 'sunk') return;

      const { newBoard, result, sunkShipId } = processAttack(
        enemyBoard,
        enemyShips,
        row,
        col
      );
      setEnemyBoard(newBoard);
      setLastHit({ row, col });

      if (result === 'sunk') {
        const sunkShip = enemyShips.find((s) => s.id === sunkShipId);
        setMessage(`You sunk the enemy's ${sunkShip?.name}!`);
      } else if (result === 'hit') {
        setMessage('Hit!');
      } else {
        setMessage('Miss!');
      }

      if (allShipsSunk(enemyShips)) {
        setGamePhase('gameOver');
        setWinner('player');
        setMessage('You win! All enemy ships have been sunk!');
        return;
      }

      setIsPlayerTurn(false);

      // AI turn after a delay
      setTimeout(() => {
        const aiMove = getAIMove(aiStateRef.current);
        const {
          newBoard: aiNewBoard,
          result: aiResult,
          sunkShipId: aiSunkShipId,
        } = processAttack(playerBoard, playerShips, aiMove.row, aiMove.col);

        updateAIAfterAttack(aiStateRef.current, aiMove, aiResult);
        setPlayerBoard(aiNewBoard);

        if (aiResult === 'sunk') {
          const sunkShip = playerShips.find((s) => s.id === aiSunkShipId);
          setMessage(`AI sunk your ${sunkShip?.name}! Your turn.`);
        } else if (aiResult === 'hit') {
          setMessage('AI hit one of your ships! Your turn.');
        } else {
          setMessage('AI missed! Your turn.');
        }

        if (allShipsSunk(playerShips)) {
          setGamePhase('gameOver');
          setWinner('ai');
          setMessage('Game Over! The AI sunk all your ships!');
          return;
        }

        setIsPlayerTurn(true);
      }, 600);
    },
    [gamePhase, isPlayerTurn, enemyBoard, enemyShips, playerBoard, playerShips]
  );

  const handlePlayAgain = useCallback(() => {
    setGamePhase('placement');
    setPlayerBoard(createEmptyBoard());
    setEnemyBoard(createEmptyBoard());
    setPlayerShips([]);
    setEnemyShips([]);
    setOrientation('horizontal');
    setCurrentShipIndex(0);
    setIsPlayerTurn(true);
    setMessage('Place your Carrier (5 cells)');
    setWinner(null);
    setHoverCells([]);
    setLastHit(null);
    aiStateRef.current = createAIState();
  }, []);

  const handleRandomPlacement = useCallback(() => {
    const { board, ships } = placeShipsRandomly();
    setPlayerBoard(board);
    setPlayerShips(ships);

    const { board: aBoard, ships: aShips } = placeShipsRandomly();
    setEnemyBoard(aBoard);
    setEnemyShips(aShips);
    setCurrentShipIndex(SHIP_CONFIGS.length);
    setGamePhase('playing');
    setMessage('Your turn! Click on the enemy board to attack.');
  }, []);

  const renderCell = (
    cell: CellState,
    row: number,
    col: number,
    isEnemy: boolean,
    onClick?: () => void
  ) => {
    const isHover = hoverCells.some((p) => p.row === row && p.col === col);
    const isLastHit =
      lastHit && lastHit.row === row && lastHit.col === col && isEnemy;

    let bgClass = 'bg-slate-700/50';
    let content = '';
    let borderClass = 'border-slate-600/50';
    let cursorClass = '';

    if (cell === 'ship' && !isEnemy) {
      bgClass = 'bg-blue-500/70';
      borderClass = 'border-blue-400/50';
    } else if (cell === 'hit') {
      bgClass = 'bg-red-500/80';
      content = '💥';
      borderClass = 'border-red-400/50';
    } else if (cell === 'miss') {
      bgClass = 'bg-slate-600/60';
      content = '•';
      borderClass = 'border-slate-500/50';
    } else if (cell === 'sunk') {
      bgClass = 'bg-red-700/80';
      content = '🔥';
      borderClass = 'border-red-500/50';
    }

    if (isHover && gamePhase === 'placement' && !isEnemy) {
      bgClass = hoverValid ? 'bg-green-500/60' : 'bg-red-400/60';
      borderClass = hoverValid ? 'border-green-400' : 'border-red-400';
    }

    if (
      isEnemy &&
      gamePhase === 'playing' &&
      isPlayerTurn &&
      cell !== 'hit' &&
      cell !== 'miss' &&
      cell !== 'sunk'
    ) {
      cursorClass = 'cursor-crosshair hover:bg-cyan-500/40 hover:border-cyan-400';
    }

    if (gamePhase === 'placement' && !isEnemy && cell === 'empty') {
      cursorClass = 'cursor-pointer';
    }

    return (
      <button
        key={`${row}-${col}`}
        className={`w-9 h-9 sm:w-10 sm:h-10 border ${borderClass} ${bgClass} ${cursorClass} 
          flex items-center justify-center text-sm transition-all duration-150 
          ${isLastHit ? 'ring-2 ring-yellow-400 animate-pulse' : ''}`}
        onClick={onClick}
        onMouseEnter={
          gamePhase === 'placement' && !isEnemy
            ? () => handlePlacementHover(row, col)
            : undefined
        }
        onMouseLeave={
          gamePhase === 'placement' && !isEnemy
            ? () => setHoverCells([])
            : undefined
        }
        disabled={
          isEnemy
            ? gamePhase !== 'playing' ||
              !isPlayerTurn ||
              cell === 'hit' ||
              cell === 'miss' ||
              cell === 'sunk'
            : gamePhase !== 'placement'
        }
      >
        {content}
      </button>
    );
  };

  const renderBoard = (
    board: CellState[][],
    isEnemy: boolean,
    onCellClick?: (row: number, col: number) => void
  ) => (
    <div className="inline-block">
      {/* Column headers */}
      <div className="flex ml-9 sm:ml-10">
        {COL_LABELS.map((label) => (
          <div
            key={label}
            className="w-9 h-6 sm:w-10 flex items-center justify-center text-xs font-bold text-cyan-300/80"
          >
            {label}
          </div>
        ))}
      </div>
      {/* Rows */}
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="flex">
          {/* Row number */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-xs font-bold text-cyan-300/80">
            {rowIndex + 1}
          </div>
          {row.map((cell, colIndex) =>
            renderCell(cell, rowIndex, colIndex, isEnemy, () =>
              onCellClick?.(rowIndex, colIndex)
            )
          )}
        </div>
      ))}
    </div>
  );

  const renderShipStatus = (ships: Ship[], label: string) => (
    <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
      <h3 className="text-sm font-bold text-cyan-300 mb-2 uppercase tracking-wider">
        {label}
      </h3>
      <div className="space-y-1.5">
        {SHIP_CONFIGS.map((config) => {
          const ship = ships.find((s) => s.id === config.id);
          const sunk = ship ? isShipSunk(ship) : false;
          const hitCount = ship ? ship.hits.size : 0;

          return (
            <div key={config.id} className="flex items-center gap-2">
              <span
                className={`text-xs font-medium w-24 ${sunk ? 'text-red-400 line-through' : 'text-slate-300'}`}
              >
                {config.name}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: config.size }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-sm border ${
                      sunk
                        ? 'bg-red-600/80 border-red-500'
                        : ship && i < hitCount
                          ? 'bg-orange-500/80 border-orange-400'
                          : ship
                            ? 'bg-blue-500/60 border-blue-400/50'
                            : 'bg-slate-600/40 border-slate-500/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white p-4 sm:p-6">
      {/* Header */}
      <header className="text-center mb-6">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
          <span className="text-cyan-400">BATTLE</span>
          <span className="text-slate-300">SHIP</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Naval Combat Strategy Game</p>
      </header>

      {/* Message bar */}
      <div className="max-w-3xl mx-auto mb-4">
        <div
          className={`text-center py-2.5 px-4 rounded-lg font-semibold text-sm ${
            winner === 'player'
              ? 'bg-green-600/30 border border-green-500/50 text-green-300'
              : winner === 'ai'
                ? 'bg-red-600/30 border border-red-500/50 text-red-300'
                : 'bg-slate-800/60 border border-slate-700/50 text-cyan-200'
          }`}
        >
          {message}
        </div>
      </div>

      {/* Placement controls */}
      {gamePhase === 'placement' && (
        <div className="flex justify-center gap-3 mb-4">
          <button
            onClick={() =>
              setOrientation((o) =>
                o === 'horizontal' ? 'vertical' : 'horizontal'
              )
            }
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-semibold 
              transition-colors border border-cyan-500/50 shadow-lg shadow-cyan-900/30"
          >
            Orientation: {orientation === 'horizontal' ? '→ Horizontal' : '↓ Vertical'}
          </button>
          <button
            onClick={handleRandomPlacement}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold 
              transition-colors border border-purple-500/50 shadow-lg shadow-purple-900/30"
          >
            Random Placement
          </button>
        </div>
      )}

      {/* Game boards */}
      <div className="flex flex-col lg:flex-row items-start justify-center gap-6 lg:gap-10">
        {/* Player board */}
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-bold text-blue-300 mb-2 uppercase tracking-wider">
            Your Fleet
          </h2>
          {renderBoard(
            playerBoard,
            false,
            gamePhase === 'placement' ? handlePlacementClick : undefined
          )}
          {(gamePhase === 'playing' || gamePhase === 'gameOver') &&
            renderShipStatus(playerShips, 'Your Ships')}
        </div>

        {/* Separator */}
        {gamePhase !== 'placement' && (
          <div className="hidden lg:flex flex-col items-center justify-center self-center">
            <div className="w-px h-32 bg-gradient-to-b from-transparent via-slate-500 to-transparent" />
            <span className="text-slate-500 text-xs font-bold my-2 uppercase tracking-widest">
              VS
            </span>
            <div className="w-px h-32 bg-gradient-to-b from-transparent via-slate-500 to-transparent" />
          </div>
        )}

        {/* Enemy board */}
        {gamePhase !== 'placement' && (
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold text-red-300 mb-2 uppercase tracking-wider">
              Enemy Waters
            </h2>
            {renderBoard(enemyBoard, true, handleAttack)}
            {renderShipStatus(enemyShips, 'Enemy Ships')}
          </div>
        )}
      </div>

      {/* Turn indicator */}
      {gamePhase === 'playing' && (
        <div className="text-center mt-4">
          <span
            className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              isPlayerTurn
                ? 'bg-green-600/30 text-green-300 border border-green-500/40'
                : 'bg-amber-600/30 text-amber-300 border border-amber-500/40 animate-pulse'
            }`}
          >
            {isPlayerTurn ? 'Your Turn' : 'AI Thinking...'}
          </span>
        </div>
      )}

      {/* Game over overlay */}
      {gamePhase === 'gameOver' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md mx-4 text-center border border-slate-600 shadow-2xl">
            <h2
              className={`text-3xl font-black mb-2 ${winner === 'player' ? 'text-green-400' : 'text-red-400'}`}
            >
              {winner === 'player' ? 'VICTORY!' : 'DEFEAT!'}
            </h2>
            <p className="text-slate-300 mb-6">
              {winner === 'player'
                ? 'You destroyed the entire enemy fleet!'
                : 'The AI has sunk all your ships.'}
            </p>
            <button
              onClick={handlePlayAgain}
              className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-lg font-bold 
                transition-all border border-cyan-400/50 shadow-lg shadow-cyan-900/40 
                hover:shadow-cyan-800/60 active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-6 flex-wrap">
        {[
          { color: 'bg-slate-700/50', label: 'Water', border: 'border-slate-600/50' },
          { color: 'bg-blue-500/70', label: 'Ship', border: 'border-blue-400/50' },
          { color: 'bg-red-500/80', label: 'Hit', border: 'border-red-400/50' },
          { color: 'bg-slate-600/60', label: 'Miss', border: 'border-slate-500/50' },
          { color: 'bg-red-700/80', label: 'Sunk', border: 'border-red-500/50' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className={`w-4 h-4 ${item.color} border ${item.border} rounded-sm`}
            />
            <span className="text-xs text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
