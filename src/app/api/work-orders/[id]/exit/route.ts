import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const wo = db.prepare("SELECT id, os_number, status FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const exitData = db.prepare("SELECT * FROM wo_exit_checklist WHERE work_order_id = ?").get(wo.id);
    const whatsappLogs = db.prepare("SELECT * FROM notification_history WHERE work_order_id = ? ORDER BY sent_at DESC").all(wo.id);

    return NextResponse.json({
      success: true,
      work_order_status: wo.status,
      exit_checklist: exitData || null,
      whatsapp_notifications: whatsappLogs
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const db = getDb();

    const wo = db.prepare("SELECT id, os_number, status, vehicle_id, customer_id FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const {
      step = "concluir_checklist_saida", // "concluir_checklist_saida" | "confirmar_retirada_entregue"
      road_test_ok = true,
      warning_lights_cleared = true,
      parts_returned = false,
      vehicle_cleaned = true,
      wheel_torque_checked = true,
      recommendations = null,
      delivered_to_name = null,
      delivered_by = "Giovane Ribeiro",
      pickup_confirmed_by_staff_id = "usr-giovane-01",
      pickup_confirmed_by_staff_name = null
    } = body;

    const existing = db.prepare("SELECT * FROM wo_exit_checklist WHERE work_order_id = ?").get(wo.id) as any;
    const now = new Date().toISOString();

    // =========================================================================
    // ETAPA FINAL: CONFIRMAÇÃO DE RETIRADA FÍSICA -> ENTREGUE
    // Exige que o checklist de saída já tenha sido concluído e o veículo esteja "finalizada" (Pronto para retirada)
    // =========================================================================
    if (step === "confirmar_retirada_entregue") {
      if (!existing || !existing.checklist_completed_at) {
        return NextResponse.json({
          success: false,
          error: "Sequência inválida: Não é permitido confirmar a retirada antes de concluir o checklist de saída e liberar o veículo para retirada."
        }, { status: 422 });
      }

      if (wo.status !== "finalizada" && wo.status !== "entregue") {
        return NextResponse.json({
          success: false,
          error: `Sequência inválida: O veículo precisa estar com status 'finalizada' (Pronto para retirada) antes da confirmação de entrega física (status atual: ${wo.status}).`
        }, { status: 422 });
      }

      const staffName = (pickup_confirmed_by_staff_name || delivered_by || "").trim();
      const staffId = (pickup_confirmed_by_staff_id || "usr-giovane-01").trim();
      const recipientName = (delivered_to_name || existing.delivered_to_name || "").trim();

      if (!staffName) {
        return NextResponse.json({
          success: false,
          error: "O nome do funcionário responsável pela confirmação de retirada é obrigatório."
        }, { status: 400 });
      }

      if (!recipientName) {
        return NextResponse.json({
          success: false,
          error: "O nome do cliente/portador que retirou o veículo (delivered_to_name) é obrigatório para confirmar a entrega."
        }, { status: 400 });
      }

      db.prepare(`
        UPDATE wo_exit_checklist SET
          exit_stage = 'retirada_confirmada_entregue',
          delivered_to_name = ?,
          delivered_by = ?,
          delivered_at = ?,
          pickup_confirmed_at = ?,
          pickup_confirmed_by_staff_id = ?,
          pickup_confirmed_by_staff_name = ?
        WHERE work_order_id = ?
      `).run(
        recipientName,
        staffName,
        now,
        now,
        staffId,
        staffName,
        wo.id
      );

      db.prepare(`
        UPDATE work_orders
        SET status = 'entregue', updated_at = ?
        WHERE id = ?
      `).run(now, wo.id);

      db.prepare(`
        INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
        VALUES (?, ?, 'CONFIRMACAO_RETIRADA_ENTREGUE', 'Confirmação de Retirada Física — Veículo Entregue', ?, ?, 'gestor')
      `).run(
        `tl-ret-${Date.now()}`,
        wo.id,
        `Retirada física confirmada em ${now} pelo funcionário responsável ${staffName} (ID: ${staffId}). Veículo entregue a: ${recipientName}. Status da OS alterado de 'finalizada' (Pronto para retirada) para 'entregue'.`,
        staffName
      );

      db.prepare(`
        INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
        VALUES (?, 'gtech-paranagua', 'wo_exit_checklist', ?, 'CONFIRM_VEHICLE_PICKUP', ?, 'gestor', ?, ?)
      `).run(
        `aud-ret-${Date.now()}`,
        wo.id,
        staffName,
        JSON.stringify({
          step: "confirmar_retirada_entregue",
          work_order_id: wo.id,
          os_number: wo.os_number,
          pickup_confirmed_at: now,
          pickup_confirmed_by_staff_id: staffId,
          pickup_confirmed_by_staff_name: staffName,
          delivered_to_name: recipientName,
          final_status: "entregue"
        }),
        generateHash({
          woId: wo.id,
          pickup_confirmed_at: now,
          pickup_confirmed_by_staff_id: staffId,
          pickup_confirmed_by_staff_name: staffName,
          delivered_to_name: recipientName
        })
      );

      const updatedExit = db.prepare("SELECT * FROM wo_exit_checklist WHERE work_order_id = ?").get(wo.id);

      return NextResponse.json({
        success: true,
        step_executed: "confirmar_retirada_entregue",
        exit_stage: "retirada_confirmada_entregue",
        work_order_status: "entregue",
        pickup_confirmed_at: now,
        pickup_confirmed_by_staff_id: staffId,
        pickup_confirmed_by_staff_name: staffName,
        delivered_to_name: recipientName,
        exit_checklist: updatedExit,
        message: `Retirada confirmada por ${staffName} em ${now}. Veículo marcado como ENTREGUE!`
      });
    }

    // =========================================================================
    // ETAPA 1 & 2: CHECKLIST DE SAÍDA CONCLUÍDO -> PRONTO PARA RETIRADA
    // Concluir o checklist NUNCA marca a OS como "entregue"!
    // =========================================================================
    const staffConcluding = (delivered_by || "Giovane Ribeiro").trim();

    if (existing) {
      db.prepare(`
        UPDATE wo_exit_checklist SET
          road_test_ok = ?,
          warning_lights_cleared = ?,
          parts_returned = ?,
          vehicle_cleaned = ?,
          wheel_torque_checked = ?,
          recommendations = ?,
          exit_stage = 'pronto_para_retirada',
          checklist_completed_at = COALESCE(checklist_completed_at, ?),
          checklist_completed_by = COALESCE(checklist_completed_by, ?),
          ready_for_pickup_at = COALESCE(ready_for_pickup_at, ?),
          ready_for_pickup_by = COALESCE(ready_for_pickup_by, ?)
        WHERE work_order_id = ?
      `).run(
        road_test_ok ? 1 : 0,
        warning_lights_cleared ? 1 : 0,
        parts_returned ? 1 : 0,
        vehicle_cleaned ? 1 : 0,
        wheel_torque_checked ? 1 : 0,
        recommendations || null,
        now,
        staffConcluding,
        now,
        staffConcluding,
        wo.id
      );
    } else {
      db.prepare(`
        INSERT INTO wo_exit_checklist (
          id, work_order_id, road_test_ok, warning_lights_cleared, parts_returned,
          vehicle_cleaned, wheel_torque_checked, recommendations,
          exit_stage, checklist_completed_at, checklist_completed_by,
          ready_for_pickup_at, ready_for_pickup_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pronto_para_retirada', ?, ?, ?, ?)
      `).run(
        `exit-${Date.now()}`,
        wo.id,
        road_test_ok ? 1 : 0,
        warning_lights_cleared ? 1 : 0,
        parts_returned ? 1 : 0,
        vehicle_cleaned ? 1 : 0,
        wheel_torque_checked ? 1 : 0,
        recommendations || null,
        now,
        staffConcluding,
        now,
        staffConcluding
      );
    }

    // Registrar estágio de saída na tabela wo_inspection_visits sem sobrescrever visitas anteriores
    const visitRow = db.prepare(`
      SELECT COALESCE(MAX(visit_number), 1) as visit_num
      FROM wo_inspection_visits
      WHERE work_order_id = ?
    `).get(wo.id) as any;

    const existingExitVisit = db.prepare(`
      SELECT id FROM wo_inspection_visits
      WHERE work_order_id = ? AND inspection_stage = 'saida'
    `).get(wo.id) as any;

    const exitChecklistPayload = JSON.stringify({
      road_test_ok,
      warning_lights_cleared,
      parts_returned,
      vehicle_cleaned,
      wheel_torque_checked,
      recommendations,
      exit_stage: "pronto_para_retirada",
      checklist_completed_at: now,
      checklist_completed_by: staffConcluding,
      ready_for_pickup_at: now,
      ready_for_pickup_by: staffConcluding
    });

    if (existingExitVisit) {
      db.prepare(`
        UPDATE wo_inspection_visits SET
          checklist_json = ?,
          notes = ?,
          inspector_name = ?
        WHERE id = ?
      `).run(exitChecklistPayload, recommendations || "", staffConcluding, existingExitVisit.id);
    } else {
      db.prepare(`
        INSERT INTO wo_inspection_visits (
          id, work_order_id, vehicle_id, visit_number,
          inspection_stage, photos_json, checklist_json, notes, inspector_name
        ) VALUES (?, ?, ?, ?, 'saida', '[]', ?, ?, ?)
      `).run(
        `vis-out-${Date.now()}`,
        wo.id,
        wo.vehicle_id,
        visitRow?.visit_num || 1,
        exitChecklistPayload,
        recommendations || "",
        staffConcluding
      );
    }

    // Atualiza status da OS estritamente para "finalizada" (Pronto para retirada) — NUNCA para "entregue"
    db.prepare(`
      UPDATE work_orders
      SET status = 'finalizada', updated_at = ?
      WHERE id = ?
    `).run(now, wo.id);

    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, 'CHECKLIST_SAIDA_PRONTO_RETIRADA', 'Checklist de Saída Concluído → Pronto para Retirada', ?, ?, 'gestor')
    `).run(
      `tl-chk-${Date.now()}`,
      wo.id,
      `Checklist de saída concluído por ${staffConcluding} em ${now} (Rodagem: ${road_test_ok ? "OK" : "Não"}, Painel sem alertas: ${warning_lights_cleared ? "OK" : "Não"}, Torque rodas: ${wheel_torque_checked ? "OK" : "Não"}). Veículo liberado como 'Pronto para retirada' (status='finalizada'). A conclusão do checklist NÃO marca o veículo como entregue.`,
      staffConcluding
    );

    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, 'gtech-paranagua', 'wo_exit_checklist', ?, 'COMPLETE_EXIT_CHECKLIST_READY', ?, 'gestor', ?, ?)
    `).run(
      `aud-chk-${Date.now()}`,
      wo.id,
      staffConcluding,
      JSON.stringify({
        step: "concluir_checklist_saida",
        exit_stage: "pronto_para_retirada",
        work_order_status: "finalizada",
        checklist_completed_at: now,
        ready_for_pickup_at: now,
        staff: staffConcluding
      }),
      generateHash({ woId: wo.id, step: "concluir_checklist_saida", timestamp: now })
    );

    const updatedExit = db.prepare("SELECT * FROM wo_exit_checklist WHERE work_order_id = ?").get(wo.id);

    return NextResponse.json({
      success: true,
      step_executed: "concluir_checklist_saida",
      exit_stage: "pronto_para_retirada",
      work_order_status: "finalizada",
      checklist_completed_at: now,
      checklist_completed_by: staffConcluding,
      ready_for_pickup_at: now,
      ready_for_pickup_by: staffConcluding,
      exit_checklist: updatedExit,
      message: "Checklist de saída concluído! Veículo liberado como PRONTO PARA RETIRADA (não entregue). Próximo passo: Notificação WhatsApp e posterior Confirmação de Retirada."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
