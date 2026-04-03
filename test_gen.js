import { LevelGenerator } from './src/core/LevelGenerator.js';

console.log("Generating Level 15...");
console.time("Level15");
const l15 = LevelGenerator.generateLevel(15);
console.timeEnd("Level15");
console.log(`Par moves: ${l15.par}`);

console.log("\nGenerating Level 50...");
console.time("Level50");
const l50 = LevelGenerator.generateLevel(50);
console.timeEnd("Level50");
console.log(`Par moves: ${l50.par}`);

console.log("\nGenerating Level 100...");
console.time("Level100");
const l100 = LevelGenerator.generateLevel(100);
console.timeEnd("Level100");
console.log(`Par moves: ${l100.par}`);
