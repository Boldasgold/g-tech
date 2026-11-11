const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');

console.log('--- Tables in DB ---');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name));

console.log('\n--- vehicle_catalog ---');
try {
  const cat = db.prepare("SELECT id, brand, model, generation, body_type FROM vehicle_catalog").all();
  console.log(cat);
} catch (e) {
  console.log(e.message);
}

console.log('\n--- vehicles table ---');
try {
  const v = db.prepare("SELECT * FROM vehicles").all();
  console.log(v);
} catch (e) {
  console.log(e.message);
}

console.log('\n--- vehicle_3d_models ---');
try {
  const models = db.prepare("SELECT * FROM vehicle_3d_models").all();
  console.log(models);
} catch (e) {
  console.log(e.message);
}
