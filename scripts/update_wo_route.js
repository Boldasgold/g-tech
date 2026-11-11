const fs = require('fs');
const path = require('path');

const woRoutePath = path.resolve('C:/Users/tiujo/Desktop/g-tech/src/app/api/work-orders/route.ts');
let content = fs.readFileSync(woRoutePath, 'utf8');

// Ensure imports
if (!content.includes('generateToken')) {
  content = content.replace('generateHash } from "@/lib/db";', 'generateHash, generateToken } from "@/lib/db";');
}
if (!content.includes('resolveCanonicalVehicle')) {
  content = content.replace('import { getDb', 'import { resolveCanonicalVehicle } from "@/lib/canonical-vehicle";\nimport { getDb');
}

// Enhance GET
const getStart = content.indexOf('export async function GET(req: NextRequest) {');
const getEnd = content.indexOf('export async function POST(req: NextRequest) {');

if (getStart !== -1 && getEnd !== -1) {
  const newGet = `export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const db = getDb();

    // VIEW: CARS / VEHICLES
    if (view === "vehicles") {
      let vQuery = \`
        SELECT 
          v.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.document as customer_document,
          (SELECT COUNT(*) FROM work_orders wo WHERE wo.vehicle_id = v.id) as total_work_orders,
          (SELECT MAX(created_at) FROM work_orders wo WHERE wo.vehicle_id = v.id) as last_maintenance_at,
          (SELECT id FROM work_orders wo WHERE wo.vehicle_id = v.id ORDER BY created_at DESC LIMIT 1) as latest_wo_id,
          (SELECT os_number FROM work_orders wo WHERE wo.vehicle_id = v.id ORDER BY created_at DESC LIMIT 1) as latest_os_number,
          (SELECT status FROM work_orders wo WHERE wo.vehicle_id = v.id ORDER BY created_at DESC LIMIT 1) as latest_wo_status,
          m.file_name as glb_file_name,
          m.file_url as glb_file_url,
          m.file_sha256 as glb_file_sha256,
          m.audit_status as glb_audit_status,
          m.origin_type as glb_origin_type
        FROM vehicles v
        LEFT JOIN customers c ON v.customer_id = c.id
        LEFT JOIN vehicle_3d_models m ON (m.vehicle_key = v.vehicle_key OR m.vehicle_key = ('volkswagen_' || v.vehicle_key) OR m.vehicle_key = ('chevrolet_' || v.vehicle_key)) AND m.audit_status IN ('aprovado', 'aprovado_verificado')
        WHERE 1=1
      \`;
      const vParams: any[] = [];
      if (search) {
        vQuery += \` AND (v.plate LIKE ? OR v.model LIKE ? OR v.brand LIKE ? OR c.name LIKE ?)\`;
        const term = \`%\${search}%\`;
        vParams.push(term, term, term, term);
      }
      vQuery += \` ORDER BY v.created_at DESC\`;
      const vehicles = db.prepare(vQuery).all(...vParams);
      return NextResponse.json({ success: true, count: vehicles.length, vehicles });
    }

    // VIEW: CUSTOMERS
    if (view === "customers") {
      let cQuery = \`
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) as total_vehicles,
          (SELECT COUNT(*) FROM work_orders wo WHERE wo.customer_id = c.id) as total_work_orders,
          (SELECT MAX(created_at) FROM work_orders wo WHERE wo.customer_id = c.id) as last_visit_at,
          (SELECT GROUP_CONCAT(v.brand || ' ' || v.model || ' (' || v.plate || ')', ' • ') FROM vehicles v WHERE v.customer_id = c.id) as vehicles_summary
        FROM customers c
        WHERE 1=1
      \`;
      const cParams: any[] = [];
      if (search) {
        cQuery += \` AND (c.name LIKE ? OR c.phone LIKE ? OR c.document LIKE ? OR c.email LIKE ?)\`;
        const term = \`%\${search}%\`;
        cParams.push(term, term, term, term);
      }
      cQuery += \` ORDER BY c.created_at DESC\`;
      const customers = db.prepare(cQuery).all(...cParams);
      return NextResponse.json({ success: true, count: customers.length, customers });
    }

    // VIEW: MAINTENANCES / SERVIÇOS EXECUTADOS
    if (view === "maintenances") {
      let mQuery = \`
        SELECT 
          wo.id as work_order_id,
          wo.os_number,
          wo.status,
          wo.initial_scope,
          wo.customer_complaint,
          wo.created_at,
          wo.km_entry,
          c.id as customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          v.id as vehicle_id,
          v.brand as vehicle_brand,
          v.model as vehicle_model,
          v.plate as vehicle_plate,
          v.year as vehicle_year,
          v.vehicle_key,
          q.total_amount as quote_total,
          (SELECT COUNT(*) FROM wo_replaced_parts rp WHERE rp.work_order_id = wo.id) as replaced_parts_count,
          (SELECT GROUP_CONCAT(rp.component_name || ' [' || rp.warranty_terms || ']', ' • ') FROM wo_replaced_parts rp WHERE rp.work_order_id = wo.id) as parts_summary,
          (SELECT COUNT(*) FROM wo_checklist_items ci WHERE ci.work_order_id = wo.id) as checklist_items_count
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        JOIN vehicles v ON wo.vehicle_id = v.id
        LEFT JOIN wo_quotes q ON q.work_order_id = wo.id AND q.version_number = (
          SELECT MAX(version_number) FROM wo_quotes WHERE work_order_id = wo.id
        )
        WHERE 1=1
      \`;
      const mParams: any[] = [];
      if (status && status !== "todos") {
        mQuery += \` AND wo.status = ?\`;
        mParams.push(status);
      }
      if (search) {
        mQuery += \` AND (wo.os_number LIKE ? OR c.name LIKE ? OR v.plate LIKE ? OR v.model LIKE ?)\`;
        const term = \`%\${search}%\`;
        mParams.push(term, term, term, term);
      }
      mQuery += \` ORDER BY wo.created_at DESC\`;
      const maintenances = db.prepare(mQuery).all(...mParams);
      return NextResponse.json({ success: true, count: maintenances.length, maintenances });
    }

    // DEFAULT VIEW: WORK ORDERS
    let query = \`
      SELECT 
        wo.*,
        c.name as customer_name,
        c.phone as customer_phone,
        v.brand as vehicle_brand,
        v.model as vehicle_model,
        v.plate as vehicle_plate,
        v.year as vehicle_year,
        v.body_type as vehicle_body_type,
        u.name as mechanic_name,
        q.id as active_quote_id,
        q.total_amount as quote_total,
        q.status as quote_status,
        q.public_token as quote_token
      FROM work_orders wo
      JOIN customers c ON wo.customer_id = c.id
      JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.assigned_mechanic_id = u.id
      LEFT JOIN wo_quotes q ON q.work_order_id = wo.id AND q.version_number = (
        SELECT MAX(version_number) FROM wo_quotes WHERE work_order_id = wo.id
      )
      WHERE 1=1
    \`;
    const params: any[] = [];

    if (status && status !== "todos") {
      query += \` AND wo.status = ?\`;
      params.push(status);
    }

    if (search) {
      query += \` AND (wo.os_number LIKE ? OR c.name LIKE ? OR v.plate LIKE ? OR v.model LIKE ?)\`;
      const term = \`%\${search}%\`;
      params.push(term, term, term, term);
    }

    query += \` ORDER BY wo.created_at DESC\`;

    const workOrders = db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      count: workOrders.length,
      work_orders: workOrders
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

`;
  content = content.substring(0, getStart) + newGet + content.substring(getEnd);
  console.log('GET /api/work-orders enhanced with views!');
}

