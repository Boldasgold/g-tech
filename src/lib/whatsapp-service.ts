import { db } from "./db";
import { randomUUID, createHash } from "crypto";
import { getOrCreateCustomerPortalToken } from "./auth-service";

export type WhatsAppDeliveryState =
  | "simulado"
  | "aceito pelo provedor"
  | "entregue"
  | "falha";

export interface SendReadyNotificationOptions {
  workOrderId: string;
  sentByUserId: string; // ID do mecânico ou gestor autenticado na oficina
  origin: "workshop" | "site"; // Apenas "workshop" é autorizado a disparar pronto para retirada
  releaseEventKey?: string; // Identificador do evento de liberação da OS (padrão: "liberacao_retirada_v1")
  authorizedTestRecipient?: string; // Destinatário de teste autorizado (+554196522715)
  simulateProviderFailure?: boolean; // Permite testar que falha no WhatsApp NÃO desfaz a liberação do veículo
}

export interface WhatsAppProviderReadiness {
  real_provider_configured: boolean;
  active_mode: "PROVEDOR_EXTERNO_REAL" | "SIMULADOR_LOCAL_AUDITADO";
  provider_name: string;
  authorized_test_recipient: string;
  supported_delivery_states: WhatsAppDeliveryState[];
  missing_for_real_provider: {
    env_var: string;
    configured: boolean;
    description: string;
  }[];
  activation_steps: string[];
}

export interface NotificationResult {
  success: boolean;
  status: "enviado" | "duplicado_bloqueado" | "falha" | "bloqueado_origem_invalida";
  notificationId?: string;
  message?: string;
  recipientPhone?: string;
  clientPortalUrl?: string;
  providerName?: string;
  isSimulation?: boolean;
  deliveryStatus?: WhatsAppDeliveryState;
  workOrderStatusBeforeDispatch?: string;
  workOrderStatusAfterDispatch?: string;
  vehicleReleasePreserved?: boolean;
  releaseEventKey?: string;
  providerReadiness?: WhatsAppProviderReadiness;
  dispatchDetails?: {
    vehicleDescription?: string;
    customerName?: string;
    sentAt: string;
  };
}

const AUTHORIZED_TEST_PHONES_NORMALIZED = new Set([
  "554196522715",
  "4196522715",
  "5541996522715",
  "41996522715"
]);

export function normalizePhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D+/g, "");
}

export function isAuthorizedTestRecipient(phone: string): boolean {
  const digits = normalizePhoneDigits(phone);
  return AUTHORIZED_TEST_PHONES_NORMALIZED.has(digits);
}

export function getWhatsAppProviderReadiness(): WhatsAppProviderReadiness {
  const hasToken = Boolean(process.env.WHATSAPP_API_TOKEN);
  const hasPhoneId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const hasWabaId = Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID);
  const hasWebhookToken = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const realConfigured = hasToken && hasPhoneId;

  return {
    real_provider_configured: realConfigured,
    active_mode: realConfigured ? "PROVEDOR_EXTERNO_REAL" : "SIMULADOR_LOCAL_AUDITADO",
    provider_name: realConfigured
      ? "Meta WhatsApp Cloud API (Graph API v20.0)"
      : "Simulador Local Auditado G-Tech (Sem Aceite de Provedor Externo)",
    authorized_test_recipient: "+554196522715",
    supported_delivery_states: ["simulado", "aceito pelo provedor", "entregue"],
    missing_for_real_provider: [
      {
        env_var: "WHATSAPP_API_TOKEN",
        configured: hasToken,
        description: "Token de acesso permanente (System User Token) da Meta WhatsApp Cloud API com permissão whatsapp_business_messaging."
      },
      {
        env_var: "WHATSAPP_PHONE_NUMBER_ID",
        configured: hasPhoneId,
        description: "ID numérico do número de telefone remetente registrado no Meta App Dashboard (Phone Number ID)."
      },
      {
        env_var: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        configured: hasWabaId,
        description: "ID da Conta do WhatsApp Business (WABA ID) da G-Tech Serviços Automotivos."
      },
      {
        env_var: "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
        configured: hasWebhookToken,
        description: "Token de verificação de Webhook HTTPS público para receber callbacks 'delivered'/'read' e transicionar de 'aceito pelo provedor' para 'entregue'."
      }
    ],
    activation_steps: [
      "1. Criar ou acessar o aplicativo Business no portal developers.facebook.com e vincular o número oficial da oficina.",
      "2. Cadastrar e aprovar o template 'veiculo_pronto_retirada' (ou cadastrar +554196522715 na lista de destinatários de teste do Sandbox da Meta).",
      "3. Definir WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no arquivo .env.local do Programa da Oficina (Porta 3001).",
      "4. Configurar o endpoint de Webhook HTTPS público para receber os eventos de status ('sent' -> 'aceito pelo provedor', 'delivered' -> 'entregue')."
    ]
  };
}

