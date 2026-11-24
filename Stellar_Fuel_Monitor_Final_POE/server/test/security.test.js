import test from 'node:test'; import assert from 'node:assert/strict'; import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../src/security/middleware.js';
function res(){return {code:200,body:null,status(n){this.code=n;return this},json(x){this.body=x;return this}}}
test('auth rejects missing bearer token',()=>{const r=res();authenticate({headers:{}},r,()=>{});assert.equal(r.code,401)});
test('auth accepts signed token and role guard permits matching role',()=>{process.env.JWT_SECRET='unit-test-secret';const token=jwt.sign({userId:'1',role:'Administrator'},process.env.JWT_SECRET);const req={headers:{authorization:`Bearer ${token}`}};const r=res();let ok=false;authenticate(req,r,()=>requireRole('Administrator')(req,r,()=>{ok=true}));assert.equal(ok,true)});
test('role guard rejects unauthorized role',()=>{const r=res();requireRole('Administrator')({user:{role:'Analyst'}},r,()=>{});assert.equal(r.code,403)});
