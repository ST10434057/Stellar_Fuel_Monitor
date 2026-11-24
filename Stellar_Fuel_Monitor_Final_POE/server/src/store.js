import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.join(here,'..','data');
const seedPath=path.join(dataDir,'seed.json');
const dbPath=path.join(dataDir,'db.json');
export function ensureDb(){if(!fs.existsSync(dbPath))fs.copyFileSync(seedPath,dbPath);}
export function readDb(){ensureDb();return JSON.parse(fs.readFileSync(dbPath,'utf8'));}
export function writeDb(db){fs.writeFileSync(dbPath,JSON.stringify(db,null,2));}
export function resetDb(){fs.copyFileSync(seedPath,dbPath);}
