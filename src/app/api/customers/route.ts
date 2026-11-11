import { NextRequest, NextResponse } from "next/server";
import { getDb, generateToken } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const db = getDb();
    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) as total_vehicles,
        (SELECT COUNT(*) FROM work_orders wo WHERE wo.customer_id = c.id) as total_work_orders,
        (SELECT MAX(created_at) FROM work_orders wo WHERE wo.customer_id = c.id) as last_visit_at,
        (SELECT GROUP_CONCAT(v.brand || ' ' || v.model || ' (' || v.plate || ')', ' • ') FROM vehicles v WHERE v.customer_id = c.id) as vehicles_summary
      FROM customers c
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.document LIKE ? OR c.email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY c.created_at DESC`;

    const customers = db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, document, notes } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: "Nome e telefone são obrigatórios." },
        { status: 400 }
      );
    }

    const db = getDb();
    const customerId = `cust-${Date.now().toString(36)}-${generateToken().slice(0, 6)}`;

    db.prepare(`
      INSERT INTO customers (
        id, company_id, name, phone, email, document, notes, preferred_contact_channel
      ) VALUES (?, 'comp-gtech-matriz', ?, ?, ?, ?, ?, 'whatsapp')
    `).run(
      customerId,
      name.trim(),
      phone.trim(),
      email ? email.trim() : null,
      document ? document.trim() : null,
      notes ? notes.trim() : null
    );

    const created = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId);

    return NextResponse.json({
      success: true,
      customer: created
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

