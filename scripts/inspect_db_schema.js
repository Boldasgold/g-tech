const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(path.join(__dirname, '../data/gtech.db'));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
for (const t of tables) {
  const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
  console.log('\n--- ' + t.name + ' ---');
  console.log(info.map(c => `${c.name} (${c.type})`).join(', '));
  const count = db.prepare(`SELECT count(*) as total FROM ${t.name}`).get();
  console.log('Total rows:', count.total);
}
