import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { routeVariance } from './logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheFile = process.env.GOOGLE_ROUTES_CACHE_FILE || path.join(__dirname, '..', 'data', 'google-routes-cache.json');
let cache = {};
try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { cache = {}; }
const ttlMs = Math.max(1, Number(process.env.GOOGLE_ROUTES_CACHE_DAYS || 30)) * 86400000;

function keyFor(origin, destination, roundTrip) { return crypto.createHash('sha256').update(`${origin}|${destination}|${roundTrip}`).digest('hex'); }
function persist() { try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2)); } catch {} }
export function googleRoutesConfigured() { return Boolean(process.env.GOOGLE_ROUTES_API_KEY); }

export async function getGoogleRoadBenchmark({ origin, destination, actualDistanceKm, roundTrip = true, fetchImpl = fetch }) {
  const disclaimer = 'Google DRIVE is used only as a general road-route distance benchmark. It is not a guaranteed legal, permitted, safe or suitable heavy-truck route. Dispatch, road restrictions, permits and driver judgement remain authoritative.';
  if (!process.env.GOOGLE_ROUTES_API_KEY) return { available: false, status: 'not-configured', disclaimer };
  if (!origin || !destination) return { available: false, status: 'insufficient-route-data', disclaimer };
  const cacheKey = keyFor(origin, destination, roundTrip);
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.cachedAt < ttlMs) return { ...hit.value, cache: 'hit', disclaimer };
  try {
    const response = await fetchImpl('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_ROUTES_API_KEY, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
      body: JSON.stringify({ origin: { address: origin }, destination: { address: destination }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', computeAlternativeRoutes: false, languageCode: 'en-ZA', units: 'METRIC' })
    });
    if (!response.ok) return { available: false, status: 'provider-error', providerStatus: response.status, disclaimer };
    const data = await response.json();
    const oneWayKm = Number(data?.routes?.[0]?.distanceMeters) / 1000;
    if (!(oneWayKm > 0)) return { available: false, status: 'no-route-returned', disclaimer };
    const benchmarkKm = oneWayKm * (roundTrip ? 2 : 1);
    const variance = routeVariance(actualDistanceKm, benchmarkKm);
    const value = { available: true, status: 'ok', provider: 'Google Routes API', travelMode: 'DRIVE', origin, destination, oneWayKm: Number(oneWayKm.toFixed(1)), benchmarkKm: Number(benchmarkKm.toFixed(1)), roundTrip, actualDistanceKm: Number(actualDistanceKm) || null, varianceKm: variance.varianceKm == null ? null : Number(variance.varianceKm.toFixed(1)), variancePct: variance.variancePct == null ? null : Number(variance.variancePct.toFixed(1)) };
    cache[cacheKey] = { cachedAt: Date.now(), value }; persist();
    return { ...value, cache: 'miss', disclaimer };
  } catch { return { available: false, status: 'temporarily-unavailable', disclaimer }; }
}
