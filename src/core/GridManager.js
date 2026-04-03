/**
 * GridManager — 2D grid logic, cell states, collision detection
 */

export const CELL = {
  EMPTY: 0,
  WALL: 1,
  PAINTED: 2,
};

export class GridManager {
  constructor() {
    this.grid = [];
    this.rows = 0;
    this.cols = 0;
    this.totalValid = 0;
    this.paintedCount = 0;
  }

  /**
   * Load a level grid (deep copy)
   */
  loadGrid(gridData) {
    this.rows = gridData.length;
    this.cols = gridData[0].length;
    this.grid = gridData.map((row) => [...row]);
    this.totalValid = 0;
    this.paintedCount = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === CELL.EMPTY) {
          this.totalValid++;
        }
      }
    }
  }

  /**
   * Get cell state
   */
  getCell(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return CELL.WALL;
    return this.grid[row][col];
  }

  /**
   * Paint a cell, returns true if it was newly painted
   */
  paintCell(row, col) {
    if (this.grid[row][col] === CELL.EMPTY) {
      this.grid[row][col] = CELL.PAINTED;
      this.paintedCount++;
      return true;
    }
    return false;
  }

  /**
   * Paint the start cell
   */
  paintStart(row, col) {
    if (this.grid[row][col] === CELL.EMPTY) {
      this.grid[row][col] = CELL.PAINTED;
      this.paintedCount++;
    }
  }

  /**
   * Given a position and direction, find where the ball stops.
   * Returns { row, col, path: [{row, col}, ...] }
   * Direction: 'up' | 'down' | 'left' | 'right'
   */
  getStopPosition(startRow, startCol, direction) {
    const deltas = {
      up: [-1, 0],
      down: [1, 0],
      left: [0, -1],
      right: [0, 1],
    };

    const [dr, dc] = deltas[direction];
    let row = startRow;
    let col = startCol;
    const path = [];

    while (true) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      const nextCell = this.getCell(nextRow, nextCol);

      if (nextCell === CELL.WALL) {
        break;
      }

      row = nextRow;
      col = nextCol;
      path.push({ row, col });
    }

    return { row, col, path };
  }

  /**
   * Check if the ball can move in a direction (at least 1 cell)
   */
  canMove(row, col, direction) {
    const result = this.getStopPosition(row, col, direction);
    return result.path.length > 0;
  }

  /**
   * Check if any move is possible from given position
   */
  hasAnyMove(row, col) {
    return (
      this.canMove(row, col, "up") ||
      this.canMove(row, col, "down") ||
      this.canMove(row, col, "left") ||
      this.canMove(row, col, "right")
    );
  }

  /**
   * Check if all valid cells are painted
   */
  isComplete() {
    return this.paintedCount >= this.totalValid;
  }

  /**
   * Get completion percentage
   */
  getProgress() {
    if (this.totalValid === 0) return 100;
    return Math.round((this.paintedCount / this.totalValid) * 100);
  }

  /**
   * Check if the player is stuck (has moves but all lead to only painted cells,
   * and there are still unpainted cells)
   */
  isStuck(row, col) {
    if (this.isComplete()) return false;
    if (!this.hasAnyMove(row, col)) return true;

    // Check if any reachable move leads to unpainted cells
    const directions = ["up", "down", "left", "right"];
    for (const dir of directions) {
      const result = this.getStopPosition(row, col, dir);
      for (const cell of result.path) {
        if (this.grid[cell.row][cell.col] === CELL.EMPTY) {
          return false;
        }
      }
    }

    // All reachable paths are already painted — could still proceed
    // Only truly stuck if there are unpainted cells AND can't reach them
    return false;
  }
}
