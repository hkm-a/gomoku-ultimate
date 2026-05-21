import { BOARD_SIZE, Player, CellState, EMPTY, BLACK, WHITE, DIRECTIONS, Pattern, Position } from '../core/types';
import { Board } from '../core/Board';

// ===== Pattern Scores =====
// These weights determine AI playing style
const SCORES: Record<string, number> = {
  FIVE: 10000000,
  LIVE_FOUR: 500000,
  RUSH_FOUR: 50000,
  LIVE_THREE: 15000,
  SLEEP_THREE: 2000,
  LIVE_TWO: 500,
  SLEEP_TWO: 100,
  LIVE_ONE: 50,
};

// Position weight table (distance from center)
// Center is (7,7) on a 15x15 board
function getPositionWeight(row: number, col: number): number {
  const center = Math.floor(BOARD_SIZE / 2);
  const dr = Math.abs(row - center);
  const dc = Math.abs(col - center);
  const dist = Math.max(dr, dc);
  // Linear decay from center
  return Math.max(0.3, 1.0 - dist * 0.05);
}

// ===== Pattern Recognition =====

interface PatternResult {
  pattern: Pattern;
  count: number;
  openEnds: number;
}

/**
 * Analyze a line (row, column, or diagonal) segment for patterns.
 * Scans consecutive stones of the same color.
 */
function analyzeLineSegment(
  board: Board,
  startRow: number, startCol: number,
  dr: number, dc: number,
  player: Player
): PatternResult[] {
  const results: PatternResult[] = [];
  let i = 0;
  const maxLen = BOARD_SIZE;

  while (i < maxLen) {
    const r = startRow + dr * i;
    const c = startCol + dc * i;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;

    if (board.grid[r][c] === player) {
      // Count consecutive stones
      let count = 0;
      let j = i;
      while (j < maxLen) {
        const nr = startRow + dr * j;
        const nc = startCol + dc * j;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (board.grid[nr][nc] !== player) break;
        count++;
        j++;
      }

      // Check if both ends are open
      const beforeR = startRow + dr * (i - 1);
      const beforeC = startCol + dc * (i - 1);
      const afterR = startRow + dr * j;
      const afterC = startCol + dc * j;

      let openEnds = 0;
      if (beforeR >= 0 && beforeR < BOARD_SIZE && beforeC >= 0 && beforeC < BOARD_SIZE) {
        if (board.grid[beforeR][beforeC] === EMPTY) openEnds++;
      } else {
        // Edge counts as blocked
      }
      if (afterR >= 0 && afterR < BOARD_SIZE && afterC >= 0 && afterC < BOARD_SIZE) {
        if (board.grid[afterR][afterC] === EMPTY) openEnds++;
      }

      // Classify pattern
      let pattern: Pattern = Pattern.NONE;
      if (count >= 5) {
        pattern = Pattern.FIVE;
      } else if (count === 4) {
        pattern = openEnds === 2 ? Pattern.LIVE_FOUR : Pattern.RUSH_FOUR;
      } else if (count === 3) {
        pattern = openEnds === 2 ? Pattern.LIVE_THREE : Pattern.SLEEP_THREE;
      } else if (count === 2) {
        pattern = openEnds === 2 ? Pattern.LIVE_TWO : Pattern.SLEEP_TWO;
      } else if (count === 1) {
        pattern = openEnds === 2 ? Pattern.LIVE_ONE : Pattern.NONE;
      }

      if (pattern !== Pattern.NONE) {
        results.push({ pattern, count, openEnds });
      }

      i = j;
    } else {
      i++;
    }
  }

  return results;
}

/**
 * Evaluate the entire board for a given player.
 * Returns a score from that player's perspective.
 */
function evaluatePlayer(board: Board, player: Player): number {
  let score = 0;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board.grid[row][col] === player) {
        // Add position weight
        score += getPositionWeight(row, col) * 1;
      }
    }
  }

  // Scan all lines (rows, columns, diagonals)
  const scanned = new Set<string>();

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board.grid[row][col] !== player) continue;

      for (const [dr, dc] of DIRECTIONS) {
        // Only scan if we're at the start of a potential segment
        const prevR = row - dr;
        const prevC = col - dc;
        if (prevR >= 0 && prevR < BOARD_SIZE && prevC >= 0 && prevC < BOARD_SIZE) {
          if (board.grid[prevR][prevC] === player) continue; // Already counted
        }

        const key = `${row},${col},${dr},${dc}`;
        if (scanned.has(key)) continue;
        scanned.add(key);

        const patterns = analyzeLineSegment(board, row, col, dr, dc, player);
        for (const p of patterns) {
          switch (p.pattern) {
            case Pattern.FIVE: score += SCORES.FIVE; break;
            case Pattern.LIVE_FOUR: score += SCORES.LIVE_FOUR; break;
            case Pattern.RUSH_FOUR: score += SCORES.RUSH_FOUR; break;
            case Pattern.LIVE_THREE: score += SCORES.LIVE_THREE; break;
            case Pattern.SLEEP_THREE: score += SCORES.SLEEP_THREE; break;
            case Pattern.LIVE_TWO: score += SCORES.LIVE_TWO; break;
            case Pattern.SLEEP_TWO: score += SCORES.SLEEP_TWO; break;
            case Pattern.LIVE_ONE: score += SCORES.LIVE_ONE; break;
          }
        }
      }
    }
  }

  return score;
}

