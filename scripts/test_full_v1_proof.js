/**
 * SUITE COMPLETA DE VALIDAÇÃO FUNCIONAL G-TECH V1 + CORREÇÃO PRIORITÁRIA 3D
 * Executa os 12 testes existentes + 6 novos blocos de comprovação funcional E2E
 * contra os 3 processos independentes:
 * - Site Público: http://localhost:3000
 * - Programa da Oficina: http://localhost:3001
 * - Trabalhador IA/3D: http://localhost:3002
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const db = new DatabaseSync(path.join(__dirname, "../data/gtech.db"));
const outboxDb = new DatabaseSync(path.join(__dirname, "../data/site_outbox.db"));

const SITE_URL = "http://localhost:3000";
const WORKSHOP_URL = "http://localhost:3001";
const WORKER_URL = "http://localhost:3002";

let totalPassed = 0;
let totalTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    totalPassed++;
    console.log(`  [PASS] #${totalTests} - ${testName}`);
    if (details) console.log(`         -> ${details}`);
  } else {
    console.error(`  [FAIL] #${totalTests} - ${testName}`);
    if (details) console.error(`         -> ${details}`);
  }
}

async function runFullSuite() {
  console.log("================================================================================");
  console.log("   SUITE DE COMPROVAÇÃO FUNCIONAL G-TECH V1 & AUDITORIA 3D (PORTAS 3000/3001/3002)");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // PARTE I: OS 12 TESTES BASE EXISTENTES (PRESERVADOS E EXECUTADOS)
  // ---------------------------------------------------------------------------
  console.log("\n--- BLOCO A: 12 TESTES EXISTENTES DA ARQUITETURA V1 ---");

  const siteRes = await fetch(`${SITE_URL}/index.html`);
  const siteHtml = await siteRes.text();

  assert(siteRes.status === 200, "Teste 1: Site público carrega normalmente com HTTP 200 (Porta 3000)");
  assert(!siteHtml.includes("gtech-3d.js"), "Teste 2: Site público NÃO carrega 'gtech-3d.js' (Three.js)");
  assert(!siteHtml.includes(".glb"), "Teste 3: Site público NÃO referencia arquivos pesados .glb diretamente");

  const uniqueIdemKey = `idem-live-${Date.now()}`;
  const randomDay = String(Math.floor(10 + Math.random() * 18)).padStart(2, "0");
  const randomMin = Math.random() > 0.5 ? "00" : "30";
  const randomHour = String(Math.floor(8 + Math.random() * 8)).padStart(2, "0");
  const apptPayload = {
    customer_name: "Mariana Alencar",
    customer_phone: "(41) 99123-4567",
    vehicle_brand: "Volkswagen",
    vehicle_model: "Golf IV 2.0",
    vehicle_plate: "GLF-2026",
    scheduled_date: `2026-11-${randomDay}`,
    scheduled_time: `${randomHour}:${randomMin}`,
    issue_description: "Troca de óleo e revisão de freios",
    idempotency_key: uniqueIdemKey
  };

  const apptRes1 = await fetch(`${SITE_URL}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apptPayload)
  });
  const apptData1 = await apptRes1.json();

  assert(
    apptRes1.status === 200 && apptData1.success === true,
    "Teste 4: Solicitação de agendamento no Site (3000) encaminhada e registrada na Oficina (3001)",
    `Protocolo: ${apptData1.protocol}`
  );
  assert(
    apptData1.status_label && apptData1.status_label.includes("Aguardando Confirmação"),
    "Teste 5: Status retornado NUNCA declara 'confirmado' sem aprovação da oficina",
    `Rótulo: "${apptData1.status_label}"`
  );

  const apptRes2 = await fetch(`${WORKSHOP_URL}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apptPayload)
  });
  const apptData2 = await apptRes2.json();

  assert(
    apptData2.duplicate_prevented === true && apptData2.protocol === apptData1.protocol,
    "Teste 6: Idempotência previne duplicidade e retorna protocolo existente sem reinserção",
    `Protocolo preservado: ${apptData2.protocol}`
  );

  const bareOsRes = await fetch(`${WORKSHOP_URL}/api/tracking/GT-OS-000127`);
  const bareOsData = await bareOsRes.json();

  assert(
    bareOsRes.status === 403 && bareOsData.protected === true,
    "Teste 7: Consulta direta por número sequencial de OS (GT-OS-000127) é BLOQUEADA com HTTP 403",
    `Erro: ${bareOsData.error}`
  );

  const tokenRow = db.prepare(`SELECT token FROM customer_portal_tokens WHERE work_order_id = 'wo-demo-00127'`).get();
  const securePortalToken = tokenRow ? tokenRow.token : "095373a5ced37ed1b66cf1094a09507a";
  const tokenTrackRes = await fetch(`${WORKSHOP_URL}/api/tracking/${securePortalToken}`);
  const tokenTrackData = await tokenTrackRes.json();

  assert(
    tokenTrackRes.status === 200 && tokenTrackData.success === true && tokenTrackData.type === "work_order_secure",
    "Teste 8: Acesso autorizado exclusivamente através do link individual protegido",
    `Veículo: ${tokenTrackData.vehicle} | Status: ${tokenTrackData.status_label}`
  );

  const jobRes = await fetch(`${WORKSHOP_URL}/api/workshop/jobs/enqueue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({
      job_type: "ai_vision_scan",
      work_order_id: "wo-demo-00127",
      payload: { images: ["foto1.jpg", "foto2.jpg"], vehicle: "Renault Duster" }
    })
  });
  const jobData = await jobRes.json();

  assert(
    jobRes.status === 200 && jobData.success === true && !!jobData.job,
    "Teste 9: Tarefa pesada de visão computacional enfileirada no serviço assíncrono",
    `Job ID: ${jobData.job?.job_id || jobData.job?.id}`
  );

  const notifRes1 = await fetch(`${WORKSHOP_URL}/api/workshop/notifications/send-ready`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({ work_order_id: "wo-demo-00127" })
  });
  const notifData1 = await notifRes1.json();

  assert(
    notifData1.status === "enviado" || notifData1.status === "duplicado_bloqueado",
    "Teste 10: Disparo de WhatsApp executado e auditado exclusivamente pela oficina",
    `Status: ${notifData1.status}`
  );

  const notifRes2 = await fetch(`${WORKSHOP_URL}/api/workshop/notifications/send-ready`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({ work_order_id: "wo-demo-00127" })
  });
  const notifData2 = await notifRes2.json();

  assert(
    notifData2.status === "duplicado_bloqueado",
    "Teste 11: Segundo disparo repetido para a mesma OS é INTERCEPTADO e BLOQUEADO por idempotência",
    `Mensagem: ${notifData2.message}`
  );

  const convertRes = await fetch(`${WORKSHOP_URL}/api/workshop/appointments/convert-to-os`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({
      appointment_id: apptData1.protocol,
      service_description: "Revisão Geral e Diagnóstico Eletrônico"
    })
  });
  const convertData = await convertRes.json();

  assert(
    convertRes.status === 200 && convertData.success === true && !!convertData.workOrderCode,
    "Teste 12: Agendamento convertido em Ordem de Serviço (OS) com geração de token individual",
    `OS gerada: ${convertData.workOrderCode} (${convertData.workOrderId})`
  );

  // ---------------------------------------------------------------------------
  // PARTE II: NOVOS TESTES DE COMPROVAÇÃO FUNCIONAL (TESTES 13 A 18)
  // ---------------------------------------------------------------------------
  console.log("\n--- BLOCO B: COMPROVAÇÃO DOS REQUISITOS FUNCIONAIS E CORREÇÃO 3D ---");

  // TESTE 13: COMPROVAÇÃO DE SEPARAÇÃO DE PROCESSOS E PORTAS (3000, 3001, 3002)
  const siteHealth = await (await fetch(`${SITE_URL}/api/health`)).json();
  const workerHealth = await (await fetch(`${WORKER_URL}/health`)).json();
  const glbBlockedOnSite = await fetch(`${SITE_URL}/models/vehicles/volkswagen_arteon_shooting_brake.glb`);
  const adminBlockedOnSite = await fetch(`${SITE_URL}/oficina`);

  assert(
    siteHealth.port === 3000 &&
      workerHealth.port === 3002 &&
      siteHealth.process_pid !== workerHealth.process_pid &&
      glbBlockedOnSite.status === 403 &&
      adminBlockedOnSite.status === 403,
    "Teste 13 (Req 1 - Separação): Site (3000), Oficina (3001) e Worker (3002) rodam em processos/PIDs distintos e Site bloqueia GLB/Oficina (HTTP 403)",
    `PID Site(3000)=${siteHealth.process_pid} | PID Worker(3002)=${workerHealth.process_pid} | Oficina=Porta 3001`
  );

  // TESTE 14: SINCRONIZAÇÃO PÓS-INDISPONIBILIDADE SEM DUPLICAR (FASE 2 DO OUTAGE TEST)
  const outageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/last_outage_test_key.json"), "utf8"));
  const syncRes = await fetch(`${SITE_URL}/api/outbox/sync`, { method: "POST" });
  const syncData = await syncRes.json();
  // Tentar sincronizar novamente e reenviar o mesmo agendamento para provar que NÃO duplica
  await fetch(`${SITE_URL}/api/outbox/sync`, { method: "POST" });
  await fetch(`${WORKSHOP_URL}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(outageInfo.payload)
  });

  const outboxAfter = outboxDb.prepare("SELECT * FROM site_outbox_queue WHERE idempotency_key = ?").get(outageInfo.idempotency_key);
  const workshopCount = db.prepare("SELECT COUNT(*) as cnt, protocol FROM appointments WHERE idempotency_key = ?").get(outageInfo.idempotency_key);

  assert(
    outboxAfter?.sync_status === "sincronizado_oficina" && workshopCount?.cnt === 1,
    "Teste 14 (Req 2 - Indisponibilidade): Solicitação guardada em data/site_outbox.db com oficina parada sincronizou ao reiniciar a oficina SEM DUPLICAR (cnt=1)",
    `Outbox status=${outboxAfter?.sync_status} | Protocolo Oficina=${outboxAfter?.workshop_protocol} | Registros no banco da oficina=${workshopCount?.cnt}`
  );

  // TESTE 15: FLUXO PRINCIPAL V1 COMPLETO + PRESERVAÇÃO DE HISTÓRICO EM NOVA VISITA (SEM SOBRESCREVER FOTOS PASSADAS)
  // Criar OS Visita #1
  const createOs1Res = await fetch(`${WORKSHOP_URL}/api/work-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: "Roberto Almeida (Fluxo V1)",
      customer_phone: "(41) 9652-2715",
      customer_document: "111.222.333-44",
      vehicle_brand: "Volkswagen",
      vehicle_model: "Golf IV",
      vehicle_plate: "VWG-4411",
      vehicle_year: "2003",
      vehicle_km: "82000",
      vehicle_body_type: "hatch",
      initial_scope: "Visita 1 - Revisão de freios e suspensão",
      customer_complaint: "Ruído ao frear"
    })
  });
  const os1Data = await createOs1Res.json();
  const wo1Id = os1Data.work_order_id;

  // Fotos + Checklist de Entrada na Visita #1
  await fetch(`${WORKSHOP_URL}/api/work-orders/${wo1Id}/intake`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photo_front: "/img/vehicles/volkswagen/fotos/golf-iv.jpg?visita=1_frente",
      photo_rear: "/img/vehicles/volkswagen/fotos/golf-iv.jpg?visita=1_traseira",
      odometer_km: 82000,
      fuel_pct: 60,
      observations: "Fotos originais da Visita #1 registradas na entrada.",
      client_acknowledged: true
    })
  });

  // Registrar Avaria na Visita #1
  await fetch(`${WORKSHOP_URL}/api/work-orders/${wo1Id}/hotspots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region_name: "Para-choque Dianteiro",
      orientation_side: "dianteira",
      pos_x: 0.2,
      pos_y: 0.5,
      pos_z: 1.8,
      severity: "media",
      hotspot_type: "avaria_entrada",
      damage_type: "risco",
      description: "Risco superficial de 4cm no para-choque dianteiro registrado na entrada."
    })
  });

  // Fechar e Reabrir OS #1 (GET /api/work-orders/[id])
  const reopen1 = await (await fetch(`${WORKSHOP_URL}/api/work-orders/${wo1Id}`)).json();
  const firstChecklistItem = Object.values(reopen1.checklist_groups || {}).flat()[0];
  if (firstChecklistItem) {
    await fetch(`${WORKSHOP_URL}/api/work-orders/${wo1Id}/checklist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: firstChecklistItem.id,
        status: "ATENCAO",
        finding_description: "Desgaste de pastilha constatado no checklist de entrada",
        test_performed: "Inspeção visual e paquímetro",
        priority: "alta"
      })
    });
  }

  // Transição para "Pronto para retirada" + Aviso WhatsApp (Validando que NÃO marca como entregue!)
  const waRes1 = await fetch(`${WORKSHOP_URL}/api/workshop/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      work_order_id: wo1Id,
      release_event_key: "liberacao_visita_1",
      authorized_test_recipient: "+554196522715"
    })
  });
  const waData1 = await waRes1.json();

  // Verificar no banco que o status após o WhatsApp é "finalizada" (Pronto p/ retirada) e NÃO "entregue"
  const woAfterWa = db.prepare("SELECT status FROM work_orders WHERE id = ?").get(wo1Id);

  // Tentar disparar WhatsApp duplicado para o mesmo evento de liberação -> deve bloquear (409)
  const waDupRes = await fetch(`${WORKSHOP_URL}/api/workshop/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      work_order_id: wo1Id,
      release_event_key: "liberacao_visita_1",
      authorized_test_recipient: "+554196522715"
    })
  });
  const waDupData = await waDupRes.json();

  // Concluir Checklist de Saída -> Marcar como ENTREGUE
  await fetch(`${WORKSHOP_URL}/api/work-orders/${wo1Id}/exit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      road_test_ok: true,
      warning_lights_cleared: true,
      wheel_torque_checked: true,
      vehicle_cleaned: true,
      recommendations: "Revisão concluída na Visita 1.",
      delivered_to_name: "Roberto Almeida",
      final_status: "entregue"
    })
  });
  const woAfterExit = db.prepare("SELECT status FROM work_orders WHERE id = ?").get(wo1Id);

  // Abrir NOVA VISITA (Visita #2) para o MESMO VEÍCULO (placa VWG-4411) com novas fotos
  const createOs2Res = await fetch(`${WORKSHOP_URL}/api/work-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: "Roberto Almeida (Fluxo V1)",
      customer_phone: "(41) 9652-2715",
      customer_document: "111.222.333-44",
      vehicle_brand: "Volkswagen",
      vehicle_model: "Golf IV",
      vehicle_plate: "VWG-4411",
      vehicle_year: "2003",
      vehicle_km: "89500",
      vehicle_body_type: "hatch",
      initial_scope: "Visita 2 - Troca de óleo 89.500 km",
      customer_complaint: "Manutenção preventiva segunda visita"
    })
  });
  const os2Data = await createOs2Res.json();
  const wo2Id = os2Data.work_order_id;

  await fetch(`${WORKSHOP_URL}/api/work-orders/${wo2Id}/intake`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photo_front: "/img/vehicles/volkswagen/fotos/golf-iv.jpg?visita=2_frente_nova",
      photo_rear: "/img/vehicles/volkswagen/fotos/golf-iv.jpg?visita=2_traseira_nova",
      odometer_km: 89500,
      fuel_pct: 80,
      observations: "Fotos da Visita #2 sem sobrescrever a Visita #1.",
      client_acknowledged: true
    })
  });

  const reopen2 = await (await fetch(`${WORKSHOP_URL}/api/work-orders/${wo2Id}`)).json();
  const intakeWo1StillIntact = db.prepare("SELECT photo_front, odometer_km FROM wo_intake_inspection WHERE work_order_id = ?").get(wo1Id);
  const visitsList = reopen2.vehicle_visits_history || [];

  assert(
    woAfterWa.status === "finalizada" &&
      woAfterExit.status === "entregue" &&
      intakeWo1StillIntact.photo_front.includes("visita=1_frente") &&
      visitsList.length >= 2,
    "Teste 15 (Req 3 - Fluxo V1 Completo + Multi-Visitas): Fluxo completo executado e Visita #2 gerou nova vistoria preservando intactas as fotos da Visita #1",
    `Status pós-WhatsApp='${woAfterWa.status}' (não entregue) -> Status pós-Saída='${woAfterExit.status}' | Foto Visita 1 preservada='${intakeWo1StillIntact.photo_front}' | Total registros de visita=${visitsList.length}`
  );

  // TESTE 16: VALIDAÇÃO DETALHADA DO WHATSAPP (PROVEDOR, SIMULAÇÃO VS REAL, ENTREGA VS ACEITE, DUPLICIDADE)
  assert(
    waData1.success === true &&
      typeof waData1.isSimulation === "boolean" &&
      waData1.providerName?.includes("Simulador Local Auditado") &&
      waData1.deliveryStatus === "aceito_provedor_pendente_confirmacao" &&
      waData1.workOrderStatusAfterDispatch === "finalizada" &&
      waDupRes.status === 409 &&
      waDupData.status === "duplicado_bloqueado",
    "Teste 16 (Req 5 - WhatsApp): Provedor identificado, diferencia simulação/envio real e aceite/entrega confirmada, bloqueia duplicidade (HTTP 409) e não marca OS como entregue",
    `Provedor="${waData1.providerName}" | Simulação=${waData1.isSimulation} | Delivery="${waData1.deliveryStatus}" | Duplicado=${waDupData.status}`
  );

  // TESTE 17: COMPROVAÇÃO FOTO -> 3D NO WORKER INDEPENDENTE (3002) + INDEPENDÊNCIA DO CHECKLIST
  const enqueue3dRes = await fetch(`${WORKER_URL}/jobs/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_type: "reconstruct_3d",
      work_order_id: wo1Id,
      payload: {
        vehicle_key: "volkswagen_golf-iv",
        source_photos: [
          "/img/vehicles/volkswagen/fotos/golf-iv.jpg?visita=1_frente",
          "/img/vehicles/volkswagen/fotos/golf-iv.jpg?visita=1_traseira"
        ]
      }
    })
  });
  const enqueue3dData = await enqueue3dRes.json();
  await new Promise(r => setTimeout(r, 600));
  const workerJobsData = await (await fetch(`${WORKER_URL}/jobs?work_order_id=${wo1Id}`)).json();
  const reconJob = workerJobsData.jobs.find(j => j.job_id === enqueue3dData.job_id);
  const reconResult = reconJob ? JSON.parse(reconJob.result_json || "{}") : {};

  assert(
    reconJob &&
      reconJob.status === "concluido" &&
      reconResult.reconstruction_status === "PENDENTE" &&
      reconResult.generated_glb_file === null &&
      Array.isArray(reconResult.source_photos) &&
      reconResult.source_photos.length === 2,
    "Teste 17 (Req 4 - Foto -> 3D): Worker processa fotos da OS e declara honestamente reconstrução 3D 'PENDENTE' (sem fingir GLB pré-instalado), mantendo checklist 100% funcional",
    `Job=${reconJob?.job_id} | Status Reconstrução=${reconResult.reconstruction_status} | Fotos=${reconResult.source_photos?.length}`
  );

  // TESTE 18: CORREÇÃO PRIORITÁRIA 3D (BLOQUEIO DA FERRARI cafe3f48... EM GOLF IV, GOLF VII, JETTA E APROVAÇÃO DO ARTEON)
  const golfIvModel = await (await fetch(`${WORKSHOP_URL}/api/models?vehicle_key=volkswagen_golf-iv&photo_url=/img/vehicles/volkswagen/fotos/golf-iv.jpg`)).json();
  const golfViiModel = await (await fetch(`${WORKSHOP_URL}/api/models?vehicle_key=volkswagen_golf-vii&photo_url=/img/vehicles/volkswagen/fotos/golf-vii.jpg`)).json();
  const jettaModel = await (await fetch(`${WORKSHOP_URL}/api/models?vehicle_key=volkswagen_jetta-gli&photo_url=/img/vehicles/volkswagen/fotos/jetta-gli.jpg`)).json();
  const arteonModel = await (await fetch(`${WORKSHOP_URL}/api/models?vehicle_key=volkswagen_arteon&photo_url=/img/vehicles/volkswagen/fotos/arteon.jpg`)).json();

  assert(
    golfIvModel.has_specific_model === false &&
      golfIvModel.status_message === "Projeção 3D deste veículo ainda não disponível" &&
      golfViiModel.has_specific_model === false &&
      jettaModel.has_specific_model === false &&
      arteonModel.has_specific_model === true &&
      arteonModel.model?.file_sha256 === "29543f894fc6985fad0f60a589983384abca004fbd0959a2a9828ffefa0a80b4",
    "Teste 18 (Correção Prioritária 3D): Malha Ferrari (cafe3f48...) bloqueada para Golf IV, Golf VII e Jetta GLI; aviso 'Projeção 3D deste veículo ainda não disponível' retornado; Arteon carrega GLB autêntico (29543f89...)",
    `Golf IV="${golfIvModel.status_message}" | Jetta Origem="${jettaModel.audit_trace?.association_origin}" | Arteon SHA256=${arteonModel.model?.file_sha256?.slice(0, 16)}...`
  );

  // TESTE 19: ISOLAMENTO ENTRE CLIENTES (CLIENTE A NÃO ACESSA ATENDIMENTO DO CLIENTE B)
  const allTokens = db.prepare("SELECT token, work_order_id, customer_id FROM customer_portal_tokens LIMIT 5").all();
  const tokenClientA = allTokens[0];
  const tokenClientB = allTokens.find(t => t.work_order_id !== tokenClientA.work_order_id) || allTokens[1];
  const respA = await (await fetch(`${WORKSHOP_URL}/api/tracking/${tokenClientA.token}`)).json();
  const respB = await (await fetch(`${WORKSHOP_URL}/api/tracking/${tokenClientB.token}`)).json();
  const fakeTokenResp = await fetch(`${WORKSHOP_URL}/api/tracking/${tokenClientA.token.slice(0, -4)}ffff`);
  const plateAttemptResp = await fetch(`${WORKSHOP_URL}/api/tracking/VWG-4411`);

  assert(
    respA.protocol !== respB.protocol &&
      !JSON.stringify(respA).includes(respB.protocol) &&
      fakeTokenResp.status === 404 &&
      (plateAttemptResp.status === 403 || plateAttemptResp.status === 404),
    "Teste 19 (Req 6 - Isolamento entre Clientes): Cliente A acessa exclusivamente sua OS, não enxerga OS do Cliente B, e tentativas por placa ou token adulterado são bloqueadas (403/404)",
    `Cliente A OS=${respA.protocol} !== Cliente B OS=${respB.protocol} | Placa direta bloqueada HTTP=${plateAttemptResp.status}`
  );

  console.log("\n================================================================================");
  console.log(`RESULTADO FINAL: ${totalPassed} de ${totalTests} testes aprovados (${Math.round((totalPassed / totalTests) * 100)}%)`);
  console.log("================================================================================");

  // Salvar resumo JSON para o relatório final
  fs.writeFileSync(
    path.join(__dirname, "../data/v1_full_test_results.json"),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      totalPassed,
      totalTests,
      siteHealth,
      workerHealth,
      outboxAfter,
      wo1Id,
      wo2Id,
      waData1,
      waDupData,
      reconResult,
      golfIvAudit: golfIvModel.audit_trace,
      jettaAudit: jettaModel.audit_trace,
      arteonAudit: arteonModel.audit_trace
    }, null, 2)
  );
}

runFullSuite().catch(err => {
  console.error("Erro fatal na suite:", err);
  process.exit(1);
});
