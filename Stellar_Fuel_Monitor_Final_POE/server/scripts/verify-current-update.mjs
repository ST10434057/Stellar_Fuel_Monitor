import 'dotenv/config';
import { MongoClient } from 'mongodb';
const uri=process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName=process.env.MONGODB_DB || 'stellar_fuel_monitoring';
const client=new MongoClient(uri);
const expected={fuel_loading_events_current:801,vehicle_consumption_current:749,loading_instruction_updates:1022,loading_instruction_route_updates:660,consumption_route_matches_current:749,fuel_tanks_current:5};
try {
  await client.connect(); const db=client.db(dbName);
  const meta=await db.collection('database_metadata').findOne({_id:'stellar_current_update_2026_09_07'});
  if(!meta) throw new Error('07-Sep metadata document is missing');
  for (const [name,min] of Object.entries(expected)) {
    let n;
    if (name==='loading_instruction_updates' || name==='loading_instruction_route_updates') {
      n=await db.collection(name).countDocuments({ transactionDate:{ $gte:new Date('2026-08-13T00:00:00Z'), $lt:new Date('2026-09-08T00:00:00Z') } });
    } else n=await db.collection(name).countDocuments({});
    if(n<min) throw new Error(`${name}: expected at least ${min}, found ${n}`);
    console.log(`${name}: ${n.toLocaleString()} OK`);
  }
  const latest=await db.collection('vehicle_consumption_current').find({}).sort({date:-1}).limit(1).next();
  const linked=await db.collection('vehicle_consumption_current').countDocuments({'matchedFuelEntryIds.0':{$exists:true}});
  const total=await db.collection('vehicle_consumption_current').countDocuments({});
  const sepLis=await db.collection('loading_instruction_updates').countDocuments({transactionDate:{$gte:new Date('2026-09-01T00:00:00Z'),$lt:new Date('2026-09-08T00:00:00Z')}});
  console.log(`Latest current consumption date: ${latest?.date?.toISOString().slice(0,10)}`);
  console.log(`Current fuel corroboration: ${linked}/${total} (${(linked/total*100).toFixed(1)}%)`);
  console.log(`Loading Instructions 01-07 Sep: ${sepLis}`);
  if(latest?.date?.toISOString().slice(0,10)!=='2026-09-03') throw new Error('Latest consumption date is not 2026-09-03');
  if(linked!==total) throw new Error('Not every current consumption row has a corroborating detailed fuel row');
  console.log('VERIFY SUCCESS - dataset 07-Sep / latest complete fuel-consumption 03-Sep / route context through 04-Sep.');
} finally { await client.close(); }
