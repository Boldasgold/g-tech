const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');

// Check if veh-demo-arteon exists
let veh = db.prepare("SELECT * FROM vehicles WHERE id = 'veh-demo-arteon'").get();
if (!veh) {
  db.prepare(`
    INSERT INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type)
    VALUES ('veh-demo-arteon', 'cust-demo-camila-vw', 'ART-2026', 'Volkswagen', 'Arteon Shooting Brake', '2023', '2.0 TSI (280cv) DSG 7 4Motion', 'Prata Reflex Metálico', 24100, 'Gasolina Premium', 'sedan')
  `).run();
  console.log("Criado veículo veh-demo-arteon");
}

// Create wo-demo-132
db.prepare("DELETE FROM work_orders WHERE id = 'wo-demo-132'").run();
db.prepare(`
  INSERT INTO work_orders (
    id, company_id, os_number, customer_id, vehicle_id,
    initial_scope, customer_complaint, diagnostic_authorized,
    status, priority, km_entry, fuel_level_entry
  ) VALUES (
    'wo-demo-132', 'gtech-paranagua', 'GT-OS-000132', 'cust-demo-camila-vw', 'veh-demo-arteon',
    'Revisão técnica 25.000 km e inspeção estrutural 3D', 'Inspeção de suspensão e freios', 1,
    'aguardando_cliente', 'normal', 24100, '3/4'
  )
`).run();
console.log("Criada OS wo-demo-132 para Volkswagen Arteon Shooting Brake.");

// Link in vehicle_3d_models
db.prepare(`
  UPDATE vehicle_3d_models
  SET work_order_id = 'wo-demo-132',
      vehicle_key = 'volkswagen_arteon'
  WHERE id = 'v3d-arteon-01'
`).run();
console.log("Vinculado v3d-arteon-01 à OS wo-demo-132.");
