import { Player, Position, EMPTY, BLACK, WHITE, BOARD_SIZE, Difficulty } from '../core/types';
import { Board } from '../core/Board';
import { evaluate, getOrderedMoves, createsOpenFour, createsDoubleThree } from './evaluate';
import {
  tt, TTEntry, TT_EXACT, TT_ALPHA, TT_BETA,
  computeZobrist, xorPiece,
} from './transposition';

// Search state for iterative deepening
interface SearchContext {
  nodesExplored: number;
  timeoutAt: number;
  abort: boolean;
  bestMove: Position | null;
  bestScore: number;
}

// Depth per difficulty level
const DIFFICULTY_DEPTH: Record<number, number> = {
  1: 2,   // Easy
  2: 4,   // Medium
  3: 6,   // Hard
  4: 8,   // Expert
};

// Time limit per move (ms)
const MOVE_TIME_LIMIT: Record<number, number> = {
  1: 500,
  2: 1000,
  3: 3000,
  4: 10000,
};

/**
 * Move the TT best-move to the front of the candidate list.
 */
function prioritizeTTMove(candidates: Position[], bestMove: Position | null): void {
  if (!bestMove) return;
  const idx = candidates.findIndex(p => p.row === bestMove.row && p.col === bestMove.col);
  if (idx > 0) {
    const [item] = candidates.splice(idx, 1);
    candidates.unshift(item);
  }
}

/**
 * AI entry point: find the best move for the given player.
 * Uses iterative deepening with alpha-beta pruning + transposition table.
 */
export function findBestMove(
  board: Board,
  player: Player,
  difficulty: Difficulty
): Position | null {
  const maxDepth = DIFFICULTY_DEPTH[difficulty];
  const timeLimit = MOVE_TIME_LIMIT[difficulty];

  const ctx: SearchContext = {
    nodesExplored: 0,
    timeoutAt: Date.now() + timeLimit,
    abort: false,
    bestMove: null,
    bestScore: -Infinity,
  };

  // Clear TT for new search
  tt.clear();

  const candidates = getOrderedMoves(board, player);
  if (candidates.length === 0) return null;

  // If someone can win immediately, take it
  for (const pos of candidates) {
    const testBoard = board.clone();
    testBoard.setCell(pos.row, pos.col, player);
    if (testBoard.checkWinAt(pos.row, pos.col)) {
      return pos;
    }
  }

  // Check if opponent has an immediate win threat
  const opponent = player === BLACK ? WHITE : BLACK;
  for (const pos of candidates) {
    const testBoard = board.clone();
    testBoard.setCell(pos.row, pos.col, opponent);
    if (testBoard.checkWinAt(pos.row, pos.col)) {
      return pos; // Block it
    }
  }

  // Pre-search: open-four or double-three = forced win
  for (const pos of candidates) {
    if (createsOpenFour(board, pos.row, pos.col, player)) return pos;
  }
  for (const pos of candidates) {
    if (createsDoubleThree(board, pos.row, pos.col, player)) return pos;
  }

  // Pre-search: opponent has open-four → must block
  for (const pos of candidates) {
    if (createsOpenFour(board, pos.row, pos.col, opponent)) return pos;
  }

  // Compute root Zobrist hash
  const [rootH1, rootH2] = computeZobrist(board);

  // Iterative deepening
  for (let depth = 2; depth <= maxDepth; depth += 2) {
    if (ctx.abort || Date.now() >= ctx.timeoutAt) break;

    tt.newGeneration();

    const alpha = -Infinity;
    const beta = Infinity;

    const result = alphaBetaRoot(board, player, depth, alpha, beta, ctx, rootH1, rootH2);
    if (!ctx.abort) {
      ctx.bestMove = result.move;
      ctx.bestScore = result.score;
    }
  }

  // Fallback: return first candidate if search didn't find anything
  return ctx.bestMove || candidates[0];
}

interface RootResult {
  move: Position | null;
  score: number;
}

