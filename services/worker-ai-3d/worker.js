/**
 * PROJETO 3: TRABALHADOR DE IA E MODELO ILUSTRATIVO TEXTURIZADO G-TECH V1 (Processo Independente - Porta 3002)
 * - Executa em processo próprio separado do Site Público (3000) e do Programa da Oficina (3001).
 * - Gerencia fila de tarefas (processing_jobs_queue) com limite de concorrência (MAX_CONCURRENT_JOBS = 2).
 * - Isola falhas: uma falha na geração 3D nunca bloqueia o checklist, o atendimento ou o site.
 * - Geração Foto -> 3D (Itens 2, 3 e 4):
 *   1. Não depende de scripts de teste nem de IDs fixos de demonstração (proibido fallback para wo-v1-fluxo-01 ou wo-demo-129).
 *   2. Vincula a geração ao veículo (vehicle_id + vehicle_key canônico), à OS (work_order_id), à vistoria (visit_id) e às fotos de origem (source_photos_json).
 *   3. Identifica o resultado do photo_to_glb_builder.js estritamente como "modelo ilustrativo texturizado" (forma predefinida com fotografias).
 */

const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const {
  buildApproximateGlbFromVisitPhotos,
  getPhotoTo3DIntegrationProposal,
  resolveCanonicalVehicleKey
} = require("./photo_to_glb_builder");

const WORKER_PORT = Number(process.env.WORKER_PORT || 3002);
const MAX_CONCURRENT_JOBS = Number(process.env.MAX_CONCURRENT_JOBS || 2);
const ROOT_DIR = path.resolve(__dirname, "../..");
const DB_PATH = path.join(ROOT_DIR, "data", "gtech.db");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 10000;");

// Garantir colunas de vínculo canônico em vehicles e vehicle_3d_models
function ensureCanonicalColumns() {
  const safeAlter = (sql) => {
    try { db.exec(sql); } catch (_) {}
  };
  safeAlter("ALTER TABLE vehicles ADD COLUMN vehicle_key TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN vehicle_id TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN visit_id TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN file_sha256 TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN audit_status TEXT DEFAULT 'aprovado';");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN origin_type TEXT DEFAULT 'acervo_preexistente';");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN source_photos_json TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN audit_notes TEXT;");
  safeAlter("ALTER TABLE wo_inspection_visits ADD COLUMN generated_3d_model_id TEXT;");
  safeAlter("ALTER TABLE wo_inspection_visits ADD COLUMN generated_3d_glb_url TEXT;");
  safeAlter("ALTER TABLE wo_inspection_visits ADD COLUMN generated_3d_sha256 TEXT;");
}
ensureCanonicalColumns();

let activeWorkers = 0;

function hasExternalCloudGeneratorApprovedAndConfigured() {
  return (
    process.env.ALLOW_EXTERNAL_PHOTO_TRANSMISSION === "true" &&
    Boolean(process.env.TRIPO3D_API_KEY || process.env.MESHY_API_KEY)
  );
}

async function processNextQueueItems() {
  if (activeWorkers >= MAX_CONCURRENT_JOBS) return;

  const availableSlots = MAX_CONCURRENT_JOBS - activeWorkers;
  const jobs = db.prepare(`
    SELECT * FROM processing_jobs_queue
    WHERE status = 'enfileirado'
    ORDER BY created_at ASC
    LIMIT ?
  `).all(availableSlots);

  for (const job of jobs) {
    activeWorkers++;
    runJob(job).finally(() => {
      activeWorkers = Math.max(0, activeWorkers - 1);
    });
  }
}

