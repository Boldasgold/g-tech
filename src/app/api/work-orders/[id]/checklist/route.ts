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

    const items = db.prepare(`
      SELECT * FROM wo_checklist_items 
      WHERE work_order_id = ? 
      ORDER BY group_name ASC, item_name ASC
    `).all(wo.id);

    return NextResponse.json({ success: true, count: items.length, items });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
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
      item_id,
      status,
      finding_description,
      test_performed,
      recommendation,
      priority,
      suggested_part,
      suggested_service,
      suggested_qty = 1,
      photo_url,
      mechanic_name = "Giovane Ribeiro"
    } = body;

    if (!item_id || !status) {
      return NextResponse.json({ success: false, error: "Item ID e status são obrigatórios." }, { status: 400 });
    }

    if ((status === "ATENCAO" || status === "CRITICO") && (!finding_description || finding_description.trim().length === 0)) {
      return NextResponse.json({
        success: false,
        error: "Para itens com status ATENÇÃO ou CRÍTICO, a descrição do achado técnico e evidência é obrigatória."
      }, { status: 422 });
    }

    db.prepare(`
      UPDATE wo_checklist_items SET
        status = ?,
        finding_description = ?,
        test_performed = ?,
        recommendation = ?,
        priority = ?,
        suggested_part = ?,
        suggested_service = ?,
        suggested_qty = ?,
        photo_url = COALESCE(?, photo_url),
        mechanic_name = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ? AND work_order_id = ?
    `).run(
      status,
      finding_description || null,
      test_performed || null,
      recommendation || null,
      priority || (status === "CRITICO" ? "critica" : status === "ATENCAO" ? "alta" : "baixa"),
      suggested_part || null,
      suggested_service || null,
      suggested_qty || 1,
      photo_url || null,
      mechanic_name,
      item_id,
      wo.id
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "wo_checklist_items",
      item_id,
      "UPDATE_CHECKLIST_ITEM",
      mechanic_name,
      "mecanico",
      JSON.stringify({ item_id, status, finding_description }),
      generateHash({ item_id, status, finding_description })
    );

    return NextResponse.json({
      success: true,
      message: "Item do checklist atualizado com sucesso!"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

