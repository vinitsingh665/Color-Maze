export class LevelGenerator {

  // Simple seeded PRNG (mulberry32) — ensures each levelIndex
  // produces a unique but reproducible sequence of random numbers.
  static createRNG(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  
  static generateCandidate(rows, cols, rng) {
    let grid = Array(rows).fill(0).map(() => Array(cols).fill(0));

    // border walls
    for (let i = 0; i < rows; i++) {
      grid[i][0] = 1;
      grid[i][cols - 1] = 1;
    }
    for (let j = 0; j < cols; j++) {
      grid[0][j] = 1;
      grid[rows - 1][j] = 1;
    }

    // Wall density varies per-call via the seeded RNG (0.12 to 0.22)
    const density = 0.12 + rng() * 0.10;
    let walls = Math.floor((rows * cols) * density); 
    while (walls--) {
      let r = 1 + Math.floor(rng() * (rows - 2));
      let c = 1 + Math.floor(rng() * (cols - 2));
      grid[r][c] = 1;
    }

    grid[1][1] = 0; // Ensure start is empty
    return grid;
  }

  // Flood fill check
  static testReachability(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    let required = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
         if (grid[r][c] === 0) required++;
      }
    }

    let visited = new Set();
    let q = [{r: 1, c: 1}];
    visited.add("1,1");
    let found = 1;

    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];

    while(q.length > 0) {
      const {r, c} = q.shift();
      for(let i=0; i<4; i++) {
        const nr = r + dr[i];
        const nc = c + dc[i];
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 0) {
          const hash = `${nr},${nc}`;
          if (!visited.has(hash)) {
            visited.add(hash);
            q.push({r: nr, c: nc});
            found++;
          }
        }
      }
    }

    return found === required ? required : -1; // -1 if disconnected components exist
  }

  static solveLevel(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    
    // 1. Flood fill check (instant reject for bad grids)
    const validCellCount = this.testReachability(grid);
    if (validCellCount === -1) return { solvable: false };

    const startP = Array(rows).fill(0).map(() => Array(cols).fill(false));
    startP[1][1] = true;
    
    // queue state: {r, c, p (painted array), moves }
    let queue = [{ r: 1, c: 1, p: startP, moves: 0 }];
    let visited = new Set(); 

    let statesExplored = 0;
    
    const getHash = (r, c, p) => {
      let s = `${r},${c},`;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (grid[i][j] === 0) s += p[i][j] ? '1' : '0';
        }
      }
      return s;
    };
    visited.add(getHash(1, 1, startP));

    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    const getStopPosition = (startRow, startCol, dr, dc) => {
      let row = startRow, col = startCol, path = [];
      while (true) {
        const nr = row + dr;
        const nc = col + dc;
        if (grid[nr][nc] === 1) break;
        row = nr;
        col = nc;
        path.push({ r: row, c: col });
      }
      return { row, col, path };
    };

    while (queue.length > 0) {
      statesExplored++;
      // Performance ceiling protection — raised to 15000 to avoid
      // false-negative rejections on legitimate larger grids
      if (statesExplored > 15000) return { solvable: false, reason: "timeout" };

      const { r, c, p, moves } = queue.shift();

      let paintedCount = 0;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (p[i][j]) paintedCount++;
        }
      }

      if (paintedCount === validCellCount) {
        const branchingFactor = Math.pow(statesExplored, 1 / Math.max(moves, 1));
        return { 
          solvable: true, 
          moves, 
          statesExplored, 
          branchingFactor,
          validCells: validCellCount
        };
      }

      for (const { dr, dc } of dirs) {
        const { row: newR, col: newC, path } = getStopPosition(r, c, dr, dc);
        if (path.length > 0) {
          let nextP = p.map(rowArr => [...rowArr]);
          for (const cell of path) nextP[cell.r][cell.c] = true;
          
          const hash = getHash(newR, newC, nextP);
          if (!visited.has(hash)) {
            visited.add(hash);
            queue.push({ r: newR, c: newC, p: nextP, moves: moves + 1 });
          }
        }
      }
    }

    return { solvable: false, reason: "exhausted" };
  }

  /**
   * Generates a unique, guaranteed-solvable fallback level.
   * Uses levelIndex as seed so every level gets a distinct layout.
   */
  static getFallbackLevel(rows, cols, levelIndex = 0) {
    let grid = Array(rows).fill(0).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) { grid[i][0] = 1; grid[i][cols - 1] = 1; }
    for (let j = 0; j < cols; j++) { grid[0][j] = 1; grid[rows - 1][j] = 1; }

    // Use levelIndex to pick from different zigzag variants:
    //   variant 0 = column-based zigzag (original)
    //   variant 1 = row-based zigzag
    //   variant 2 = column zigzag with offset start
    //   variant 3 = row zigzag with offset start
    const variant = levelIndex % 4;
    
    if (variant === 0 || variant === 2) {
      // Column-based zigzag walls
      const startCol = variant === 2 ? 3 : 2;
      for (let c = startCol; c < cols - 1; c += 2) {
        const colIdx = Math.floor((c - startCol) / 2);
        let isGapBottom = ((colIdx + (variant === 2 ? 1 : 0)) % 2 !== 0);
        let startR = isGapBottom ? 1 : 2;
        let endR = isGapBottom ? rows - 2 : rows - 1;
        for (let r = startR; r < endR; r++) {
          grid[r][c] = 1;
        }
      }
    } else {
      // Row-based zigzag walls (different visual feel)
      const startRow = variant === 3 ? 3 : 2;
      for (let r = startRow; r < rows - 1; r += 2) {
        const rowIdx = Math.floor((r - startRow) / 2);
        let isGapRight = ((rowIdx + (variant === 3 ? 1 : 0)) % 2 !== 0);
        let startC = isGapRight ? 1 : 2;
        let endC = isGapRight ? cols - 2 : cols - 1;
        for (let c = startC; c < endC; c++) {
          grid[r][c] = 1;
        }
      }
    }

    // Sprinkle a few extra walls based on levelIndex for more variety
    const rng = this.createRNG(levelIndex * 9973);
    const extras = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < extras; i++) {
      const r = 1 + Math.floor(rng() * (rows - 2));
      const c = 1 + Math.floor(rng() * (cols - 2));
      // Only place if it doesn't block the start
      if (!(r === 1 && c === 1)) {
        grid[r][c] = 1;
      }
    }

    grid[1][1] = 0;
    return { grid, par: cols };
  }

  static generateLevel(levelIndex) {
    const difficultyProgress = Math.min((levelIndex - 10) / 90, 1.0);

    // Shape variations — different aspect ratios so levels never
    // look the same. Each shape is [rowsOffset, colsOffset] added
    // to the base dimensions. Cycles by levelIndex for variety.
    const shapes = [
      [0, 2],   // wide      (e.g. 7×10)
      [2, 0],   // tall      (e.g. 9×8)
      [1, 1],   // square-ish(e.g. 8×9)
      [0, 4],   // very wide (e.g. 7×12)
      [3, 1],   // tall+     (e.g. 10×9)
      [1, 3],   // wide+     (e.g. 8×11)
      [2, 2],   // square    (e.g. 9×10)
      [0, 3],   // wide      (e.g. 7×11)
      [3, 0],   // very tall (e.g. 10×8)
      [1, 2],   // slightly wide (e.g. 8×10)
      [2, 3],   // large rect (e.g. 9×11)
      [4, 1],   // tall large (e.g. 11×9)
    ];
    const shape = shapes[levelIndex % shapes.length];

    // Base size grows with difficulty: rows 7→8, cols 8→10
    const baseRows = 7 + Math.floor(difficultyProgress * 1.5);
    const baseCols = 8 + Math.floor(difficultyProgress * 2);

    // Apply shape offset, clamped to reasonable bounds
    const rows = Math.min(Math.max(baseRows + shape[0], 6), 13);
    const cols = Math.min(Math.max(baseCols + shape[1], 7), 15);
    
    // Minimum moves scale with area (more cells = more moves needed)
    const area = rows * cols;
    const minMoves = Math.max(3, Math.floor(area * 0.06));

    const startTime = Date.now();
    let bestCandidate = null;

    // Create a seeded RNG unique to this levelIndex so each level
    // explores a different region of the random space
    const rng = this.createRNG(levelIndex * 7919 + 31);

    // Generation budget limit (500ms gives more room for quality levels)
    while (Date.now() - startTime < 500) {
      let grid = this.generateCandidate(rows, cols, rng);
      let result = this.solveLevel(grid);

      if (result.solvable) {
        // Is Good Level Filter
        if (result.moves >= minMoves && result.branchingFactor <= 2.5) {
           bestCandidate = { grid, par: result.moves };
           break; // Found perfect level
        }
        // Save best acceptable just in case we don't find perfect
        if (!bestCandidate || result.moves > bestCandidate.par) {
           bestCandidate = { grid, par: result.moves };
        }
      }
    }

    // Fallback protection — now unique per levelIndex
    if (!bestCandidate) {
      console.log(`[Level ${levelIndex}] Gen failed constraints or timed out. Using fallback.`);
      bestCandidate = this.getFallbackLevel(rows, cols, levelIndex);
    }

    // CRITICAL: Post-generation verification — never serve an unsolvable level.
    const verification = this.solveLevel(bestCandidate.grid);
    if (!verification.solvable) {
      console.warn(`[Level ${levelIndex}] Post-gen verification FAILED! Using fallback.`);
      bestCandidate = this.getFallbackLevel(rows, cols, levelIndex);
      // Verify fallback too — if extra walls broke it, strip them
      const fbCheck = this.solveLevel(bestCandidate.grid);
      if (!fbCheck.solvable) {
        // Ultimate safe fallback: plain zigzag, no extras
        let grid = Array(rows).fill(0).map(() => Array(cols).fill(0));
        for (let i = 0; i < rows; i++) { grid[i][0] = 1; grid[i][cols - 1] = 1; }
        for (let j = 0; j < cols; j++) { grid[0][j] = 1; grid[rows - 1][j] = 1; }
        for (let c = 2; c < cols - 1; c += 2) {
          let isGapBottom = ((c / 2) % 2 !== 0);
          let startR = isGapBottom ? 1 : 2;
          let endR = isGapBottom ? rows - 2 : rows - 1;
          for (let r = startR; r < endR; r++) { grid[r][c] = 1; }
        }
        grid[1][1] = 0;
        bestCandidate = { grid, par: cols };
      }
    }

    const hue = (levelIndex * 45 + Math.floor(rng() * 60)) % 360;
    return {
      id: levelIndex,
      name: `Sector ${levelIndex}`,
      grid: bestCandidate.grid,
      start: [1, 1],
      par: bestCandidate.par,
      colors: { 
        paint: `hsl(${hue}, 85%, 60%)`, 
        glow: `hsl(${hue}, 95%, 75%)`, 
        floor: `hsl(${hue}, 40%, 10%)` 
      }
    };
  }
}
