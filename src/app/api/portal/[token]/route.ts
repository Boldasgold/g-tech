import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ success: false, error: "Token inválido." }, { status: 400 });
    }

    const db = getDb();
    const quote = db.prepare(`
      SELECT q.*, wo.os_number, wo.customer_complaint, wo.status as wo_status,
             c.name as customer_name, c.phone as customer_phone,
             v.brand, v.model, v.plate, v.year, v.km, v.body_type
      FROM wo_quotes q
      JOIN work_orders wo ON q.work_order_id = wo.id
      JOIN customers c ON wo.customer_id = c.id
      JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE q.public_token = ?
    `).get(token) as any;

    if (!quote) {
      return NextResponse.json({ success: false, error: "Orçamento não localizado ou link expirado." }, { status: 404 });
    }

    // Fetch quote items
    const items = db.prepare(`
      SELECT id, description, part_code, quantity, unit_price_part, unit_price_service,
             subtotal, is_indivisible, indivisible_justification, safety_risk_warning,
             decision, refusal_reason
      FROM wo_quote_items
      WHERE quote_id = ?
      ORDER BY is_indivisible DESC, created_at ASC
    `).all(quote.id);

    // Fetch intake inspection highlights
    const intake = db.prepare(`
      SELECT odometer_km, fuel_pct, photo_front, photo_rear, photo_left, photo_right,
             photo_interior, photo_dashboard, observations
      FROM wo_intake_inspection
      WHERE work_order_id = ?
    `).get(quote.work_order_id);

    // Fetch hotspots/findings for customer visualization
    const hotspots = db.prepare(`
      SELECT id, hotspot_type, region_name, orientation_side, severity, damage_type, description, photo_url
      FROM wo_hotspots
      WHERE work_order_id = ?
    `).all(quote.work_order_id);

    // Fetch previous decisions if already submitted
    const decision = db.prepare(`
      SELECT * FROM wo_customer_decisions
      WHERE quote_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(quote.id);

    return NextResponse.json({
      success: true,
      quote: {
        id: quote.id,
        version: quote.version_number,
        status: quote.status,
        os_number: quote.os_number,
        customer_complaint: quote.customer_complaint,
        subtotal_parts: quote.subtotal_parts,
        subtotal_services: quote.subtotal_services,
        total_amount: quote.total_amount,
        authorized_total: quote.authorized_total,
        valid_until: quote.valid_until,
        estimated_deadline: quote.estimated_deadline,
        warranty_terms: quote.warranty_terms,
        notes: quote.notes,
        created_at: quote.created_at,
        customer: {
          name: quote.customer_name,
          phone: quote.customer_phone
        },
        vehicle: {
          brand: quote.brand,
          model: quote.model,
          plate: quote.plate,
          year: quote.year,
          km: quote.km,
          body_type: quote.body_type
        },
        items,
        intake,
        hotspots,
        existing_decision: decision || null
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await req.json();
    const db = getDb();

    const quote = db.prepare(`
      SELECT q.*, wo.id as work_order_id, wo.os_number, c.name as customer_name, c.document as customer_document
      FROM wo_quotes q
      JOIN work_orders wo ON q.work_order_id = wo.id
      JOIN customers c ON wo.customer_id = c.id
      WHERE q.public_token = ?
    `).get(token) as any;

    if (!quote) {
      return NextResponse.json({ success: false, error: "Orçamento não encontrado." }, { status: 404 });
    }

    const {
      decisions = [], // array of { item_id, decision: 'aprovado' | 'recusado' | 'esclarecimento', refusal_reason }
      client_name,
      client_document,
      refusal_risk_acknowledged = false,
      risk_acknowledgement_text
    } = body;

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Navegador Web";

    // Update individual items
    let authorizedAmount = 0;
    let refusedAmount = 0;
    let hasRefusalOnCritical = false;

    const quoteItems = db.prepare("SELECT * FROM wo_quote_items WHERE quote_id = ?").all(quote.id) as any[];
    const itemsMap = new Map(quoteItems.map(it => [it.id, it]));

    const updateItemStmt = db.prepare(`
      UPDATE wo_quote_items SET
        decision = ?,
        refusal_reason = ?
      WHERE id = ? AND quote_id = ?
    `);

    for (const d of decisions) {
      const original = itemsMap.get(d.item_id);
      if (!original) continue;

      const dec = d.decision === "aprovado" ? "aprovado" : d.decision === "recusado" ? "recusado" : "esclarecimento";
      updateItemStmt.run(dec, d.refusal_reason || null, d.item_id, quote.id);

      if (dec === "aprovado") {
        authorizedAmount += original.subtotal;
      } else if (dec === "recusado") {
        refusedAmount += original.subtotal;
        if (original.safety_risk_warning) {
          hasRefusalOnCritical = true;
        }
      }
    }

    // Safety check: if customer refused a critical safety item without acknowledgement, require it
    if (hasRefusalOnCritical && !refusal_risk_acknowledged) {
      return NextResponse.json({
        success: false,
        error: "Um ou mais itens recusados possuem alerta crítico de segurança veicular. É necessário marcar a ciência explícita do termo de responsabilidade técnica antes de confirmar.",
        requires_risk_acknowledgement: true
      }, { status: 422 });
    }

    // Overall action
    let overallAction: "aprovado_total" | "aprovado_parcial" | "recusado_total" = "aprovado_total";
    if (authorizedAmount === 0 && refusedAmount > 0) {
      overallAction = "recusado_total";
    } else if (refusedAmount > 0) {
      overallAction = "aprovado_parcial";
    }

    const currentYear = new Date().getFullYear();
    const receiptProtocol = `DEC-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;
    const decisionId = `dec-${Date.now()}`;

    // Generate cryptographic hash of the customer's decision
    const decisionPayload = {
      work_order_id: quote.work_order_id,
      quote_id: quote.id,
      receipt_protocol: receiptProtocol,
      overallAction,
      authorizedAmount,
      refusedAmount,
      client_name: client_name || quote.customer_name,
      client_document: client_document || quote.customer_document,
      ipAddress,
      userAgent,
      hasRefusalOnCritical,
      decisions,
      timestamp: new Date().toISOString()
    };
    const auditHash = generateHash(decisionPayload);

    // Save decision
    db.prepare(`
      INSERT INTO wo_customer_decisions (
        id, work_order_id, quote_id, decision_token, action,
        authorized_amount, refused_amount, client_name, client_document,
        ip_address, user_agent, audit_hash, refusal_risk_acknowledged,
        risk_acknowledgement_text, receipt_protocol
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decisionId,
      quote.work_order_id,
      quote.id,
      token,
      overallAction,
      authorizedAmount,
      refusedAmount,
      client_name || quote.customer_name,
      client_document || quote.customer_document || null,
      ipAddress,
      userAgent,
      auditHash,
      refusal_risk_acknowledged ? 1 : 0,
      risk_acknowledgement_text || (hasRefusalOnCritical ? "Cliente manifestou recusa de item de segurança assumindo responsabilidade operacional." : null),
      receiptProtocol
    );

    // Update quote record
    db.prepare(`
      UPDATE wo_quotes SET
        status = 'decidido',
        authorized_total = ?,
        decided_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(authorizedAmount, quote.id);

    // Update work order status: if approved, set to 'aprovada' (or 'em_servico')
    const nextWoStatus = authorizedAmount > 0 ? "aprovada" : "orcamento";
    db.prepare(`
      UPDATE work_orders SET
        status = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(nextWoStatus, quote.work_order_id);

    // Timeline event
    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tl-${Date.now()}`,
      quote.work_order_id,
      "DECISAO_CLIENTE",
      `Decisão do Cliente: ${overallAction === "aprovado_total" ? "Aprovação Total" : overallAction === "aprovado_parcial" ? "Aprovação Parcial" : "Recusa Total"}`,
      `Protocolo de Comprovante: ${receiptProtocol}. Autorizado: R$ ${authorizedAmount.toFixed(2)}. Recusado: R$ ${refusedAmount.toFixed(2)}. Hash: ${auditHash.slice(0, 16)}...`,
      client_name || quote.customer_name,
      "cliente"
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "wo_customer_decisions",
      decisionId,
      "CUSTOMER_DECISION_SIGNATURE",
      client_name || quote.customer_name,
      "cliente",
      JSON.stringify(decisionPayload),
      auditHash
    );

    return NextResponse.json({
      success: true,
      receipt_protocol: receiptProtocol,
      audit_hash: auditHash,
      overall_action: overallAction,
      authorized_amount: authorizedAmount,
      refused_amount: refusedAmount,
      message: "Decisão gravada com sucesso no sistema da G-Tech!"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

