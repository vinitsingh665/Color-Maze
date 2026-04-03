import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  if (!uri || uri.includes('<db_password>')) throw new Error("Invalid MongoDB URI");
  
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  try {
    const client = await connectToDatabase();
    const db = client.db('colormaze');
    const scoresCol = db.collection('scores');

    // POST /api/score -> Submit a new score
    if (req.method === 'POST') {
      const { levelId, playerName, moves } = req.body;
      
      if (!levelId || !playerName || !moves) {
        return res.status(400).json({ error: "Missing score data" });
      }

      const parsedLevelId = parseInt(levelId, 10);
      const parsedMoves = parseInt(moves, 10);

      // 1. Check existing world record BEFORE inserting new score
      const previousRecord = await scoresCol.findOne(
        { levelId: parsedLevelId },
        { sort: { moves: 1 } }
      );

      const isFirstCompletion = !previousRecord; // No one has ever submitted a score for this level

      // 2. Insert the new score
      await scoresCol.insertOne({
        levelId: parsedLevelId,
        playerName: playerName,
        moves: parsedMoves,
        date: new Date()
      });

      // 3. Determine if this is a new world record
      // Rule: Must be STRICTLY less than previous best (ties keep original holder)
      let isNewRecord = false;
      if (!isFirstCompletion && parsedMoves < previousRecord.moves) {
        isNewRecord = true;
      }

      // 4. Get the current world record after insertion
      const currentRecord = await scoresCol.findOne(
        { levelId: parsedLevelId },
        { sort: { moves: 1 } }
      );

      // 5. Get discoverer info from levels collection
      const levelsCol = db.collection('levels');
      const levelDoc = await levelsCol.findOne({ id: parsedLevelId });
      const discoveredBy = levelDoc?.discoveredBy || null;

      return res.status(200).json({ 
        success: true,
        hasRecord: true,
        bestMoves: currentRecord.moves,
        holder: currentRecord.playerName,
        isNewRecord,           // true if player beat the previous record (strictly less)
        isFirstCompletion,     // true if this is the first score ever for this level
        previousRecord: previousRecord ? previousRecord.moves : null,
        previousHolder: previousRecord ? previousRecord.playerName : null,
        discoveredBy
      });
    }

    // GET /api/score?levelId=15 -> Retrieve the World Record for a level
    if (req.method === 'GET') {
      const { levelId } = req.query;
      if (!levelId) return res.status(400).json({ error: "Missing levelId" });

      // Find the lowest move count for this level
      const record = await scoresCol.findOne(
        { levelId: parseInt(levelId, 10) },
        { sort: { moves: 1 } } // Sort ascending (lowest moves first)
      );

      if (record) {
        return res.status(200).json({
          hasRecord: true,
          bestMoves: record.moves,
          holder: record.playerName
        });
      } else {
        return res.status(200).json({ hasRecord: false });
      }
    }

    res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.warn("[Vercel API] Score DB failed:", error.message);
    res.status(500).json({ error: "Database offline" });
  }
}
