/**
 * TESTE END-TO-END DE VALIDAÇÃO DA ARQUITETURA G-TECH V1
 * Executa todos os testes exigidos no documento "ALTERAÇÃO DE ARQUITETURA — G-TECH V1"
 */

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.join(__dirname, "../data/gtech.db");
const db = new DatabaseSync(dbPath);

console.log("================================================================================");
console.log("       VALIDAÇÃO INTEGRAL DA ARQUITETURA G-TECH V1 (OFICINA & SITE)            ");
console.log("================================================================================");

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

// -----------------------------------------------------------------------------
// TESTE 1: SEPARAÇÃO DO SITE PÚBLICO E BIBLIOTECAS 3D
// -----------------------------------------------------------------------------
console.log("\n[1] Verificação de Isolamento do Site Público");
const publicHtmlPath = path.join(__dirname, "../public/index.html");
const publicHtml = fs.readFileSync(publicHtmlPath, "utf-8");

assert(
  !publicHtml.includes("gtech-3d.js"),
  "1.1. O site público (index.html) NÃO carrega 'gtech-3d.js' (Three.js 570KB)",
  "Script 3D removido das páginas públicas; Three.js restrito exclusivamente à /oficina."
);

assert(
  !publicHtml.includes(".glb"),
  "1.2. O site público (index.html) NÃO referencia arquivos pesados .glb",
  "Modelos 3D permanecem em armazenamento técnico da oficina."
);

// -----------------------------------------------------------------------------
// TESTE 2: FILA DE PROCESSAMENTO ASSÍNCRONO COM PROTEÇÃO CONTRA FALHAS
// -----------------------------------------------------------------------------
console.log("\n[2] Fila Assíncrona e Limite de Concorrência (IA / Reconstrução 3D)");
const { enqueueJob, getJobById } = require("../src/lib/queue/task-queue.ts");

const testJob = enqueueJob({
  jobType: "ai_vision_scan",
  workOrderId: "wo-demo-00127",
  payload: {
    images: ["foto_avaria_1.jpg", "foto_avaria_2.jpg"],
    vehicle: "Volkswagen Arteon"
  }
});

assert(
  !!testJob && testJob.job_id.startsWith("job-"),
  "2.1. Tarefa de IA/3D é enfileirada assincronamente sem travar o checklist do mecânico",
  `Job ID gerado: ${testJob.job_id}`
);

// Verifica persistência na tabela processing_jobs_queue
const jobInDb = db.prepare(`SELECT * FROM processing_jobs_queue WHERE job_id = ?`).get(testJob.job_id);
assert(
  jobInDb && (jobInDb.status === "queued" || jobInDb.status === "completed" || jobInDb.status === "processing"),
  "2.2. Estado do job é persistido na tabela processing_jobs_queue",
  `Status atual no banco: ${jobInDb.status}`
);

// -----------------------------------------------------------------------------
// TESTE 3: INTEGRAÇÃO COM O SITE — IDEMPOTÊNCIA E RESILIÊNCIA OFFLINE
// -----------------------------------------------------------------------------
console.log("\n[3] Integração com o Site (Idempotência, Fila Offline e Conversão em OS)");
const {
  handleSiteAppointmentSubmission,
  drainPendingSyncQueue,
  convertAppointmentToWorkOrder
} = require("../src/lib/sync/offline-sync-service.ts");

const uniqueIdempotencyKey = `idem-test-${Date.now()}`;
const appointmentData = {
  idempotency_key: uniqueIdempotencyKey,
  name: "Carlos Eduardo da Silva",
  phone: "(41) 98888-1234",
  vehicle_brand: "Volkswagen",
  vehicle_model: "Jetta GLI",
  vehicle_plate: "BCP-9J88",
  service_interest: "Revisão de 50.000 km e ruído na suspensão",
  preferred_date: "2026-11-12",
  preferred_time: "09:00"
};

