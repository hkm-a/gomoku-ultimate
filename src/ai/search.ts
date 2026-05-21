import { Player, Position, EMPTY, BLACK, WHITE, BOARD_SIZE, Difficulty } from '../core/types';
import { Board } from '../core/Board';
import { evaluate, getOrderedMoves } from './evaluate';

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
 * AI entry point: find the best move for the given player.
 * Uses iterative deepening with alpha-beta pruning.
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

  // Iterative deepening
  for (let depth = 2; depth <= maxDepth; depth += 2) {
    if (ctx.abort || Date.now() >= ctx.timeoutAt) break;

    const alpha = -Infinity;
    const beta = Infinity;

    const result = alphaBetaRoot(board, player, depth, alpha, beta, ctx);
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
  ctx: SearchContext
): RootResult {
  let bestScore = -Infinity;
  let bestMove: Position | null = null;
  const candidates = getOrderedMoves(board, player);

  for (const pos of candidates) {
    if (ctx.abort) break;

    const testBoard = board.clone();
    testBoard.setCell(pos.row, pos.col, player);

    const score = alphaBeta(
      testBoard,
      maxDepth - 1,
      alpha,
      beta,
      false,
      player,
      ctx
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = pos;
    }

    alpha = Math.max(alpha, bestScore);
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
  ctx: SearchContext
): number {
  ctx.nodesExplored++;

  // Check timeout every 1000 nodes
  if (ctx.nodesExplored % 1000 === 0 && Date.now() >= ctx.timeoutAt) {
    ctx.abort = true;
    return 0;
  }

  // Terminal node evaluation
  if (depth === 0) {
    return evaluate(board, aiPlayer);
  }

  // Check for game-ending state
  const winner = board.checkWinner();
  if (winner) {
    if (winner.winner === aiPlayer) return 10000000 + depth; // Win faster = better
    if (winner.winner !== EMPTY) return -10000000 - depth; // Lose = bad
  }

  if (maximizing) {
    let maxEval = -Infinity;
    const candidates = getOrderedMoves(board, aiPlayer);

    for (const pos of candidates) {
      if (ctx.abort) break;

      const child = board.clone();
      child.setCell(pos.row, pos.col, aiPlayer);

      const evalScore = alphaBeta(child, depth - 1, alpha, beta, false, aiPlayer, ctx);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);

      if (beta <= alpha) break; // Beta cut-off
    }

    return maxEval;
  } else {
    let minEval = Infinity;
    const opponent = aiPlayer === BLACK ? WHITE : BLACK;
    const candidates = getOrderedMoves(board, opponent);

    for (const pos of candidates) {
      if (ctx.abort) break;

      const child = board.clone();
      child.setCell(pos.row, pos.col, opponent);

      const evalScore = alphaBeta(child, depth - 1, alpha, beta, true, aiPlayer, ctx);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);

      if (beta <= alpha) break; // Alpha cut-off
    }

    return minEval;
  }
}
