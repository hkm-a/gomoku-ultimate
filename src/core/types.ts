// ===== Common Types for Gomoku Ultimate =====

export const BOARD_SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1; // Black goes first
export const WHITE = 2;

export type Player = typeof EMPTY | typeof BLACK | typeof WHITE;
export type CellState = Player;
export type BoardGrid = CellState[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  row: number;
  col: number;
  player: Player;
  timestamp: number;
}

export type GameMode = 'pvp' | 'pvai' | 'aivai';

export type Difficulty = 1 | 2 | 3 | 4; // Easy, Medium, Hard, Expert

export interface GameConfig {
  mode: GameMode;
  difficulty: Difficulty;
  aiPlayer: Player; // Which color the human plays (in PvAI)
  timeLimit: number; // per player in seconds, 0 = no limit
}

export interface WinResult {
  winner: Player;
  line: Position[]; // The 5 winning positions
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'over';

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  1: '简单',
  2: '中等',
  3: '困难',
  4: '专家',
};

export const DIFFICULTY_NAMES_EN: Record<Difficulty, string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
  4: 'Expert',
};

export const MODE_NAMES: Record<GameMode, string> = {
  pvp: '👤 双人对战',
  pvai: '🤖 人机对战',
  aivai: '🧠 AI自对弈',
};

export const MODE_NAMES_EN: Record<GameMode, string> = {
  pvp: '👤 PvP',
  pvai: '🤖 PvAI',
  aivai: '🧠 AI vs AI',
};

// Pattern types for evaluation
export enum Pattern {
  FIVE = 'FIVE',           // 连五
  LIVE_FOUR = 'LIVE_FOUR', // 活四
  RUSH_FOUR = 'RUSH_FOUR', // 冲四
  LIVE_THREE = 'LIVE_THREE', // 活三
  SLEEP_THREE = 'SLEEP_THREE', // 眠三
  LIVE_TWO = 'LIVE_TWO',   // 活二
  SLEEP_TWO = 'SLEEP_TWO', // 眠二
  LIVE_ONE = 'LIVE_ONE',   // 活一
  NONE = 'NONE',
}

// Direction vectors for scanning
export const DIRECTIONS: [number, number][] = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diagonal ↘
  [1, -1],  // diagonal ↙
];