// 3.1 Submissão Normal
const submission1 = handleSiteAppointmentSubmission(appointmentData, false);
assert(
  submission1.success && submission1.status === "recebido_aguardando_confirmacao",
  "3.1. Solicitação recebida no site com status 'solicitado' (NUNCA confirmado prematuramente)",
  `Protocolo: ${submission1.protocol}`
);

// 3.2 Submissão Duplicada com a mesma chave de idempotência
const submission2 = handleSiteAppointmentSubmission(appointmentData, false);
assert(
  submission2.success && submission2.status === "duplicado_existente" && submission2.protocol === submission1.protocol,
  "3.2. Idempotência previne cadastro e solicitação duplicada",
  `Retornou mesmo protocolo original: ${submission2.protocol}`
);

// 3.3 Simulação de Queda da Oficina (Modo Offline)
const offlineKey = `idem-offline-${Date.now()}`;
const offlineSubmission = handleSiteAppointmentSubmission({
  ...appointmentData,
  idempotency_key: offlineKey,
  name: "Mariana Souza Santos"
}, true); // Simula oficina indisponível

assert(
  offlineSubmission.success && offlineSubmission.status === "preservado_offline_fila",
  "3.3. Durante indisponibilidade temporária da oficina, solicitação é preservada na fila local",
  `Sync ID na fila: ${offlineSubmission.protocol}`
);

// 3.4 Restabelecimento da Conexão e Dreno da Fila
const drainResult = drainPendingSyncQueue();
assert(
  drainResult.processed >= 1,
  "3.4. Ao restabelecer conexão, fila offline é sincronizada automaticamente com a oficina",
  `Total processado com sucesso: ${drainResult.processed}`
);

// 3.5 Conversão de Agendamento em Ordem de Serviço (OS)
const convertResult = convertAppointmentToWorkOrder(submission1.protocol, "user-giovane", "Revisão Jetta GLI");
assert(
  convertResult.success && !!convertResult.workOrderCode,
  "3.5. Agendamento vinculado à Ordem de Serviço na abertura do atendimento",
  `Vinculado com sucesso à ${convertResult.workOrderCode}`
);

// -----------------------------------------------------------------------------
// TESTE 4: AUTENTICAÇÃO, RBAC E PROTEÇÃO CONTRA ENUMERAÇÃO DE OS
// -----------------------------------------------------------------------------
console.log("\n[4] Controle de Acesso (RBAC) e Bloqueio de Enumeração de OS");
const { authenticateStaff, getStaffSession, checkPermission } = require("../src/lib/auth-service.ts");
const { getSafePublicTracking } = require("../src/lib/sync/offline-sync-service.ts");

// 4.1 Login de Funcionário
const staffSession = authenticateStaff("giovane@gtech.com.br", "gtech2026");
assert(
  !!staffSession && staffSession.user.role === "gestor",
  "4.1. Funcionário da oficina autentica com credenciais válidas e recebe papel (Role)",
  `Usuário: ${staffSession?.user.name} | Cargo: ${staffSession?.user.role}`
);

// 4.2 Verificação de Permissão por Função
assert(
  checkPermission(staffSession, "edit_work_order") === true,
  "4.2. Gestor possui permissão 'edit_work_order' para gerenciar OS e notificações"
);

// 4.3 Bloqueio de Acesso com Senha Incorreta
const invalidLogin = authenticateStaff("giovane@gtech.com.br", "senha_errada");
assert(
  invalidLogin === null,
  "4.3. Tentativa de login inválida é rejeitada com segurança"
);

// 4.4 Bloqueio de Enumeração Sequencial de OS no Rastreamento Público
const bareOsTracking = getSafePublicTracking("GT-OS-000127");
assert(
  bareOsTracking.found === false && bareOsTracking.error.includes("Acesso não autorizado"),
  "4.4. Número sequencial de OS ou placa isolados NÃO autorizam acesso direto no site público",
  `Mensagem de proteção: ${bareOsTracking.error}`
);

