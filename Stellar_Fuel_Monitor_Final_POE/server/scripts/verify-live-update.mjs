import 'dotenv/config';
import { MongoClient } from 'mongodb';
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'stellar_fuel_monitoring';
const client = new MongoClient(uri);
try {
  await client.connect();
  const db=client.db(dbName);
  const names=['fuel_loading_events_update','loading_instruction_updates','loading_instruction_route_updates','fuel_trip_intervals'];
  for (const n of names) console.log(`${n}: ${(await db.collection(n).countDocuments({})).toLocaleString()}`);
  const latest=await db.collection('fuel_trip_intervals').find({validForAnalytics:true}).sort({consumptionDate:-1}).limit(1).next();
  console.log(`Latest valid fuel interval: ${latest?.consumptionDate?.toISOString?.().slice(0,10) || latest?.consumptionDate || 'none'}`);
} finally { await client.close(); }