// Enhance POST with action handlers
const postStart = content.indexOf('export async function POST(req: NextRequest) {\n  try {\n    const body = await req.json();');
if (postStart !== -1) {
  const insertPos = content.indexOf('const body = await req.json();', postStart) + 31;
  const actionHandler = `
    // Action handler for creating vehicle directly
    if (body.action === "create_vehicle") {
      const { plate, brand, model, year, motor, color, km, fuel, chassis, body_type, customer_id, customer_name, customer_phone } = body;
      if (!plate || !brand || !model) {
        return NextResponse.json({ success: false, error: "Placa, marca e modelo são obrigatórios." }, { status: 400 });
      }
      const cleanPlate = plate.toUpperCase().trim();
      const db = getDb();
      const existing = db.prepare("SELECT id FROM vehicles WHERE plate = ?").get(cleanPlate);
      if (existing) {
        return NextResponse.json({ success: false, error: \`Já existe um veículo com a placa \${cleanPlate}.\` }, { status: 409 });
      }
      let resolvedCustomerId = customer_id;
      if (!resolvedCustomerId && customer_name && customer_phone) {
        const existingCust = db.prepare("SELECT id FROM customers WHERE phone = ?").get(customer_phone.trim()) as any;
        if (existingCust) {
          resolvedCustomerId = existingCust.id;
        } else {
          resolvedCustomerId = "cust-" + Date.now().toString(36) + "-" + generateToken().slice(0, 6);
          db.prepare("INSERT INTO customers (id, company_id, name, phone, preferred_contact_channel) VALUES (?, 'comp-gtech-matriz', ?, ?, 'whatsapp')")
            .run(resolvedCustomerId, customer_name.trim(), customer_phone.trim());
        }
      }
      const canonical = resolveCanonicalVehicle({ brand, model });
      const vehicleId = "veh-" + Date.now().toString(36) + "-" + generateToken().slice(0, 6);
      db.prepare(\`
        INSERT INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, chassis, body_type, vehicle_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`).run(
        vehicleId,
        resolvedCustomerId || null,
        cleanPlate,
        brand.trim(),
        model.trim(),
        year ? String(year).trim() : null,
        motor ? String(motor).trim() : null,
        color ? String(color).trim() : "Prata",
        km ? parseInt(km, 10) : 0,
        fuel || "flex",
        chassis ? String(chassis).trim() : null,
        body_type || canonical.body_type || "hatch",
        canonical.vehicle_key
      );
      const createdVeh = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);
      return NextResponse.json({ success: true, vehicle: createdVeh });
    }

    // Action handler for creating customer directly
    if (body.action === "create_customer") {
      const { name, phone, email, document, notes } = body;
      if (!name || !phone) {
        return NextResponse.json({ success: false, error: "Nome e telefone são obrigatórios." }, { status: 400 });
      }
      const db = getDb();
      const customerId = "cust-" + Date.now().toString(36) + "-" + generateToken().slice(0, 6);
      db.prepare(\`
        INSERT INTO customers (id, company_id, name, phone, email, document, notes, preferred_contact_channel)
        VALUES (?, 'comp-gtech-matriz', ?, ?, ?, ?, ?, 'whatsapp')
      \`).run(
        customerId,
        name.trim(),
        phone.trim(),
        email ? email.trim() : null,
        document ? document.trim() : null,
        notes ? notes.trim() : null
      );
      const createdCust = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
      return NextResponse.json({ success: true, customer: createdCust });
    }
  `;
  content = content.substring(0, insertPos) + actionHandler + content.substring(insertPos);
  console.log('POST /api/work-orders enhanced with action handlers!');
}

fs.writeFileSync(woRoutePath, content, 'utf8');
console.log('work-orders route.ts successfully updated!');

