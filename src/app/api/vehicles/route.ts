import { NextRequest, NextResponse } from "next/server";
import { getDb, generateToken } from "@/lib/db";
import { resolveCanonicalVehicle } from "@/lib/canonical-vehicle";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const db = getDb();
    let query = `
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
        m.audit_status as glb_audit_status,
        m.origin_type as glb_origin_type
      FROM vehicles v
      LEFT JOIN customers c ON v.customer_id = c.id
      LEFT JOIN vehicle_3d_models m ON m.vehicle_key = v.vehicle_key AND m.audit_status IN ('aprovado', 'aprovado_verificado')
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (v.plate LIKE ? OR v.model LIKE ? OR v.brand LIKE ? OR c.name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY v.created_at DESC`;

    const vehicles = db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      count: vehicles.length,
      vehicles
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      plate,
      brand,
      model,
      year,
      motor,
      color,
      km,
      fuel,
      chassis,
      body_type,
      customer_id,
      customer_name,
      customer_phone
    } = body;

    if (!plate || !brand || !model) {
      return NextResponse.json(
        { success: false, error: "Placa, marca e modelo são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanPlate = plate.toUpperCase().trim();
    const db = getDb();

    // Check if plate already exists
    const existing = db.prepare(`SELECT id FROM vehicles WHERE plate = ?`).get(cleanPlate);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Já existe um veículo cadastrado com a placa ${cleanPlate}.` },
        { status: 409 }
      );
    }

    let resolvedCustomerId = customer_id;

    // Create customer if needed
    if (!resolvedCustomerId && customer_name && customer_phone) {
      const existingCustomer = db.prepare(
        `SELECT id FROM customers WHERE phone = ? OR name = ?`
      ).get(customer_phone.trim(), customer_name.trim()) as { id: string } | undefined;

      if (existingCustomer) {
        resolvedCustomerId = existingCustomer.id;
      } else {
        resolvedCustomerId = `cust-${Date.now().toString(36)}-${generateToken().slice(0, 6)}`;
        db.prepare(`
          INSERT INTO customers (id, company_id, name, phone, preferred_contact_channel)
          VALUES (?, 'comp-gtech-matriz', ?, ?, 'whatsapp')
        `).run(resolvedCustomerId, customer_name.trim(), customer_phone.trim());
      }
    }

    const canonical = resolveCanonicalVehicle({ brand, model });
    const vehicleId = `veh-${Date.now().toString(36)}-${generateToken().slice(0, 6)}`;

    db.prepare(`
      INSERT INTO vehicles (
        id, customer_id, plate, brand, model, year, motor, color, km, fuel, chassis, body_type, vehicle_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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

    const created = db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicleId);

    return NextResponse.json({
      success: true,
      vehicle: created
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

