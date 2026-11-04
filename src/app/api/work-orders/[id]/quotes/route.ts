import { NextRequest, NextResponse } from "next/server";
import { getDb, generateToken, generateHash } from "@/lib/db";

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

    const quotes = db.prepare(`
      SELECT * FROM wo_quotes 
      WHERE work_order_id = ? 
      ORDER BY version_number DESC
    `).all(wo.id) as any[];

    const withItems = quotes.map(q => {
      const items = db.prepare("SELECT * FROM wo_quote_items WHERE quote_id = ?").all(q.id);
      return { ...q, items };
    });

    return NextResponse.json({ success: true, count: withItems.length, quotes: withItems });
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
      items = [],
      valid_until,
      estimated_deadline,
      warranty_terms = "90 dias para peças e serviços conforme CDC. Peças genuínas/homologadas com garantia de fábrica.",
      notes,
      publish_to_client = false,
      created_by = "Giovane Ribeiro"
    } = body;

    // Determine next version number
    const lastQuote = db.prepare(`
      SELECT version_number FROM wo_quotes 
      WHERE work_order_id = ? 
      ORDER BY version_number DESC LIMIT 1
    `).get(wo.id) as { version_number?: number } | undefined;

    const nextVersion = (lastQuote?.version_number || 0) + 1;
    const quoteId = `quote-${wo.id}-v${nextVersion}`;
    const publicToken = `gt-tok-${Date.now().toString(36)}-${generateToken().slice(0, 8)}`;

    let subtotalParts = 0;
    let subtotalServices = 0;

    items.forEach((it: any) => {
      const q = Number(it.quantity) || 1;
      const part = (Number(it.unit_price_part) || 0) * q;
      const srv = (Number(it.unit_price_service) || 0) * q;
      subtotalParts += part;
      subtotalServices += srv;
    });

    const totalAmount = subtotalParts + subtotalServices;
    const status = publish_to_client ? "enviado" : "rascunho";

    db.prepare(`
      INSERT INTO wo_quotes (
        id, work_order_id, version_number, status, subtotal_parts, subtotal_services,
        total_amount, valid_until, estimated_deadline, warranty_terms, notes,
        public_token, created_by, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quoteId,
      wo.id,
      nextVersion,
      status,
      subtotalParts,
      subtotalServices,
      totalAmount,
      valid_until || null,
      estimated_deadline || "1 a 2 dias úteis",
      warranty_terms,
      notes || null,
      publicToken,
      created_by,
      publish_to_client ? new Date().toISOString() : null
    );

    // Insert items
    const insertItem = db.prepare(`
      INSERT INTO wo_quote_items (
        id, quote_id, checklist_item_id, description, part_code,
        quantity, unit_price_part, unit_price_service, subtotal,
        is_indivisible, indivisible_justification, safety_risk_warning, decision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((it: any, idx: number) => {
      const q = Number(it.quantity) || 1;
      const pPart = Number(it.unit_price_part) || 0;
      const pSrv = Number(it.unit_price_service) || 0;
      const sub = (pPart + pSrv) * q;

      insertItem.run(
        `qi-${quoteId}-${idx + 1}`,
        quoteId,
        it.checklist_item_id || null,
        it.description,
        it.part_code || null,
        q,
        pPart,
        pSrv,
        sub,
        it.is_indivisible ? 1 : 0,
        it.indivisible_justification || null,
        it.safety_risk_warning || null,
        "pendente"
      );
    });

    // Update work order status if published
    if (publish_to_client) {
      db.prepare(`
        UPDATE work_orders 
        SET status = 'aguardando_cliente', updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(wo.id);

      db.prepare(`
        INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `tl-${Date.now()}`,
        wo.id,
        "ORCAMENTO_ENVIADO",
        `Orçamento v${nextVersion} Publicado`,
        `Orçamento no total de R$ ${totalAmount.toFixed(2)} liberado para aprovação do cliente via link seguro.`,
        created_by,
        "adm"
      );
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "wo_quotes",
      quoteId,
      "CREATE_QUOTE",
      created_by,
      "adm",
      JSON.stringify({ version: nextVersion, total: totalAmount, itemsCount: items.length }),
      generateHash({ quoteId, totalAmount, publicToken })
    );

    return NextResponse.json({
      success: true,
      quote_id: quoteId,
      version: nextVersion,
      total_amount: totalAmount,
      public_token: publicToken,
      portal_url: `/cliente/${publicToken}`,
      message: `Orçamento v${nextVersion} gerado com sucesso!`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

