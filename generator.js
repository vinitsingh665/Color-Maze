import fs from 'fs';

function getStopPosition(grid, startRow, startCol, dr, dc) {
  let row = startRow, col = startCol;
  let path = [];
  while (true) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length) break;
    if (grid[nr][nc] === 1) break;
    row = nr;
    col = nc;
    path.push({ r: row, c: col });
  }
  return { row, col, path };
}

function solveLevel(grid, startR, startC) {
  const rows = grid.length;
  const cols = grid[0].length;
  let validCellCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) validCellCount++;
    }
  }

  let startP = Array(rows).fill(0).map(() => Array(cols).fill(false));
  startP[startR][startC] = true;
  let queue = [{ r: startR, c: startC, p: startP, moves: 0 }];
  let visited = new Set();
  
  const getHash = (r, c, p) => {
    let s = `${r},${c},`;
    for(let i=0; i<rows; i++) for(let j=0; j<cols; j++) if(grid[i][j]===0) s += p[i][j]?'1':'0';
    return s;
  }
  visited.add(getHash(startR, startC, startP));

  const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
  
  while (queue.length > 0) {
    const { r, c, p, moves } = queue.shift();
    let paintedCount = 0;
    for(let i=0; i<rows; i++) for(let j=0; j<cols; j++) if(p[i][j]) paintedCount++;
    if (paintedCount === validCellCount) return { solvable: true, moves };
    
    for (const { dr, dc } of dirs) {
      const { row: newR, col: newC, path } = getStopPosition(grid, r, c, dr, dc);
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
  return { solvable: false };
}

function generateLevel(rows, cols, minMoves, maxWalls) {
  let attempts = 0;
  while(attempts < 10000) {
    attempts++;
    let grid = Array(rows).fill(0).map(() => Array(cols).fill(0));
    // add border walls
    for(let i=0; i<rows; i++) { grid[i][0] = 1; grid[i][cols-1] = 1; }
    for(let i=0; i<cols; i++) { grid[0][i] = 1; grid[rows-1][i] = 1; }
    
    // add random walls
    let numWalls = Math.floor(Math.random() * maxWalls) + 4;
    for(let w=0; w<numWalls; w++) {
      let r = 1 + Math.floor(Math.random() * (rows-2));
      let c = 1 + Math.floor(Math.random() * (cols-2));
      grid[r][c] = 1;
    }
    
    // ensure [1,1] is empty
    grid[1][1] = 0;
    
    // check solvable
    const result = solveLevel(grid, 1, 1);
    if(result.solvable && result.moves >= minMoves) {
       console.log(`Found grid for ${rows}x${cols} in ${result.moves} moves!`);
       return {grid, moves: result.moves};
    }
  }
  return null;
}

const levelsToGenerate = [
  { id: 10, rows: 10, cols: 10, minMoves: 18, maxWalls: 12 },
];

let res = {};
for(let lv of levelsToGenerate) {
  console.log(`Generating Level ${lv.id}...`);
  let gen = generateLevel(lv.rows, lv.cols, lv.minMoves, lv.maxWalls);
  if (gen) {
    res[lv.id] = gen;
    console.log(gen.grid.map(r => JSON.stringify(r) + ',').join('\n'));
  } else {
    console.log(`Failed to generate ${lv.id}`);
  }
}

fs.writeFileSync("generated_levels.json", JSON.stringify(res, null, 2));
