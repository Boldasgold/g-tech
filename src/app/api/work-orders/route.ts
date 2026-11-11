import { NextRequest, NextResponse } from "next/server";
import { resolveCanonicalVehicle } from "@/lib/canonical-vehicle";
import { getDb, generateHash, generateToken } from "@/lib/db";

const DEFAULT_CHECKLIST_TEMPLATE = [
  // Freios
  { group: "freios", item: "Pastilhas e Discos de Freio Dianteiros" },
  { group: "freios", item: "Lonas, Tambores e Sapatas Traseiras" },
  { group: "freios", item: "Fluido de Freio (Ponto de Ebulição e Contaminação)" },
  { group: "freios", item: "Flexíveis e Cilindros de Roda" },
  // Arrefecimento
  { group: "arrefecimento", item: "Nível e Concentração do Aditivo de Arrefecimento" },
  { group: "arrefecimento", item: "Válvula Termostática e Eletroventilador" },
  { group: "arrefecimento", item: "Mangueiras e Teste de Estanqueidade / Pressão" },
  // Elétrica
  { group: "eletrica", item: "Bateria (CCA, Tensão e Teste de Condutância)" },
  { group: "eletrica", item: "Alternador (Tensão de Carga e Diodo Ripple)" },
  { group: "eletrica", item: "Iluminação Externa e Painel de Instrumentos" },
  // Lubrificação
  { group: "lubrificacao", item: "Óleo do Motor (Viscosidade, Nível e Quilometragem)" },
  { group: "lubrificacao", item: "Filtro de Óleo, Filtro de Ar e Filtro de Combustível" },
  // Pneus
  { group: "pneus", item: "Profundidade dos Sulcos (TWI) e Calibragem" },
  { group: "pneus", item: "Estado Geral, Deformações e Estepe" },
  // Direção
  { group: "direcao", item: "Terminais de Direção e Barras Axiais" },
  { group: "direcao", item: "Caixa de Direção e Coifas Protetoras" },
  { group: "direcao", item: "Fluido da Direção Hidráulica / Elétrica" },
  // Suspensão
  { group: "suspensao", item: "Amortecedores e Batentes / Coifas" },
  { group: "suspensao", item: "Bieletas e Buchas da Barra Estabilizadora" },
  { group: "suspensao", item: "Bandejas e Pivôs de Suspensão" },
  // Carroceria
  { group: "carroceria", item: "Alinhamento de Painéis e Fechamento de Portas" },
  { group: "carroceria", item: "Palhetas do Limpador e Reservatório do Lavador" },
  // Motor
  { group: "motor", item: "Correia Dentada / Corrente de Sincronismo e Tensor" },
  { group: "motor", item: "Correia de Acessórios e Velas de Ignição" },
  // Diagnóstico
  { group: "diagnostico", item: "Varredura Completa de DTCs via Scanner Avançado" },
  { group: "diagnostico", item: "Rede Multiplexada CAN/LIN e Parâmetros em Tempo Real" }
];

