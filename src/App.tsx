import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CellState,
  Difficulty,
  Orientation,
  Position,
  Ship,
  ShipConfig,
  GamePhase,
  GameStats,
  BOARD_SIZE,
  COL_LABELS,
  FleetPreset,
  FLEET_PRESETS,
} from './types';
import {
  setMuted,
  playHitSound,
  playMissSound,
  playSunkSound,
  playPlaceSound,
  playStartSound,
  playGameOverSound,
} from './sounds';
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

const STATS_KEY = 'battleship-stats';
const DEFAULT_STATS: GameStats = { playerName: '', wins: 0, losses: 0, totalShots: 0, totalHits: 0 };

function loadStats(): GameStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_STATS };
}

function saveStats(stats: GameStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function App() {
  const [stats, setStats] = useState<GameStats>(loadStats);
  const [nameInput, setNameInput] = useState(stats.playerName);
  const [gamePhase, setGamePhase] = useState<GamePhase>(() => stats.playerName ? 'placement' : 'setup');
  const shotCountRef = useRef({ shots: 0, hits: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [shotLog, setShotLog] = useState<Array<{ player: string; coord: string; result: string }>>([]);

  // Timer effect
  useEffect(() => {
    if (gamePhase === 'playing') {
      timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gamePhase]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setMuted(!next);
  }, [soundEnabled]);
  const [playerBoard, setPlayerBoard] = useState<CellState[][]>(createEmptyBoard());
  const [enemyBoard, setEnemyBoard] = useState<CellState[][]>(createEmptyBoard());
  const [playerShips, setPlayerShips] = useState<Ship[]>([]);
  const [enemyShips, setEnemyShips] = useState<Ship[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [currentShipIndex, setCurrentShipIndex] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [playerMessage, setPlayerMessage] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [placementMessage, setPlacementMessage] = useState('Place your Carrier (5 cells)');
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);
  const [hoverCells, setHoverCells] = useState<Position[]>([]);
  const [hoverValid, setHoverValid] = useState(false);
  const [lastHit, setLastHit] = useState<Position | null>(null);
  const aiStateRef = useRef<AIStateType>(createAIState());
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(false);
  const [revealEnemyShips, setRevealEnemyShips] = useState(false);
  const [selectedFleet, setSelectedFleet] = useState<FleetPreset>(FLEET_PRESETS[0]);

  const activeShipConfigs = selectedFleet.ships;
  const currentShipConfig: ShipConfig | undefined = activeShipConfigs[currentShipIndex];

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
      playPlaceSound();

      const newShip = createShipFromConfig(currentShipConfig, positions);
      const updatedShips = [...playerShips, newShip];
      setPlayerShips(updatedShips);

      const nextIndex = currentShipIndex + 1;
      if (nextIndex >= activeShipConfigs.length) {
        // All ships placed, let user review before starting
        setCurrentShipIndex(nextIndex);
        setPlacementMessage('All ships placed! Review your layout, then click Start Game!');
      } else {
        setCurrentShipIndex(nextIndex);
        setPlacementMessage(
          `Place your ${activeShipConfigs[nextIndex].name} (${activeShipConfigs[nextIndex].size} cells)`
        );
      }
      setHoverCells([]);
    },
    [playerBoard, playerShips, currentShipIndex, orientation, currentShipConfig, activeShipConfigs]
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
        setPlayerMessage(`You sunk the enemy's ${sunkShip?.name}!`);
        playSunkSound();
        shotCountRef.current.shots++;
        shotCountRef.current.hits++;
      } else if (result === 'hit') {
        setPlayerMessage('Hit!');
        playHitSound();
        shotCountRef.current.shots++;
        shotCountRef.current.hits++;
      } else {
        setPlayerMessage('Miss!');
        playMissSound();
        shotCountRef.current.shots++;
      }
      const coordLabel = `${COL_LABELS[col]}${row + 1}`;
      setShotLog(prev => [...prev, { player: 'You', coord: coordLabel, result }]);
      setAiMessage('');

      if (allShipsSunk(enemyShips)) {
        setGamePhase('gameOver');
        setWinner('player');
        setShowGameOverOverlay(true);
        setPlayerMessage('You win! All enemy ships have been sunk!');
        setAiMessage('');
        playGameOverSound(true);
        setStats(prev => {
          const updated = {
            ...prev,
            wins: prev.wins + 1,
            totalShots: prev.totalShots + shotCountRef.current.shots,
            totalHits: prev.totalHits + shotCountRef.current.hits,
          };
          saveStats(updated);
          return updated;
        });
        return;
      }

      setIsPlayerTurn(false);

      // AI turn after a delay
      setTimeout(() => {
        const aiMove = getAIMove(aiStateRef.current, difficulty, playerBoard, activeShipConfigs);
        const {
          newBoard: aiNewBoard,
          result: aiResult,
          sunkShipId: aiSunkShipId,
        } = processAttack(playerBoard, playerShips, aiMove.row, aiMove.col);

        updateAIAfterAttack(aiStateRef.current, aiMove, aiResult);
        setPlayerBoard(aiNewBoard);

        const aiCoordLabel = `${COL_LABELS[aiMove.col]}${aiMove.row + 1}`;
        if (aiResult === 'sunk') {
          const sunkShip = playerShips.find((s) => s.id === aiSunkShipId);
          setAiMessage(`AI sunk your ${sunkShip?.name}!`);
          playSunkSound();
        } else if (aiResult === 'hit') {
          setAiMessage('AI hit one of your ships!');
          playHitSound();
        } else {
          setAiMessage('AI missed!');
        }
        setShotLog(prev => [...prev, { player: 'AI', coord: aiCoordLabel, result: aiResult }]);

        if (allShipsSunk(playerShips)) {
          setGamePhase('gameOver');
          setWinner('ai');
          setShowGameOverOverlay(true);
          setPlayerMessage('Game Over!');
          setAiMessage('The AI sunk all your ships!');
          playGameOverSound(false);
          setStats(prev => {
            const updated = {
              ...prev,
              losses: prev.losses + 1,
              totalShots: prev.totalShots + shotCountRef.current.shots,
              totalHits: prev.totalHits + shotCountRef.current.hits,
            };
            saveStats(updated);
            return updated;
          });
          return;
        }

        setIsPlayerTurn(true);
      }, 600);
    },
    [gamePhase, isPlayerTurn, enemyBoard, enemyShips, playerBoard, playerShips, difficulty, activeShipConfigs]
  );

  const handleSetupComplete = useCallback(() => {
    const trimmed = nameInput.trim() || 'Admiral';
    const updated = { ...stats, playerName: trimmed };
    setStats(updated);
    saveStats(updated);
    setGamePhase('placement');
  }, [nameInput, stats]);

  const handlePlayAgain = useCallback(() => {
    shotCountRef.current = { shots: 0, hits: 0 };
    setElapsedTime(0);
    setShotLog([]);
    setGamePhase('placement');
    setPlayerBoard(createEmptyBoard());
    setEnemyBoard(createEmptyBoard());
    setPlayerShips([]);
    setEnemyShips([]);
    setOrientation('horizontal');
    setCurrentShipIndex(0);
    setIsPlayerTurn(true);
    setPlayerMessage('');
    setAiMessage('');
    setPlacementMessage(`Place your ${selectedFleet.ships[0].name} (${selectedFleet.ships[0].size} cells)`);
    setWinner(null);
    setHoverCells([]);
    setLastHit(null);
    setShowNewGameConfirm(false);
    setShowGameOverOverlay(false);
    setRevealEnemyShips(false);
    aiStateRef.current = createAIState();
  }, [selectedFleet]);

  const handleNewGame = useCallback(() => {
    if (gamePhase === 'playing') {
      setShowNewGameConfirm(true);
    } else {
      handlePlayAgain();
    }
  }, [gamePhase, handlePlayAgain]);

  const handleRandomPlacement = useCallback(() => {
    const { board, ships } = placeShipsRandomly(activeShipConfigs);
    setPlayerBoard(board);
    setPlayerShips(ships);
    setCurrentShipIndex(activeShipConfigs.length);
    setPlacementMessage('Ships placed randomly. Review your layout, then click Start Game!');
    setHoverCells([]);
  }, [activeShipConfigs]);

  const handleStartGame = useCallback(() => {
    if (playerShips.length < activeShipConfigs.length) return;
    const { board: aBoard, ships: aShips } = placeShipsRandomly(activeShipConfigs);
    setEnemyBoard(aBoard);
    setEnemyShips(aShips);
    setGamePhase('playing');
    setPlayerMessage('Your turn! Click on the enemy board to attack.');
    setAiMessage('');
    setElapsedTime(0);
    setShotLog([]);
    playStartSound();
  }, [playerShips, activeShipConfigs]);

  const handleUndoLastShip = useCallback(() => {
    if (playerShips.length === 0) return;
    const newShips = playerShips.slice(0, -1);
    // Rebuild board from remaining ships
    const board = createEmptyBoard();
    for (const ship of newShips) {
      for (const pos of ship.positions) {
        board[pos.row][pos.col] = 'ship';
      }
    }
    setPlayerBoard(board);
    setPlayerShips(newShips);
    setCurrentShipIndex(newShips.length);
    setPlacementMessage(
      `Place your ${activeShipConfigs[newShips.length].name} (${activeShipConfigs[newShips.length].size} cells)`
    );
    setHoverCells([]);
  }, [playerShips, activeShipConfigs]);

  const handleResetPlacement = useCallback(() => {
    setPlayerBoard(createEmptyBoard());
    setPlayerShips([]);
    setCurrentShipIndex(0);
    setPlacementMessage(`Place your ${activeShipConfigs[0].name} (${activeShipConfigs[0].size} cells)`);
    setHoverCells([]);
  }, [activeShipConfigs]);

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
    } else if (cell === 'ship' && isEnemy && revealEnemyShips) {
      bgClass = 'bg-blue-500/40';
      borderClass = 'border-blue-400/30';
      content = '■';
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
        className={`w-6 h-6 sm:w-9 sm:h-9 md:w-10 md:h-10 border ${borderClass} ${bgClass} ${cursorClass} 
          flex items-center justify-center text-xs sm:text-sm transition-all duration-150 
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
    <div className="inline-block overflow-x-auto max-w-full">
      {/* Column headers */}
      <div className="flex ml-6 sm:ml-9 md:ml-10">
        {COL_LABELS.map((label) => (
          <div
            key={label}
            className="w-6 h-6 sm:w-9 md:w-10 flex items-center justify-center text-xs font-bold text-cyan-300/80"
          >
            {label}
          </div>
        ))}
      </div>
      {/* Rows */}
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="flex">
          {/* Row number */}
          <div className="w-6 h-6 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center text-xs font-bold text-cyan-300/80">
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
          {activeShipConfigs.map((config) => {
            const ship = ships.find((s) => s.id === config.id);
          const sunk = ship ? isShipSunk(ship) : false;
          const hitCount = ship ? ship.hits.size : 0;
          const isEnemyPanel = label === 'Enemy Ships';

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
                        : !isEnemyPanel && ship && i < hitCount
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

  const accuracy = stats.totalShots > 0 ? Math.round((stats.totalHits / stats.totalShots) * 100) : 0;
  const totalGames = stats.wins + stats.losses;

  if (gamePhase === 'setup') {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">
          <span className="text-cyan-400">BATTLE</span>
          <span className="text-slate-300">SHIP</span>
        </h1>
        <p className="text-slate-400 text-sm mb-8">Naval Combat Strategy Game</p>
        <div className="bg-slate-800/80 rounded-2xl p-8 max-w-sm w-full border border-slate-600 shadow-2xl">
          <label className="block text-sm font-semibold text-cyan-300 mb-2 uppercase tracking-wider">
            Commander Name
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetupComplete()}
            placeholder="Enter your name..."
            className="w-full px-4 py-3 bg-slate-700 border border-slate-500 rounded-lg text-white placeholder-slate-400
              focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-lg"
            autoFocus
          />
          <button
            onClick={handleSetupComplete}
            className="w-full mt-4 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-lg font-bold
              transition-all border border-cyan-400/50 shadow-lg shadow-cyan-900/40
              hover:shadow-cyan-800/60 active:scale-95"
          >
            Set Sail!
          </button>
          {totalGames > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-600">
              <h3 className="text-sm font-bold text-slate-300 mb-2">Previous Record</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-green-400 text-xl font-black">{stats.wins}</div>
                  <div className="text-xs text-slate-400">Wins</div>
                </div>
                <div>
                  <div className="text-red-400 text-xl font-black">{stats.losses}</div>
                  <div className="text-xs text-slate-400">Losses</div>
                </div>
                <div>
                  <div className="text-cyan-400 text-xl font-black">{accuracy}%</div>
                  <div className="text-xs text-slate-400">Accuracy</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <footer className="mt-12 text-center text-slate-500 text-xs">
          Created by Max Sapo solely for the purpose of the Cognition Labs interview demo
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4 sm:p-6">
      {/* Header */}
      <header className="text-center mb-6 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex gap-2">
          <button
            onClick={toggleSound}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold
              transition-colors border border-slate-600/50 text-slate-300 hover:text-white"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
          <span className="text-cyan-400">BATTLE</span>
          <span className="text-slate-300">SHIP</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Commander {stats.playerName}</p>
        <button
          onClick={handleNewGame}
          className="absolute right-0 top-1/2 -translate-y-1/2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold
            transition-colors border border-slate-600/50 text-slate-300 hover:text-white"
        >
          New Game
        </button>
      </header>

      {/* Message bar */}
      <div className="max-w-3xl mx-auto mb-4">
        {gamePhase === 'placement' ? (
          <div className="text-center py-2.5 px-4 rounded-lg font-semibold text-sm bg-slate-800/60 border border-slate-700/50 text-cyan-200">
            {placementMessage}
          </div>
        ) : (
          <div className="flex gap-2">
            {playerMessage && (
              <div
                className={`flex-1 text-center py-2.5 px-4 rounded-lg font-semibold text-sm ${
                  winner === 'player'
                    ? 'bg-green-600/30 border border-green-500/50 text-green-300'
                    : 'bg-blue-600/20 border border-blue-500/40 text-blue-200'
                }`}
              >
                {playerMessage}
              </div>
            )}
            {aiMessage && (
              <div
                className={`flex-1 text-center py-2.5 px-4 rounded-lg font-semibold text-sm ${
                  winner === 'ai'
                    ? 'bg-red-600/30 border border-red-500/50 text-red-300'
                    : 'bg-amber-600/20 border border-amber-500/40 text-amber-200'
                }`}
              >
                {aiMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fleet & Difficulty selector - only during placement */}
      {gamePhase === 'placement' && (
        <div className="flex flex-col items-center gap-3 mb-4">
          {/* Fleet preset selector */}
          <div className="flex flex-wrap justify-center gap-2">
            <span className="text-xs text-slate-400 self-center mr-1">Fleet:</span>
            {FLEET_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  if (preset.id !== selectedFleet.id) {
                    setSelectedFleet(preset);
                    setPlayerBoard(createEmptyBoard());
                    setPlayerShips([]);
                    setCurrentShipIndex(0);
                    setPlacementMessage(`Place your ${preset.ships[0].name} (${preset.ships[0].size} cells)`);
                    setHoverCells([]);
                  }
                }}
                disabled={playerShips.length > 0 && preset.id !== selectedFleet.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  selectedFleet.id === preset.id
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : playerShips.length > 0
                      ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-700 border-slate-600/50 text-slate-400 hover:text-white hover:bg-slate-600'
                }`}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{selectedFleet.description}</p>
          {/* Difficulty selector */}
          <div className="flex justify-center gap-2">
            <span className="text-xs text-slate-400 self-center mr-1">Difficulty:</span>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  difficulty === d
                    ? d === 'easy'
                      ? 'bg-green-600 border-green-500 text-white'
                      : d === 'medium'
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-red-600 border-red-500 text-white'
                    : 'bg-slate-700 border-slate-600/50 text-slate-400 hover:text-white hover:bg-slate-600'
                }`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timer display during game */}
      {(gamePhase === 'playing' || gamePhase === 'gameOver') && (
        <div className="text-center mb-2">
          <span className="text-xs text-slate-400">
            ⏱ {formatTime(elapsedTime)}
            {gamePhase === 'playing' && (
              <span className="ml-3 text-slate-500">
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} AI
              </span>
            )}
          </span>
        </div>
      )}

      {/* Placement controls */}
      {gamePhase === 'placement' && (
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {currentShipIndex < activeShipConfigs.length && (
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
          )}
          <button
            onClick={handleRandomPlacement}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold 
              transition-colors border border-purple-500/50 shadow-lg shadow-purple-900/30"
          >
            Random Placement
          </button>
          {playerShips.length > 0 && (
            <>
              <button
                onClick={handleUndoLastShip}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-semibold
                  transition-colors border border-amber-500/50 shadow-lg shadow-amber-900/30"
              >
                Undo Last Ship
              </button>
              <button
                onClick={handleResetPlacement}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold
                  transition-colors border border-red-500/50 shadow-lg shadow-red-900/30"
              >
                Reset All
              </button>
            </>
          )}
          {currentShipIndex >= activeShipConfigs.length && (
            <button
              onClick={handleStartGame}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold
                transition-colors border border-green-500/50 shadow-lg shadow-green-900/30 animate-pulse"
            >
              Start Game
            </button>
          )}
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

      {/* Turn indicator + Shot log */}
      {(gamePhase === 'playing' || gamePhase === 'gameOver') && (
        <div className="max-w-3xl mx-auto mt-4 flex flex-col items-center gap-3">
          {gamePhase === 'playing' && (
            <span
              className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isPlayerTurn
                  ? 'bg-green-600/30 text-green-300 border border-green-500/40'
                  : 'bg-amber-600/30 text-amber-300 border border-amber-500/40 animate-pulse'
              }`}
            >
              {isPlayerTurn ? 'Your Turn' : 'AI Thinking...'}
            </span>
          )}

          {/* Shot history log */}
          {shotLog.length > 0 && (
            <details className="w-full max-w-md">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 text-center">
                Shot Log ({shotLog.length} moves)
              </summary>
              <div className="mt-2 max-h-32 overflow-y-auto bg-slate-800/60 rounded-lg border border-slate-700/50 p-2">
                {shotLog.slice().reverse().map((entry, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5 px-2">
                    <span className={entry.player === 'You' ? 'text-blue-300' : 'text-amber-300'}>
                      {entry.player}
                    </span>
                    <span className="text-slate-400">{entry.coord}</span>
                    <span className={
                      entry.result === 'sunk' ? 'text-red-400 font-bold'
                        : entry.result === 'hit' ? 'text-orange-400'
                          : 'text-slate-500'
                    }>
                      {entry.result.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Game over overlay */}
      {gamePhase === 'gameOver' && showGameOverOverlay && (
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
            <div className="flex flex-col gap-3">
              <button
                onClick={handlePlayAgain}
                className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-lg font-bold 
                  transition-all border border-cyan-400/50 shadow-lg shadow-cyan-900/40 
                  hover:shadow-cyan-800/60 active:scale-95"
              >
                Play Again
              </button>
              <button
                onClick={() => { setShowGameOverOverlay(false); setRevealEnemyShips(true); }}
                className="px-8 py-3 bg-slate-600 hover:bg-slate-500 rounded-xl text-sm font-semibold
                  transition-all border border-slate-500/50"
              >
                View Final Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Play Again banner when viewing final board */}
      {gamePhase === 'gameOver' && !showGameOverOverlay && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-800/95 border-t border-slate-600 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-3">
            <span className={`font-bold ${winner === 'player' ? 'text-green-400' : 'text-red-400'}`}>
              {winner === 'player' ? 'VICTORY!' : 'DEFEAT!'} — Viewing final board
            </span>
            <button
              onClick={handlePlayAgain}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-bold
                transition-colors border border-cyan-400/50"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* New Game confirmation dialog */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-sm mx-4 text-center border border-slate-600 shadow-2xl">
            <h2 className="text-xl font-bold text-amber-300 mb-3">Start New Game?</h2>
            <p className="text-slate-300 mb-6 text-sm">
              Your current game is still in progress. Are you sure you want to start a new game?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowNewGameConfirm(false)}
                className="px-6 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-semibold
                  transition-colors border border-slate-500/50"
              >
                Cancel
              </button>
              <button
                onClick={handlePlayAgain}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold
                  transition-colors border border-red-500/50"
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {totalGames > 0 && (
        <div className="max-w-3xl mx-auto mt-4 flex justify-center gap-6">
          <span className="text-xs text-slate-400">
            <span className="text-green-400 font-bold">{stats.wins}W</span> / <span className="text-red-400 font-bold">{stats.losses}L</span>
          </span>
          <span className="text-xs text-slate-400">
            Accuracy: <span className="text-cyan-400 font-bold">{accuracy}%</span>
          </span>
          <span className="text-xs text-slate-400">
            Games: <span className="text-white font-bold">{totalGames}</span>
          </span>
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

      {/* Footer */}
      <footer className="text-center mt-8 text-slate-500 text-xs">
        Created by Max Sapo solely for the purpose of the Cognition Labs interview demo
      </footer>
    </div>
  );
}

export default App;
