const fs = require('fs');
const content = fs.readFileSync('src/lib/vw-recognition.ts', 'utf8');

const matches = [];
const regex = /id:\s*"([^"]+)",[\s\S]*?name:\s*"([^"]+)",[\s\S]*?category:\s*"([^"]+)",[\s\S]*?bodyType:\s*"([^"]+)"/g;
let m;
while ((m = regex.exec(content)) !== null) {
  matches.push({ id: m[1], name: m[2], category: m[3], bodyType: m[4] });
}

console.log('Total vehicles:', matches.length);
const sedans = matches.filter(m => m.bodyType === 'sedan');
const hatches = matches.filter(m => m.bodyType === 'hatch' && !m.id.startsWith('golf'));
const golfs = matches.filter(m => m.id.startsWith('golf') || m.id.startsWith('e-golf'));
const suvs = matches.filter(m => m.bodyType === 'suv');
const vans = matches.filter(m => m.bodyType === 'van');

console.log('Sedans (' + sedans.length + '):', sedans.map(s => s.name));
console.log('Hatches (' + hatches.length + '):', hatches.map(h => h.name));
console.log('Golfs (' + golfs.length + ')');
console.log('SUVs (' + suvs.length + ')');
console.log('Vans (' + vans.length + ')');