function alphaBetaRoot(
  board: Board,
  player: Player,
  maxDepth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext,
  h1: number,
  h2: number,
  useTT: boolean = true,
): RootResult {
  let bestScore = -Infinity;
  let bestMove: Position | null = null;

  // Probe TT for best-move ordering (if enabled)
  const entry = useTT ? tt.get(h1, h2) : undefined;
  const candidates = getOrderedMoves(board, player);
  prioritizeTTMove(candidates, entry?.bestMove ?? null);

  for (const pos of candidates) {
    if (ctx.abort) break;

    const testBoard = board.clone();
    testBoard.setCell(pos.row, pos.col, player);
    const [nh1, nh2] = xorPiece(h1, h2, pos.row, pos.col, player);

    const score = alphaBeta(
      testBoard,
      maxDepth - 1,
      alpha,
      beta,
      false,   // opponent to play next
      player,
      ctx,
      nh1,
      nh2,
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = pos;
    }

    alpha = Math.max(alpha, bestScore);
  }

  // Store root in TT (depth = maxDepth, always EXACT since we searched all)
  if (useTT && !ctx.abort) {
    tt.set(h1, h2, {
      depth: maxDepth,
      score: bestScore,
      flag: TT_EXACT,
      bestMove,
    });
  }

  return { move: bestMove, score: bestScore };
}

function alphaBeta(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiPlayer: Player,
  ctx: SearchContext,
  h1: number,
  h2: number,
  useTT: boolean = true,
): number {
  ctx.nodesExplored++;

  // ------------------------------------------------------------------
  // 1. Transposition Table probe
  // ------------------------------------------------------------------
  const entry = useTT ? tt.get(h1, h2) : undefined;
  if (entry && entry.depth >= depth) {
    if (entry.flag === TT_EXACT) {
      return entry.score;
    }
    if (entry.flag === TT_ALPHA) {
      // Upper bound: raise alpha
      alpha = Math.max(alpha, entry.score);
    } else if (entry.flag === TT_BETA) {
      // Lower bound: lower beta
      beta = Math.min(beta, entry.score);
    }
    if (alpha >= beta) {
      return entry.score;
    }
  }

  // ------------------------------------------------------------------
  // 2. Timeout check (every 1000 nodes)
  // ------------------------------------------------------------------
  if (ctx.nodesExplored % 1000 === 0 && Date.now() >= ctx.timeoutAt) {
    ctx.abort = true;
    return 0;
  }

  // ------------------------------------------------------------------
  // 3. Terminal / leaf evaluation
  // ------------------------------------------------------------------
  if (depth === 0) {
    return evaluate(board, aiPlayer);
  }

  const winner = board.checkWinner();
  if (winner) {
    if (winner.winner === aiPlayer) return 10000000 + depth;
    if (winner.winner !== EMPTY) return -10000000 - depth;
  }

  // ------------------------------------------------------------------
  // 4. Search
  // ------------------------------------------------------------------
  const origAlpha = alpha;  // saved for TT flag determination

  if (maximizing) {
    let maxEval = -Infinity;
    let bestMove: Position | null = null;
    const curPlayer = aiPlayer;
    const candidates = getOrderedMoves(board, curPlayer);
    prioritizeTTMove(candidates, entry?.bestMove ?? null);

    for (const pos of candidates) {
      if (ctx.abort) break;

      const child = board.clone();
      child.setCell(pos.row, pos.col, curPlayer);
      const [nh1, nh2] = xorPiece(h1, h2, pos.row, pos.col, curPlayer);

      const evalScore = alphaBeta(child, depth - 1, alpha, beta, false, aiPlayer, ctx, nh1, nh2);

      if (evalScore > maxEval) {
        maxEval = evalScore;
        bestMove = pos;
      }
      alpha = Math.max(alpha, evalScore);

      if (beta <= alpha) break; // Beta cutoff
    }

    // Store in TT
    if (useTT) {
      let flag: number;
      if (maxEval <= origAlpha) flag = TT_ALPHA;
      else if (maxEval >= beta) flag = TT_BETA;
      else flag = TT_EXACT;

      if (!ctx.abort) {
        tt.set(h1, h2, { depth, score: maxEval, flag, bestMove });
      }
    }
    return maxEval;

  } else {
    // Minimizing
    let minEval = Infinity;
    let bestMove: Position | null = null;
    const opponent = aiPlayer === BLACK ? WHITE : BLACK;
    const candidates = getOrderedMoves(board, opponent);
    prioritizeTTMove(candidates, entry?.bestMove ?? null);

    for (const pos of candidates) {
      if (ctx.abort) break;

      const child = board.clone();
      child.setCell(pos.row, pos.col, opponent);
      const [nh1, nh2] = xorPiece(h1, h2, pos.row, pos.col, opponent);

      const evalScore = alphaBeta(child, depth - 1, alpha, beta, true, aiPlayer, ctx, nh1, nh2);

      if (evalScore < minEval) {
        minEval = evalScore;
        bestMove = pos;
      }
      beta = Math.min(beta, evalScore);

      if (beta <= alpha) break; // Alpha cutoff
    }

    // Store in TT
    if (useTT) {
      let flag: number;
      if (minEval <= origAlpha) flag = TT_ALPHA;
      else if (minEval >= beta) flag = TT_BETA;
      else flag = TT_EXACT;

      if (!ctx.abort) {
        tt.set(h1, h2, { depth, score: minEval, flag, bestMove });
      }
    }
    return minEval;
  }
}

