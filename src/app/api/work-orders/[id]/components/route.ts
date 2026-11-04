import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

// GET /api/work-orders/[id]/components
// Returns all vehicle components, optionally filtered, merged with this work order's inspections
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();

    // Check if OS exists
    const wo = db.prepare("SELECT id, vehicle_id, os_number FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const system = searchParams.get("system");
    const axle = searchParams.get("axle");
    const side = searchParams.get("side");
    const status = searchParams.get("status");
    const query = searchParams.get("q");

    let sql = `
      SELECT 
        c.*,
        i.id as inspection_id,
        i.status as inspection_status,
        i.test_performed,
        i.measurement_value,
        i.tolerance_spec,
        i.finding_description,
        i.priority,
        i.photo_url as inspection_photo,
        i.suggested_repair,
        i.suggested_part_price,
        i.suggested_service_price,
        i.is_quoted,
        i.inspected_by,
        i.inspected_at,
        r.id as replaced_id,
        r.seal_status,
        r.removed_part_desc,
        r.installed_part_desc,
        r.photo_before_url,
        r.photo_after_url,
        r.replaced_at
      FROM vehicle_components c
      LEFT JOIN wo_component_inspections i 
        ON c.id = i.component_id AND i.work_order_id = ?
      LEFT JOIN wo_replaced_parts r
        ON c.id = r.component_id AND r.work_order_id = ?
      WHERE 1=1
    `;

    const params: any[] = [wo.id, wo.id];

    if (system && system !== "todos") {
      sql += " AND c.system_group = ?";
      params.push(system);
    }

    if (axle && axle !== "todos") {
      sql += " AND c.axle = ?";
      params.push(axle);
    }

    if (side && side !== "todos") {
      sql += " AND c.position_side = ?";
      params.push(side);
    }

    if (status && status !== "todos") {
      if (status === "nao_inspecionado") {
        sql += " AND (i.status IS NULL OR i.status = 'nao_inspecionado')";
      } else {
        sql += " AND i.status = ?";
        params.push(status);
      }
    }

    if (query) {
      sql += " AND (c.component_name LIKE ? OR c.assembly_name LIKE ? OR c.oem_code LIKE ?)";
      const term = `%${query}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY c.system_group ASC, c.assembly_name ASC, c.component_name ASC";

    const rows = db.prepare(sql).all(...params);

    // Also get overall counts
    const summary = db.prepare(`
      SELECT 
        count(c.id) as total_components,
        sum(CASE WHEN i.status = 'ok' THEN 1 ELSE 0 END) as ok_count,
        sum(CASE WHEN i.status = 'atencao' THEN 1 ELSE 0 END) as atencao_count,
        sum(CASE WHEN i.status = 'critico' THEN 1 ELSE 0 END) as critico_count,
        sum(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) as replaced_count
      FROM vehicle_components c
      LEFT JOIN wo_component_inspections i ON c.id = i.component_id AND i.work_order_id = ?
      LEFT JOIN wo_replaced_parts r ON c.id = r.component_id AND r.work_order_id = ?
    `).get(wo.id, wo.id) as any;

    return NextResponse.json({
      success: true,
      work_order_id: wo.id,
      os_number: wo.os_number,
      summary,
      components: rows
    });
  } catch (err: any) {
    console.error("Erro ao listar componentes", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/work-orders/[id]/components
// Saves or updates a component inspection finding on this OS
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
      component_id,
      status, // 'ok', 'atencao', 'critico', 'nao_inspecionado', 'nao_aplicavel'
      test_performed,
      measurement_value,
      tolerance_spec,
      finding_description,
      priority = "normal",
      photo_url,
      suggested_repair,
      suggested_part_price = 0,
      suggested_service_price = 0,
      inspected_by = "Giovane Ribeiro"
    } = body;

    if (!component_id || !status) {
      return NextResponse.json({ success: false, error: "Componente e status são obrigatórios." }, { status: 400 });
    }

    // Check if inspection already exists for this component on this OS
    const existing = db.prepare("SELECT id FROM wo_component_inspections WHERE work_order_id = ? AND component_id = ?").get(wo.id, component_id) as any;

    const inspId = existing ? existing.id : `cinsp-${Date.now()}`;

    if (existing) {
      db.prepare(`
        UPDATE wo_component_inspections
        SET status = ?, test_performed = ?, measurement_value = ?, tolerance_spec = ?,
            finding_description = ?, priority = ?, photo_url = ?, suggested_repair = ?,
            suggested_part_price = ?, suggested_service_price = ?, inspected_by = ?,
            inspected_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(
        status, test_performed, measurement_value, tolerance_spec,
        finding_description, priority, photo_url, suggested_repair,
        suggested_part_price, suggested_service_price, inspected_by,
        inspId
      );
    } else {
      db.prepare(`
        INSERT INTO wo_component_inspections (
          id, work_order_id, component_id, status, test_performed, measurement_value,
          tolerance_spec, finding_description, priority, photo_url, suggested_repair,
          suggested_part_price, suggested_service_price, inspected_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        inspId, wo.id, component_id, status, test_performed, measurement_value,
        tolerance_spec, finding_description, priority, photo_url, suggested_repair,
        suggested_part_price, suggested_service_price, inspected_by
      );
    }

    // Also add event to timeline if critical or attention
    if (status === "critico" || status === "atencao") {
      db.prepare(`
        INSERT INTO wo_timeline_events (
          id, work_order_id, event_type, title, description, actor_name, actor_role
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `tl-${Date.now()}`,
        wo.id,
        status === "critico" ? "ACHADO_CRITICO" : "ACHADO_ATENCAO",
        `Inspeção: ${finding_description?.slice(0, 40) || status}`,
        `Medição: ${measurement_value || "N/A"}. Prioridade: ${priority}. Sugestão: ${suggested_repair || "Revisão técnica"}`,
        inspected_by,
        "mecanico"
      );
    }

    return NextResponse.json({
      success: true,
      inspection_id: inspId,
      message: "Inspeção do componente gravada com sucesso."
    });
  } catch (err: any) {
    console.error("Erro ao salvar inspeção do componente", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

