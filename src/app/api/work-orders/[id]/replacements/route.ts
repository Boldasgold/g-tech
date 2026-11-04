import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

// GET /api/work-orders/[id]/replacements
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();

    const wo = db.prepare("SELECT id, os_number FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const replacements = db.prepare(`
      SELECT 
        r.*,
        c.system_group,
        c.mesh_id,
        c.oem_code,
        c.axle,
        c.position_side as comp_side
      FROM wo_replaced_parts r
      LEFT JOIN vehicle_components c ON r.component_id = c.id
      WHERE r.work_order_id = ?
      ORDER BY r.replaced_at DESC
    `).all(wo.id);

    return NextResponse.json({
      success: true,
      work_order_id: wo.id,
      os_number: wo.os_number,
      replacements
    });
  } catch (err: any) {
    console.error("Erro ao consultar peças trocadas", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/work-orders/[id]/replacements
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const db = getDb();

    const wo = db.prepare("SELECT id, os_number, company_id FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const {
      quote_item_id,
      component_id,
      component_name,
      assembly_path,
      position_side = "central",
      removed_part_desc,
      installed_part_desc,
      photo_before_url,
      photo_after_url,
      technician_name = "Giovane Ribeiro",
      warranty_terms = "90 dias conforme CDC"
    } = body;

    if (!component_name || !removed_part_desc || !installed_part_desc) {
      return NextResponse.json({
        success: false,
        error: "Nome da peça, descrição da peça retirada e da instalada são obrigatórios."
      }, { status: 400 });
    }

    const replId = `repl-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO wo_replaced_parts (
        id, work_order_id, quote_item_id, component_id, component_name,
        assembly_path, position_side, removed_part_desc, installed_part_desc,
        photo_before_url, photo_after_url, technician_name, seal_status, warranty_terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PEÇA TROCADA', ?)
    `).run(
      replId, wo.id, quote_item_id || null, component_id || null, component_name,
      assembly_path || "Veículo › Componente Substituído", position_side,
      removed_part_desc, installed_part_desc, photo_before_url || null,
      photo_after_url || null, technician_name, warranty_terms
    );

    // Timeline event
    db.prepare(`
      INSERT INTO wo_timeline_events (
        id, work_order_id, event_type, title, description, actor_name, actor_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tl-${Date.now()}`,
      wo.id,
      "PECA_SUBSTITUIDA",
      `Peça Trocada: ${component_name}`,
      `Substituição concluída por ${technician_name}. Nova: ${installed_part_desc}. Garantia: ${warranty_terms}`,
      technician_name,
      "mecanico"
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (
        id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      wo.company_id,
      "replaced_parts",
      replId,
      "REPLACE_PART",
      technician_name,
      "mecanico",
      JSON.stringify({ component_name, installed_part_desc, os_number: wo.os_number }),
      generateHash({ replId, component_name, installed_part_desc, date: now })
    );

    return NextResponse.json({
      success: true,
      replacement_id: replId,
      seal_status: "PEÇA TROCADA",
      message: "Substituição de peça registrada e selo oficial emitido."
    });
  } catch (err: any) {
    console.error("Erro ao registrar substituição de peça", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
