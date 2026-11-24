import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data', 'current-update-2026-09-07');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'stellar_fuel_monitoring';
const client = new MongoClient(uri, { maxPoolSize: 8 });
const start = new Date('2026-08-13T00:00:00.000Z');
const end = new Date('2026-09-08T00:00:00.000Z');

const specs = {
  fuel_loading_events_current: ['date'],
  vehicle_consumption_current: ['date'],
  loading_instruction_updates: ['transactionDate'],
  loading_instruction_route_updates: ['transactionDate','loadArriveDate','loadDepartDate','offloadArriveDate','offloadDepartDate'],
  consumption_route_matches_current: ['consumptionDate','previousConsumptionDate','loadingInstructionDate'],
  fuel_tanks_current: ['snapshotDate']
};
function toDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T00:00:00.000Z`);
}
async function upsertJsonl(db, name, dateFields) {
  const file = path.join(dataDir, `${name}.jsonl`);
  if (!fs.existsSync(file)) throw new Error(`Missing update file: ${file}`);
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding:'utf8' }), crlfDelay: Infinity });
  let ops=[]; let rows=0;
  async function flush(){ if(!ops.length)return; await db.collection(name).bulkWrite(ops.splice(0), { ordered:false }); }
  for await (const line of rl) {
    if (!line.trim()) continue;
    const doc=JSON.parse(line);
    for (const field of dateFields) if (doc[field] != null) doc[field]=toDate(doc[field]);
    ops.push({ replaceOne:{ filter:{ _id:doc._id }, replacement:doc, upsert:true } });
    rows++;
    if (ops.length>=500) await flush();
  }
  await flush(); return rows;
}

try {
  await client.connect();
  const db=client.db(dbName);
  console.log(`Connected to MongoDB: ${dbName}`);
  console.log('Historical/base collections, trip_context, alert_reviews and settings are preserved.');

  // These four collections represent a complete current snapshot, so clear only those
  // update-specific collections before inserting the 07-Sep export.
  for (const name of ['fuel_loading_events_current','vehicle_consumption_current','consumption_route_matches_current','fuel_tanks_current']) {
    await db.collection(name).deleteMany({});
  }
  // Shared LI update collections keep older records but replace this current window.
  await db.collection('loading_instruction_updates').deleteMany({ transactionDate:{ $gte:start, $lt:end } }).catch(()=>{});
  await db.collection('loading_instruction_route_updates').deleteMany({ transactionDate:{ $gte:start, $lt:end } }).catch(()=>{});

  const counts={};
  for (const [name,fields] of Object.entries(specs)) {
    process.stdout.write(`Upserting ${name} ... `);
    counts[name]=await upsertJsonl(db,name,fields);
    console.log(`${counts[name].toLocaleString()} rows`);
  }

  await Promise.all([
    db.collection('fuel_loading_events_current').createIndex({ registrationNormalized:1, date:-1 }, { name:'registration_date' }),
    db.collection('vehicle_consumption_current').createIndex({ registrationNormalized:1, date:-1 }, { name:'registration_date' }),
    db.collection('vehicle_consumption_current').createIndex({ consumptionId:1 }, { unique:true, name:'consumption_unique' }),
    db.collection('consumption_route_matches_current').createIndex({ consumptionId:1 }, { unique:true, name:'consumption_unique' }),
    db.collection('consumption_route_matches_current').createIndex({ assetId:1, consumptionDate:-1 }, { name:'asset_date' }),
    db.collection('loading_instruction_updates').createIndex({ loadingInstructionNo:1 }, { unique:true, name:'li_unique' }),
    db.collection('loading_instruction_route_updates').createIndex({ loadingInstructionNo:1 }, { unique:true, name:'li_route_unique' }),
    db.collection('fuel_tanks_current').createIndex({ snapshotDate:-1, description:1 }, { name:'snapshot_tank' })
  ]).catch(err => console.warn(`Index note: ${err.message}`));

  const metadata=JSON.parse(fs.readFileSync(path.join(dataDir,'update_metadata.json'),'utf8'));
  for (const k of ['updateDate','latestFuelTransactionDate','latestVehicleConsumptionDate','latestCompletedRouteContextDate','latestLoadingInstructionDate','latestCompleteFuelConsumptionDate','currentWindowStart']) {
    if (metadata[k]) metadata[k]=toDate(metadata[k]);
  }
  metadata.importedAt=new Date(); metadata.databaseName=dbName;
  await db.collection('database_metadata').replaceOne({ _id:metadata._id }, metadata, { upsert:true });

  // Force a one-time rebuild against the new dataset on next API startup.
  for (const file of ['precomputed-benchmarks.json','precomputed-daily-summaries.json']) {
    try { fs.rmSync(path.join(here,'..','data',file), { force:true }); } catch {}
  }
  console.log('\n07-Sep current data imported successfully. No historical database collections were dropped.');
} finally { await client.close(); }
