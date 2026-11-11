/**
 * MIGRAÇÃO COMPLEMENTAR G-TECH V1:
 * 1. Tabela wo_visit_photos para rastreamento individual de fotos por visita com ID e SHA-256
 * 2. Colunas de sequência estrita de saída em wo_exit_checklist (checklist concluído -> pronto p/ retirada -> WhatsApp -> confirmação de retirada -> entregue)
 * 3. Separação estrita dos estados de WhatsApp ('simulado', 'aceito_pelo_provedor', 'entregue', 'falha')
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const dbPath = path.join(__dirname, "../data/gtech.db");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 10000;");

const addCol = (table, colDef) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
    console.log(`[OK] Coluna adicionada em ${table}: ${colDef}`);
  } catch (e) {
    if (!e.message.includes("duplicate column")) {
      console.log(`[INFO] ${table}.${colDef}: ${e.message}`);
    }
  }
};

// 1. Tabela wo_visit_photos (Armazena cada fotografia real enviada com ID único e hash SHA-256)
db.exec(`
  CREATE TABLE IF NOT EXISTS wo_visit_photos (
    photo_id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    visit_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    visit_number INTEGER NOT NULL,
    slot_name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    file_sha256 TEXT NOT NULL,
    uploaded_by TEXT NOT NULL DEFAULT 'Giovane Ribeiro',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);
console.log("[OK] Tabela wo_visit_photos verificada/criada.");

// 2. Colunas em wo_exit_checklist para a sequência estrita de saída
addCol("wo_exit_checklist", "exit_stage TEXT NOT NULL DEFAULT 'checklist_concluido_pronto_retirada'");
addCol("wo_exit_checklist", "checklist_completed_at TEXT");
addCol("wo_exit_checklist", "checklist_completed_by TEXT");
addCol("wo_exit_checklist", "ready_for_pickup_at TEXT");
addCol("wo_exit_checklist", "ready_for_pickup_by TEXT");
addCol("wo_exit_checklist", "pickup_confirmed_at TEXT");
addCol("wo_exit_checklist", "pickup_confirmed_by_staff_id TEXT");
addCol("wo_exit_checklist", "pickup_confirmed_by_staff_name TEXT");

// 3. Coluna generated_3d_model_id em wo_inspection_visits para vincular o GLB aproximado gerado pelas fotos à vistoria
addCol("wo_inspection_visits", "generated_3d_model_id TEXT");
addCol("wo_inspection_visits", "generated_3d_glb_url TEXT");
addCol("wo_inspection_visits", "generated_3d_sha256 TEXT");

// 4. Atualizar registros anteriores de simulação em notification_history para delivery_status = 'simulado'
// (O simulador NUNCA deve registrar aceite de um provedor externo real)
db.prepare(`
  UPDATE notification_history
  SET delivery_status = 'simulado',
      provider_name = 'Simulador Local G-Tech (Sem Provedor Externo)'
  WHERE is_simulation = 1
`).run();
console.log("[OK] Estados de simulação em notification_history corrigidos para 'simulado'.");

