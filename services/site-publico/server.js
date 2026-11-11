/**
 * PROJETO 1: SITE PÚBLICO G-TECH V1 (Processo Independente - Porta 3000)
 * - Sem bibliotecas 3D (Three.js), modelos GLB ou módulos administrativos.
 * - Sem acesso direto ao banco de dados da oficina (gtech.db).
 * - Possui banco próprio de fila de saída (data/site_outbox.db) que preserva
 *   solicitações de agendamento caso o serviço da oficina (Porta 3001) esteja parado,
 *   sincronizando automaticamente sem duplicidade quando a oficina retorna.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const SITE_PORT = Number(process.env.SITE_PORT || 3000);
const WORKSHOP_API_URL = process.env.WORKSHOP_API_URL || "http://localhost:3001";
const ROOT_DIR = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const OUTBOX_DB_PATH = path.join(DATA_DIR, "site_outbox.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const outboxDb = new DatabaseSync(OUTBOX_DB_PATH);
outboxDb.exec("PRAGMA journal_mode = WAL;");
outboxDb.exec("PRAGMA busy_timeout = 5000;");
outboxDb.exec(`
  CREATE TABLE IF NOT EXISTS site_outbox_queue (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    protocol_temp TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    vehicle_brand TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_plate TEXT,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    issue_description TEXT,
    dashboard_alert TEXT,
    payload_json TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pendente_oficina_offline',
    workshop_protocol TEXT,
    workshop_appointment_id TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    synced_at TEXT
  );
`);

function generateIdempotencyKey(payload) {
  if (payload.idempotency_key) return payload.idempotency_key;
  const raw = `${(payload.customer_phone || "").trim()}|${payload.scheduled_date}|${payload.scheduled_time}|${(payload.vehicle_plate || "").trim().toUpperCase()}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function forwardToWorkshop(payload, idempotencyKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${WORKSHOP_API_URL}/api/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, status: 503, error: err.message || "Oficina indisponível" };
  }
}

async function syncPendingOutbox() {
  const pending = outboxDb.prepare(`
    SELECT * FROM site_outbox_queue
    WHERE sync_status = 'pendente_oficina_offline'
    ORDER BY created_at ASC
  `).all();

  const results = [];
  for (const row of pending) {
    const payload = JSON.parse(row.payload_json);
    const forward = await forwardToWorkshop(payload, row.idempotency_key);
    const now = new Date().toISOString();

    if (forward.ok && forward.data?.success) {
      outboxDb.prepare(`
        UPDATE site_outbox_queue
        SET sync_status = 'sincronizado_oficina',
            workshop_protocol = ?,
            workshop_appointment_id = ?,
            attempts = attempts + 1,
            last_error = NULL,
            synced_at = ?
        WHERE id = ?
      `).run(
        forward.data.protocol || row.protocol_temp,
        forward.data.appointment_id || "idempotente",
        now,
        row.id
      );
      results.push({
        id: row.id,
        idempotency_key: row.idempotency_key,
        synced: true,
        duplicate_prevented: Boolean(forward.data.duplicate_prevented),
        workshop_protocol: forward.data.protocol
      });
    } else {
      outboxDb.prepare(`
        UPDATE site_outbox_queue
        SET attempts = attempts + 1,
            last_error = ?
        WHERE id = ?
      `).run(forward.error || JSON.stringify(forward.data), row.id);
      results.push({
        id: row.id,
        idempotency_key: row.idempotency_key,
        synced: false,
        error: forward.error || forward.data?.error
      });
    }
  }
  return results;
}

// Sincronização periódica automática a cada 5s quando a oficina estiver ativa
setInterval(() => {
  syncPendingOutbox().catch(() => {});
}, 5000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(obj, null, 2));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${SITE_PORT}`);
  const pathname = parsedUrl.pathname;

  // 1. Bloquear carregamento de modelos 3D (.glb/.gltf), bibliotecas 3D e rotas administrativas no Site Público
  if (
    pathname.endsWith(".glb") ||
    pathname.endsWith(".gltf") ||
    pathname.includes("gtech-3d.js") ||
    pathname.startsWith("/models/")
  ) {
    return sendJson(res, 403, {
      success: false,
      error: "Regra de Separação V1: O site público não carrega bibliotecas 3D nem modelos GLB."
    });
  }

  if (pathname.startsWith("/oficina") || pathname.startsWith("/3D-360")) {
    return sendJson(res, 403, {
      success: false,
      error: "Aplicação separada: O sistema administrativo e 3D da oficina executa em processo e porta próprios.",
      workshop_url: `${WORKSHOP_API_URL}${pathname}`
    });
  }

  // 2. Health & Identificação do Processo do Site Público
  if (pathname === "/api/health" && req.method === "GET") {
    const counts = outboxDb.prepare(`
      SELECT sync_status, COUNT(*) as total
      FROM site_outbox_queue
      GROUP BY sync_status
    `).all();
    return sendJson(res, 200, {
      service: "gtech-site-publico",
      process_pid: process.pid,
      port: SITE_PORT,
      workshop_target_url: WORKSHOP_API_URL,
      outbox_database: OUTBOX_DB_PATH,
      threejs_or_glb_loaded: false,
      outbox_summary: counts
    });
  }

  // 3. Inspeção da Fila Local do Site (Outbox SQLite) — disponível mesmo com a oficina desligada
  if (pathname === "/api/outbox" && req.method === "GET") {
    const items = outboxDb.prepare(`
      SELECT * FROM site_outbox_queue
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    return sendJson(res, 200, {
      success: true,
      storage_file: OUTBOX_DB_PATH,
      table: "site_outbox_queue",
      total: items.length,
      items
    });
  }

  // 4. Disparo manual/imediato de sincronização Site -> Oficina
  if (pathname === "/api/outbox/sync" && req.method === "POST") {
    const synced = await syncPendingOutbox();
    return sendJson(res, 200, {
      success: true,
      synced_count: synced.filter(s => s.synced).length,
      results: synced
    });
  }

  // 5. Recebimento de Solicitação de Agendamento no Site Público (POST /api/appointments)
  if (pathname === "/api/appointments" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const {
        customer_name,
        customer_phone,
        vehicle_brand,
        vehicle_model,
        vehicle_plate,
        scheduled_date,
        scheduled_time,
        issue_description,
        dashboard_alert
      } = body;

      if (!customer_name || !customer_phone || !vehicle_brand || !vehicle_model || !scheduled_date || !scheduled_time) {
        return sendJson(res, 400, {
          success: false,
          error: "Campos obrigatórios ausentes para solicitação de agendamento."
        });
      }

      const idempotencyKey = generateIdempotencyKey(body);

      // Verifica se já está na fila local do site (idempotência no site)
      let existingLocal = outboxDb.prepare(`
        SELECT * FROM site_outbox_queue WHERE idempotency_key = ?
      `).get(idempotencyKey);

      const now = new Date().toISOString();
      const outboxId = existingLocal?.id || `outbox-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const tempProtocol = existingLocal?.protocol_temp || `SITE-${Date.now().toString().slice(-6)}`;

      if (!existingLocal) {
        outboxDb.prepare(`
          INSERT INTO site_outbox_queue (
            id, idempotency_key, protocol_temp,
            customer_name, customer_phone, vehicle_brand, vehicle_model, vehicle_plate,
            scheduled_date, scheduled_time, issue_description, dashboard_alert,
            payload_json, sync_status, attempts, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente_oficina_offline', 0, ?)
        `).run(
          outboxId,
          idempotencyKey,
          tempProtocol,
          customer_name.trim(),
          customer_phone.trim(),
          vehicle_brand.trim(),
          vehicle_model.trim(),
          vehicle_plate ? vehicle_plate.trim().toUpperCase() : null,
          scheduled_date,
          scheduled_time,
          issue_description || "Avaliação técnica solicitada via site",
          dashboard_alert || null,
          JSON.stringify({ ...body, idempotency_key: idempotencyKey }),
          now
        );
      }

      // Tenta encaminhar imediatamente para a API da Oficina (Porta 3001)
      const forward = await forwardToWorkshop(body, idempotencyKey);

      if (forward.ok && forward.data?.success) {
        outboxDb.prepare(`
          UPDATE site_outbox_queue
          SET sync_status = 'sincronizado_oficina',
              workshop_protocol = ?,
              workshop_appointment_id = ?,
              attempts = attempts + 1,
              last_error = NULL,
              synced_at = ?
          WHERE idempotency_key = ?
        `).run(
          forward.data.protocol || tempProtocol,
          forward.data.appointment_id || "idempotente",
          now,
          idempotencyKey
        );

        return sendJson(res, 200, {
          success: true,
          queued_offline: false,
          idempotency_key: idempotencyKey,
          protocol: forward.data.protocol || tempProtocol,
          status: "solicitacao_recebida_aguardando_confirmacao",
          status_label: "Solicitação Recebida — Aguardando Confirmação da Oficina",
          duplicate_prevented: Boolean(forward.data.duplicate_prevented),
          message: "Solicitação recebida pela oficina. Nota: O agendamento NÃO está confirmado até a confirmação oficial da oficina."
        });
      }

      // Se a Oficina (Porta 3001) estiver PARADA / INDISPONÍVEL: preserva na fila do site e retorna 202 Accepted
      outboxDb.prepare(`
        UPDATE site_outbox_queue
        SET sync_status = 'pendente_oficina_offline',
            attempts = attempts + 1,
            last_error = ?
        WHERE idempotency_key = ?
      `).run(forward.error || "Serviço da oficina indisponível na porta 3001", idempotencyKey);

      return sendJson(res, 202, {
        success: true,
        queued_offline: true,
        outbox_id: outboxId,
        idempotency_key: idempotencyKey,
        protocol: tempProtocol,
        storage_db: OUTBOX_DB_PATH,
        storage_table: "site_outbox_queue",
        status: "solicitacao_preservada_fila_site",
        status_label: "Solicitação Recebida na Fila do Site — Aguardando Confirmação da Oficina",
        message: "O serviço da oficina está temporariamente indisponível, mas sua solicitação foi preservada com segurança no banco de fila do site (data/site_outbox.db) e será sincronizada automaticamente sem duplicação assim que a oficina retornar."
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 6. Consulta de horários (GET /api/appointments) — proxy para oficina ou horários padrão se oficina estiver offline
  if (pathname === "/api/appointments" && req.method === "GET") {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const r = await fetch(`${WORKSHOP_API_URL}${req.url}`, { signal: controller.signal });
      clearTimeout(timeout);
      const d = await r.json();
      return sendJson(res, r.status, d);
    } catch {
      const date = parsedUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
      const slots = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"].map(time => ({
        time,
        available: true,
        period: time < "12:00" ? "Manhã" : "Tarde"
      }));
      return sendJson(res, 200, {
        success: true,
        offline_fallback: true,
        date,
        slots
      });
    }
  }

  // 7. Acompanhamento Simplificado pelo Site via API da Oficina (sem expor banco nem dados internos)
  if (pathname.startsWith("/api/public/tracking")) {
    try {
      const r = await fetch(`${WORKSHOP_API_URL}${req.url}`);
      const d = await r.json();
      return sendJson(res, r.status, d);
    } catch {
      return sendJson(res, 503, {
        success: false,
        error: "Serviço de acompanhamento da oficina temporariamente indisponível."
      });
    }
  }

  // 8. Arquivos estáticos do Site Público
  let filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    sendJson(res, 404, { success: false, error: "Recurso não encontrado no Site Público." });
  }
});

server.listen(SITE_PORT, () => {
  console.log(`[SITE-PUBLICO] Rodando em processo isolado PID=${process.pid} na porta http://localhost:${SITE_PORT}`);
  console.log(`[SITE-PUBLICO] Fila Outbox SQLite: ${OUTBOX_DB_PATH}`);
  console.log(`[SITE-PUBLICO] API da Oficina alvo: ${WORKSHOP_API_URL}`);
});

