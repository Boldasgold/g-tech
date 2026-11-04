import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const wo = db.prepare("SELECT id FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const exitData = db.prepare("SELECT * FROM wo_exit_checklist WHERE work_order_id = ?").get(wo.id);

    return NextResponse.json({ success: true, exit_checklist: exitData || null });
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

    const wo = db.prepare("SELECT id, os_number FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const {
      road_test_ok = true,
      warning_lights_cleared = true,
      parts_returned = false,
      vehicle_cleaned = true,
      wheel_torque_checked = true,
      recommendations,
      delivered_to_name,
      delivered_by = "Giovane Ribeiro",
      final_status = "entregue"
    } = body;

    const existing = db.prepare("SELECT id FROM wo_exit_checklist WHERE work_order_id = ?").get(wo.id) as any;
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(`
        UPDATE wo_exit_checklist SET
          road_test_ok = ?,
          warning_lights_cleared = ?,
          parts_returned = ?,
          vehicle_cleaned = ?,
          wheel_torque_checked = ?,
          recommendations = ?,
          delivered_to_name = ?,
          delivered_by = ?,
          delivered_at = ?
        WHERE work_order_id = ?
      `).run(
        road_test_ok ? 1 : 0,
        warning_lights_cleared ? 1 : 0,
        parts_returned ? 1 : 0,
        vehicle_cleaned ? 1 : 0,
        wheel_torque_checked ? 1 : 0,
        recommendations || null,
        delivered_to_name || null,
        delivered_by,
        now,
        wo.id
      );
    } else {
      db.prepare(`
        INSERT INTO wo_exit_checklist (
          id, work_order_id, road_test_ok, warning_lights_cleared, parts_returned,
          vehicle_cleaned, wheel_torque_checked, recommendations, delivered_to_name,
          delivered_by, delivered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `exit-${Date.now()}`,
        wo.id,
        road_test_ok ? 1 : 0,
        warning_lights_cleared ? 1 : 0,
        parts_returned ? 1 : 0,
        vehicle_cleaned ? 1 : 0,
        wheel_torque_checked ? 1 : 0,
        recommendations || null,
        delivered_to_name || null,
        delivered_by,
        now
      );
    }

    // Update work order status
    db.prepare(`
      UPDATE work_orders 
      SET status = ?, updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(final_status, wo.id);

    // Timeline event
    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tl-${Date.now()}`,
      wo.id,
      "ENTREGA_VEICULO",
      final_status === "entregue" ? "Veículo Entregue ao Cliente" : "Controle de Qualidade Concluído",
      `Checklist de saída aprovado (Rodagem: ${road_test_ok ? "OK" : "Não"}, Luzes de painel limpas: ${warning_lights_cleared ? "OK" : "Não"}, Torque verificado: ${wheel_torque_checked ? "OK" : "Não"}). Entregue por ${delivered_by}.`,
      delivered_by,
      "gestor"
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "wo_exit_checklist",
      wo.id,
      "SUBMIT_EXIT_CHECKLIST",
      delivered_by,
      "gestor",
      JSON.stringify({ road_test_ok, warning_lights_cleared, final_status, delivered_to_name }),
      generateHash({ woId: wo.id, final_status, delivered_to_name, timestamp: now })
    );

    return NextResponse.json({
      success: true,
      message: `Checklist de saída registrado e OS alterada para ${final_status.toUpperCase()}!`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