// ===== Suggestions API (for "show me the best moves") =====

export interface Suggestion {
  row: number;
  col: number;
  score: number;
  winRate: number; // 0–100
}

const NUM_SUGGESTIONS = 6;

/**
 * Score a single move by doing a shallow search + evaluation.
 * Does NOT use the transposition table (independent calls, short depth).
 */
function scoreMove(board: Board, row: number, col: number, player: Player, depth: number): number {
  const child = board.clone();
  child.setCell(row, col, player);
  if (child.checkWinAt(row, col)) return 10000000;
  // Run a shallow minimax from the opponent's perspective, no TT
  return alphaBeta(child, depth, -Infinity, Infinity, false, player, {
    nodesExplored: 0,
    timeoutAt: Date.now() + 200,
    abort: false,
    bestMove: null,
    bestScore: 0,
  }, 0, 0, false);  // no TT for suggestions
}

/**
 * Normalize suggestion scores to intuitive 5–95 win rates.
 */
function normalizeWinRates(suggestions: Suggestion[]): Suggestion[] {
  if (suggestions.length <= 1) {
    return suggestions.map(s => ({ ...s, winRate: 50 }));
  }

  const scores = suggestions.map(s => s.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  if (max - min < 1) {
    const wr = scores[0] >= 10000000 ? 99 : 50;
    return suggestions.map(s => ({ ...s, winRate: wr }));
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance) || 1;

  return suggestions.map(s => {
    const z = (s.score - mean) / std;
    const percentile = 1 / (1 + Math.exp(-z * 1.5));
    const winRate = Math.round(5 + percentile * 90);
    return { ...s, winRate };
  });
}

/**
 * Returns top N scored positions for the current player.
 * Does a shallow search so it's fast enough for on-demand display.
 */
export function getSuggestions(
  board: Board,
  player: Player,
  difficulty: Difficulty,
  count: number = NUM_SUGGESTIONS,
): Suggestion[] {
  const searchDepth = Math.min(DIFFICULTY_DEPTH[difficulty], 7);
  const allCandidates = getOrderedMoves(board, player);

  // Always surface immediate wins and unstoppable threats
  const wins: Suggestion[] = [];
  const rest: Position[] = [];
  for (const pos of allCandidates) {
    if (wins.length >= count) break;
    const test = board.clone();
    test.setCell(pos.row, pos.col, player);
    if (test.checkWinAt(pos.row, pos.col)) {
      wins.push({ row: pos.row, col: pos.col, score: 10000001, winRate: 100 });
    } else if (createsOpenFour(board, pos.row, pos.col, player)) {
      wins.push({ row: pos.row, col: pos.col, score: 10000000, winRate: 99 });
    } else if (createsDoubleThree(board, pos.row, pos.col, player)) {
      wins.push({ row: pos.row, col: pos.col, score: 9999999, winRate: 98 });
    } else {
      rest.push(pos);
    }
  }
  if (wins.length >= count) {
    return wins.slice(0, count);
  }

  // Score remaining candidates with shallow search
  const candidates = rest.slice(0, 15);
  const scored: Suggestion[] = candidates.map(pos => {
    const score = scoreMove(board, pos.row, pos.col, player, searchDepth);
    return { row: pos.row, col: pos.col, score, winRate: 50 };
  });

  scored.sort((a, b) => b.score - a.score);
  const remaining = count - wins.length;
  const result = [...wins, ...scored.slice(0, remaining)];
  return normalizeWinRates(result);
}
