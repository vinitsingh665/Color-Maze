import { MongoClient } from 'mongodb';
import { LevelGenerator } from '../src/core/LevelGenerator.js';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  if (!uri || uri.includes('<db_password>')) {
    throw new Error("Invalid MongoDB URI (Password not set)");
  }
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  const { id, player } = req.query;
  const levelId = parseInt(id, 10);

  if (isNaN(levelId) || levelId < 11) {
    return res.status(400).json({ error: 'Invalid level ID' });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('colormaze');
    const collection = db.collection('levels');

    // 1. Check if the level already exists in the Community pool
    const existingLevel = await collection.findOne({ id: levelId });

    if (existingLevel) {
      delete existingLevel._id; // Remove mongo id for client
      return res.status(200).json(existingLevel);
    }

    // 2. Player is the Frontier! Generate it natively.
    const newLevel = LevelGenerator.generateLevel(levelId);
    newLevel.discoveredBy = player || "Anonymous Pioneer";

    // 3. Save to MongoDB to freeze it globally
    await collection.insertOne({ ...newLevel });

    delete newLevel._id; 
    return res.status(200).json(newLevel);

  } catch (error) {
    console.warn("[Vercel API] MongoDB connection failed or not configured.", error.message);
    
    // 4. Absolute fail-safe: Even if MongoDB crashes (or not configured yet),
    // serve a level directly using the generator logic so the player experience never stops.
    const fallbackLevel = LevelGenerator.generateLevel(levelId);
    return res.status(200).json(fallbackLevel);
  }
}
