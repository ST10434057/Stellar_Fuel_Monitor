// `npm run check`: syntax-checks every server source, script and test file with `node --check`,
// so CI catches a broken module even when no test imports it.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const roots = ['src', 'scripts', 'test'];
const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(m?js)$/.test(name)) files.push(full);
  }
};
roots.forEach(walk);

let failed = 0;
for (const file of files) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (error) { failed++; console.error(`Syntax error in ${file}\n${error.stderr?.toString() || error.message}`); }
}
if (failed) process.exit(1);
console.log(`Syntax check passed (${files.length} files).`);
