const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');

// Check if already in vehicle_catalog
const inCatalog = db.prepare("SELECT * FROM vehicle_catalog WHERE model LIKE '%Arteon%'").get();
if (!inCatalog) {
  db.prepare(`
    INSERT INTO vehicle_catalog (brand, model, body_type, is_quick_brand, representation_type, source_license)
    VALUES ('Volkswagen', 'Arteon Shooting Brake', 'sedan', 1, 'Modelo 3D GLB Real', 'Khronos glTF Blender I/O')
  `).run();
  console.log("Inserido Arteon no vehicle_catalog.");
} else {
  console.log("Arteon já existente no vehicle_catalog.");
}

// Check if already in vehicle_3d_models
const inModels = db.prepare("SELECT * FROM vehicle_3d_models WHERE vehicle_key = 'volkswagen_arteon'").get();
const fileSize = fs.statSync('C:/Users/tiujo/Desktop/g-tech/public/models/vehicles/volkswagen_arteon_shooting_brake.glb').size;

if (!inModels) {
  db.prepare(`
    INSERT INTO vehicle_3d_models (
      id, vehicle_key, brand, model, generation, work_order_id,
      file_name, file_url, file_size_bytes, model_type, source
    ) VALUES (
      'v3d-arteon-01', 'volkswagen_arteon', 'Volkswagen', 'Arteon Shooting Brake',
      'Shooting Brake (3H9)', NULL, 'volkswagen_arteon_shooting_brake.glb',
      '/models/vehicles/volkswagen_arteon_shooting_brake.glb', ?, 'malha_externa_monobloco',
      'modelo_especifico_verificado'
    )
  `).run(fileSize);
  console.log("Inserido Arteon no vehicle_3d_models com tamanho:", fileSize);
} else {
  db.prepare(`
    UPDATE vehicle_3d_models
    SET file_url = '/models/vehicles/volkswagen_arteon_shooting_brake.glb',
        file_size_bytes = ?,
        model_type = 'malha_externa_monobloco',
        source = 'modelo_especifico_verificado'
    WHERE vehicle_key = 'volkswagen_arteon'
  `).run(fileSize);
  console.log("Atualizado Arteon no vehicle_3d_models.");
}

// Add a demo customer vehicle for testing in /oficina if needed
const vehDemo = db.prepare("SELECT * FROM vehicles WHERE id = 'veh-demo-arteon'").get();
if (!vehDemo) {
  db.prepare(`
    INSERT INTO vehicles (
      id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type
    ) VALUES (
      'veh-demo-arteon', 'cust-demo-camila-vw', 'ART-2026', 'Volkswagen',
      'Arteon Shooting Brake R-Line', '2023', '2.0 TSI EA888 Gen 4 (280cv) DSG 7 4Motion',
      'Prata Metálico Reflex', 24100, 'Gasolina Premium', 'sedan'
    )
  `).run();
  console.log("Inserido veículo demo veh-demo-arteon.");
}

// Add a corresponding work order
const woDemo = db.prepare("SELECT * FROM work_orders WHERE id = 'wo-demo-130'").get();
if (!woDemo) {
  db.prepare(`
    INSERT INTO work_orders (
      id, company_id, customer_id, vehicle_id, status, description, priority, mileage, total_amount, created_at, updated_at
    ) VALUES (
      'wo-demo-130', 'comp-demo-gtech', 'cust-demo-camila-vw', 'veh-demo-arteon',
      'aguardando_orcamento', 'Revisão periódica 25.000 km e inspeção estrutural 3D com análise de suspensão e freios.',
      'normal', 24100, 0, datetime('now', 'localtime'), datetime('now', 'localtime')
    )
  `).run();
  console.log("Inserida OS demo wo-demo-130 para Arteon.");
}

console.log("Configuração concluída com sucesso no banco de dados.");

