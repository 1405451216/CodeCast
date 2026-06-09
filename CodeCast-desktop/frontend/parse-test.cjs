const fs = require('fs');
const cp = require('child_process');
cp.execSync('npx vitest run src/v2/__tests__/functionality-audit.test.tsx --reporter=json > test-out.json 2>&1', { stdio: 'inherit' });
const data = fs.readFileSync('test-out.json', 'utf8');
const re = /"fullName":"([^"]+)","status":"failed"/g;
let m;
const fails = [];
while ((m = re.exec(data))) fails.push(m[1]);
console.log('Failed tests count:', fails.length);
console.log('---');
fails.forEach((f, i) => console.log(`${i+1}. ${f}`));
try { fs.unlinkSync('test-out.json'); } catch {}
