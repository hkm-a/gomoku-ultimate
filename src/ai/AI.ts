import { Board } from '../core/Board';
import { getSuggestions, Suggestion } from './search';
import { computeTSSMove } from './tss';
import { Player, Position, Difficulty, EMPTY } from '../core/types';

export type AIProgressCallback = (thinking: boolean) => void;

/**
 * Difficulty → TSS depth mapping.
 *   Easy=1   → d1 (fast, weaker)
 *   Medium=2 → d2 (strong, fast)
 *   Hard=3   → d3 (very strong, balanced)
 *   Expert=4 → d4 (strongest)
 */
const DIFFICULTY_DEPTH: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
};

export class AI {
  private thinking: boolean = false;
  private cachedSuggestions: Suggestion[] = [];

  isThinking(): boolean {
    return this.thinking;
  }

  getCachedSuggestions(): Suggestion[] {
    return this.cachedSuggestions;
  }

  /**
   * Compute the best move using TSS (Threat Space Search).
   * Difficulty controls search depth: 1→d1, 2→d2, 3→d3, 4→d4.
   */
  async computeMove(
    board: Board,
    player: Player,
    difficulty: Difficulty,
    onProgress?: AIProgressCallback
  ): Promise<Position | null> {
    this.thinking = true;
    onProgress?.(true);

    return new Promise(resolve => {
      setTimeout(() => {
        const depth = DIFFICULTY_DEPTH[difficulty] ?? 3;
        let move = computeTSSMove(board, player, depth, 5);

        // Easy: add random blunders
        if (move && difficulty === 1) {
          if (Math.random() < 0.3) {
            const candidates = board.getCandidateMoves(2);
            if (candidates.length > 1) {
              move = candidates[Math.floor(Math.random() * candidates.length)];
            }
          }
        }

        this.thinking = false;
        onProgress?.(false);
        resolve(move);
      }, 50);
    });
  }

  /**
   * Analyze the current position and cache suggestions (hints feature).
   * Still uses search.ts for multi-move suggestions.
   */
  async analyzePosition(
    board: Board,
    player: Player,
    difficulty: Difficulty,
  ): Promise<Suggestion[]> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.cachedSuggestions = getSuggestions(board, player, difficulty);
        resolve(this.cachedSuggestions);
      }, 10);
    });
  }

  clearSuggestions(): void {
    this.cachedSuggestions = [];
  }
}
