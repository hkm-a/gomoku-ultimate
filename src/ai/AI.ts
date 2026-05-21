import { Board } from '../core/Board';
import { findBestMove } from './search';
import { Player, Position, Difficulty, EMPTY } from '../core/types';

export type AIProgressCallback = (thinking: boolean) => void;

export class AI {
  private thinking: boolean = false;

  isThinking(): boolean {
    return this.thinking;
  }

  /**
   * Compute the best move for the given player.
   * Returns a promise to allow async UI updates.
   */
  async computeMove(
    board: Board,
    player: Player,
    difficulty: Difficulty,
    onProgress?: AIProgressCallback
  ): Promise<Position | null> {
    this.thinking = true;
    onProgress?.(true);

    // Use setTimeout to allow UI thread to update
    return new Promise(resolve => {
      setTimeout(() => {
        const move = findBestMove(board.clone(), player, difficulty);

        // Add small random variation for easy/medium
        if (move && difficulty <= 2) {
          const noise = Math.random();
          if (difficulty === 1 && noise < 0.3) {
            // Easy: sometimes pick a sub-optimal move
            const candidates = board.getCandidateMoves(2);
            if (candidates.length > 1) {
              const randomPick = candidates[Math.floor(Math.random() * candidates.length)];
              this.thinking = false;
              onProgress?.(false);
              resolve(randomPick);
              return;
            }
          }
        }

        this.thinking = false;
        onProgress?.(false);
        resolve(move);
      }, 50); // Small delay for UI responsiveness
    });
  }
}
