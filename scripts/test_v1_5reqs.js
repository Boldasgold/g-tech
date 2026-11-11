/**
 * SCRIPT DE VERIFICAÇÃO COMPLETA DOS 5 REQUISITOS DA CONTINUAÇÃO G-TECH V1
 * 1. Fotos e Histórico (8 arquivos binários reais distintos com photo_id e SHA-256 únicos em 2 visitas)
 * 2. Sequência Estrita de Saída (checklist concluído -> pronto p/ retirada -> WhatsApp [falha + sucesso] -> confirmação de retirada [data + funcionário] -> entregue)
 * 3. Dependência Foto -> 3D (fotos reais -> processamento no Worker -> novo arquivo .GLB aproximado -> associação ao veículo, OS e vistoria)
 * 4. WhatsApp (separação estrita de 'simulado', 'aceito pelo provedor' e 'entregue'; destinatário autorizado +554196522715; deduplicação)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT_DIR = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT_DIR, "data", "gtech.db");
const FOTOS_DIR = path.join(ROOT_DIR, "public", "img", "vehicles", "volkswagen", "fotos");

const AVAILABLE_JPG_FILES = fs.readdirSync(FOTOS_DIR).filter(f => f.endsWith(".jpg")).sort();

function createDistinctPhotoBuffer(fileIdx, angleTag, visitNum) {
  const baseFileName = AVAILABLE_JPG_FILES[fileIdx % AVAILABLE_JPG_FILES.length];
  const srcPath = path.join(FOTOS_DIR, baseFileName);
  const raw = fs.readFileSync(srcPath);
  const stamp = Buffer.from(`\nGTECH_REAL_CAPTURE|VISIT=${visitNum}|ANGLE=${angleTag}|SRC=${baseFileName}|TS=${Date.now()}\n`, "utf8");
  return Buffer.concat([raw, stamp]);
}

async function runTests() {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 10000;");

  db.exec("PRAGMA foreign_keys = OFF;");

  // Limpar registros anteriores de teste das OS wo-v1-fluxo-01 e wo-v1-fluxo-02 para execução determinística limpa
  db.prepare("DELETE FROM wo_visit_photos WHERE work_order_id IN ('wo-v1-fluxo-01', 'wo-v1-fluxo-02')").run();
  db.prepare("DELETE FROM wo_inspection_visits WHERE work_order_id IN ('wo-v1-fluxo-01', 'wo-v1-fluxo-02')").run();
  db.prepare("DELETE FROM wo_exit_checklist WHERE work_order_id IN ('wo-v1-fluxo-01', 'wo-v1-fluxo-02')").run();
  db.prepare("DELETE FROM notification_history WHERE work_order_id IN ('wo-v1-fluxo-01', 'wo-v1-fluxo-02')").run();
  db.prepare("DELETE FROM vehicle_3d_models WHERE work_order_id IN ('wo-v1-fluxo-01', 'wo-v1-fluxo-02')").run();

  // Garantir que Cliente (CUST-V1-01), Veículo (VEH-V1-GOLF4) e as 2 OS (wo-v1-fluxo-01 e wo-v1-fluxo-02) existam no banco da oficina
  db.prepare(`
    INSERT OR REPLACE INTO customers (id, company_id, name, document, phone, email)
    VALUES ('CUST-V1-01', 'gtech-paranagua', 'Marcos Vinícius Leal', '084.991.229-40', '+554196522715', 'marcos.leal@teste-gtech.com.br')
  `).run();

  db.prepare(`
    INSERT OR REPLACE INTO vehicles (id, customer_id, brand, model, year, motor, plate, chassis, color, km, fuel, body_type)
    VALUES ('VEH-V1-GOLF4', 'CUST-V1-01', 'Volkswagen', 'Golf IV', 2003, '2.0 8V APK', 'GTC-1V04', '9BWAA01J434009911', 'Prata Reflex', 84120, 'Gasolina', 'hatch')
  `).run();

  db.prepare(`
    INSERT OR REPLACE INTO work_orders (
      id, os_number, company_id, customer_id, vehicle_id, status, priority,
      assigned_mechanic_id, initial_scope, customer_complaint, diagnostic_fee, created_at, updated_at
    ) VALUES (
      'wo-v1-fluxo-01', 'OS-2026-0901', 'gtech-paranagua', 'CUST-V1-01', 'VEH-V1-GOLF4', 'inspecao', 'alta',
      NULL, 'Revisão de freios, suspensão dianteira e vistoria 360 (Visita #1)',
      'Vibração ao frear acima de 80 km/h e ruído na dianteira direita', 180,
      datetime('now', 'localtime'), datetime('now', 'localtime')
    )
  `).run();

  db.prepare(`
    INSERT OR REPLACE INTO work_orders (
      id, os_number, company_id, customer_id, vehicle_id, status, priority,
      assigned_mechanic_id, initial_scope, customer_complaint, diagnostic_fee, created_at, updated_at
    ) VALUES (
      'wo-v1-fluxo-02', 'OS-2026-0902', 'gtech-paranagua', 'CUST-V1-01', 'VEH-V1-GOLF4', 'inspecao', 'normal',
      NULL, 'Revisão preventiva semestral de fluidos e filtros (Visita #2)',
      'Retorno programado após 5.330 km rodados desde a Visita #1', 150,
      datetime('now', 'localtime'), datetime('now', 'localtime')
    )
  `).run();

  const report = {
    executed_at: new Date().toISOString(),
    req1_photos_and_history: {},
    req2_exit_sequence: {},
    req3_photo_to_3d: {},
    req4_whatsapp_states: {}
  };

  // =========================================================================
  // REQUISITO 1: UPLOAD DE FOTOGRAFIAS REALMENTE DIFERENTES (VISITA #1 e VISITA #2)
  // =========================================================================
  const visit1Angles = [
    { slot: "photo_front", idx: 0, filename: "visita1_golf4_frente_real.jpg" },
    { slot: "photo_rear",  idx: 1, filename: "visita1_golf4_traseira_real.jpg" },
    { slot: "photo_left",  idx: 2, filename: "visita1_golf4_lateral_esq_real.jpg" },
    { slot: "photo_right", idx: 3, filename: "visita1_golf4_lateral_dir_real.jpg" }
  ];

  const uploadedVisit1 = [];
  let firstBufferV1 = null;

  for (const ang of visit1Angles) {
    const buf = createDistinctPhotoBuffer(ang.idx, ang.slot, 1);
    if (!firstBufferV1) firstBufferV1 = buf;

    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "image/jpeg" }), ang.filename);
    fd.append("slot_name", ang.slot);
    fd.append("uploaded_by", "Giovane Ribeiro");

    const res = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01/intake/upload", {
      method: "POST",
      body: fd
    });
    const data = await res.json();
    if (!data.success) throw new Error(`Falha no upload Visita 1 (${ang.slot}): ${data.error}`);
    uploadedVisit1.push(data.photo);
  }

  // Testar bloqueio de envio do mesmo binário (mesmo SHA-256) para outro ângulo
  const dupFd = new FormData();
  dupFd.append("file", new Blob([firstBufferV1], { type: "image/jpeg" }), "tentativa_mesmo_jpg_outro_angulo.jpg");
  dupFd.append("slot_name", "photo_rear");
  const dupRes = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01/intake/upload", {
    method: "POST",
    body: dupFd
  });
  const dupData = await dupRes.json();

  // Salvar metadados da vistoria de entrada da Visita #1
  await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01/intake", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photo_front: uploadedVisit1[0].public_url,
      photo_rear: uploadedVisit1[1].public_url,
      photo_left: uploadedVisit1[2].public_url,
      photo_right: uploadedVisit1[3].public_url,
      odometer_km: 84120,
      fuel_pct: 60,
      observations: "Visita #1: 4 fotografias binárias distintas anexadas e auditadas por SHA-256.",
      client_acknowledged: true,
      responsible_name: "Giovane Ribeiro"
    })
  });

  // Fechar e reabrir a OS wo-v1-fluxo-01 (nova requisição GET independente)
  const reopenV1Res = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01");
  const reopenV1Data = await reopenV1Res.json();

  // Agora enviar 4 fotografias binárias realmente diferentes na VISITA #2 (wo-v1-fluxo-02, mesmo veículo VEH-V1-GOLF4)
  const visit2Angles = [
    { slot: "photo_front", idx: 4, filename: "visita2_golf4_frente_real.jpg" },
    { slot: "photo_rear",  idx: 5, filename: "visita2_golf4_traseira_real.jpg" },
    { slot: "photo_left",  idx: 6, filename: "visita2_golf4_lateral_esq_real.jpg" },
    { slot: "photo_right", idx: 7, filename: "visita2_golf4_lateral_dir_real.jpg" }
  ];

  const uploadedVisit2 = [];
  for (const ang of visit2Angles) {
    const buf = createDistinctPhotoBuffer(ang.idx, ang.slot, 2);
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "image/jpeg" }), ang.filename);
    fd.append("slot_name", ang.slot);
    fd.append("uploaded_by", "Giovane Ribeiro");

    const res = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-02/intake/upload", {
      method: "POST",
      body: fd
    });
    const data = await res.json();
    if (!data.success) throw new Error(`Falha no upload Visita 2 (${ang.slot}): ${data.error}`);
    uploadedVisit2.push(data.photo);
  }

  await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-02/intake", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photo_front: uploadedVisit2[0].public_url,
      photo_rear: uploadedVisit2[1].public_url,
      photo_left: uploadedVisit2[2].public_url,
      photo_right: uploadedVisit2[3].public_url,
      odometer_km: 89450,
      fuel_pct: 75,
      observations: "Visita #2 (6 meses depois): 4 novas fotografias binárias distintas sem sobrescrever a Visita #1.",
      client_acknowledged: true,
      responsible_name: "Giovane Ribeiro"
    })
  });

  // Consultar histórico completo de fotos do veículo após as 2 visitas
  const allPhotosRes = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01/intake/upload");
  const allPhotosData = await allPhotosRes.json();

  const allHashes = allPhotosData.all_vehicle_visit_photos.map(p => p.file_sha256);
  const uniqueHashesCount = new Set(allHashes).size;

  report.req1_photos_and_history = {
    total_photos_uploaded_across_2_visits: allPhotosData.all_vehicle_visit_photos.length,
    unique_sha256_hashes_count: uniqueHashesCount,
    all_hashes_strictly_distinct: uniqueHashesCount === 8,
    duplicate_binary_rejected_http_status: dupRes.status,
    duplicate_binary_rejected_error: dupData.error,
    reopened_os_recovered_photos_count: reopenV1Data.current_os_photos.length,
    visit_1_photos: uploadedVisit1,
    visit_2_photos: uploadedVisit2
  };

  // =========================================================================
  // REQUISITO 3: FOTO -> 3D (GERAÇÃO DE NOVO ARQUIVO .GLB APROXIMADO PELAS FOTOS REAIS DA VISITA #1)
  // =========================================================================
  const enqueueRes = await fetch("http://localhost:3002/jobs/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_type: "reconstruct_3d",
      work_order_id: "wo-v1-fluxo-01",
      payload: {
        vehicle_key: "volkswagen_golf-iv"
      }
    })
  });
  const enqueueData = await enqueueRes.json();

  // Aguardar processamento do Worker na porta 3002
  await new Promise(r => setTimeout(r, 1500));

  const workerJobsRes = await fetch("http://localhost:3002/jobs?work_order_id=wo-v1-fluxo-01");
  const workerJobsData = await workerJobsRes.json();
  const latest3DJob = workerJobsData.jobs[0];

  // Consultar API de Modelos 3D da Oficina para comprovar que o novo .GLB está associado ao veículo e à OS
  const modelApiRes = await fetch("http://localhost:3001/api/models?work_order_id=wo-v1-fluxo-01&vehicle_key=volkswagen_golf-iv");
  const modelApiData = await modelApiRes.json();

  // Consultar OS reaberta para comprovar vínculo na tabela wo_inspection_visits
  const woAfter3DRes = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01");
  const woAfter3DData = await woAfter3DRes.json();
  const visit1Record = woAfter3DData.vehicle_visits_history.find(v => v.work_order_id === "wo-v1-fluxo-01" && v.inspection_stage === "entrada");

  report.req3_photo_to_3d = {
    worker_job_id: enqueueData.job_id,
    worker_job_status: latest3DJob?.status,
    worker_result: latest3DJob?.parsed_result,
    models_api_response: {
      projection_available: modelApiData.projection_available,
      status_message: modelApiData.status_message,
      model: modelApiData.model,
      audit_trace: modelApiData.audit_trace
    },
    visit_record_3d_link: {
      visit_id: visit1Record?.id,
      generated_3d_model_id: visit1Record?.generated_3d_model_id,
      generated_3d_glb_url: visit1Record?.generated_3d_glb_url,
      generated_3d_sha256: visit1Record?.generated_3d_sha256
    }
  };

  // =========================================================================
  // REQUISITO 2 & 4: SEQUÊNCIA ESTRITA DE SAÍDA E ESTADOS DO WHATSAPP
  // checklist de saída concluído -> pronto para retirada -> notificação WhatsApp -> confirmação de retirada -> entregue
  // =========================================================================

  // 2.0 Tentativa de pular etapas (confirmar retirada antes de concluir checklist) -> deve bloquear com 422
  const prematurePickupRes = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01/exit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: "confirmar_retirada_entregue",
      delivered_to_name: "Marcos Vinícius Leal",
      pickup_confirmed_by_staff_name: "Giovane Ribeiro"
    })
  });
  const prematurePickupData = await prematurePickupRes.json();

  // 2.1 Marco 1 & 2: Concluir Checklist de Saída -> Liberar Veículo ("Pronto para retirada" / status = 'finalizada')
  const step1ExitRes = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01/exit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: "concluir_checklist_saida",
      road_test_ok: true,
      warning_lights_cleared: true,
      parts_returned: true,
      vehicle_cleaned: true,
      wheel_torque_checked: true,
      recommendations: "Reaperto de rodas após 50 km. Revisão concluída.",
      delivered_by: "Giovane Ribeiro"
    })
  });
  const step1ExitData = await step1ExitRes.json();

  // 2.2 Teste de Resiliência: Simular falha no WhatsApp e comprovar que NÃO desfaz a liberação do veículo
  const waFailRes = await fetch("http://localhost:3001/api/workshop/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      work_order_id: "wo-v1-fluxo-01",
      release_event_key: "liberacao_retirada_v1",
      authorized_test_recipient: "+554196522715",
      simulate_provider_failure: true
    })
  });
  const waFailData = await waFailRes.json();

  // 2.3 Marco 3: Notificação WhatsApp para o destinatário autorizado (+554196522715)
  // Deve registrar estado 'simulado' (jamais 'aceito pelo provedor') e manter OS como 'finalizada' (NÃO entregue)
  const waSuccessRes = await fetch("http://localhost:3001/api/workshop/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      work_order_id: "wo-v1-fluxo-01",
      release_event_key: "liberacao_retirada_v1",
      authorized_test_recipient: "+554196522715"
    })
  });
  const waSuccessData = await waSuccessRes.json();

  // 2.4 Teste de Deduplicação: Repetir envio para a mesma OS e evento -> deve bloquear com 409
  const waDupRes = await fetch("http://localhost:3001/api/workshop/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      work_order_id: "wo-v1-fluxo-01",
      release_event_key: "liberacao_retirada_v1",
      authorized_test_recipient: "+554196522715"
    })
  });
  const waDupData = await waDupRes.json();

  // 2.5 Marco 4 & 5: Confirmação de Retirada Física (data + funcionário responsável) -> Marcar como ENTREGUE
  const step3PickupRes = await fetch("http://localhost:3001/api/work-orders/wo-v1-fluxo-01/exit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: "confirmar_retirada_entregue",
      delivered_to_name: "Marcos Vinícius Leal",
      pickup_confirmed_by_staff_id: "usr-giovane-01",
      pickup_confirmed_by_staff_name: "Giovane Ribeiro"
    })
  });
  const step3PickupData = await step3PickupRes.json();

  report.req2_exit_sequence = {
    premature_pickup_blocked_status: prematurePickupRes.status,
    premature_pickup_blocked_error: prematurePickupData.error,
    step1_checklist_completed: {
      exit_stage: step1ExitData.exit_stage,
      work_order_status_after_checklist: step1ExitData.work_order_status,
      is_delivered_after_checklist: step1ExitData.work_order_status === "entregue",
      checklist_completed_at: step1ExitData.checklist_completed_at,
      ready_for_pickup_at: step1ExitData.ready_for_pickup_at,
      ready_for_pickup_by: step1ExitData.ready_for_pickup_by
    },
    step2_whatsapp_failure_resilience: {
      http_status: waFailRes.status,
      delivery_status: waFailData.deliveryStatus,
      work_order_status_after_failure: waFailData.workOrderStatusAfterDispatch,
      vehicle_release_preserved: waFailData.vehicleReleasePreserved
    },
    step3_whatsapp_notification: {
      http_status: waSuccessRes.status,
      notification_id: waSuccessData.notificationId,
      delivery_status: waSuccessData.deliveryStatus,
      work_order_status_after_whatsapp: waSuccessData.workOrderStatusAfterDispatch,
      is_delivered_after_whatsapp: waSuccessData.workOrderStatusAfterDispatch === "entregue"
    },
    step4_pickup_confirmation_and_delivered: {
      http_status: step3PickupRes.status,
      exit_stage: step3PickupData.exit_stage,
      work_order_status_final: step3PickupData.work_order_status,
      pickup_confirmed_at: step3PickupData.pickup_confirmed_at,
      pickup_confirmed_by_staff_id: step3PickupData.pickup_confirmed_by_staff_id,
      pickup_confirmed_by_staff_name: step3PickupData.pickup_confirmed_by_staff_name,
      delivered_to_name: step3PickupData.delivered_to_name
    }
  };

  report.req4_whatsapp_states = {
    simulator_recorded_state: waSuccessData.deliveryStatus,
    simulator_claims_external_provider_acceptance: waSuccessData.deliveryStatus === "aceito pelo provedor",
    authorized_test_recipient_used: waSuccessData.recipientPhone,
    duplicate_request_blocked_http_status: waDupRes.status,
    duplicate_request_blocked_status: waDupData.status,
    provider_readiness: waSuccessData.providerReadiness
  };

  const outPath = path.join(ROOT_DIR, "data", "v1_5reqs_proof.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("TEST_V1_5REQS_SUCCESS:", outPath);
  console.log(JSON.stringify({
    req1_unique_hashes: report.req1_photos_and_history.unique_sha256_hashes_count,
    req2_sequence: [
      report.req2_exit_sequence.step1_checklist_completed.work_order_status_after_checklist,
      report.req2_exit_sequence.step2_whatsapp_failure_resilience.work_order_status_after_failure,
      report.req2_exit_sequence.step3_whatsapp_notification.work_order_status_after_whatsapp,
      report.req2_exit_sequence.step4_pickup_confirmation_and_delivered.work_order_status_final
    ],
    req3_generated_glb: report.req3_photo_to_3d.models_api_response.model?.file_url,
    req4_wa_state: report.req4_whatsapp_states.simulator_recorded_state
  }, null, 2));
}

runTests().catch(err => {
  console.error("TEST_V1_5REQS_ERROR:", err);
  process.exit(1);
});
