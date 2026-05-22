/**
 * TSS (Threat Space Search) for Gomoku.
 *
 * Core idea: find forcing sequences where the attacker creates threats
 * and the defender must respond to ALL cost squares. If the attacker
 * can maintain threats until a FIVE appears, it's a forced win.
 *
 * Optimization: only search for forced wins in mid-to-late game where
 * real threats exist. Early game falls back to evaluation immediately.
 */

import { Board } from '../core/Board';
import { BOARD_SIZE, EMPTY, BLACK, WHITE, CellState, Position, DIRECTIONS } from '../core/types';
import { getOrderedMoves } from './evaluate';

// ---- Threat Level ----

enum TSSLevel {
  NONE = 0,
  THREE = 1,         // _XXX_ (2 open ends after gain)
  FOUR = 2,          // XXXX_ or _XXXX (1 open end)
  STRAIGHT_FOUR = 3, // _XXXX_ (both ends open — but after gain it's XXXX_ or _XXXX)
  FIVE = 4,
}

interface TSSThreat {
  level: TSSLevel;
  gain: Position;
  costs: Position[];
}

// ---- Direction Scan ----

interface ScanResult {
  count: number;
  openForward: boolean;
  openBackward: boolean;
  forwardEnd: Position;
  backwardEnd: Position;
}

function scanLine(
  grid: CellState[][],
  row: number, col: number,
  dr: number, dc: number,
  player: CellState
): ScanResult {
  let cf = 0, r = row + dr, c = col + dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && grid[r][c] === player) { cf++; r += dr; c += dc; }
  const of = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && grid[r][c] === EMPTY;
  const fe: Position = { row: r, col: c };

  let cb = 0; r = row - dr; c = col - dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && grid[r][c] === player) { cb++; r -= dr; c -= dc; }
  const ob = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && grid[r][c] === EMPTY;
  const be: Position = { row: r, col: c };

  return { count: 1 + cf + cb, openForward: of, openBackward: ob, forwardEnd: fe, backwardEnd: be };
}

/**
 * Find all threats for `player` on the current board.
 * Only scans candidates with distance 1 for speed.
 */
export function findThreats(board: Board, player: CellState): TSSThreat[] {
  const threats: TSSThreat[] = [];
  const candidates = board.getCandidateMoves(1); // tighter = faster

  for (const pos of candidates) {
    board.grid[pos.row][pos.col] = player;

    for (const [dr, dc] of DIRECTIONS) {
      const s = scanLine(board.grid, pos.row, pos.col, dr, dc, player);

      if (s.count >= 5) {
        threats.push({ level: TSSLevel.FIVE, gain: pos, costs: [] });
      } else if (s.count === 4) {
        if (s.openForward && s.openBackward) {
          threats.push({ level: TSSLevel.STRAIGHT_FOUR, gain: pos, costs: [s.forwardEnd, s.backwardEnd] });
        } else if (s.openForward) {
          threats.push({ level: TSSLevel.FOUR, gain: pos, costs: [s.forwardEnd] });
        } else if (s.openBackward) {
          threats.push({ level: TSSLevel.FOUR, gain: pos, costs: [s.backwardEnd] });
        }
      } else if (s.count === 3 && s.openForward && s.openBackward) {
        threats.push({ level: TSSLevel.THREE, gain: pos, costs: [s.forwardEnd, s.backwardEnd] });
      }
    }

    board.grid[pos.row][pos.col] = EMPTY;
  }

  return threats;
}

function deduplicateThreats(threats: TSSThreat[]): TSSThreat[] {
  const map = new Map<string, TSSThreat>();
  for (const t of threats) {
    const key = `${t.gain.row},${t.gain.col}`;
    const existing = map.get(key);
    if (!existing || t.level > existing.level) map.set(key, t);
  }
  return Array.from(map.values()).sort((a, b) => b.level - a.level);
}

/**
 * TSS forced-win search.
 * Limits branching by only trying the top-N threats at each node.
 */
function tssSearch(
  board: Board,
  player: CellState,
  depth: number,
  playedSet: Set<string>,
  maxBranches: number
): Position | null {
  if (depth <= 0) return null;

  const opponent: CellState = player === BLACK ? WHITE : BLACK;
  let threats = deduplicateThreats(findThreats(board, player));
  if (threats.length === 0) return null;

  // Immediate FIVE check
  for (const t of threats) {
    if (t.level === TSSLevel.FIVE) return t.gain;
  }

  threats.sort((a, b) => b.level - a.level);
  const toTry = threats.slice(0, maxBranches);

  for (const threat of toTry) {
    const key = `${threat.gain.row},${threat.gain.col}`;
    if (playedSet.has(key)) continue;

    const nb = board.clone();
    nb.setCell(threat.gain.row, threat.gain.col, player);

    const newPlayed = new Set(playedSet);
    newPlayed.add(key);
    let defenderWon = false;

    for (const cost of threat.costs) {
      const ck = `${cost.row},${cost.col}`;
      if (nb.grid[cost.row]?.[cost.col] === EMPTY) {
        nb.setCell(cost.row, cost.col, opponent);
        newPlayed.add(ck);
        if (nb.checkWinAt(cost.row, cost.col)) { defenderWon = true; break; }
      } else if (nb.grid[cost.row]?.[cost.col] === player) {
        defenderWon = true; break;
      }
    }
    if (defenderWon) continue;

    if (nb.checkWinAt(threat.gain.row, threat.gain.col)) return threat.gain;

    const result = tssSearch(nb, player, depth - 1, newPlayed, maxBranches);
    if (result) return threat.gain;
  }

  return null;
}

/**
 * Main TSS move computation.
 *
 * Performance tuning:
 * - Skip TSS search before move 8 (no real threats yet)
 * - Depth 2, max 5 branches per node
 * - Falls back to getOrderedMoves
 */
export function computeTSSMove(
  board: Board,
  player: CellState,
  maxDepth: number = 3,
  maxBranches: number = 5
): Position | null {
  if (board.moveCount === 0) {
    const c = Math.floor(BOARD_SIZE / 2);
    return { row: c, col: c };
  }

  // Only run TSS search when enough stones exist for real threats
  if (board.moveCount >= 8) {
    const tssResult = tssSearch(board, player, maxDepth, new Set(), maxBranches);
    if (tssResult) return tssResult;
  }

  const ordered = getOrderedMoves(board, player);
  return ordered.length > 0 ? ordered[0] : null;
}
