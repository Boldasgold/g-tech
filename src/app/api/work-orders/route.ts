import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

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
  const last = db.prepare(`
    SELECT os_number FROM work_orders 
    ORDER BY created_at DESC LIMIT 1
  `).get() as { os_number?: string } | undefined;

  let nextSeq = 128;
  if (last?.os_number) {
    const match = last.os_number.match(/GT-OS-(\d+)/);
    if (match) {
      nextSeq = Math.max(nextSeq, parseInt(match[1], 10) + 1);
    }
  }
  const padded = String(nextSeq).padStart(6, "0");
  return `GT-OS-${padded}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const db = getDb();
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

    // 2. Create vehicle
    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate, brand, model, year, km, fuel, body_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vehicleId,
      finalCustId,
      vehicle_plate ? vehicle_plate.toUpperCase() : null,
      vehicle_brand,
      vehicle_model,
      vehicle_year || null,
      vehicle_km || null,
      vehicle_fuel || "flex",
      vehicle_body_type || "hatch"
    );

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
      vehicleId,
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

