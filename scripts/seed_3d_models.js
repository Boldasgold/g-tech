const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');

// Atualizar ou inserir Jetta GLI e Golf GTI com vínculo explícito às OSs
db.prepare(`
  INSERT OR REPLACE INTO vehicle_3d_models (
    id, vehicle_key, brand, model, generation, work_order_id,
    file_name, file_url, file_size_bytes, model_type, source, created_at, updated_at
  ) VALUES (
    'v3d-jetta-gli-01',
    'volkswagen_jetta-gli',
    'Volkswagen',
    'Jetta GLI 350 TSI',
    'Geração VII (A7)',
    'wo-demo-129',
    'volkswagen_jetta_gli.glb',
    '/models/vehicles/volkswagen_jetta_gli.glb',
    1681572,
    'malha_externa_monobloco',
    'modelo_compativel_esportivo',
    datetime('now', 'localtime'),
    datetime('now', 'localtime')
  )
`).run();

db.prepare(`
  INSERT OR REPLACE INTO vehicle_3d_models (
    id, vehicle_key, brand, model, generation, work_order_id,
    file_name, file_url, file_size_bytes, model_type, source, created_at, updated_at
  ) VALUES (
    'v3d-golf-gti-01',
    'volkswagen_golf-gti',
    'Volkswagen',
    'Golf VII GTI 2.0 TSI',
    'Geração VII',
    'wo-demo-128',
    'volkswagen_golf_gti.glb',
    '/models/vehicles/volkswagen_golf_gti.glb',
    1681572,
    'malha_externa_monobloco',
    'modelo_compativel_esportivo',
    datetime('now', 'localtime'),
    datetime('now', 'localtime')
  )
`).run();

console.log('Modelos 3D atualizados com sucesso no SQLite:');
const rows = db.prepare('SELECT * FROM vehicle_3d_models').all();
console.log(JSON.stringify(rows, null, 2));
