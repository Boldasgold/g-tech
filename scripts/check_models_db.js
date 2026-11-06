const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');
const rows = db.prepare('SELECT * FROM vehicle_3d_models').all();
console.log('Total de modelos no banco:', rows.length);
console.log(JSON.stringify(rows, null, 2));
