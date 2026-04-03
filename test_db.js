import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log("Connecting to:", process.env.MONGODB_URI.replace(/:([^:@]{3})[^:@]*@/, ':$1***@'));
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
    console.log("SUCCESS! Connected to MongoDB.");
    await client.close();
  } catch (err) {
    console.error("FAIL:", err.message);
  }
}
test();
