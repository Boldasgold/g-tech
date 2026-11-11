/**
 * TESTE LIVE END-TO-END DE VALIDAÇÃO DA ARQUITETURA G-TECH V1
 * Executa testes reais via HTTP contra http://localhost:3000
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "../data/gtech.db"));
const BASE_URL = "http://localhost:3000";

let totalPassed = 0;
let totalTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    totalPassed++;
    console.log(`  [PASS] ${testName}`);
    if (details) console.log(`         -> ${details}`);
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         -> ${details}`);
  }
}

async function runLiveTests() {
  console.log("================================================================================");
  console.log("       TESTE LIVE HTTP — ARQUITETURA G-TECH V1 (OFICINA & SITE)                 ");
  console.log("================================================================================");

  // 1. SEPARAÇÃO — Site público sem 3D nem Three.js
  console.log("\n[1] Verificação de Isolamento do Site Público (HTTP)");
  const siteRes = await fetch(`${BASE_URL}/index.html`);
  const siteHtml = await siteRes.text();

  assert(
    siteRes.status === 200,
    "1.1. Site público carrega normalmente com HTTP 200"
  );
  assert(
    !siteHtml.includes("gtech-3d.js"),
    "1.2. Site público NÃO carrega 'gtech-3d.js' (Three.js 570KB)",
    "Three.js e visualizadores 3D isolados exclusivamente na rota da oficina (/oficina)."
  );
  assert(
    !siteHtml.includes(".glb"),
    "1.3. Site público NÃO referencia arquivos pesados .glb diretamente"
  );

  // 2. INTEGRAÇÃO — Agendamento no Site com Idempotência
  console.log("\n[2] Solicitação de Agendamento com Idempotência e Confirmação Pendente");
  const uniqueIdemKey = `idem-live-${Date.now()}`;
  const randomDay = String(Math.floor(10 + Math.random() * 18)).padStart(2, "0");
  const randomMin = Math.random() > 0.5 ? "00" : "30";
  const randomHour = String(Math.floor(8 + Math.random() * 8)).padStart(2, "0");
  const apptPayload = {
    customer_name: "Mariana Alencar",
    customer_phone: "(41) 99123-4567",
    vehicle_brand: "Volkswagen",
    vehicle_model: "Golf GTI MK7.5",
    vehicle_plate: "GTI-2026",
    scheduled_date: `2026-12-${randomDay}`,
    scheduled_time: `${randomHour}:${randomMin}`,
    service_interest: "Troca de óleo e revisão de freios",
    idempotency_key: uniqueIdemKey
  };

  const apptRes1 = await fetch(`${BASE_URL}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apptPayload)
  });
  const apptData1 = await apptRes1.json();
  if (!apptData1.success) console.error("  [DEBUG apptData1]:", apptData1);

  assert(
    apptRes1.status === 200 && apptData1.success === true,
    "2.1. Solicitação de agendamento registrada no banco da oficina",
    `Protocolo: ${apptData1.protocol}`
  );
  assert(
    apptData1.status_label && apptData1.status_label.includes("Aguardando Confirmação"),
    "2.2. Status retornado NUNCA declara 'confirmado' sem aprovação da oficina",
    `Rótulo: "${apptData1.status_label}"`
  );

  // Submissão Duplicada com a mesma idempotency_key
  const apptRes2 = await fetch(`${BASE_URL}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apptPayload)
  });
  const apptData2 = await apptRes2.json();

  assert(
    apptData2.duplicate_prevented === true && apptData2.protocol === apptData1.protocol,
    "2.3. Idempotência previne duplicidade e retorna protocolo existente sem reinserção",
    `Detectado duplicado: protocolo ${apptData2.protocol}`
  );

  // 3. SEGURANÇA E ACESSO — Bloqueio de Enumeração Sequencial de OS
  console.log("\n[3] Segurança de Acesso e Bloqueio de Enumeração de OS");
  const bareOsRes = await fetch(`${BASE_URL}/api/tracking/GT-OS-000127`);
  const bareOsData = await bareOsRes.json();

  assert(
    bareOsRes.status === 403 && bareOsData.protected === true,
    "3.1. Consulta direta por número de OS (GT-OS-000127) isolado é BLOQUEADA com HTTP 403",
    `Resposta segura: ${bareOsData.error}`
  );

  // Consulta por Token de Portal Individual Seguro existente no banco
  const tokenRow = db.prepare(`SELECT token FROM customer_portal_tokens WHERE work_order_id = 'wo-demo-00127'`).get();
  const securePortalToken = tokenRow ? tokenRow.token : "095373a5ced37ed1b66cf1094a09507a";

  const tokenTrackRes = await fetch(`${BASE_URL}/api/tracking/${securePortalToken}`);
  const tokenTrackData = await tokenTrackRes.json();

  assert(
    tokenTrackRes.status === 200 && tokenTrackData.success === true && tokenTrackData.type === "work_order_secure",
    "3.2. Acesso autorizado exclusivamente através do link individual protegido",
    `Veículo: ${tokenTrackData.vehicle} | Status: ${tokenTrackData.status_label}`
  );

  // 4. PROCESSAMENTO ASSÍNCRONO 3D/IA EM FILA (NÃO BLOQUEIA CHECKLIST)
  console.log("\n[4] Fila de Processamento Assíncrono com Limite de Concorrência");
  const jobRes = await fetch(`${BASE_URL}/api/workshop/jobs/enqueue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({
      job_type: "ai_vision_scan",
      work_order_id: "wo-demo-00127",
      payload: {
        images: ["foto1.jpg", "foto2.jpg"],
        vehicle: "Renault Duster"
      }
    })
  });
  const jobData = await jobRes.json();

  if (!jobData.success) {
    console.error("  [DEBUG ERROR jobData]:", jobData);
  }

  assert(
    jobRes.status === 200 && jobData.success === true && !!jobData.job,
    "4.1. Tarefa pesada de visão computacional enfileirada no serviço assíncrono",
    `Job ID: ${jobData.job?.job_id || jobData.job?.id} | Status: ${jobData.job?.status}`
  );

  // 5. WHATSAPP "PRONTO PARA RETIRADA" (EXCLUSIVIDADE DA OFICINA & ANTI-DUPLICIDADE)
  console.log("\n[5] Notificação WhatsApp Exclusiva da Oficina e Anti-Duplicidade");
  const notifRes1 = await fetch(`${BASE_URL}/api/workshop/notifications/send-ready`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({
      work_order_id: "wo-demo-00127"
    })
  });
  const notifData1 = await notifRes1.json();

  assert(
    notifData1.status === "enviado" || notifData1.status === "duplicado_bloqueado",
    "5.1. Disparo de WhatsApp executado e auditado com sucesso pela oficina",
    `Status: ${notifData1.status} | Destinatário: ${notifData1.recipientPhone || "registrado"}`
  );

  // Tentativa de segundo disparo no mesmo dia (Controle de Duplicidade Diária)
  const notifRes2 = await fetch(`${BASE_URL}/api/workshop/notifications/send-ready`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({
      work_order_id: "wo-demo-00127"
    })
  });
  const notifData2 = await notifRes2.json();

  assert(
    notifData2.status === "duplicado_bloqueado",
    "5.2. Segundo disparo no mesmo dia é INTERCEPTADO e BLOQUEADO por idempotência",
    `Mensagem: ${notifData2.message}`
  );

  // 6. CONVERSÃO DE AGENDAMENTO EM ORDEM DE SERVIÇO NA OFICINA
  console.log("\n[6] Vinculação de Agendamento à Nova Ordem de Serviço");
  const convertRes = await fetch(`${BASE_URL}/api/workshop/appointments/convert-to-os`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-token": "session-giovane-director-token-2026"
    },
    body: JSON.stringify({
      appointment_id: apptData1.appointment_id || apptData1.protocol,
      service_description: "Revisão Geral e Diagnóstico Eletrônico"
    })
  });
  const convertData = await convertRes.json();

  assert(
    convertRes.status === 200 && convertData.success === true && !!convertData.workOrderCode,
    "6.1. Agendamento convertido em Ordem de Serviço (OS) com geração de token individual",
    `OS gerada: ${convertData.workOrderCode} | ID: ${convertData.workOrderId}`
  );

  // RESUMO
  console.log("\n================================================================================");
  console.log(`RESULTADO FINAL DO TESTE LIVE: ${totalPassed} de ${totalTests} testes aprovados (${Math.round((totalPassed/totalTests)*100)}%)`);
  console.log("================================================================================");

  if (totalPassed === totalTests) {
    console.log("🎉 TODOS OS REQUISITOS DA ARQUITETURA V1 FORAM VALIDADOS COM 100% DE SUCESSO!\n");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runLiveTests().catch(err => {
  console.error("Erro fatal no teste live:", err);
  process.exit(1);
});