/**
 * Threat-aware single-point evaluation for candidate sorting.
 *
 * Scores are deliberately spread wide so that forced wins/blocks
 * always beat positional moves, giving alpha-beta the best ordering.
 *
 * Scoring tiers (per direction, summed across all 4):
 *   FIVE         100,000,000  — immediate win
 *   LIVE_FOUR     10,000,000  — opponent can't block both ends
 *   RUSH_FOUR      1,000,000  — one end blocked, still very dangerous
 *   BROKEN_FOUR      500,000  — X_XXX / XX_XX / XXX_X patterns
 *   LIVE_THREE       100,000  — 2 open ends, can become open four
 *   SLEEP_THREE       20,000  — 1 open end
 *   LIVE_TWO           2,000  — 2 open ends
 *   SLEEP_TWO            300  — 1 open end
 *   POSITIONAL           10+  — center proximity tiebreaker
 */
function threatScore(board: Board, row: number, col: number, player: Player): number {
  let score = 0;
  score += getPositionWeight(row, col) * 10;

  // Temporarily place the piece (safe: synchronous, restored before return)
  board.grid[row][col] = player;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let openEnds = 0;

    // Forward
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board.grid[r][c] === player) count++;
      else if (board.grid[r][c] === EMPTY) { openEnds++; break; }
      else break;
    }

    // Backward
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board.grid[r][c] === player) count++;
      else if (board.grid[r][c] === EMPTY) { openEnds++; break; }
      else break;
    }

    // Wide scoring tiers
    if (count >= 5) score += 100_000_000;
    else if (count === 4 && openEnds === 2) score += 10_000_000;
    else if (count === 4 && openEnds === 1) score += 1_000_000;
    else if (count === 4) score += 100_000;  // rare: both ends blocked
    else if (count === 3 && openEnds === 2) score += 100_000;
    else if (count === 3 && openEnds === 1) score += 20_000;
    else if (count === 3) score += 2_000;
    else if (count === 2 && openEnds === 2) score += 2_000;
    else if (count === 2 && openEnds === 1) score += 300;
    else if (count === 2) score += 50;
    else if (count === 1 && openEnds >= 1) score += 10;
  }

  // Bonus for creating two threats in different directions simultaneously
  // (e.g. double-three fork).  The per-direction sum above already captures
  // this to some degree, but a flat bonus makes forks stand out even more.
  if (score >= 200_000) score += 500_000;

  board.grid[row][col] = EMPTY;
  return score;
}

/**
 * Check if placing at (row, col) creates an unstoppable threat:
 * open four (4 in a row, both ends free) — opponent can't block both.
 */
export function createsOpenFour(board: Board, row: number, col: number, player: Player): boolean {
  const test = board.clone();
  test.setCell(row, col, player);
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    // Forward
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === player) {
      count++; r += dr; c += dc;
    }
    const open1 = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === EMPTY;
    // Backward
    r = row - dr; c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === player) {
      count++; r -= dr; c -= dc;
    }
    const open2 = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === EMPTY;
    if (count === 4 && open1 && open2) return true;
  }
  return false;
}

/**
 * Check if placing at (row, col) creates two open threes (a fork)
 * in different directions — also an unstoppable threat.
 */
export function createsDoubleThree(board: Board, row: number, col: number, player: Player): boolean {
  const test = board.clone();
  test.setCell(row, col, player);
  let openThrees = 0;
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === player) {
      count++; r += dr; c += dc;
    }
    const open1 = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === EMPTY;
    r = row - dr; c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === player) {
      count++; r -= dr; c -= dc;
    }
    const open2 = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && test.grid[r][c] === EMPTY;
    if (count === 3 && open1 && open2) openThrees++;
  }
  return openThrees >= 2;
}

/**
 * Quick evaluate a single point for candidate sorting (legacy wrapper).
 */
function quickPointEval(board: Board, row: number, col: number, player: Player): number {
  return threatScore(board, row, col, player);
}

/**
 * Full board evaluation from AI's perspective.
 * Positive = good for AI, Negative = good for opponent.
 */
export function evaluate(board: Board, aiPlayer: Player): number {
  const opponent = aiPlayer === BLACK ? WHITE : BLACK;
  const aiScore = evaluatePlayer(board, aiPlayer);
  const oppScore = evaluatePlayer(board, opponent);
  return aiScore - oppScore;
}

/**
 * Generate and score candidate moves sorted by potential.
 * Best moves first → better Alpha-Beta pruning.
 */
export function getOrderedMoves(board: Board, player: Player): Position[] {
  const candidates = board.getCandidateMoves(2);

  // If board is empty, return center
  if (candidates.length === 0) {
    const center = Math.floor(BOARD_SIZE / 2);
    return [{ row: center, col: center }];
  }

  // Score each candidate quickly
  const scored = candidates.map(pos => ({
    pos,
    attackScore: quickPointEval(board, pos.row, pos.col, player),
    defenseScore: quickPointEval(board, pos.row, pos.col, player === BLACK ? WHITE : BLACK),
  }));

  // Combined score: highest threat tier wins; ties broken by attack > defense
  scored.sort((a, b) => {
    const tierA = Math.max(a.attackScore, a.defenseScore);
    const tierB = Math.max(b.attackScore, b.defenseScore);
    if (tierA !== tierB) return tierB - tierA;
    // Same threat tier: prefer the attacking move
    if (a.attackScore !== b.attackScore) return b.attackScore - a.attackScore;
    return b.defenseScore - a.defenseScore;
  });

  return scored.map(s => s.pos);
}
