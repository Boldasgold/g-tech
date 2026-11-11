const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', 'data', 'gtech.db');
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

console.log("Applying Architecture V1 migrations to:", dbPath);

db.exec(`
  -- 22. Histórico e Controle de Disparos WhatsApp Exclusivos da Oficina (Anti-duplicidade)
  CREATE TABLE IF NOT EXISTS notification_history (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK(notification_type IN ('pronto_para_retirada', 'orcamento_disponivel', 'vistoria_concluida', 'agendamento_confirmado')),
    status TEXT NOT NULL CHECK(status IN ('enviado', 'falha', 'duplicado_bloqueado')),
    idempotency_hash TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    sent_by_user_id TEXT,
    error_message TEXT,
    sent_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  -- 23. Fila de Sincronização e Tolerância a Falhas do Site Público (Buffer Offline)
  CREATE TABLE IF NOT EXISTS site_pending_sync_queue (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    request_type TEXT NOT NULL DEFAULT 'appointment_request',
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'sincronizado', 'falha_tentativa')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_attempt_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- 24. Fila Assíncrona de Processamento 3D e IA (Isolamento de Falhas com Limites)
  CREATE TABLE IF NOT EXISTS processing_jobs_queue (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL CHECK(job_type IN ('ai_vision_scan', 'reconstruct_3d', 'mesh_optimization')),
    work_order_id TEXT,
    status TEXT NOT NULL DEFAULT 'enfileirado' CHECK(status IN ('enfileirado', 'processando', 'concluido', 'falha')),
    input_payload TEXT NOT NULL,
    result_payload TEXT,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    started_at TEXT,
    completed_at TEXT
  );

  -- 25. Sessões Autenticadas da Oficina (Controle de Acesso RBAC)
  CREATE TABLE IF NOT EXISTS user_sessions (
    session_token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('mecanico', 'adm', 'gestor')),
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 26. Tokens Individuais Protegidos do Portal do Cliente
  CREATE TABLE IF NOT EXISTS customer_portal_tokens (
    token TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    phone_hash TEXT NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`);

console.log("Migration executed successfully!");

// Seed portal tokens for all existing work orders
const wos = db.prepare("SELECT id, customer_id FROM work_orders").all();
console.log(`Checking portal tokens for ${wos.length} work orders...`);

for (const wo of wos) {
  const existing = db.prepare("SELECT token FROM customer_portal_tokens WHERE work_order_id = ?").get(wo.id);
  if (!existing) {
    const token = crypto.createHash("sha256").update(`gtech-portal-${wo.id}-token`).digest("hex").slice(0, 32);
    db.prepare(`
      INSERT INTO customer_portal_tokens (token, work_order_id, customer_id, phone_hash)
      VALUES (?, ?, ?, ?)
    `).run(token, wo.id, wo.customer_id, "demo_secure_hash");
    console.log(`Generated portal token for OS ${wo.id}: ${token}`);
  }
}

// Seed default staff session for demo
const existingSession = db.prepare("SELECT session_token FROM user_sessions WHERE user_id = 'user-giovane'").get();
if (!existingSession) {
  const sessionToken = "session-giovane-director-token-2026";
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO user_sessions (session_token, user_id, user_name, role, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionToken, "user-giovane", "Giovane Ribeiro", "gestor", expiresAt);
  console.log("Created master staff session for Giovane Ribeiro:", sessionToken);
}

console.log("Done!");

