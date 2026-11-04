import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ protocol: string }> }
) {
  try {
    const { protocol } = await context.params;
    if (!protocol) {
      return NextResponse.json({ success: false, error: "Protocolo não informado." }, { status: 400 });
    }

    const cleanProto = protocol.trim().toUpperCase();
    const db = getDb();

    // Check in appointments first
    const appointment = db.prepare(`
      SELECT * FROM appointments WHERE UPPER(protocol) = ?
    `).get(cleanProto) as any;

    if (appointment) {
      let osInfo: any = null;
      if (appointment.work_order_id) {
        osInfo = db.prepare(`
          SELECT id, os_number, status, updated_at FROM work_orders WHERE id = ?
        `).get(appointment.work_order_id);
      }

      const statusMap: Record<string, string> = {
        pendente: "Solicitação Recebida no Sistema",
        confirmado: "Horário Confirmado na Oficina",
        convertido_os: osInfo ? getFriendlyOsStatus(osInfo.status) : "Em Atendimento na Oficina",
        cancelado: "Cancelado"
      };

      const timeline = [
        {
          timestamp: appointment.created_at,
          title: "Agendamento Solicitado",
          description: `Horário reservado para ${appointment.scheduled_date} às ${appointment.scheduled_time}.`
        }
      ];

      if (appointment.status === "confirmado" || appointment.status === "convertido_os") {
        timeline.push({
          timestamp: appointment.created_at,
          title: "Horário Confirmado",
          description: "A equipe técnica da G-Tech confirmou a recepção do veículo."
        });
      }

      if (osInfo) {
        timeline.push({
          timestamp: osInfo.updated_at,
          title: `Ordem de Serviço ${osInfo.os_number}`,
          description: `Veículo em processo: ${getFriendlyOsStatus(osInfo.status)}.`
        });
      }

      return NextResponse.json({
        success: true,
        type: "appointment",
        protocol: appointment.protocol,
        vehicle: `${appointment.vehicle_brand} ${appointment.vehicle_model}`,
        scheduled_date: appointment.scheduled_date,
        scheduled_time: appointment.scheduled_time,
        status_code: appointment.status,
        status_label: statusMap[appointment.status] || "Em Análise",
        is_in_workshop: !!appointment.work_order_id,
        timeline
      });
    }

    // Check if the user entered an OS Number (e.g. GT-OS-000127)
    const workOrder = db.prepare(`
      SELECT wo.id, wo.os_number, wo.status, wo.created_at, wo.updated_at,
             v.brand, v.model, v.plate
      FROM work_orders wo
      JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE UPPER(wo.os_number) = ?
    `).get(cleanProto) as any;

    if (workOrder) {
      // Fetch public milestone events from timeline
      const events = db.prepare(`
        SELECT title, description, created_at 
        FROM wo_timeline_events 
        WHERE work_order_id = ? 
        ORDER BY created_at ASC
      `).all(workOrder.id) as any[];

      const maskedPlate = workOrder.plate ? `***-${workOrder.plate.slice(-4)}` : "";

      return NextResponse.json({
        success: true,
        type: "work_order",
        protocol: workOrder.os_number,
        vehicle: `${workOrder.brand} ${workOrder.model} ${maskedPlate}`.trim(),
        status_code: workOrder.status,
        status_label: getFriendlyOsStatus(workOrder.status),
        is_in_workshop: true,
        timeline: events.map(e => ({
          timestamp: e.created_at,
          title: e.title,
          description: e.description
        }))
      });
    }

    return NextResponse.json(
      { success: false, error: "Protocolo não encontrado. Verifique se o código foi digitado corretamente (Ex: GT-2026-0001 ou GT-OS-000127)." },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function getFriendlyOsStatus(status: string): string {
  const map: Record<string, string> = {
    aberta: "Recepção / Entrada de Veículo",
    vistoria: "Vistoria Fotográfica e Inspeção 3D",
    inspecao: "Diagnóstico Técnico Avançado (Scanner & Osciloscópio)",
    orcamento: "Elaboração de Orçamento Técnico",
    aguardando_cliente: "Aguardando Decisão do Cliente no Portal",
    aprovada: "Orçamento Aprovado pelo Cliente",
    em_servico: "Serviço em Execução na Oficina",
    controle_qualidade: "Controle de Qualidade e Teste de Rodagem",
    finalizada: "Veículo Pronto para Retirada",
    entregue: "Entregue ao Cliente com Garantia"
  };
  return map[status] || status;
}

