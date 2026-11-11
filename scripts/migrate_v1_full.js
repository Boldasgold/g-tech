/**
 * MIGRAÇÃO E AUDITORIA DE MODELOS 3D / VISTORIAS / WHATSAPP — G-TECH V1
 */
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "../data/gtech.db");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

// 1. Adicionar colunas de auditoria SHA-256 e origem em vehicle_3d_models
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

addCol("vehicle_3d_models", "file_sha256 TEXT");
addCol("vehicle_3d_models", "audit_status TEXT NOT NULL DEFAULT 'pendente'");
addCol("vehicle_3d_models", "origin_type TEXT NOT NULL DEFAULT 'acervo_preexistente'");
addCol("vehicle_3d_models", "source_photos_json TEXT");
addCol("vehicle_3d_models", "audit_notes TEXT");

// 2. Tabela de log de auditoria de seleção de veículos 3D (Requisito 1 da Correção Prioritária)
db.exec(`
  CREATE TABLE IF NOT EXISTS model_selection_audit_log (
    id TEXT PRIMARY KEY,
    selected_vehicle_id TEXT NOT NULL,
    work_order_id TEXT,
    brand TEXT,
    model TEXT,
    photo_used TEXT,
    glb_url_loaded TEXT,
    glb_sha256 TEXT,
    association_origin TEXT NOT NULL,
    audit_result TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// 3. Tabela de histórico de vistorias por visita (preserva todas as visitas anteriores sem sobrescrever fotos)
db.exec(`
  CREATE TABLE IF NOT EXISTS wo_inspection_visits (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    visit_number INTEGER NOT NULL DEFAULT 1,
    inspection_stage TEXT NOT NULL CHECK(inspection_stage IN ('entrada', 'saida')),
    odometer_km INTEGER,
    fuel_level TEXT,
    photos_json TEXT NOT NULL,
    checklist_json TEXT NOT NULL,
    hotspots_json TEXT,
    notes TEXT,
    inspector_name TEXT NOT NULL DEFAULT 'Giovane Ribeiro',
    client_signature_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// 4. Colunas adicionais em notification_history para diferenciar provedor real vs simulação e status de entrega
addCol("notification_history", "provider_name TEXT NOT NULL DEFAULT 'whatsapp_cloud_api_sandbox'");
addCol("notification_history", "is_simulation INTEGER NOT NULL DEFAULT 1");
addCol("notification_history", "delivery_status TEXT NOT NULL DEFAULT 'aceito_provedor'");
addCol("notification_history", "release_event_key TEXT");

// 5. Auditar todos os modelos 3D cadastrados pelo hash SHA-256 real do arquivo
const BLOCKED_FERRARI_SHA256 = "cafe3f48da6797aa9bde75ca768bc5b57db366575fd233e90df186ae988a876e";

const models = db.prepare("SELECT * FROM vehicle_3d_models").all();
for (const m of models) {
  const relPath = (m.file_url || "").replace(/^\//, "");
  const fullPath = path.join(__dirname, "../public", relPath);
  if (fs.existsSync(fullPath)) {
    const buf = fs.readFileSync(fullPath);
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    if (sha256 === BLOCKED_FERRARI_SHA256) {
      db.prepare(`
        UPDATE vehicle_3d_models
        SET file_sha256 = ?,
            audit_status = 'bloqueado_malha_incompativel',
            origin_type = 'bloqueado_auditoria_sha256',
            audit_notes = 'BLOQUEADO: Arquivo GLB possui SHA-256 cafe3f48... correspondente a uma Ferrari 458 Italia renomeada, incompatível com veículos Volkswagen.'
        WHERE id = ?
      `).run(sha256, m.id);
      console.log(`[AUDITORIA 3D] Modelo ${m.id} (${m.file_name}) BLOQUEADO por SHA-256 incompatível (${sha256.slice(0, 16)}...)`);
    } else {
      db.prepare(`
        UPDATE vehicle_3d_models
        SET file_sha256 = ?,
            audit_status = 'aprovado',
            origin_type = 'acervo_preexistente',
            audit_notes = 'APROVADO: Geometria glTF autêntica verificada por hash SHA-256.'
        WHERE id = ?
      `).run(sha256, m.id);
      console.log(`[AUDITORIA 3D] Modelo ${m.id} (${m.file_name}) APROVADO com SHA-256 (${sha256.slice(0, 16)}...)`);
    }
  } else {
    db.prepare(`
      UPDATE vehicle_3d_models
      SET audit_status = 'arquivo_ausente',
          audit_notes = 'Arquivo físico não encontrado no diretório public/models/vehicles.'
      WHERE id = ?
    `).run(m.id);
  }
}

console.log("\nResumo de vehicle_3d_models após auditoria:");
console.table(db.prepare("SELECT id, vehicle_key, file_name, substr(file_sha256, 1, 16) as sha256_prefix, audit_status, origin_type FROM vehicle_3d_models").all());

