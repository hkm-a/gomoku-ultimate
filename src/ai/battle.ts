/**
 * Battle harness: αβ (negamax via findBestMove) vs TSS head-to-head.
 *
 * Usage:
 *   npx tsx src/ai/battle.ts [games] [abDifficulty] [tssDepth] [--verbose]
 *
 * Examples:
 *   npx tsx src/ai/battle.ts 20 2 2          # AB Medium (d4) vs TSS (d2)
 *   npx tsx src/ai/battle.ts 6 4 2 -v        # AB Expert (d8) vs TSS (d2), verbose
 *   npx tsx src/ai/battle.ts 10 3 3          # AB Hard (d6) vs TSS (d3)
 */

import { Board } from '../core/Board';
import { BLACK, WHITE, EMPTY, CellState, Position, Difficulty } from '../core/types';
import { findBestMove } from './search';
import { computeTSSMove } from './tss';

// ---- Constants ----

const MAX_MOVES = 15 * 15;

// ---- Stats ----

interface BattleStats {
  total: number;
  alphaBetaWins: number;
  alphaBetaWhiteWins: number;
  tssWins: number;
  tssWhiteWins: number;
  draws: number;
}

function emptyStats(): BattleStats {
  return { total: 0, alphaBetaWins: 0, alphaBetaWhiteWins: 0, tssWins: 0, tssWhiteWins: 0, draws: 0 };
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'Easy (d2)',
  2: 'Medium (d4)',
  3: 'Hard (d6)',
  4: 'Expert (d8)',
};

// ---- Single Game ----

function runGame(
  abDifficulty: Difficulty,
  tssDepth: number,
  abIsBlack: boolean,
  verbose: boolean
): 'black' | 'white' | 'draw' {
  const board = new Board();
  let current: CellState = BLACK;

  for (let move = 0; move < MAX_MOVES; move++) {
    const isAB = (current === BLACK) === abIsBlack;
    const pos = isAB
      ? findBestMove(board, current, abDifficulty)
      : computeTSSMove(board, current, tssDepth);

    if (!pos) {
      if (verbose) console.log(`  Player ${current} returned null`);
      return current === BLACK ? 'white' : 'black';
    }

    if (!board.isEmpty(pos.row, pos.col)) {
      if (verbose) console.log(`  Illegal move (${pos.row},${pos.col}) by ${current}`);
      return current === BLACK ? 'white' : 'black';
    }

    board.setCell(pos.row, pos.col, current);
    const win = board.checkWinAt(pos.row, pos.col);
    if (win) return current === BLACK ? 'black' : 'white';

    current = current === BLACK ? WHITE : BLACK;
  }

  return 'draw';
}

// ---- Battle ----

export function runBattle(
  games: number = 10,
  abDifficulty: Difficulty = 2,
  tssDepth: number = 2,
  verbose: boolean = false
): BattleStats {
  const stats = emptyStats();
  stats.total = games;

  for (let i = 0; i < games; i++) {
    const abFirst = i % 2 === 0; // alternate who is BLACK

    if (verbose) {
      console.log(`\n--- Game ${i + 1}/${games} ---`);
      console.log(`  BLACK: ${abFirst ? 'αβ' : 'TSS'}`);
      console.log(`  WHITE: ${abFirst ? 'TSS' : 'αβ'}`);
    }

    const result = runGame(abDifficulty, tssDepth, abFirst, verbose);

    if (result === 'black') {
      if (abFirst) { stats.alphaBetaWins++; if (verbose) console.log('  αβ wins (BLACK)'); }
      else { stats.tssWins++; if (verbose) console.log('  TSS wins (BLACK)'); }
    } else if (result === 'white') {
      if (abFirst) { stats.tssWhiteWins++; if (verbose) console.log('  TSS wins (WHITE)'); }
      else { stats.alphaBetaWhiteWins++; if (verbose) console.log('  αβ wins (WHITE)'); }
    } else {
      stats.draws++;
      if (verbose) console.log('  Draw');
    }
  }

  return stats;
}

export function printStats(stats: BattleStats): void {
  const abTotal = stats.alphaBetaWins + stats.alphaBetaWhiteWins;
  const tssTotal = stats.tssWins + stats.tssWhiteWins;
  const abPct = ((abTotal / stats.total) * 100).toFixed(1);
  const tssPct = ((tssTotal / stats.total) * 100).toFixed(1);

  console.log('\n============= BATTLE RESULT =============');
  console.log(`  Games:        ${stats.total}`);
  console.log(`  αβ wins:      ${abTotal} (${abPct}%)  [B:${stats.alphaBetaWins} W:${stats.alphaBetaWhiteWins}]`);
  console.log(`  TSS wins:     ${tssTotal} (${tssPct}%)  [B:${stats.tssWins} W:${stats.tssWhiteWins}]`);
  console.log(`  Draws:        ${stats.draws}`);
  console.log('========================================');

  if (abTotal > tssTotal) {
    console.log(`🏆 αβ (negamax) series winner by ${abTotal - tssTotal} game(s)!`);
  } else if (tssTotal > abTotal) {
    console.log(`🏆 TSS series winner by ${tssTotal - abTotal} game(s)!`);
  } else {
    console.log(`🤝 Series tied!`);
  }
}

// ---- CLI ----

const isMain = process.argv[1]?.endsWith('battle.ts') || process.argv[1]?.endsWith('battle.js');
if (isMain) {
  const games = parseInt(process.argv[2] || '10', 10);
  const abDifficulty = (parseInt(process.argv[3] || '2', 10) || 2) as Difficulty;
  const tssDepth = parseInt(process.argv[4] || '2', 10) || 2;
  const verbose = process.argv.includes('-v') || process.argv.includes('--verbose');

  console.log(
    `αβ (${DIFFICULTY_LABEL[abDifficulty] ?? '?'}) ` +
    `vs TSS (depth=${tssDepth}) — ` +
    `${games} games, alternating colors`
  );
  const stats = runBattle(games, abDifficulty, tssDepth, verbose);
  printStats(stats);
}
