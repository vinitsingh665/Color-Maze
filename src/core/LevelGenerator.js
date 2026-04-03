export class LevelGenerator {
  
  static generateCandidate(rows, cols) {
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

    // IMPORTANT: don't overfill walls (low density)
    let walls = Math.floor((rows * cols) * 0.15); 
    while (walls--) {
      let r = 1 + Math.floor(Math.random() * (rows - 2));
      let c = 1 + Math.floor(Math.random() * (cols - 2));
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
      // Performance ceiling protection
      if (statesExplored > 2000) return { solvable: false, reason: "timeout" };

      const { r, c, p, moves } = queue.shift();

      let paintedCount = 0;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (p[i][j]) paintedCount++;
        }
      }

      if (paintedCount === validCellCount) {
        // Calculate branching factor approximations
        // formula: branchingFactor^moves = statesExplored => BF = statesExplored ^ (1 / moves)
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

  static getFallbackLevel(rows, cols) {
    // Generates a fully playable snake-like zigzag pattern
    let grid = Array(rows).fill(0).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) { grid[i][0] = 1; grid[i][cols - 1] = 1; }
    for (let j = 0; j < cols; j++) { grid[0][j] = 1; grid[rows - 1][j] = 1; }

    for(let c = 1; c < cols - 1; c += 2) {
       for(let r = 2; r < rows - 2; r++) { grid[r][c] = 1; }
    }
    grid[1][1] = 0;
    return { grid, par: cols };
  }

  static generateLevel(levelIndex) {
    const difficultyProgress = Math.min((levelIndex - 10) / 90, 1.0); 
    const rows = 7 + Math.floor(difficultyProgress * 4);  // max 11
    const cols = 8 + Math.floor(difficultyProgress * 6); // max 14
    
    // Sparse grids naturally require fewer moves because slides cover huge distances
    const minMoves = 5 + Math.floor(difficultyProgress * 6); // 5 to 11

    const startTime = Date.now();
    let bestCandidate = null;

    // Strict 100ms budget limit
    while (Date.now() - startTime < 100) {
      let grid = this.generateCandidate(rows, cols);
      let result = this.solveLevel(grid);

      if (result.solvable) {
        // Is Good Level Filter
        if (result.moves >= minMoves && result.branchingFactor <= 2.2) {
           bestCandidate = { grid, par: result.moves };
           break; // Found perfect level
        }
        // Save best acceptable just in case we don't find perfect
        if (!bestCandidate || result.moves > bestCandidate.par) {
           bestCandidate = { grid, par: result.moves };
        }
      }
    }

    // Fallback protection
    if (!bestCandidate) {
      console.log(`[Level ${levelIndex}] Gen failed constraints or timed out. Using fallback.`);
      bestCandidate = this.getFallbackLevel(rows, cols);
    }

    const hue = (levelIndex * 45 + Math.floor(Math.random() * 60)) % 360;
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
