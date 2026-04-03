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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('colormaze');

    // --- 1. Most World Records Held ---
    // For each level, find the record (lowest moves). 
    // If tie on moves, earliest date wins (original record holder keeps it).
    // Then count how many records each player holds.
    const scoresCol = db.collection('scores');
    
    // Get all unique level IDs that have scores
    const levelIds = await scoresCol.distinct('levelId');
    
    // For each level, find the world record holder
    const recordHolderCounts = {};
    for (const levelId of levelIds) {
      // Sort by moves ascending, then by date ascending (first submitter wins ties)
      const record = await scoresCol.findOne(
        { levelId },
        { sort: { moves: 1, date: 1 } }
      );
      if (record) {
        const name = record.playerName;
        recordHolderCounts[name] = (recordHolderCounts[name] || 0) + 1;
      }
    }

    // Sort by count descending, take top 10
    const worldRecordLeaders = Object.entries(recordHolderCounts)
      .map(([player, records]) => ({ player, records }))
      .sort((a, b) => b.records - a.records)
      .slice(0, 10);

    // --- 2. Most Levels Discovered ---
    const levelsCol = db.collection('levels');
    const discoveryPipeline = [
      { $match: { discoveredBy: { $exists: true, $ne: null } } },
      { $group: { _id: '$discoveredBy', discoveries: { $sum: 1 } } },
      { $sort: { discoveries: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, player: '$_id', discoveries: 1 } }
    ];
    const discoveryLeaders = await levelsCol.aggregate(discoveryPipeline).toArray();

    return res.status(200).json({
      worldRecordLeaders,
      discoveryLeaders
    });
  } catch (error) {
    console.warn("[Vercel API] Leaderboard failed:", error.message);
    return res.status(500).json({ error: "Database offline" });
  }
}
