import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';

function limiter(windowMs, limit) { const hits = new Map(); return (req,res,next) => { const now=Date.now(), key=req.ip || req.socket?.remoteAddress || 'unknown'; let x=hits.get(key); if(!x || now-x.start>=windowMs) x={start:now,count:0}; x.count++; hits.set(key,x); res.set('RateLimit-Limit',String(limit)); res.set('RateLimit-Remaining',String(Math.max(0,limit-x.count))); if(x.count>limit) return res.status(429).json({message:'Too many requests; please try again later'}); if(hits.size>10000) for(const [k,v] of hits) if(now-v.start>=windowMs) hits.delete(k); next(); }; }
export const apiLimiter = limiter(60_000, Number(process.env.API_RATE_LIMIT_PER_MINUTE || 180));
export const authLimiter = limiter(15 * 60_000, Number(process.env.AUTH_RATE_LIMIT_PER_15_MIN || 20));
// Final POE: evidence uploads and push triggers cost storage/FCM quota, so they get tighter windows.
export const uploadLimiter = limiter(15 * 60_000, Number(process.env.EVIDENCE_UPLOADS_PER_15_MIN || 30));
export const pushTriggerLimiter = limiter(15 * 60_000, Number(process.env.PUSH_TRIGGERS_PER_15_MIN || 20));
export function authenticate(req, res, next) {
  const header = String(req.headers.authorization || ''); const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); } catch { return res.status(401).json({ message: 'Invalid or expired authentication token' }); }
}
export function requireRole(...roles) { return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'Insufficient permissions' }); }
export function protectedWhenEnabled(...roles) { return (req, res, next) => { if (String(process.env.AUTH_REQUIRED || 'false').toLowerCase() !== 'true') return next(); return authenticate(req, res, () => roles.length ? requireRole(...roles)(req, res, next) : next()); }; }
export function securityAudit(req, res, next) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  res.on('finish', () => { try { const dir = process.env.AUDIT_LOG_DIR || path.join(process.cwd(), 'logs'); fs.mkdirSync(dir, { recursive: true }); const row = { at:new Date().toISOString(), method:req.method, path:req.originalUrl, status:res.statusCode, userId:req.user?.userId || null, role:req.user?.role || null, ip:req.ip }; fs.appendFileSync(path.join(dir,'security-audit.jsonl'), JSON.stringify(row)+'\n'); } catch {} });
  next();
}
