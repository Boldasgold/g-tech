import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();

    // 1. Fetch OS header
    const wo = db.prepare(`
      SELECT 
        wo.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.document as customer_document,
        c.email as customer_email,
        v.brand as vehicle_brand,
        v.model as vehicle_model,
        v.plate as vehicle_plate,
        v.year as vehicle_year,
        v.motor as vehicle_motor,
        v.color as vehicle_color,
        v.km as vehicle_km,
        v.fuel as vehicle_fuel,
        v.chassis as vehicle_chassis,
        v.body_type as vehicle_body_type,
        u.name as mechanic_name,
        u.role as mechanic_role
      FROM work_orders wo
      JOIN customers c ON wo.customer_id = c.id
      JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.assigned_mechanic_id = u.id
      WHERE wo.id = ? OR wo.os_number = ?
    `).get(id, id) as any;

    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const woId = wo.id;

    // 2. Intake inspection
    const intake = db.prepare("SELECT * FROM wo_intake_inspection WHERE work_order_id = ?").get(woId) as any;

    // 3. Hotspots (3D & 2D)
    const hotspots = db.prepare(`
      SELECT * FROM wo_hotspots 
      WHERE work_order_id = ? 
      ORDER BY created_at ASC
    `).all(woId);

    // 4. Checklist items (10 groups)
    const checklistItems = db.prepare(`
      SELECT * FROM wo_checklist_items 
      WHERE work_order_id = ? 
      ORDER BY group_name ASC, item_name ASC
    `).all(woId);

    // Group checklist items by group_name
    const checklistGroups: Record<string, any[]> = {};
    checklistItems.forEach((item: any) => {
      if (!checklistGroups[item.group_name]) {
        checklistGroups[item.group_name] = [];
      }
      checklistGroups[item.group_name].push(item);
    });

    // 5. Quotes and Items
    const quotes = db.prepare(`
      SELECT * FROM wo_quotes 
      WHERE work_order_id = ? 
      ORDER BY version_number DESC
    `).all(woId) as any[];

    const quotesWithItems = quotes.map(q => {
      const items = db.prepare(`
        SELECT * FROM wo_quote_items 
        WHERE quote_id = ? 
        ORDER BY is_indivisible DESC, created_at ASC
      `).all(q.id);
      return { ...q, items };
    });

    // 6. Customer Decisions
    const customerDecisions = db.prepare(`
      SELECT * FROM wo_customer_decisions 
      WHERE work_order_id = ? 
      ORDER BY created_at DESC
    `).all(woId);

    // 7. Exit checklist
    const exitChecklist = db.prepare("SELECT * FROM wo_exit_checklist WHERE work_order_id = ?").get(woId) as any;

    // 8. Timeline
    const timeline = db.prepare(`
      SELECT * FROM wo_timeline_events 
      WHERE work_order_id = ? 
      ORDER BY created_at ASC
    `).all(woId);

    // 9. Replaced parts ("PEÇA TROCADA")
    const replacedParts = db.prepare(`
      SELECT * FROM wo_replaced_parts
      WHERE work_order_id = ?
      ORDER BY replaced_at DESC
    `).all(woId);

    // 10. Component inspections with measurements
    const componentInspections = db.prepare(`
      SELECT i.*, c.component_name, c.assembly_name, c.system_group, c.position_side, c.axle, c.mesh_id
      FROM wo_component_inspections i
      JOIN vehicle_components c ON i.component_id = c.id
      WHERE i.work_order_id = ?
      ORDER BY i.inspected_at DESC
    `).all(woId);

    // 11. Vehicle multi-visit inspection history (preserves previous visits and photos without overwriting)
    const vehicleVisitsHistory = db.prepare(`
      SELECT v.*, w.os_number, w.status as os_status
      FROM wo_inspection_visits v
      LEFT JOIN work_orders w ON v.work_order_id = w.id
      WHERE v.vehicle_id = ?
      ORDER BY v.visit_number DESC, v.created_at DESC
    `).all(wo.vehicle_id);

    // 12. WhatsApp Notification History
    const notificationHistory = db.prepare(`
      SELECT * FROM notification_history
      WHERE work_order_id = ?
      ORDER BY sent_at DESC
    `).all(woId);

    // 13. Uploaded Visit Photos with individual photo_id and file_sha256
    const currentOsPhotos = db.prepare(`
      SELECT * FROM wo_visit_photos
      WHERE work_order_id = ?
      ORDER BY created_at ASC
    `).all(woId);

    const vehicleVisitPhotos = db.prepare(`
      SELECT p.*, w.os_number
      FROM wo_visit_photos p
      LEFT JOIN work_orders w ON p.work_order_id = w.id
      WHERE p.vehicle_id = ?
      ORDER BY p.visit_number DESC, p.created_at ASC
    `).all(wo.vehicle_id);

    return NextResponse.json({
      success: true,
      work_order: wo,
      intake,
      hotspots,
      checklist_groups: checklistGroups,
      quotes: quotesWithItems,
      customer_decisions: customerDecisions,
      exit_checklist: exitChecklist,
      timeline,
      replaced_parts: replacedParts,
      component_inspections: componentInspections,
      vehicle_visits_history: vehicleVisitsHistory,
      notification_history: notificationHistory,
      current_os_photos: currentOsPhotos,
      vehicle_visit_photos: vehicleVisitPhotos
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const db = getDb();

    const wo = db.prepare("SELECT id, status, os_number FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const {
      status,
      priority,
      assigned_mechanic_id,
      initial_scope,
      customer_complaint,
      diagnostic_fee,
      diagnostic_notes,
      belongings_declared,
      keys_received
    } = body;

    const updates: string[] = ["updated_at = datetime('now', 'localtime')"];
    const params: any[] = [];

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push("priority = ?");
      params.push(priority);
    }
    if (assigned_mechanic_id !== undefined) {
      updates.push("assigned_mechanic_id = ?");
      params.push(assigned_mechanic_id);
    }
    if (initial_scope !== undefined) {
      updates.push("initial_scope = ?");
      params.push(initial_scope);
    }
    if (customer_complaint !== undefined) {
      updates.push("customer_complaint = ?");
      params.push(customer_complaint);
    }
    if (diagnostic_fee !== undefined) {
      updates.push("diagnostic_fee = ?");
      params.push(diagnostic_fee);
    }
    if (diagnostic_notes !== undefined) {
      updates.push("diagnostic_notes = ?");
      params.push(diagnostic_notes);
    }
    if (belongings_declared !== undefined) {
      updates.push("belongings_declared = ?");
      params.push(belongings_declared);
    }
    if (keys_received !== undefined) {
      updates.push("keys_received = ?");
      params.push(keys_received ? 1 : 0);
    }

    params.push(wo.id);

    db.prepare(`UPDATE work_orders SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    // If status changed, record timeline event and audit
    if (status && status !== wo.status) {
      db.prepare(`
        INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `tl-${Date.now()}`,
        wo.id,
        "STATUS_CHANGE",
        `Status alterado para: ${status.toUpperCase()}`,
        `Transição de ${wo.status} para ${status} realizada no painel da oficina.`,
        "Giovane Ribeiro",
        "gestor"
      );

      db.prepare(`
        INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}`,
        "gtech-paranagua",
        "work_orders",
        wo.id,
        "UPDATE_STATUS",
        "Giovane Ribeiro",
        "gestor",
        JSON.stringify({ oldStatus: wo.status, newStatus: status }),
        generateHash({ woId: wo.id, oldStatus: wo.status, newStatus: status })
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ordem de serviço atualizada com sucesso!"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

