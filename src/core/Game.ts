import { Board } from './Board';
import {
  Player, Move, GameMode, Difficulty, GameConfig, GameStatus, WinResult,
  Position, BLACK, WHITE, EMPTY, BOARD_SIZE, DIRECTIONS,
} from './types';

export class Game {
  board: Board;
  currentPlayer: Player;
  status: GameStatus;
  mode: GameMode;
  difficulty: Difficulty;
  aiPlayer: Player;
  winner: Player;
  winLine: Position[];

  private moveHistory: Move[];
  private redoStack: Move[];
  private moveIndex: number; // Current position in history (for undo/redo)

  // Timers (in seconds)
  blackTime: number;
  whiteTime: number;
  timeLimit: number;
  private lastMoveTime: number;
  private timerInterval: number | null;

  // Callbacks
  onStateChange?: () => void;
  onMoveMade?: (move: Move) => void;
  onTimerTick?: () => void;

  constructor(config: GameConfig) {
    this.board = new Board();
    this.currentPlayer = BLACK; // Black always goes first
    this.status = 'idle';
    this.mode = config.mode;
    this.difficulty = config.difficulty;
    this.aiPlayer = config.aiPlayer;
    this.winner = EMPTY;
    this.winLine = [];
    this.moveHistory = [];
    this.redoStack = [];
    this.moveIndex = -1;
    this.blackTime = config.timeLimit;
    this.whiteTime = config.timeLimit;
    this.timeLimit = config.timeLimit;
    this.lastMoveTime = Date.now();
    this.timerInterval = null;
  }

  start(): void {
    this.board.reset();
    this.currentPlayer = BLACK;
    this.status = 'playing';
    this.winner = EMPTY;
    this.winLine = [];
    this.moveHistory = [];
    this.redoStack = [];
    this.moveIndex = -1;
    this.blackTime = this.timeLimit;
    this.whiteTime = this.timeLimit;
    this.lastMoveTime = Date.now();
    this.startTimer();
    this.onStateChange?.();
  }

  reset(): void {
    this.board.reset();
    this.currentPlayer = BLACK;
    this.status = 'idle';
    this.winner = EMPTY;
    this.winLine = [];
    this.moveHistory = [];
    this.redoStack = [];
    this.moveIndex = -1;
    this.blackTime = this.timeLimit;
    this.whiteTime = this.timeLimit;
    this.stopTimer();
    this.onStateChange?.();
  }

  // ===== Timer =====

  private startTimer(): void {
    this.stopTimer();
    if (this.timeLimit <= 0) return;
    this.lastMoveTime = Date.now();
    this.timerInterval = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - this.lastMoveTime) / 1000;
      this.lastMoveTime = now;
      if (this.currentPlayer === BLACK) {
        this.blackTime = Math.max(0, this.blackTime - elapsed);
      } else {
        this.whiteTime = Math.max(0, this.whiteTime - elapsed);
      }
      this.onTimerTick?.();
    }, 200);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ===== Move Execution =====

  makeMove(row: number, col: number): boolean {
    if (this.status !== 'playing') return false;
    if (this.currentPlayer === EMPTY) return false;
    if (!this.board.isEmpty(row, col)) return false;
    if (this.winner !== EMPTY) return false;

    // Remove any redo history on new move
    this.redoStack = [];

    this.board.setCell(row, col, this.currentPlayer);
    const move: Move = { row, col, player: this.currentPlayer, timestamp: Date.now() };
    this.moveHistory.push(move);
    this.moveIndex = this.moveHistory.length - 1;

    this.lastMoveTime = Date.now();

    // Check win
    const winLine = this.board.checkWinAt(row, col);
    if (winLine) {
      this.winner = this.currentPlayer;
      this.winLine = winLine;
      this.status = 'over';
      this.stopTimer();
    } else if (this.board.isFull()) {
      this.status = 'over';
      this.winner = EMPTY; // Draw
      this.winLine = [];
      this.stopTimer();
    } else {
      // Switch player
      this.currentPlayer = (this.currentPlayer === BLACK) ? WHITE : BLACK;
    }

    this.onStateChange?.();
    this.onMoveMade?.(move);
    return true;
  }

  canUndo(): boolean {
    return this.moveIndex >= 0 && this.mode !== 'aivai';
  }

  undo(): boolean {
    if (!this.canUndo()) return false;

    const move = this.moveHistory[this.moveIndex];
    this.board.grid[move.row][move.col] = EMPTY;
    this.board.moveCount--;
    this.redoStack.push(move);
    this.moveHistory.pop();
    this.moveIndex--;

    this.currentPlayer = move.player;
    this.winner = EMPTY;
    this.winLine = [];
    this.status = 'playing';

    // If in PvAI mode and undoing to AI's turn, undo one more
    if (this.mode === 'pvai' && this.currentPlayer !== this.aiPlayer && this.moveIndex >= 0) {
      const prevMove = this.moveHistory[this.moveIndex];
      this.board.grid[prevMove.row][prevMove.col] = EMPTY;
      this.board.moveCount--;
      this.redoStack.push(prevMove);
      this.moveHistory.pop();
      this.moveIndex--;
      this.currentPlayer = prevMove.player;
    }

    this.lastMoveTime = Date.now();
    this.onStateChange?.();
    return true;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0 && this.mode !== 'aivai';
  }

  redo(): boolean {
    if (!this.canRedo()) return false;

    const move = this.redoStack.pop()!;
    this.makeMoveInternal(move);
    this.onStateChange?.();
    return true;
  }

  private makeMoveInternal(move: Move): void {
    this.board.grid[move.row][move.col] = move.player;
    this.board.moveCount++;
    this.moveHistory.push(move);
    this.moveIndex++;

    const winLine = this.board.checkWinAt(move.row, move.col);
    if (winLine) {
      this.winner = move.player;
      this.winLine = winLine;
      this.status = 'over';
      this.stopTimer();
    } else if (this.board.isFull()) {
      this.status = 'over';
      this.winner = EMPTY;
      this.stopTimer();
    } else {
      this.currentPlayer = (move.player === BLACK) ? WHITE : BLACK;
    }
  }

  getLastMove(): Move | null {
    if (this.moveHistory.length === 0) return null;
    return this.moveHistory[this.moveHistory.length - 1];
  }

  getMoveHistory(): Move[] {
    return [...this.moveHistory];
  }

  getCurrentPlayerName(): string {
    if (this.currentPlayer === BLACK) return '黑棋';
    if (this.currentPlayer === WHITE) return '白棋';
    return '';
  }

  getCurrentPlayerColor(): 'black' | 'white' {
    return this.currentPlayer === BLACK ? 'black' : 'white';
  }

  isAIThinking(): boolean {
    if (this.status !== 'playing') return false;
    if (this.mode === 'pvp') return false;
    if (this.mode === 'pvai') return this.currentPlayer === this.aiPlayer;
    if (this.mode === 'aivai') return true;
    return false;
  }

  destroy(): void {
    this.stopTimer();
  }
}
