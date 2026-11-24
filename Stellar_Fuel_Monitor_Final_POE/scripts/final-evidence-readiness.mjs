import fs from 'node:fs';
import path from 'node:path';

const problems = [];
const readme = fs.readFileSync('README.md', 'utf8');
if (/replace this line with the team's working/i.test(readme) || !/https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|[^\s)]+video)/i.test(readme)) {
  problems.push('README.md still needs the real, working final demonstration video URL.');
}

const privacy = fs.readFileSync('play-store/privacy-policy.md', 'utf8');
if (/<replace-|replace-with-real/i.test(privacy)) problems.push('Privacy policy still contains a contact placeholder.');

const screenshotsDir = 'play-store/screenshots';
const screenshotCount = fs.readdirSync(screenshotsDir).filter(name => /\.(png|jpe?g|webp)$/i.test(name)).length;
if (screenshotCount < 4) problems.push(`Only ${screenshotCount} real Play Store screenshot(s) found; capture the physical-device promotional set.`);

if (problems.length) {
  console.error('Final evidence is NOT ready yet:');
  problems.forEach(item => console.error(` - ${item}`));
  process.exit(1);
}
console.log('Final evidence readiness check passed.');
