const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables in gtech.db:');
for (const t of tables) {
  try {
    const count = db.prepare("SELECT count(*) as c FROM " + t.name).get().c;
    console.log(`- ${t.name}: ${count} rows`);
  } catch (e) {
    console.log(`- ${t.name}: error (${e.message})`);
  }
}

