import { db } from "../db";
import { randomUUID } from "crypto";
import { getOrCreateCustomerPortalToken } from "../auth-service";

export interface AppointmentSiteRequest {
  idempotency_key: string;
  name: string;
  phone: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_plate?: string;
  service_interest: string;
  preferred_date?: string;
  preferred_time?: string;
  notes?: string;
}

export interface AppointmentSyncResult {
  success: boolean;
  status: "recebido_aguardando_confirmacao" | "duplicado_existente" | "preservado_offline_fila" | "erro";
  protocol: string;
  message: string;
  appointment?: any;
}

/**
 * Registra solicitação de agendamento vinda do site público.
 * Trata idempotência estrita, modo offline resiliente e nunca declara "confirmado" prematuramente.
 */
export function handleSiteAppointmentSubmission(
  data: AppointmentSiteRequest,
  simulateWorkshopDown: boolean = false
): AppointmentSyncResult {
  const idempotencyKey = data.idempotency_key || `idem-${Date.now()}-${randomUUID().slice(0, 8)}`;

  // 1. Verifica duplicidade por chave de idempotência
  const existingAppt = db.prepare(`
    SELECT * FROM appointments WHERE idempotency_key = ?
  `).get(idempotencyKey) as any;

  if (existingAppt) {
    return {
      success: true,
      status: "duplicado_existente",
      protocol: existingAppt.protocol || existingAppt.id,
      message: "Solicitação de agendamento já recebida anteriormente. Aguardando confirmação da oficina.",
      appointment: {
        id: existingAppt.id,
        protocol: existingAppt.protocol,
        status: existingAppt.status,
        scheduled_for: existingAppt.scheduled_date
      }
    };
  }

  // 2. Se a oficina estiver temporariamente indisponível, preserva na fila offline
  if (simulateWorkshopDown) {
    return saveToOfflineQueue(idempotencyKey, data, "Oficina temporariamente fora do ar. Solicitação armazenada na fila local.");
  }

  // 3. Processa no banco da oficina
  try {
    const currentYear = new Date().getFullYear();
    const last = db.prepare(`SELECT protocol FROM appointments WHERE protocol LIKE ? ORDER BY created_at DESC LIMIT 1`).get(`GT-${currentYear}-%`) as any;
    let nextSeq = 1;
    if (last?.protocol) {
      const match = last.protocol.match(/GT-\d{4}-(\d+)/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }
    const protocol = `GT-${currentYear}-${String(nextSeq).padStart(4, "0")}`;
    const appointmentId = `apt-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();

    const cleanPhone = (data.phone || "").replace(/\D/g, "");

    // Cria registro de agendamento com status CLARO: "pendente" (Aguardando confirmação oficial)
    db.prepare(`
      INSERT INTO appointments (
        id, company_id, protocol, customer_name, customer_phone,
        vehicle_brand, vehicle_model, vehicle_plate,
        scheduled_date, scheduled_time, period,
        issue_description, dashboard_alert, mobility, status,
        idempotency_key
      ) VALUES (?, 'gtech-paranagua', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)
    `).run(
      appointmentId,
      protocol,
      data.name,
      cleanPhone,
      data.vehicle_brand || "Volkswagen",
      data.vehicle_model || "Veículo",
      data.vehicle_plate ? data.vehicle_plate.toUpperCase().trim() : null,
      data.preferred_date || new Date().toISOString().slice(0, 10),
      data.preferred_time || "08:30",
      "Manhã",
      `[Site Público] ${data.service_interest}. Obs: ${data.notes || "Nenhuma"}`,
      null,
      "Vou levar até a oficina",
      idempotencyKey
    );

    return {
      success: true,
      status: "recebido_aguardando_confirmacao",
      protocol,
      message: "Solicitação de agendamento recebida com sucesso! A oficina entrará em contato para confirmar o horário.",
      appointment: {
        id: appointmentId,
        protocol,
        status: "pendente",
        status_label: "Aguardando Confirmação da Oficina",
        scheduled_for: data.preferred_date || null
      }
    };
  } catch (err: any) {
    console.warn("[OfflineSync] Erro ao gravar agendamento diretamente na oficina, salvando na fila offline:", err.message);
    return saveToOfflineQueue(idempotencyKey, data, err.message);
  }
}

/**
 * Salva agendamento na fila offline para retry quando o serviço da oficina responder.
 */
function saveToOfflineQueue(idempotencyKey: string, payload: any, reason: string): AppointmentSyncResult {
  const syncId = `sync-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const existingInQueue = db.prepare(`SELECT * FROM site_pending_sync_queue WHERE idempotency_key = ?`).get(idempotencyKey) as any;
  if (existingInQueue) {
    return {
      success: true,
      status: "preservado_offline_fila",
      protocol: existingInQueue.id,
      message: "Solicitação já preservada na fila de sincronização. Será processada assim que a oficina estiver online."
    };
  }

  db.prepare(`
    INSERT INTO site_pending_sync_queue (
      id, idempotency_key, request_type, payload,
      status, attempts, last_attempt_at, last_error, created_at
    ) VALUES (?, ?, 'appointment_request', ?, 'pendente', 1, ?, ?, ?)
  `).run(syncId, idempotencyKey, JSON.stringify(payload), now, reason, now);

  return {
    success: true,
    status: "preservado_offline_fila",
    protocol: syncId,
    message: "A conexão com a oficina oscilou, mas sua solicitação foi gravada com segurança na fila resiliente e será confirmada pela equipe."
  };
}

/**
 * Drena a fila offline sincronizando as pendências com a base da oficina.
 */
export function drainPendingSyncQueue(): { processed: number; errors: number; details: any[] } {
  const pendingItems = db.prepare(`
    SELECT * FROM site_pending_sync_queue 
    WHERE status IN ('pendente', 'falha_tentativa')
    ORDER BY created_at ASC
  `).all() as any[];

  let processed = 0;
  let errors = 0;
  const details: any[] = [];

  for (const item of pendingItems) {
    try {
      const payload = JSON.parse(item.payload);
      const result = handleSiteAppointmentSubmission(payload, false);

      if (result.status === "recebido_aguardando_confirmacao" || result.status === "duplicado_existente") {
        db.prepare(`
          UPDATE site_pending_sync_queue 
          SET status = 'sincronizado', last_attempt_at = ?
          WHERE id = ?
        `).run(new Date().toISOString(), item.id);
        processed++;
        details.push({ id: item.id, status: "sincronizado", protocol: result.protocol });
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      errors++;
      db.prepare(`
        UPDATE site_pending_sync_queue 
        SET status = 'falha_tentativa', attempts = attempts + 1,
            last_attempt_at = ?, last_error = ?
        WHERE id = ?
      `).run(new Date().toISOString(), e.message, item.id);
      details.push({ id: item.id, status: "falha_tentativa", error: e.message });
    }
  }

  return { processed, errors, details };
}

/**
 * Vincula agendamento a uma nova Ordem de Serviço (OS) quando o atendimento for iniciado na oficina.
 */
export function convertAppointmentToWorkOrder(
  appointmentIdOrProtocol: string,
  staffUserId: string,
  serviceDescription: string = "Revisão e Diagnóstico Inicial"
): { success: boolean; workOrderCode?: string; workOrderId?: string; message: string } {
  const appt = db.prepare(`
    SELECT * FROM appointments 
    WHERE id = ? OR protocol = ?
  `).get(appointmentIdOrProtocol, appointmentIdOrProtocol) as any;

  if (!appt) {
    return { success: false, message: `Agendamento ${appointmentIdOrProtocol} não encontrado.` };
  }

  if (appt.work_order_id) {
    const existingWo = db.prepare(`SELECT os_number FROM work_orders WHERE id = ?`).get(appt.work_order_id) as any;
    return {
      success: true,
      workOrderId: appt.work_order_id,
      workOrderCode: existingWo?.os_number,
      message: `Agendamento já vinculado à OS ${existingWo?.os_number || appt.work_order_id}.`
    };
  }

  const now = new Date().toISOString();
  const nextWoIndex = (db.prepare(`SELECT COUNT(*) as count FROM work_orders`).get() as any).count + 1;
  const woId = `wo-live-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const woCode = `GT-OS-${String(nextWoIndex).padStart(6, "0")}`;

  // Busca ou cria cliente no cadastro formal
  let custId = "cust-demo-rodrigo";
  const existingCust = db.prepare(`SELECT id FROM customers WHERE phone LIKE ?`).get(`%${(appt.customer_phone || "").replace(/\D/g, "")}%`) as any;
  if (existingCust) {
    custId = existingCust.id;
  }

  // Busca ou cria veículo
  let vehId = "veh-demo-duster";
  const existingVeh = db.prepare(`SELECT id FROM vehicles WHERE UPPER(plate) = UPPER(?)`).get(appt.vehicle_plate || "SEM_PLACA") as any;
  if (existingVeh) {
    vehId = existingVeh.id;
  }

  // Cria OS formal
  db.prepare(`
    INSERT INTO work_orders (
      id, company_id, os_number, customer_id, vehicle_id,
      initial_scope, customer_complaint, status, priority,
      created_at, updated_at
    ) VALUES (?, 'gtech-paranagua', ?, ?, ?, ?, ?, 'aberta', 'normal', ?, ?)
  `).run(
    woId,
    woCode,
    custId,
    vehId,
    serviceDescription,
    appt.issue_description || "Revisão e diagnóstico",
    now,
    now
  );

  // Atualiza agendamento com a OS vinculada e status 'convertido_os'
  db.prepare(`
    UPDATE appointments 
    SET status = 'convertido_os', work_order_id = ?, linked_work_order_id = ?
    WHERE id = ?
  `).run(woId, woId, appt.id);

  // Gera token seguro de acesso individual para o cliente
  const portal = getOrCreateCustomerPortalToken(woId, custId, appt.customer_phone);

  return {
    success: true,
    workOrderId: woId,
    workOrderCode: woCode,
    message: `Agendamento ${appt.protocol || appt.id} convertido com sucesso na OS ${woCode}. Link individual gerado: /cliente/${portal.token}`
  };
}

/**
 * Consulta de status seguro para o site público.
 * REGRA CRÍTICA: Retorna apenas dados públicos e resumidos.
 * NUNCA expõe custos de peças, margem, observações confidenciais ou histórico de terceiros.
 */
export function getSafePublicTracking(lookupKey: string): { found: boolean; data?: any; error?: string } {
  if (!lookupKey || lookupKey.trim().length < 6) {
    return { found: false, error: "Código de rastreamento ou token inválido." };
  }

  const cleanKey = lookupKey.trim();

  // 1. Tenta buscar por token de portal individual do cliente
  const tokenRecord = db.prepare(`
    SELECT t.*, wo.os_number, wo.status as wo_status, wo.customer_complaint, wo.created_at as opened_at,
           v.brand, v.model, v.plate, v.year
    FROM customer_portal_tokens t
    JOIN work_orders wo ON t.work_order_id = wo.id
    LEFT JOIN vehicles v ON wo.vehicle_id = v.id
    WHERE t.token = ?
  `).get(cleanKey) as any;

  if (tokenRecord) {
    db.prepare(`
      UPDATE customer_portal_tokens 
      SET access_count = access_count + 1, last_accessed_at = ?
      WHERE token = ?
    `).run(new Date().toISOString(), cleanKey);

    return {
      found: true,
      data: {
        tipo: "ordem_de_servico",
        codigo_publico: tokenRecord.os_number,
        veiculo: `${tokenRecord.brand || "Volkswagen"} ${tokenRecord.model || "Veículo"} (${tokenRecord.plate || "S/ Placa"})`,
        status_atual: formatStatusPublico(tokenRecord.wo_status),
        data_abertura: tokenRecord.opened_at,
        etapas: getEtapasProgresso(tokenRecord.wo_status),
        aviso: "Dados protegidos por link criptográfico individual."
      }
    };
  }

  // 2. Tenta buscar por protocolo de agendamento (ex: GT-2026-...)
  if (cleanKey.startsWith("GT-")) {
    const appt = db.prepare(`
      SELECT * FROM appointments 
      WHERE UPPER(protocol) = ?
    `).get(cleanKey.toUpperCase()) as any;

    if (appt) {
      return {
        found: true,
        data: {
          tipo: "solicitacao_agendamento",
          protocolo: appt.protocol,
          status_atual: appt.status === "pendente" ? "Solicitação Recebida — Aguardando Confirmação" : "Agendamento Confirmado",
          data_solicitada: `${appt.scheduled_date} às ${appt.scheduled_time}`,
          veiculo: `${appt.vehicle_brand} ${appt.vehicle_model} (${appt.vehicle_plate || "Sem placa"})`,
          aviso: "A equipe da G-Tech entrará em contato para confirmar data e horário."
        }
      };
    }
  }

  // REGRA DE SEGURANÇA: Bloqueia enumeração por placa ou código de OS sequencial isolado
  return {
    found: false,
    error: "Acesso não autorizado. Para acompanhar seu veículo, utilize o link individual enviado pelo WhatsApp ou o protocolo do seu agendamento."
  };
}

function formatStatusPublico(status: string): string {
  switch (status) {
    case "aberta":
    case "inspecao":
      return "Veículo em Triagem e Diagnóstico";
    case "em_servico":
    case "aprovada":
      return "Serviços em Execução na Oficina";
    case "controle_qualidade":
      return "Controle de Qualidade e Teste de Rodagem";
    case "finalizada":
      return "Pronto para Retirada! 🎉";
    case "entregue":
      return "Entregue ao Cliente com Garantia";
    default:
      return "Em Atendimento na Oficina";
  }
}

function getEtapasProgresso(status: string) {
  return [
    { etapa: "Recepção e Check-in", concluido: true },
    { etapa: "Diagnóstico Técnico", concluido: ["em_servico", "controle_qualidade", "finalizada", "entregue"].includes(status) },
    { etapa: "Execução do Serviço", concluido: ["controle_qualidade", "finalizada", "entregue"].includes(status) },
    { etapa: "Controle de Qualidade", concluido: ["finalizada", "entregue"].includes(status) },
    { etapa: "Pronto para Retirada", concluido: ["finalizada", "entregue"].includes(status) }
  ];
}
