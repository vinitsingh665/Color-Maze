import { LEVELS } from "./src/data/levels.js";

function getStopPosition(grid, startRow, startCol, dr, dc) {
  let row = startRow;
  let col = startCol;
  let path = [];
  while (true) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (nextRow < 0 || nextRow >= grid.length || nextCol < 0 || nextCol >= grid[0].length) break;
    if (grid[nextRow][nextCol] === 1) break;
    row = nextRow;
    col = nextCol;
    path.push({ r: row, c: col });
  }
  return { row, col, path };
}

function solveLevel(level) {
  const g = level.grid;
  const rows = g.length;
  const cols = g[0].length;
  
  // Count total valid cells that need to be painted
  let validCellCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (g[r][c] === 0) validCellCount++;
    }
  }

  // State: { r, c, painted: boolean[][] }
  // Serialize painted matrix for Visited Set
  const serializeState = (r, c, p) => {
    let s = `${r},${c},`;
    for(let i=0; i<rows; i++){
      for(let j=0; j<cols; j++){
        s += p[i][j] ? '1' : '0';
      }
    }
    return s;
  };

  const getHash = (r, c, p) => {
    // try BigInt for faster hashing
    let bitString = "";
    for(let i=0; i<rows; i++){
        for(let j=0; j<cols; j++){
            if(g[i][j]===0) bitString += p[i][j] ? '1': '0';
        }
    }
    return `${r},${c},${bitString}`;
  }

  let startP = Array(rows).fill(0).map(() => Array(cols).fill(false));
  const sr = level.start[0];
  const sc = level.start[1];
  startP[sr][sc] = true;

  let queue = [{ r: sr, c: sc, p: startP, moves: 0 }];
  let visited = new Set();
  visited.add(getHash(sr, sc, startP));

  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 }
  ];

  let maxPainted = 0;
  
  while (queue.length > 0) {
    const { r, c, p, moves } = queue.shift();

    // Check if fully painted
    let paintedCount = 0;
    for(let i=0; i<rows; i++) {
      for(let j=0; j<cols; j++) {
        if (p[i][j]) paintedCount++;
      }
    }
    
    if (paintedCount > maxPainted) maxPainted = paintedCount;

    if (paintedCount === validCellCount) {
      return { solvable: true, moves, maxPainted, validCells: validCellCount };
    }

    for (const { dr, dc } of dirs) {
      const { row: newR, col: newC, path } = getStopPosition(g, r, c, dr, dc);
      
      if (path.length > 0) {
        // Clone painted array
        let nextP = p.map(rowArr => [...rowArr]);
        for (const cell of path) {
          nextP[cell.r][cell.c] = true;
        }

        const hash = getHash(newR, newC, nextP);
        if (!visited.has(hash)) {
          visited.add(hash);
          queue.push({ r: newR, c: newC, p: nextP, moves: moves + 1 });
        }
      }
    }
  }

  return { solvable: false, maxPainted, validCells: validCellCount };
}

async function runAll() {
  for (const level of LEVELS) {
    console.log(`Checking Level ${level.id}: ${level.name}...`);
    try {
      const result = solveLevel(level);
      if (result.solvable) {
        console.log(`✅ Solvable in min ${result.moves} moves. Par: ${level.par}. (Painted: ${result.maxPainted}/${result.validCells})`);
      } else {
        console.log(`❌ IMPOSSIBLE! Max cells reachable: ${result.maxPainted}/${result.validCells}`);
        
        // Let's identify unpainted cells for debugging
        const g = level.grid;
        // console.log(g.map(r => r.join('')).join('\n'));
      }
    } catch(e) {
      console.log(`Error on level ${level.id}: ${e.message}`);
    }
  }
}

runAll();