// 4.5 Acesso Autorizado via Token Individual Criptografado
const tokenRow = db.prepare(`SELECT portal_token FROM customer_portal_tokens LIMIT 1`).get();
if (tokenRow) {
  const tokenTracking = getSafePublicTracking(tokenRow.portal_token);
  assert(
    tokenTracking.found === true && !!tokenTracking.data.status_atual,
    "4.5. Cliente acessa apenas seu atendimento através de token seguro individual",
    `Acesso autorizado para veículo: ${tokenTracking.data.veiculo} (${tokenTracking.data.status_atual})`
  );
}

// -----------------------------------------------------------------------------
// TESTE 5: NOTIFICAÇÃO WHATSAPP "PRONTO PARA RETIRADA" (EXCLUSIVIDADE DA OFICINA)
// -----------------------------------------------------------------------------
console.log("\n[5] Notificação WhatsApp Exclusiva da Oficina e Anti-Duplicidade");
const { sendReadyForPickupNotification } = require("../src/lib/whatsapp-service.ts");

// 5.1 Tentativa de disparo pelo SITE (Bloqueio Obrigatório)
const blockedSiteDispatch = sendReadyForPickupNotification({
  workOrderId: convertResult.workOrderId,
  sentByUserId: "cliente-site",
  origin: "site" // Violação intencional
});

assert(
  blockedSiteDispatch.success === false && blockedSiteDispatch.status === "bloqueado_origem_invalida",
  "5.1. Disparo de 'Pronto para Retirada' a partir do site público é ESTRITAMENTE BLOQUEADO",
  "Garantia: O site nunca dispara notificações operacionais da oficina."
);

// 5.2 Disparo Oficial Autorizado pela OFICINA
const validWorkshopDispatch = sendReadyForPickupNotification({
  workOrderId: convertResult.workOrderId,
  sentByUserId: staffSession.user.id,
  origin: "workshop"
});

assert(
  validWorkshopDispatch.success === true && validWorkshopDispatch.status === "enviado",
  "5.2. Oficina dispara com sucesso aviso oficial com link individual protegido",
  `Destinatário: ${validWorkshopDispatch.recipientPhone} | Link: ${validWorkshopDispatch.clientPortalUrl}`
);

// 5.3 Tentativa de Disparo Duplicado no Mesmo Dia (Proteção de Idempotência)
const duplicateDispatch = sendReadyForPickupNotification({
  workOrderId: convertResult.workOrderId,
  sentByUserId: staffSession.user.id,
  origin: "workshop"
});

assert(
  duplicateDispatch.success === false && duplicateDispatch.status === "duplicado_bloqueado",
  "5.3. Tentativa de reenvio duplicado é interceptada e bloqueada pelo hash diário",
  `Bloqueio confirmado: ${duplicateDispatch.message}`
);

// 5.4 Registro no Histórico Auditável
const auditRecord = db.prepare(`
  SELECT * FROM notification_history WHERE work_order_id = ? AND status = 'enviado'
`).get(convertResult.workOrderId);

assert(
  !!auditRecord && !!auditRecord.idempotency_hash && auditRecord.sent_by_user_id === staffSession.user.id,
  "5.4. Disparo registrado no histórico auditável com hash SHA-256 e ID do responsável",
  `Hash: ${auditRecord.idempotency_hash.slice(0, 16)}... | Enviado por: ${auditRecord.sent_by_user_id}`
);

// -----------------------------------------------------------------------------
// RESUMO FINAL
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`RESULTADO FINAL DA VALIDAÇÃO V1: ${totalPassed} de ${totalTests} testes aprovados (${Math.round((totalPassed/totalTests)*100)}%)`);
console.log("================================================================================");

if (totalPassed === totalTests) {
  console.log("✅ TODAS AS EXIGÊNCIAS DA ARQUITETURA V1 FORAM ATENDIDAS COM SUCESSO!\n");
  process.exit(0);
} else {
  console.error("❌ ALGUNS TESTES FALHARAM. VERIFIQUE OS LOGS ACIMA.\n");
  process.exit(1);
}