function generateNextOsNumber(db: any): string {
  const rows = db.prepare(`SELECT os_number FROM work_orders`).all() as Array<{ os_number?: string }>;
  let maxSeq = 135;
  for (const r of rows) {
    const match = (r.os_number || "").match(/GT-OS-(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  const padded = String(maxSeq + 1).padStart(6, "0");
  return `GT-OS-${padded}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const db = getDb();

    // VIEW: CARS / VEHICLES
    if (view === "vehicles") {
      let vQuery = `
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
      `;
      const vParams: any[] = [];
      if (search) {
        vQuery += ` AND (v.plate LIKE ? OR v.model LIKE ? OR v.brand LIKE ? OR c.name LIKE ?)`;
        const term = `%${search}%`;
        vParams.push(term, term, term, term);
      }
      vQuery += ` ORDER BY v.created_at DESC`;
      const vehicles = db.prepare(vQuery).all(...vParams);
      return NextResponse.json({ success: true, count: vehicles.length, vehicles });
    }

    // VIEW: CUSTOMERS
    if (view === "customers") {
      let cQuery = `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) as total_vehicles,
          (SELECT COUNT(*) FROM work_orders wo WHERE wo.customer_id = c.id) as total_work_orders,
          (SELECT MAX(created_at) FROM work_orders wo WHERE wo.customer_id = c.id) as last_visit_at,
          (SELECT GROUP_CONCAT(v.brand || ' ' || v.model || ' (' || v.plate || ')', ' • ') FROM vehicles v WHERE v.customer_id = c.id) as vehicles_summary
        FROM customers c
        WHERE 1=1
      `;
      const cParams: any[] = [];
      if (search) {
        cQuery += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.document LIKE ? OR c.email LIKE ?)`;
        const term = `%${search}%`;
        cParams.push(term, term, term, term);
      }
      cQuery += ` ORDER BY c.created_at DESC`;
      const customers = db.prepare(cQuery).all(...cParams);
      return NextResponse.json({ success: true, count: customers.length, customers });
    }

    // VIEW: MAINTENANCES / SERVIÇOS EXECUTADOS
    if (view === "maintenances") {
      let mQuery = `
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
      `;
      const mParams: any[] = [];
      if (status && status !== "todos") {
        mQuery += ` AND wo.status = ?`;
        mParams.push(status);
      }
      if (search) {
        mQuery += ` AND (wo.os_number LIKE ? OR c.name LIKE ? OR v.plate LIKE ? OR v.model LIKE ?)`;
        const term = `%${search}%`;
        mParams.push(term, term, term, term);
      }
      mQuery += ` ORDER BY wo.created_at DESC`;
      const maintenances = db.prepare(mQuery).all(...mParams);
      return NextResponse.json({ success: true, count: maintenances.length, maintenances });
    }

    // DEFAULT VIEW: WORK ORDERS
    let query = `
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
    `;
    const params: any[] = [];

    if (status && status !== "todos") {
      query += ` AND wo.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (wo.os_number LIKE ? OR c.name LIKE ? OR v.plate LIKE ? OR v.model LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY wo.created_at DESC`;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

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
        return NextResponse.json({ success: false, error: `Já existe um veículo com a placa ${cleanPlate}.` }, { status: 409 });
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
      db.prepare(`
        INSERT INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, chassis, body_type, vehicle_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      db.prepare(`
        INSERT INTO customers (id, company_id, name, phone, email, document, notes, preferred_contact_channel)
        VALUES (?, 'comp-gtech-matriz', ?, ?, ?, ?, ?, 'whatsapp')
      `).run(
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
      const {
      appointment_id,
      customer_name,
      customer_phone,
      customer_document,
      vehicle_brand,
      vehicle_model,
      vehicle_plate,
      vehicle_year,
      vehicle_km,
      vehicle_fuel,
      vehicle_body_type,
      initial_scope,
      customer_complaint,
      diagnostic_authorized = 1,
      diagnostic_fee = 0.0,
      assigned_mechanic_id = "user-giovane"
    } = body;

    const db = getDb();
    const osNumber = generateNextOsNumber(db);
    const woId = `wo-${Date.now()}`;
    const customerId = `cust-${Date.now()}`;
    const vehicleId = `veh-${Date.now()}`;

    // 1. Create or link customer
    let existingCustomer = db.prepare("SELECT id FROM customers WHERE phone = ?").get(customer_phone) as { id: string } | undefined;
    let finalCustId = existingCustomer ? existingCustomer.id : customerId;

    if (!existingCustomer) {
      db.prepare(`
        INSERT INTO customers (id, company_id, name, phone, document, preferred_contact_channel)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(finalCustId, "gtech-paranagua", customer_name, customer_phone, customer_document || null, "whatsapp");
    }

    // 2. Create or reuse vehicle by plate (preserving vehicle history across multiple visits)
    const normalizedPlate = vehicle_plate ? vehicle_plate.trim().toUpperCase() : null;
    let existingVeh = normalizedPlate
      ? (db.prepare("SELECT id FROM vehicles WHERE plate = ?").get(normalizedPlate) as { id: string } | undefined)
      : undefined;
    let finalVehicleId = existingVeh ? existingVeh.id : vehicleId;

    if (existingVeh) {
      db.prepare(`
        UPDATE vehicles SET km = COALESCE(?, km), customer_id = ? WHERE id = ?
      `).run(vehicle_km || null, finalCustId, finalVehicleId);
    } else {
      db.prepare(`
        INSERT INTO vehicles (id, customer_id, plate, brand, model, year, km, fuel, body_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalVehicleId,
        finalCustId,
        normalizedPlate,
        vehicle_brand,
        vehicle_model,
        vehicle_year || null,
        vehicle_km || null,
        vehicle_fuel || "flex",
        vehicle_body_type || "hatch"
      );
    }

    // 3. Create Work Order
    db.prepare(`
      INSERT INTO work_orders (
        id, company_id, os_number, appointment_id, customer_id, vehicle_id,
        assigned_mechanic_id, initial_scope, customer_complaint,
        diagnostic_authorized, diagnostic_fee, km_entry, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      woId,
      "gtech-paranagua",
      osNumber,
      appointment_id || null,
      finalCustId,
      finalVehicleId,
      assigned_mechanic_id,
      initial_scope || "Diagnóstico eletrônico avançado e vistoria completa",
      customer_complaint || "Revisão geral / sintoma relatado",
      diagnostic_authorized ? 1 : 0,
      diagnostic_fee || 0.0,
      vehicle_km || null,
      "aberta"
    );

    // If converted from appointment, update appointment status
    if (appointment_id) {
      db.prepare(`
        UPDATE appointments 
        SET status = 'convertido_os', work_order_id = ? 
        WHERE id = ?
      `).run(woId, appointment_id);
    }

    // 4. Initialize Intake Inspection
    const intakeId = `intake-${Date.now()}`;
    db.prepare(`
      INSERT INTO wo_intake_inspection (
        id, work_order_id, odometer_km, fuel_pct, responsible_name
      ) VALUES (?, ?, ?, ?, ?)
    `).run(intakeId, woId, vehicle_km || 0, 50, "Giovane Ribeiro");

    // 5. Populate standard 10-group checklist items
    const insertChecklist = db.prepare(`
      INSERT INTO wo_checklist_items (
        id, work_order_id, group_name, item_name, status, mechanic_name
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    DEFAULT_CHECKLIST_TEMPLATE.forEach((chk, index) => {
      insertChecklist.run(`chk-${woId}-${index + 1}`, woId, chk.group, chk.item, "NAO_INSPECIONADO", "Giovane Ribeiro");
    });

    // 6. Record timeline event
    db.prepare(`
      INSERT INTO wo_timeline_events (id, work_order_id, event_type, title, description, actor_name, actor_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tl-${Date.now()}`,
      woId,
      "OS_CRIADA",
      `Ordem de Serviço ${osNumber} Aberta`,
      appointment_id 
        ? `OS gerada a partir do agendamento web. Veículo ${vehicle_brand} ${vehicle_model} recebido na oficina.`
        : `Atendimento direto sem agendamento prévio. Veículo ${vehicle_brand} ${vehicle_model} recebido na oficina.`,
      "Giovane Ribeiro",
      "gestor"
    );

    // 7. Audit log
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "work_orders",
      woId,
      "CREATE_WORK_ORDER",
      "Giovane Ribeiro",
      "gestor",
      JSON.stringify({ os_number: osNumber, customer: customer_name, vehicle: `${vehicle_brand} ${vehicle_model}` }),
      generateHash({ osNumber, woId, customer_name })
    );

    return NextResponse.json({
      success: true,
      work_order_id: woId,
      os_number: osNumber,
      message: `Ordem de Serviço ${osNumber} criada com sucesso!`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

