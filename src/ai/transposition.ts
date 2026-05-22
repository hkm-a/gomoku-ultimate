import { BOARD_SIZE, EMPTY, Player, Position } from '../core/types';
import { Board } from '../core/Board';

// ===== TT Flags =====
export const TT_EXACT = 0;  // Exact score
export const TT_ALPHA = 1;  // Upper bound (fail-low)
export const TT_BETA = 2;   // Lower bound (fail-high)

export interface TTEntry {
  depth: number;       // Remaining depth searched from this position
  score: number;       // Score from aiPlayer's POV
  flag: number;        // TT_EXACT | TT_ALPHA | TT_BETA
  bestMove: Position | null;  // Best move found for move ordering
}

// ===== Seeded PRNG (mulberry32) =====
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function(): number {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// ===== Zobrist Hash Tables =====
// For each cell (r,c) and each player (1=BLACK, 2=WHITE), we have two 32-bit values.
// Combined as a 64-bit key (h1,h2) to minimize collision risk.
let zobristInit = false;
const zobH1: number[][][] = [];
const zobH2: number[][][] = [];

function ensureZobrist(): void {
  if (zobristInit) return;
  zobristInit = true;
  const rng = mulberry32(0x9E3779B9);
  for (let r = 0; r < BOARD_SIZE; r++) {
    zobH1[r] = [];
    zobH2[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      zobH1[r][c] = [];
      zobH2[r][c] = [];
      // EMPTY=0: not stored (never hashed)
      // BLACK=1
      zobH1[r][c][1] = rng();
      zobH2[r][c][1] = rng();
      // WHITE=2
      zobH1[r][c][2] = rng();
      zobH2[r][c][2] = rng();
    }
  }
}

/**
 * Compute full Zobrist hash of a board position.
 * Returns a 64-bit hash as [h1, h2].
 */
export function computeZobrist(board: Board): [number, number] {
  ensureZobrist();
  let h1 = 0, h2 = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const val = board.grid[r][c];
      if (val !== EMPTY) {
        h1 ^= zobH1[r][c][val];
        h2 ^= zobH2[r][c][val];
      }
    }
  }
  return [h1, h2];
}

/**
 * Incremental XOR: add/remove a piece to/from a hash.
 * Since XOR is self-inverse, the same function works for both add and remove.
 */
export function xorPiece(
  h1: number, h2: number,
  row: number, col: number,
  player: Player
): [number, number] {
  ensureZobrist();
  if (player === EMPTY) return [h1, h2];
  return [
    h1 ^ zobH1[row][col][player],
    h2 ^ zobH2[row][col][player],
  ];
}

// ===== Transposition Table =====

export class TranspositionTable {
  private map: Map<string, TTEntry>;
  private maxSize: number;
  private generation: number = 0;
  hits: number = 0;
  misses: number = 0;

  constructor(maxSize: number = 500_000) {
    this.map = new Map();
    this.maxSize = maxSize;
  }

  /** Call at the start of a new search iteration to track age. */
  newGeneration(): void {
    this.generation++;
    // Full clear when exceeding cap — simpler than LRU, and iterative
    // deepening will repopulate naturally.
    if (this.map.size > this.maxSize) {
      this.map.clear();
      this.generation = 0;
    }
  }

  clear(): void {
    this.map.clear();
    this.generation = 0;
    this.hits = 0;
    this.misses = 0;
  }

  private key(h1: number, h2: number): string {
    return `${h1},${h2}`;
  }

  get(h1: number, h2: number): TTEntry | undefined {
    const k = this.key(h1, h2);
    const entry = this.map.get(k);
    if (entry) {
      this.hits++;
      return entry;
    }
    this.misses++;
    return undefined;
  }

  set(h1: number, h2: number, entry: TTEntry): void {
    if (this.map.size >= this.maxSize) {
      // Table full — discard silently.  Next iteration will clear it.
      return;
    }
    this.map.set(this.key(h1, h2), entry);
  }

  stats(): { size: number; hits: number; misses: number } {
    return { size: this.map.size, hits: this.hits, misses: this.misses };
  }
}

/** Global singleton — shared across the AI module. */
export const tt = new TranspositionTable();
