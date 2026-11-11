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

    // 2. Verificação de Token de Portal Individual (Arquitetura V1: link seguro)
    const tokenRecord = db.prepare(`
      SELECT t.*, wo.id as work_order_id, wo.os_number, wo.status as wo_status, wo.created_at, wo.updated_at,
             v.brand, v.model, v.plate
      FROM customer_portal_tokens t
      JOIN work_orders wo ON t.work_order_id = wo.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE t.token = ?
    `).get(protocol) as any;

    if (tokenRecord) {
      db.prepare(`
        UPDATE customer_portal_tokens 
        SET access_count = access_count + 1, last_accessed_at = ?
        WHERE token = ?
      `).run(new Date().toISOString(), protocol);

      const events = db.prepare(`
        SELECT title, description, created_at 
        FROM wo_timeline_events 
        WHERE work_order_id = ? 
        ORDER BY created_at ASC
      `).all(tokenRecord.work_order_id) as any[];

      const maskedPlate = tokenRecord.plate ? `***-${tokenRecord.plate.slice(-4)}` : "";

      return NextResponse.json({
        success: true,
        type: "work_order_secure",
        protocol: tokenRecord.os_number,
        vehicle: `${tokenRecord.brand} ${tokenRecord.model} ${maskedPlate}`.trim(),
        status_code: tokenRecord.wo_status,
        status_label: getFriendlyOsStatus(tokenRecord.wo_status),
        is_in_workshop: true,
        timeline: events.map(e => ({
          timestamp: e.created_at,
          title: e.title,
          description: e.description
        }))
      });
    }

    // 3. Regra de Segurança V1: Bloqueio de Enumeração Sequencial de OS / Placa
    // Número sequencial da OS (ex: GT-OS-000127) não pode servir sozinho como autorização
    if (cleanProto.startsWith("GT-OS-") || cleanProto.startsWith("OS-")) {
      const searchParams = req.nextUrl.searchParams;
      const phoneParam = searchParams.get("phone") || searchParams.get("tel");
      const tokenParam = searchParams.get("token");

      if (!phoneParam && !tokenParam) {
        return NextResponse.json(
          { 
            success: false, 
            protected: true,
            error: "Acesso protegido pela política de privacidade G-Tech. O número sequencial da OS ou placa não autoriza acesso isolado. Utilize o link individual enviado pelo WhatsApp ou informe o telefone do titular (?phone=...)." 
          },
          { status: 403 }
        );
      }

      // Se forneceu telefone, valida titularidade
      if (phoneParam) {
        const cleanPhone = phoneParam.replace(/\D/g, "");
        const woAuth = db.prepare(`
          SELECT wo.id, wo.os_number, wo.status, wo.created_at, wo.updated_at,
                 v.brand, v.model, v.plate, c.phone as customer_phone
          FROM work_orders wo
          JOIN vehicles v ON wo.vehicle_id = v.id
          LEFT JOIN customers c ON wo.customer_id = c.id
          WHERE UPPER(wo.os_number) = ?
        `).get(cleanProto) as any;

        if (!woAuth) {
          return NextResponse.json({ success: false, error: "Ordem de Serviço não localizada." }, { status: 404 });
        }

        const registeredPhoneClean = (woAuth.customer_phone || "").replace(/\D/g, "");
        if (!registeredPhoneClean.includes(cleanPhone) && !cleanPhone.includes(registeredPhoneClean)) {
          return NextResponse.json({ success: false, error: "Telefone não confere com o cadastro desta Ordem de Serviço." }, { status: 403 });
        }

        const events = db.prepare(`
          SELECT title, description, created_at 
          FROM wo_timeline_events 
          WHERE work_order_id = ? 
          ORDER BY created_at ASC
        `).all(woAuth.id) as any[];

        const maskedPlate = woAuth.plate ? `***-${woAuth.plate.slice(-4)}` : "";

        return NextResponse.json({
          success: true,
          type: "work_order",
          protocol: woAuth.os_number,
          vehicle: `${woAuth.brand} ${woAuth.model} ${maskedPlate}`.trim(),
          status_code: woAuth.status,
          status_label: getFriendlyOsStatus(woAuth.status),
          is_in_workshop: true,
          timeline: events.map(e => ({
            timestamp: e.created_at,
            title: e.title,
            description: e.description
          }))
        });
      }
    }

    return NextResponse.json(
      { success: false, error: "Protocolo não encontrado ou inválido. Verifique o código de agendamento (Ex: GT-2026-0001) ou acesse pelo link seguro enviado no seu WhatsApp." },
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

