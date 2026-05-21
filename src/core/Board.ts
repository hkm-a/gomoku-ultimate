import { BOARD_SIZE, EMPTY, BLACK, WHITE, CellState, BoardGrid, Position, DIRECTIONS } from './types';

export class Board {
  grid: BoardGrid;
  moveCount: number;

  constructor() {
    this.grid = this.createEmptyGrid();
    this.moveCount = 0;
  }

  private createEmptyGrid(): BoardGrid {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(EMPTY) as CellState[]
    );
  }

  clone(): Board {
    const b = new Board();
    b.grid = this.grid.map(row => [...row]);
    b.moveCount = this.moveCount;
    return b;
  }

  reset(): void {
    this.grid = this.createEmptyGrid();
    this.moveCount = 0;
  }

  getCell(row: number, col: number): CellState {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return EMPTY;
    return this.grid[row][col];
  }

  setCell(row: number, col: number, player: CellState): boolean {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
    if (this.grid[row][col] !== EMPTY) return false;
    this.grid[row][col] = player;
    this.moveCount++;
    return true;
  }

  isEmpty(row: number, col: number): boolean {
    return this.grid[row][col] === EMPTY;
  }

  isFull(): boolean {
    return this.moveCount >= BOARD_SIZE * BOARD_SIZE;
  }

  /**
   * Check if placing `player` at (row, col) results in a win.
   * Returns the winning positions if win, null otherwise.
   */
  checkWinAt(row: number, col: number): Position[] | null {
    const player = this.grid[row][col];
    if (player === EMPTY) return null;

    for (const [dr, dc] of DIRECTIONS) {
      const line: Position[] = [{ row, col }];

      // Scan forward
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.grid[r][c] !== player) break;
        line.push({ row: r, col: c });
      }

      // Scan backward
      for (let i = 1; i < 5; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.grid[r][c] !== player) break;
        line.push({ row: r, col: c });
      }

      if (line.length >= 5) {
        // Sort by position for consistent display
        line.sort((a, b) => a.row - b.row || a.col - b.col);
        return line;
      }
    }

    return null;
  }

  /**
   * Check the entire board for a winner.
   */
  checkWinner(): { winner: CellState; line: Position[] } | null {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (this.grid[row][col] !== EMPTY) {
          const line = this.checkWinAt(row, col);
          if (line) {
            return { winner: this.grid[row][col], line };
          }
        }
      }
    }
    return null;
  }

  /**
   * Get all empty positions adjacent (within distance) to placed pieces.
   * Used for AI move generation.
   */
  getCandidateMoves(distance: number = 2): Position[] {
    const candidates = new Set<string>();
    const hasStone = this.moveCount > 0;

    if (!hasStone) {
      // First move: return center
      const center = Math.floor(BOARD_SIZE / 2);
      return [{ row: center, col: center }];
    }

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (this.grid[row][col] !== EMPTY) {
          for (let dr = -distance; dr <= distance; dr++) {
            for (let dc = -distance; dc <= distance; dc++) {
              const nr = row + dr;
              const nc = col + dc;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                if (this.grid[nr][nc] === EMPTY) {
                  candidates.add(`${nr},${nc}`);
                }
              }
            }
          }
        }
      }
    }

    return Array.from(candidates).map(s => {
      const [r, c] = s.split(',').map(Number);
      return { row: r, col: c };
    });
  }

  /**
   * For display: convert grid to 2D array of numbers
   */
  toJSON(): number[][] {
    return this.grid.map(row => [...row]);
  }
}