async function runJob(job) {
  const startedAt = new Date().toISOString();
  db.prepare(`
    UPDATE processing_jobs_queue
    SET status = 'processando', attempts = attempts + 1, started_at = ?
    WHERE id = ?
  `).run(startedAt, job.id);

  try {
    await new Promise(r => setTimeout(r, 250));
    const payload = JSON.parse(job.input_payload || "{}");
    const completedAt = new Date().toISOString();

    if (job.job_type === "reconstruct_3d") {
      const workOrderId = job.work_order_id || payload.work_order_id;
      if (!workOrderId) {
        throw new Error("A tarefa não possui Ordem de Serviço (work_order_id) vinculada. Geração sem OS não é permitida.");
      }

      const wo = db.prepare(`
        SELECT wo.id, wo.os_number, wo.vehicle_id, v.brand, v.model, v.year, v.vehicle_key as db_vehicle_key
        FROM work_orders wo
        LEFT JOIN vehicles v ON wo.vehicle_id = v.id
        WHERE wo.id = ? OR wo.os_number = ?
      `).get(workOrderId, workOrderId);

      if (!wo) {
        throw new Error(`Ordem de Serviço '${workOrderId}' não localizada no banco de dados.`);
      }

      // Resolver o vehicle_key canônico único para todo o fluxo (cadastro, worker, API e visualizador)
      const canonicalVehicleKey = resolveCanonicalVehicleKey({
        vehicleKey: payload.vehicle_key || wo.db_vehicle_key,
        brand: wo.brand,
        model: wo.model
      });

      // Garantir que o registro do veículo também tenha o mesmo vehicle_key canônico
      if (wo.vehicle_id) {
        db.prepare("UPDATE vehicles SET vehicle_key = ? WHERE id = ?").run(canonicalVehicleKey, wo.vehicle_id);
      }

      // Buscar vistoria solicitada (visit_id específico ou a visita de entrada mais recente desta OS)
      const requestedVisitId = payload.visit_id || null;
      const visitRow = requestedVisitId
        ? db.prepare("SELECT * FROM wo_inspection_visits WHERE id = ? AND work_order_id = ?").get(requestedVisitId, wo.id)
        : db.prepare(`
            SELECT * FROM wo_inspection_visits
            WHERE work_order_id = ? AND inspection_stage = 'entrada'
            ORDER BY visit_number DESC LIMIT 1
          `).get(wo.id);

      const photoRows = visitRow
        ? db.prepare(`
            SELECT * FROM wo_visit_photos
            WHERE work_order_id = ? AND visit_id = ?
            ORDER BY created_at ASC
          `).all(wo.id, visitRow.id)
        : db.prepare(`
            SELECT * FROM wo_visit_photos
            WHERE work_order_id = ?
            ORDER BY created_at ASC
          `).all(wo.id);

      if (!photoRows || photoRows.length < 2) {
        throw new Error(
          `A vistoria da OS ${wo.os_number} (${wo.brand} ${wo.model} • ${canonicalVehicleKey}) possui apenas ${photoRows ? photoRows.length : 0} fotografia(s) anexada(s). Anexe pelo menos 2 fotografias reais distintas (ex.: frente e traseira/lateral) antes de gerar a projeção 3D.`
        );
      }

      const visitId = visitRow ? visitRow.id : `vis-in-${wo.id}`;
      const visitNumber = visitRow ? visitRow.visit_number : 1;

      // Gerar novo arquivo .GLB binário ("modelo ilustrativo texturizado") a partir das fotos reais da vistoria
      const generated = buildApproximateGlbFromVisitPhotos({
        rootDir: ROOT_DIR,
        workOrderId: wo.id,
        visitId,
        visitNumber,
        vehicleId: wo.vehicle_id,
        vehicleKey: canonicalVehicleKey,
        brand: wo.brand || "Volkswagen",
        model: wo.model || "Veículo",
        photoRecords: photoRows
      });

      const modelRecordId = `v3d-ilust-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

      // Preservar versões anteriores no histórico marcando-as como 'substituido_nova_geracao' (nunca apagar histórico)
      db.prepare(`
        UPDATE vehicle_3d_models
        SET audit_status = 'substituido_nova_geracao',
            updated_at = datetime('now', 'localtime')
        WHERE (work_order_id = ? OR vehicle_key = ?)
          AND origin_type = 'gerado_por_fotos'
          AND audit_status = 'aprovado'
      `).run(wo.id, canonicalVehicleKey);

      // Associar o novo arquivo .GLB ao veículo (vehicle_id + vehicle_key), à OS (work_order_id), à vistoria (visit_id) e às fotos de origem
      db.prepare(`
        INSERT INTO vehicle_3d_models (
          id, vehicle_key, vehicle_id, brand, model, generation, work_order_id, visit_id,
          file_name, file_url, file_size_bytes, file_sha256,
          model_type, source, audit_status, origin_type, source_photos_json, audit_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'malha_externa_monobloco', 'modelo_ilustrativo_texturizado', 'aprovado', 'gerado_por_fotos', ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
      `).run(
        modelRecordId,
        canonicalVehicleKey,
        wo.vehicle_id,
        wo.brand || "Volkswagen",
        wo.model || "Veículo",
        String(wo.year || ""),
        wo.id,
        visitId,
        generated.file_name,
        generated.file_url,
        generated.file_size_bytes,
        generated.file_sha256,
        JSON.stringify(generated.source_photos_used),
        `Modelo ilustrativo texturizado (forma predefinida com ${generated.source_photos_used.length} fotografias da Visita #${visitNumber} • OS ${wo.os_number} • Veículo ${canonicalVehicleKey}). Não constitui reconstrução 3D da geometria do carro.`
      );

      // Associar diretamente ao registro da vistoria (wo_inspection_visits)
      if (visitRow) {
        db.prepare(`
          UPDATE wo_inspection_visits
          SET generated_3d_model_id = ?,
              generated_3d_glb_url = ?,
              generated_3d_sha256 = ?
          WHERE id = ?
        `).run(modelRecordId, generated.file_url, generated.file_sha256, visitRow.id);
      }

      const resultPayload = {
        work_order_id: wo.id,
        os_number: wo.os_number,
        visit_id: visitId,
        visit_number: visitNumber,
        vehicle_id: wo.vehicle_id,
        vehicle_key: canonicalVehicleKey,
        processing_worker_pid: process.pid,
        processing_worker_port: WORKER_PORT,
        engine_used: "photo_to_glb_builder.js (Gerador Local de Modelo Ilustrativo Texturizado)",
        classification: "modelo ilustrativo texturizado",
        geometry_method: "Forma predefinida (createBoxGeometryData + createPhotoPlaneGeometryData) com aplicação de fotografias da vistoria",
        is_car_geometry_reconstruction: false,
        external_cloud_neural_engine_active: hasExternalCloudGeneratorApprovedAndConfigured(),
        external_photo_transmission: false,
        is_approximate_representation: true,
        fidelidade: "MODELO_ILUSTRATIVO_TEXTURIZADO",
        origin_category: "B. Modelo ilustrativo texturizado (forma predefinida com fotografias da vistoria)",
        generated_model_id: modelRecordId,
        generated_glb_file: generated.file_url,
        generated_glb_filename: generated.file_name,
        generated_glb_size_bytes: generated.file_size_bytes,
        generated_glb_sha256: generated.file_sha256,
        source_photos_count: generated.source_photos_used.length,
        source_photos: generated.source_photos_used,
        reconstruction_status: "CONCLUIDO_MODELO_ILUSTRATIVO_TEXTURIZADO"
      };

      db.prepare(`
        UPDATE processing_jobs_queue
        SET status = 'concluido',
            result_payload = ?,
            error_message = NULL,
            completed_at = ?
        WHERE id = ?
      `).run(JSON.stringify(resultPayload), completedAt, job.id);

      return;
    }

    // Outros tipos de tarefa
    const resultPayload = {
      processed_by_pid: process.pid,
      worker_port: WORKER_PORT,
      job_type: job.job_type,
      work_order_id: job.work_order_id,
      summary: `Processamento assíncrono (${job.job_type}) concluído pelo Worker isolado.`
    };

    db.prepare(`
      UPDATE processing_jobs_queue
      SET status = 'concluido',
          result_payload = ?,
          completed_at = ?
      WHERE id = ?
    `).run(JSON.stringify(resultPayload), completedAt, job.id);
  } catch (err) {
    db.prepare(`
      UPDATE processing_jobs_queue
      SET status = 'falha',
          error_message = ?,
          completed_at = ?
      WHERE id = ?
    `).run(err.message || "Falha isolada no worker", new Date().toISOString(), job.id);
  }
}

setInterval(() => {
  processNextQueueItems().catch(() => {});
}, 600);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-staff-token"
  });
  res.end(JSON.stringify(obj, null, 2));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url, `http://localhost:${WORKER_PORT}`);
  const pathname = parsedUrl.pathname;

  if (pathname === "/health" && req.method === "GET") {
    const stats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM processing_jobs_queue
      GROUP BY status
    `).all();
    return sendJson(res, 200, {
      service: "gtech-worker-ai-3d",
      process_pid: process.pid,
      port: WORKER_PORT,
      max_concurrent_jobs: MAX_CONCURRENT_JOBS,
      active_workers: activeWorkers,
      local_generator_classification: "modelo ilustrativo texturizado (forma predefinida com fotografias)",
      reconstructs_car_geometry: false,
      external_cloud_neural_engine_approved: hasExternalCloudGeneratorApprovedAndConfigured(),
      queue_stats: stats,
      integration_proposal: getPhotoTo3DIntegrationProposal()
    });
  }

  if (pathname === "/proposal" && req.method === "GET") {
    return sendJson(res, 200, {
      success: true,
      proposal: getPhotoTo3DIntegrationProposal()
    });
  }

  if (pathname === "/jobs" && req.method === "GET") {
    const jobId = parsedUrl.searchParams.get("job_id");
    const workOrderId = parsedUrl.searchParams.get("work_order_id");

    let rows = [];
    if (jobId) {
      rows = db.prepare("SELECT * FROM processing_jobs_queue WHERE id = ?").all(jobId);
    } else if (workOrderId) {
      rows = db.prepare("SELECT * FROM processing_jobs_queue WHERE work_order_id = ? ORDER BY created_at DESC").all(workOrderId);
    } else {
      rows = db.prepare("SELECT * FROM processing_jobs_queue ORDER BY created_at DESC LIMIT 30").all();
    }

    const jobs = rows.map(r => ({
      ...r,
      job_id: r.id,
      result_json: r.result_payload,
      parsed_result: r.result_payload ? JSON.parse(r.result_payload) : null
    }));
    return sendJson(res, 200, {
      success: true,
      worker_pid: process.pid,
      jobs
    });
  }

  if (pathname === "/jobs/enqueue" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const jobType = body.job_type || "reconstruct_3d";
      const workOrderId = (body.work_order_id || "").trim();

      if (!workOrderId) {
        return sendJson(res, 400, {
          success: false,
          error: "work_order_id é obrigatório para enfileirar geração 3D. Não são usados IDs fixos de demonstração."
        });
      }

      const jobId = `job-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO processing_jobs_queue (
          id, job_type, work_order_id, status, input_payload, attempts, created_at
        ) VALUES (?, ?, ?, 'enfileirado', ?, 0, ?)
      `).run(jobId, jobType, workOrderId, JSON.stringify(body.payload || body), now);

      await processNextQueueItems();

      return sendJson(res, 202, {
        success: true,
        job_id: jobId,
        job_type: jobType,
        work_order_id: workOrderId,
        status: "enfileirado",
        worker_pid: process.pid,
        message: "Tarefa enfileirada no Worker independente de IA/3D (Porta 3002)."
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  sendJson(res, 404, { success: false, error: "Endpoint não encontrado no Worker de IA/3D." });
});

server.listen(WORKER_PORT, () => {
  console.log(`[WORKER-AI-3D] Rodando em processo isolado PID=${process.pid} na porta http://localhost:${WORKER_PORT}`);
});
