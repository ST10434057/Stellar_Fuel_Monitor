import { MongoClient } from 'mongodb';

let client = null;
let db = null;
let lastError = null;

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DB || process.env.DB_NAME || 'stellar_fuel_monitoring';
  if (db) return db;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 2500, connectTimeoutMS: 2500, maxPoolSize: 10 });
    await client.connect();
    db = client.db(dbName);
    await db.command({ ping: 1 });
    lastError = null;
    console.log(`Connected to MongoDB: ${dbName}`);
    return db;
  } catch (error) {
    lastError = error;
    try { await client?.close(); } catch {}
    client = null;
    db = null;
    throw error;
  }
}

export function getDatabase() {
  if (!db) throw new Error('Database not connected');
  return db;
}

export function databaseStatus() {
  return {
    connected: Boolean(db),
    databaseName: db?.databaseName || (process.env.MONGODB_DB || process.env.DB_NAME || 'stellar_fuel_monitoring'),
    error: lastError?.message || null
  };
}

export async function closeDatabase() {
  try { await client?.close(); } finally { client = null; db = null; }
}
