const fs = require('fs');
const fp = 'src/v2/__tests__/functionality-audit.test.tsx';
let s = fs.readFileSync(fp, 'utf8');
// All '..\\/..\\/' patterns
s = s.replace(/\.\.\/\.\.\/pages\//g, '../pages/');
s = s.replace(/\.\.\/\.\.\/components\//g, '../components/');
s = s.replace(/\.\.\/\.\.\/layout\//g, '../layout/');
s = s.replace(/\.\.\/\.\.\/store\//g, '../store/');
s = s.replace(/\.\.\/\.\.\/wails\//g, '../wails/');
s = s.replace(/\.\.\/\.\.\/lib\//g, '../lib/');
fs.writeFileSync(fp, s);
console.log('OK', s.length, 'bytes');
