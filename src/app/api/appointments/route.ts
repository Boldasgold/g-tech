import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

// Standard Paranaguá operating hours: 08:00-11:30 and 13:30-17:30 (30-min slots)
const OPERATING_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
];

function generateNextProtocol(db: any): string {
  const currentYear = new Date().getFullYear();
  const last = db.prepare(`
    SELECT protocol FROM appointments 
    WHERE protocol LIKE ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(`GT-${currentYear}-%`) as { protocol?: string } | undefined;

  let nextSeq = 1;
  if (last?.protocol) {
    const match = last.protocol.match(/GT-\d{4}-(\d+)/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }
  const padded = String(nextSeq).padStart(4, "0");
  return `GT-${currentYear}-${padded}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      // Return recent appointments for management
      const db = getDb();
      const appointments = db.prepare(`
        SELECT * FROM appointments 
        ORDER BY scheduled_date DESC, scheduled_time ASC
      `).all();
      return NextResponse.json({ success: true, appointments });
    }

    const db = getDb();
    // Get booked slots for the date
    const booked = db.prepare(`
      SELECT scheduled_time 
      FROM appointments 
      WHERE scheduled_date = ? AND status != 'cancelado'
    `).all(date) as Array<{ scheduled_time: string }>;

    const bookedSet = new Set(booked.map(b => b.scheduled_time));

    const slots = OPERATING_SLOTS.map(time => ({
      time,
      available: !bookedSet.has(time),
      period: time < "12:00" ? "Manhã (08h às 12h)" : "Tarde (13h30 às 18h)"
    }));

    return NextResponse.json({
      success: true,
      date,
      total_slots: OPERATING_SLOTS.length,
      available_count: slots.filter(s => s.available).length,
      slots
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_name,
      customer_phone,
      vehicle_brand,
      vehicle_model,
      vehicle_plate,
      scheduled_date,
      scheduled_time,
      period,
      issue_description,
      dashboard_alert,
      mobility
    } = body;

    if (!customer_name || !customer_phone || !vehicle_brand || !vehicle_model || !scheduled_date || !scheduled_time) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios ausentes para o agendamento." },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check concurrency slot collision
    const existing = db.prepare(`
      SELECT id FROM appointments 
      WHERE scheduled_date = ? AND scheduled_time = ? AND status != 'cancelado'
    `).get(scheduled_date, scheduled_time);

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Este horário acabou de ser reservado por outro cliente. Por favor, selecione outro horário." },
        { status: 409 }
      );
    }

    const protocol = generateNextProtocol(db);
    const appointmentId = `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    db.prepare(`
      INSERT INTO appointments (
        id, company_id, protocol, customer_name, customer_phone,
        vehicle_brand, vehicle_model, vehicle_plate,
        scheduled_date, scheduled_time, period,
        issue_description, dashboard_alert, mobility, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appointmentId,
      "gtech-paranagua",
      protocol,
      customer_name.trim(),
      customer_phone.trim(),
      vehicle_brand.trim(),
      vehicle_model.trim(),
      vehicle_plate ? vehicle_plate.trim().toUpperCase() : null,
      scheduled_date,
      scheduled_time,
      period || (scheduled_time < "12:00" ? "Manhã" : "Tarde"),
      issue_description ? issue_description.trim() : "Avaliação geral e diagnóstico",
      dashboard_alert || null,
      mobility || "Vou levar o veículo até a oficina",
      "pendente"
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      "gtech-paranagua",
      "appointments",
      appointmentId,
      "BOOK_APPOINTMENT",
      customer_name,
      "cliente_web",
      JSON.stringify({ protocol, date: scheduled_date, time: scheduled_time, vehicle: `${vehicle_brand} ${vehicle_model}` }),
      generateHash({ protocol, customer_phone, scheduled_date, scheduled_time })
    );

    // Formatted WhatsApp message
    const alertText = dashboard_alert ? `\n⚠️ *Alerta no Painel:* ${dashboard_alert}` : "";
    const plateText = vehicle_plate ? ` (${vehicle_plate.toUpperCase()})` : "";
    const whatsAppMessage = 
      `*G-TECH SERVIÇOS AUTOMOTIVOS*\n` +
      `*Novo Agendamento Confirmado no Site*\n\n` +
      `📋 *Protocolo:* ${protocol}\n` +
      `👤 *Cliente:* ${customer_name}\n` +
      `📱 *Telefone:* ${customer_phone}\n` +
      `🚗 *Veículo:* ${vehicle_brand} ${vehicle_model}${plateText}\n` +
      `📅 *Data:* ${scheduled_date} às ${scheduled_time} (${period || "Horário Marcado"})\n` +
      `📍 *Locomoção:* ${mobility || "Vou levar até a oficina"}${alertText}\n` +
      `🔧 *Relato do Cliente:* ${issue_description || "Avaliação técnica"}\n\n` +
      `_Solicitação registrada no sistema com garantia de vaga. Aguardo instruções da oficina!_`;

    const encodedMsg = encodeURIComponent(whatsAppMessage);
    const whatsappUrl = `https://wa.me/554196522715?text=${encodedMsg}`;

    return NextResponse.json({
      success: true,
      protocol,
      appointment_id: appointmentId,
      scheduled_date,
      scheduled_time,
      whatsapp_url: whatsappUrl,
      message: "Agendamento registrado com sucesso no banco de dados da G-Tech!"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

