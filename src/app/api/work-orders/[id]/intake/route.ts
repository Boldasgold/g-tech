import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const db = getDb();

    const wo = db.prepare("SELECT id, os_number, vehicle_id, customer_id FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const {
      photo_front = null,
      photo_rear = null,
      photo_left = null,
      photo_right = null,
      photo_interior = null,
      photo_dashboard = null,
      video_url = null,
      odometer_km = null,
      fuel_pct = 50,
      panel_alerts_found = null,
      observations = null,
      client_acknowledged = false,
      client_refused_signature = false,
      refusal_reason = null,
      witness_info = null,
      responsible_name = "Giovane Ribeiro"
    } = body;

    const existingIntake = db.prepare("SELECT id FROM wo_intake_inspection WHERE work_order_id = ?").get(wo.id) as any;

    if (existingIntake) {
      db.prepare(`
        UPDATE wo_intake_inspection SET
          photo_front = COALESCE(?, photo_front),
          photo_rear = COALESCE(?, photo_rear),
          photo_left = COALESCE(?, photo_left),
          photo_right = COALESCE(?, photo_right),
          photo_interior = COALESCE(?, photo_interior),
          photo_dashboard = COALESCE(?, photo_dashboard),
          video_url = COALESCE(?, video_url),
          odometer_km = COALESCE(?, odometer_km),
          fuel_pct = COALESCE(?, fuel_pct),
          panel_alerts_found = COALESCE(?, panel_alerts_found),
          observations = COALESCE(?, observations),
          client_acknowledged = COALESCE(?, client_acknowledged),
          client_refused_signature = COALESCE(?, client_refused_signature),
          refusal_reason = COALESCE(?, refusal_reason),
          witness_info = COALESCE(?, witness_info),
          responsible_name = ?
        WHERE work_order_id = ?
      `).run(
        photo_front, photo_rear, photo_left, photo_right, photo_interior, photo_dashboard,
        video_url, odometer_km, fuel_pct, panel_alerts_found, observations,
        client_acknowledged ? 1 : 0, client_refused_signature ? 1 : 0,
        refusal_reason, witness_info, responsible_name, wo.id
      );
    } else {
      db.prepare(`
        INSERT INTO wo_intake_inspection (
          id, work_order_id, photo_front, photo_rear, photo_left, photo_right,
          photo_interior, photo_dashboard, video_url, odometer_km, fuel_pct,
          panel_alerts_found, observations, client_acknowledged, client_refused_signature,
          refusal_reason, witness_info, responsible_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `intake-${Date.now()}`, wo.id, photo_front, photo_rear, photo_left, photo_right,
        photo_interior, photo_dashboard, video_url, odometer_km, fuel_pct,
        panel_alerts_found, observations, client_acknowledged ? 1 : 0, client_refused_signature ? 1 : 0,
        refusal_reason, witness_info, responsible_name
      );
    }

    // Registrar visita imutável na tabela wo_inspection_visits (preserva histórico de visitas anteriores do veículo sem sobrescrever fotos antigas)
    const visitCountRow = db.prepare(`
      SELECT COALESCE(MAX(visit_number), 0) as max_visit
      FROM wo_inspection_visits
      WHERE vehicle_id = ? AND work_order_id != ?
    `).get(wo.vehicle_id, wo.id) as any;
    const currentVisitNumber = (visitCountRow?.max_visit || 0) + 1;

    const existingVisitEntry = db.prepare(`
      SELECT id FROM wo_inspection_visits
      WHERE work_order_id = ? AND inspection_stage = 'entrada'
    `).get(wo.id) as any;

    const photosPayload = JSON.stringify({
      photo_front,
      photo_rear,
      photo_left,
      photo_right,
      photo_interior,
      photo_dashboard
    });

    if (existingVisitEntry) {
      db.prepare(`
        UPDATE wo_inspection_visits SET
          photos_json = ?,
          odometer_km = COALESCE(?, odometer_km),
          fuel_level = COALESCE(?, fuel_level),
          notes = COALESCE(?, notes),
          inspector_name = ?
        WHERE id = ?
      `).run(photosPayload, odometer_km || 0, `${fuel_pct || 50}%`, observations || "", responsible_name, existingVisitEntry.id);
    } else {
      db.prepare(`
        INSERT INTO wo_inspection_visits (
          id, work_order_id, vehicle_id, visit_number,
          inspection_stage, odometer_km, fuel_level, photos_json, checklist_json, notes, inspector_name
        ) VALUES (?, ?, ?, ?, 'entrada', ?, ?, ?, '[]', ?, ?)
      `).run(
        `vis-in-${Date.now()}`,
        wo.id,
        wo.vehicle_id,
        currentVisitNumber,
        odometer_km || 0,
        `${fuel_pct || 50}%`,
        photosPayload,
        observations || "",
        responsible_name
      );
    }

    // Timeline and audit
    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tl-${Date.now()}`,
      wo.id,
      "VISTORIA_ENTRADA",
      "Vistoria Fotográfica de Entrada Atualizada",
      `Vistoria registrada com hodômetro em ${odometer_km || 0} km e nível de combustível em ${fuel_pct || 50}%. Ciência do cliente: ${client_acknowledged ? "Confirmada" : "Pendente/Recusada"}.`,
      responsible_name,
      "mecanico"
    );

    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "wo_intake_inspection",
      wo.id,
      "UPDATE_INTAKE",
      responsible_name,
      "mecanico",
      JSON.stringify({ odometer: odometer_km, fuel: fuel_pct, client_acknowledged }),
      generateHash({ woId: wo.id, odometer_km, fuel_pct, client_acknowledged })
    );

    return NextResponse.json({
      success: true,
      message: "Vistoria de entrada salva com sucesso!"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const POST = PUT;

