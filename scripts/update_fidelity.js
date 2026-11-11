const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');

db.prepare(`
  UPDATE vehicle_3d_models 
  SET model_type = 'malha_externa_monobloco',
      source = 'asset_esportivo_referencia'
`).run();

console.log('Tabela vehicle_3d_models atualizada com fidelidade correta:');
const rows = db.prepare('SELECT * FROM vehicle_3d_models').all();
console.log(JSON.stringify(rows, null, 2));