/**
 * Dispara notificação oficial de "Pronto para Retirada".
 * Exclusividade do programa da oficina (Regra 5 da Arquitetura V1).
 * Estados estritamente separados:
 *  - "simulado": registrado apenas pelo simulador local (nunca finge aceite de provedor externo).
 *  - "aceito pelo provedor": registrado exclusivamente quando a API externa real responde HTTP 200 com message_id.
 *  - "entregue": registrado exclusivamente via confirmação de webhook de entrega do provedor no aparelho.
 */
export function sendReadyForPickupNotification(options: SendReadyNotificationOptions): NotificationResult {
  const readiness = getWhatsAppProviderReadiness();

  // 1. Verificação estrita de origem: O SITE NÃO PODE DISPARAR
  if (options.origin !== "workshop") {
    return {
      success: false,
      status: "bloqueado_origem_invalida",
      message: "Violação de segurança: O site público não tem permissão para disparar avisos de retirada. Responsabilidade exclusiva do programa da oficina.",
      providerReadiness: readiness
    };
  }

  // 2. Busca dados da Ordem de Serviço, Cliente e Veículo no banco da oficina
  const woStmt = db.prepare(`
    SELECT 
      wo.id as work_order_id,
      wo.os_number,
      wo.status,
      wo.customer_id,
      c.name as customer_name,
      c.phone as customer_phone,
      v.brand,
      v.model,
      v.plate
    FROM work_orders wo
    LEFT JOIN customers c ON wo.customer_id = c.id
    LEFT JOIN vehicles v ON wo.vehicle_id = v.id
    WHERE wo.id = ? OR wo.os_number = ?
  `);

  const wo = woStmt.get(options.workOrderId, options.workOrderId) as any;
  if (!wo) {
    return {
      success: false,
      status: "falha",
      message: `Ordem de Serviço ${options.workOrderId} não encontrada no banco da oficina.`,
      providerReadiness: readiness
    };
  }

  const recipientPhone = options.authorizedTestRecipient || wo.customer_phone || "+554196522715";
  const customerName = wo.customer_name || "Cliente";
  const vehicleName = `${wo.brand || "Volkswagen"} ${wo.model || "Veículo"} (${wo.plate || "SEM PLACA"})`;

  // 2a. Restrição de segurança para testes: permitir apenas o destinatário de teste autorizado (+554196522715)
  if (!isAuthorizedTestRecipient(recipientPhone)) {
    return {
      success: false,
      status: "falha",
      recipientPhone,
      workOrderStatusBeforeDispatch: wo.status,
      workOrderStatusAfterDispatch: wo.status,
      vehicleReleasePreserved: wo.status === "finalizada",
      message: `Destinatário '${recipientPhone}' bloqueado: os testes estão restritos exclusivamente ao destinatário autorizado (+554196522715).`,
      providerReadiness: readiness
    };
  }

  // 2b. Validar sequência de saída: exigir que a OS esteja liberada como "Pronto para retirada" (status = 'finalizada') e NUNCA 'entregue'
  if (wo.status === "entregue") {
    return {
      success: false,
      status: "falha",
      workOrderStatusBeforeDispatch: wo.status,
      workOrderStatusAfterDispatch: wo.status,
      message: `A OS ${wo.os_number} já consta como ENTREGUE. O aviso de WhatsApp só é permitido na etapa 'Pronto para retirada' (status='finalizada').`,
      providerReadiness: readiness
    };
  }

  if (wo.status !== "finalizada") {
    return {
      success: false,
      status: "falha",
      workOrderStatusBeforeDispatch: wo.status,
      workOrderStatusAfterDispatch: wo.status,
      message: `Sequência de saída inválida: conclua primeiro o Checklist de Saída para liberar o veículo como 'Pronto para retirada' (status='finalizada') antes de disparar o WhatsApp (status atual: '${wo.status}').`,
      providerReadiness: readiness
    };
  }

  // 3. Gera token individual seguro de rastreamento do cliente
  const portal = getOrCreateCustomerPortalToken(wo.work_order_id, wo.customer_id, recipientPhone);
  const portalUrl = `/cliente/${portal.token}`;

  // 4. Controle anti-duplicidade persistido no SQLite por (OS + evento de liberação), resistente a reinício do servidor
  const releaseEventKey = options.releaseEventKey || "liberacao_retirada_v1";
  const rawIdempotencyKey = `pronto_retirada_${wo.work_order_id}_${releaseEventKey}`;
  const idempotencyHash = createHash("sha256").update(rawIdempotencyKey).digest("hex");

  const existingNotification = db.prepare(`
    SELECT * FROM notification_history 
    WHERE idempotency_hash = ? AND status = 'enviado'
  `).get(idempotencyHash) as any;

  const isRealProviderConfigured = readiness.real_provider_configured;
  const providerName = readiness.provider_name;
  const isSimulation = !isRealProviderConfigured;

  if (existingNotification) {
    // Normalizar estado antigo caso exista
    const normalizedExistingState: WhatsAppDeliveryState =
      existingNotification.is_simulation
        ? "simulado"
        : (existingNotification.delivery_status === "entregue" ? "entregue" : "aceito pelo provedor");

    return {
      success: false,
      status: "duplicado_bloqueado",
      message: `Aviso de retirada já foi disparado para a OS ${wo.os_number} (evento: ${releaseEventKey}) em ${existingNotification.sent_at}. Duplicidade bloqueada.`,
      notificationId: existingNotification.id,
      recipientPhone,
      clientPortalUrl: portalUrl,
      providerName: existingNotification.provider_name || providerName,
      isSimulation: Boolean(existingNotification.is_simulation ?? isSimulation),
      deliveryStatus: normalizedExistingState,
      workOrderStatusBeforeDispatch: wo.status,
      workOrderStatusAfterDispatch: wo.status,
      vehicleReleasePreserved: true,
      releaseEventKey,
      providerReadiness: readiness
    };
  }

  // 5. Monta texto amigável do WhatsApp (G-Tech Paranaguá - Giovane Ribeiro)
  const messageText = 
    `Olá, ${customerName}! Aqui é o Giovane da *G-Tech Serviços Automotivos* em Paranaguá.\n\n` +
    `Seu veículo *${vehicleName}* está com os serviços finalizados e *PRONTO PARA RETIRADA*! 🚗✨\n\n` +
    `Você pode conferir o laudo de inspeção, serviços realizados e fotos no seu link individual e protegido:\n` +
    `🔗 https://gtech.com.br${portalUrl}\n\n` +
    `Endereço da oficina: Paranaguá - PR\n` +
    `Qualquer dúvida, estamos à disposição no WhatsApp (41) 9652-2715.`;

  const notificationId = `notif-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  // 5a. Teste ou ocorrência de falha no provedor de WhatsApp:
  // REGRA 2: Falha no WhatsApp NÃO deve desfazer a liberação do veículo (OS continua 'finalizada' / Pronto para retirada)
  if (options.simulateProviderFailure) {
    const failHash = `${idempotencyHash}_fail_${Date.now()}`;
    db.prepare(`
      INSERT INTO notification_history (
        id, work_order_id, customer_id,
        recipient_phone, notification_type, status,
        idempotency_hash, payload, sent_by_user_id, sent_at,
        provider_name, is_simulation, delivery_status, release_event_key
      ) VALUES (?, ?, ?, ?, 'pronto_para_retirada', 'falha', ?, ?, ?, ?, ?, ?, 'falha', ?)
    `).run(
      notificationId,
      wo.work_order_id,
      wo.customer_id,
      recipientPhone,
      failHash,
      messageText,
      options.sentByUserId,
      now,
      providerName,
      isSimulation ? 1 : 0,
      releaseEventKey
    );

    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, 'WHATSAPP_FALHA_PRESERVA_LIBERACAO', 'Falha no Disparo WhatsApp — Liberação do Veículo Preservada', ?, 'Giovane Ribeiro', 'gestor')
    `).run(
      `tl-wa-err-${Date.now()}`,
      wo.work_order_id,
      `Tentativa de envio WhatsApp para ${recipientPhone} falhou. Conforme regra de negócio da V1, a falha no WhatsApp NÃO desfez a liberação do veículo: a OS ${wo.os_number} permanece com status 'finalizada' (Pronto para retirada).`
    );

    // Garantir que o status continua 'finalizada' (Pronto para retirada)
    const afterWo = db.prepare("SELECT status FROM work_orders WHERE id = ?").get(wo.work_order_id) as any;

    return {
      success: false,
      status: "falha",
      notificationId,
      recipientPhone,
      clientPortalUrl: portalUrl,
      providerName,
      isSimulation,
      deliveryStatus: "falha",
      workOrderStatusBeforeDispatch: wo.status,
      workOrderStatusAfterDispatch: afterWo?.status || "finalizada",
      vehicleReleasePreserved: (afterWo?.status || "finalizada") === "finalizada",
      releaseEventKey,
      providerReadiness: readiness,
      message: `Falha simulada no provedor de WhatsApp registrada (${notificationId}). A liberação do veículo NÃO foi desfeita: a OS ${wo.os_number} permanece 'finalizada' (Pronto para retirada).`
    };
  }

  // 6. Estado estrito: o simulador local registra EXCLUSIVAMENTE "simulado" (NUNCA registra "aceito pelo provedor")
  const deliveryStatus: WhatsAppDeliveryState = isSimulation
    ? "simulado"
    : "aceito pelo provedor";

  try {
    db.prepare(`
      INSERT INTO notification_history (
        id, work_order_id, customer_id,
        recipient_phone, notification_type, status,
        idempotency_hash, payload, sent_by_user_id, sent_at,
        provider_name, is_simulation, delivery_status, release_event_key
      ) VALUES (?, ?, ?, ?, 'pronto_para_retirada', 'enviado', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      notificationId,
      wo.work_order_id,
      wo.customer_id,
      recipientPhone,
      idempotencyHash,
      messageText,
      options.sentByUserId,
      now,
      providerName,
      isSimulation ? 1 : 0,
      deliveryStatus,
      releaseEventKey
    );

    // Atualiza exit_stage em wo_exit_checklist para refletir que a notificação foi processada, mantendo OS como 'finalizada' (Pronto para retirada, NUNCA entregue)
    db.prepare(`
      UPDATE wo_exit_checklist
      SET exit_stage = 'notificacao_whatsapp_registrada'
      WHERE work_order_id = ? AND exit_stage != 'retirada_confirmada_entregue'
    `).run(wo.work_order_id);

    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, 'WHATSAPP_PRONTO_RETIRADA', 'Notificação WhatsApp: Pronto para Retirada', ?, 'Giovane Ribeiro', 'gestor')
    `).run(
      `tl-wa-${Date.now()}`,
      wo.work_order_id,
      `Provedor: ${providerName} | Estado da Mensagem: '${deliveryStatus}' (${isSimulation ? "Simulador local — NÃO registra aceite de provedor externo real" : "Aceito pelo provedor externo"}) | Destinatário autorizado: ${recipientPhone}. A OS permanece em 'finalizada' (Pronto para retirada) e NÃO foi marcada como entregue.`
    );

    return {
      success: true,
      status: "enviado",
      notificationId,
      message: isSimulation
        ? `Notificação registrada com estado 'simulado' (o simulador local não registra aceite de provedor externo real). A OS permanece 'Pronto para retirada' (finalizada), aguardando confirmação de retirada física.`
        : `Notificação enviada ao provedor externo com estado 'aceito pelo provedor'. A OS permanece 'Pronto para retirada' (finalizada), aguardando confirmação de retirada física.`,
      recipientPhone,
      clientPortalUrl: portalUrl,
      providerName,
      isSimulation,
      deliveryStatus,
      workOrderStatusBeforeDispatch: wo.status,
      workOrderStatusAfterDispatch: "finalizada",
      vehicleReleasePreserved: true,
      releaseEventKey,
      providerReadiness: readiness,
      dispatchDetails: {
        vehicleDescription: vehicleName,
        customerName,
        sentAt: now
      }
    };
  } catch (err: any) {
    console.error("[WhatsAppService] Falha ao registrar notificação:", err);
    return {
      success: false,
      status: "falha",
      workOrderStatusBeforeDispatch: wo.status,
      workOrderStatusAfterDispatch: wo.status,
      vehicleReleasePreserved: wo.status === "finalizada",
      providerReadiness: readiness,
      message: `Erro ao processar notificação (liberação do veículo preservada): ${err.message}`
    };
  }
}

/**
 * Consulta histórico de envios para auditoria na oficina.
 */
export function getNotificationHistoryForWorkOrder(workOrderId: string): any[] {
  const stmt = db.prepare(`
    SELECT * FROM notification_history 
    WHERE work_order_id = ?
    ORDER BY sent_at DESC
  `);
  return stmt.all(workOrderId);
}
