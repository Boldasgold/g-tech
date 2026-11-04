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

    const hotspots = db.prepare(`
      SELECT * FROM wo_hotspots 
      WHERE work_order_id = ? 
      ORDER BY created_at ASC
    `).all(wo.id);

    return NextResponse.json({ success: true, count: hotspots.length, hotspots });
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
      hotspot_type = "avaria_entrada",
      region_name,
      orientation_side,
      pos_x = 0,
      pos_y = 0,
      pos_z = 0,
      severity = "baixa",
      damage_type = "risco",
      description,
      photo_url,
      author_name = "Giovane Ribeiro"
    } = body;

    if (!region_name || !orientation_side || !description) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: região semântica, lado de orientação e descrição." },
        { status: 400 }
      );
    }

    const hotspotId = `hs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    db.prepare(`
      INSERT INTO wo_hotspots (
        id, work_order_id, hotspot_type, region_name, orientation_side,
        pos_x, pos_y, pos_z, severity, damage_type, description, photo_url, author_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hotspotId,
      wo.id,
      hotspot_type,
      region_name,
      orientation_side,
      pos_x,
      pos_y,
      pos_z,
      severity,
      damage_type,
      description,
      photo_url || null,
      author_name
    );

    // Timeline event
    const typeLabel = 
      hotspot_type === "avaria_entrada" ? "Avaria de Entrada Registrada" :
      hotspot_type === "achado_tecnico" ? "Achado Técnico no Veículo" : "Serviço Concluído na Região";

    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tl-${Date.now()}`,
      wo.id,
      "HOTSPOT_ADICIONADO",
      `${typeLabel}: ${region_name}`,
      `[${orientation_side.toUpperCase()}] ${description} (Severidade: ${severity.toUpperCase()}). Gravado por ${author_name}.`,
      author_name,
      "mecanico"
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "wo_hotspots",
      hotspotId,
      "ADD_HOTSPOT",
      author_name,
      "mecanico",
      JSON.stringify({ hotspot_type, region_name, orientation_side, severity, description }),
      generateHash({ hotspotId, woId: wo.id, region_name, description })
    );

    return NextResponse.json({
      success: true,
      hotspot_id: hotspotId,
      message: "Ponto de avaria / achado registrado no modelo 3D com sucesso!"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const hotspotId = searchParams.get("hotspot_id");

    if (!hotspotId) {
      return NextResponse.json({ success: false, error: "ID do hotspot não informado." }, { status: 400 });
    }

    const db = getDb();
    const wo = db.prepare("SELECT id FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    db.prepare("DELETE FROM wo_hotspots WHERE id = ? AND work_order_id = ?").run(hotspotId, wo.id);

    return NextResponse.json({ success: true, message: "Marcador removido com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

