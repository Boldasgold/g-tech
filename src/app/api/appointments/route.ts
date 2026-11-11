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
      mobility,
      idempotency_key
    } = body;

    if (!customer_name || !customer_phone || !vehicle_brand || !vehicle_model || !scheduled_date || !scheduled_time) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios ausentes para o agendamento." },
        { status: 400 }
      );
    }

    const cleanPhone = customer_phone.trim();
    const effectiveIdempotencyKey = idempotency_key || generateHash({
      phone: cleanPhone,
      date: scheduled_date,
      time: scheduled_time,
      plate: vehicle_plate || ""
    });

    // 1. Resiliência Offline: Se o serviço da oficina estiver simulando queda ou indisponível
    if (process.env.SIMULATE_WORKSHOP_OUTAGE === "true") {
      const db = getDb();
      const syncId = `sync-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      db.prepare(`
        INSERT INTO site_pending_sync_queue (
          sync_id, idempotency_key, entity_type, payload_json,
          status, attempt_count, last_attempt_at, error_log, created_at
        ) VALUES (?, ?, 'appointment', ?, 'pending', 1, ?, 'Oficina temporariamente indisponível - fila local', ?)
      `).run(syncId, effectiveIdempotencyKey, JSON.stringify(body), new Date().toISOString(), new Date().toISOString());

      return NextResponse.json({
        success: true,
        status: "preservado_offline_fila",
        protocol: `OFFLINE-${syncId.slice(-6)}`,
        message: "A oficina está temporariamente sem conexão externa, mas sua solicitação foi armazenada na fila segura com sucesso e será confirmada pela equipe assim que restabelecida."
      }, { status: 202 });
    }

    const db = getDb();

    // 2. Verificação de Idempotência: Evita cadastros e solicitações duplicadas
    const existingByIdempotency = db.prepare(`
      SELECT protocol, scheduled_date, scheduled_time, status 
      FROM appointments 
      WHERE idempotency_key = ?
    `).get(effectiveIdempotencyKey) as any;

    if (existingByIdempotency) {
      return NextResponse.json({
        success: true,
        duplicate_prevented: true,
        protocol: existingByIdempotency.protocol,
        status_label: "Solicitação Recebida — Aguardando Confirmação",
        message: "Sua solicitação de agendamento já foi registrada anteriormente e está aguardando confirmação da equipe da oficina."
      });
    }

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
        issue_description, dashboard_alert, mobility, status,
        idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appointmentId,
      "gtech-paranagua",
      protocol,
      customer_name.trim(),
      cleanPhone,
      vehicle_brand.trim(),
      vehicle_model.trim(),
      vehicle_plate ? vehicle_plate.trim().toUpperCase() : null,
      scheduled_date,
      scheduled_time,
      period || (scheduled_time < "12:00" ? "Manhã" : "Tarde"),
      issue_description ? issue_description.trim() : "Avaliação geral e diagnóstico",
      dashboard_alert || null,
      mobility || "Vou levar o veículo até a oficina",
      "pendente",
      effectiveIdempotencyKey
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
      "REQUEST_APPOINTMENT",
      customer_name,
      "cliente_web",
      JSON.stringify({ protocol, date: scheduled_date, time: scheduled_time, vehicle: `${vehicle_brand} ${vehicle_model}`, idempotency_key: effectiveIdempotencyKey }),
      generateHash({ protocol, customer_phone: cleanPhone, scheduled_date, scheduled_time })
    );

    // Formatted WhatsApp message: Solicitação recebida — NUNCA declarado confirmado prematuramente
    const alertText = dashboard_alert ? `\n⚠️ *Alerta no Painel:* ${dashboard_alert}` : "";
    const plateText = vehicle_plate ? ` (${vehicle_plate.toUpperCase()})` : "";
    const whatsAppMessage = 
      `*G-TECH SERVIÇOS AUTOMOTIVOS*\n` +
      `*Solicitação de Agendamento Recebida no Site*\n\n` +
      `📋 *Protocolo:* ${protocol}\n` +
      `👤 *Cliente:* ${customer_name}\n` +
      `📱 *Telefone:* ${customer_phone}\n` +
      `🚗 *Veículo:* ${vehicle_brand} ${vehicle_model}${plateText}\n` +
      `📅 *Data Solicitada:* ${scheduled_date} às ${scheduled_time} (${period || "Horário Desejado"})\n` +
      `📍 *Locomoção:* ${mobility || "Vou levar até a oficina"}${alertText}\n` +
      `🔧 *Relato do Cliente:* ${issue_description || "Avaliação técnica"}\n\n` +
      `_Solicitação recebida no sistema. Aguardando confirmação oficial da oficina G-Tech!_`;

    const encodedMsg = encodeURIComponent(whatsAppMessage);
    const whatsappUrl = `https://wa.me/554196522715?text=${encodedMsg}`;

    return NextResponse.json({
      success: true,
      protocol,
      appointment_id: appointmentId,
      scheduled_date,
      scheduled_time,
      whatsapp_url: whatsappUrl,
      status: "solicitado",
      status_label: "Solicitação Recebida — Aguardando Confirmação da Oficina",
      message: "Solicitação de agendamento recebida com sucesso! A equipe da oficina G-Tech entrará em contato para confirmação oficial."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

