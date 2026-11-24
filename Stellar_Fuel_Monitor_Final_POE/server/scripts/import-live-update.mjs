import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data', 'live-update-2026-08-20');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'stellar_fuel_monitoring';
const client = new MongoClient(uri, { maxPoolSize: 8 });

const collections = {
  fuel_loading_events_update: ['date'],
  loading_instruction_updates: ['transactionDate'],
  loading_instruction_route_updates: ['transactionDate','loadArriveDate','loadDepartDate','offloadArriveDate','offloadDepartDate'],
  fuel_trip_intervals: ['consumptionDate','intervalStartDate','intervalEndDate','loadArriveDate','loadDepartDate','offloadArriveDate','offloadDepartDate']
};

function toDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

async function importJsonl(db, name, dateFields) {
  const file = path.join(dataDir, `${name}.jsonl`);
  if (!fs.existsSync(file)) throw new Error(`Missing update file: ${file}`);
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  const ops = [];
  let rows = 0;
  async function flush() {
    if (!ops.length) return;
    await db.collection(name).bulkWrite(ops.splice(0), { ordered: false });
  }
  for await (const line of rl) {
    if (!line.trim()) continue;
    const doc = JSON.parse(line);
    for (const field of dateFields) if (doc[field] != null) doc[field] = toDate(doc[field]);
    ops.push({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } });
    rows++;
    if (ops.length >= 500) await flush();
  }
  await flush();
  return rows;
}

try {
  await client.connect();
  const db = client.db(dbName);
  const before = await db.collection('fuel_trip_intervals').countDocuments({}).catch(() => 0);
  console.log(`Connected to ${dbName}. Existing 17-Aug collections are NOT dropped.`);

  for (const [name, dateFields] of Object.entries(collections)) {
    process.stdout.write(`Upserting ${name} ... `);
    const rows = await importJsonl(db, name, dateFields);
    console.log(`${rows.toLocaleString()} rows`);
  }

  await Promise.all([
    db.collection('fuel_loading_events_update').createIndex({ registrationNormalized: 1, date: -1 }, { name: 'registration_date' }),
    db.collection('loading_instruction_updates').createIndex({ loadingInstructionNo: 1 }, { unique: true, name: 'li_unique' }),
    db.collection('loading_instruction_updates').createIndex({ registrationNormalized: 1, transactionDate: -1 }, { name: 'registration_date' }),
    db.collection('loading_instruction_route_updates').createIndex({ loadingInstructionNo: 1 }, { unique: true, name: 'li_route_unique' }),
    db.collection('fuel_trip_intervals').createIndex({ consumptionId: 1 }, { unique: true, name: 'consumption_unique' }),
    db.collection('fuel_trip_intervals').createIndex({ assetId: 1, consumptionDate: -1 }, { name: 'asset_date' }),
    db.collection('fuel_trip_intervals').createIndex({ fuelAttributionConfidence: 1, consumptionDate: -1 }, { name: 'fuel_confidence_date' })
  ]);

  const metadata = JSON.parse(fs.readFileSync(path.join(dataDir, 'update_metadata.json'), 'utf8'));
  metadata.importedAt = new Date();
  metadata.databaseName = dbName;
  await db.collection('database_metadata').replaceOne({ _id: metadata._id }, metadata, { upsert: true });

  const after = await db.collection('fuel_trip_intervals').countDocuments({});
  console.log(`\nDatabase update ready. Fuel-linked interval rows: ${after.toLocaleString()} (${after-before >= 0 ? '+' : ''}${(after-before).toLocaleString()} net).`);
  console.log('The legacy 17-Aug collections and existing trip_context / alert_reviews are preserved.');
} finally {
  await client.close();
}
