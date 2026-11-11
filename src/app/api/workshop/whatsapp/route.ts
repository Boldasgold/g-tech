import { NextRequest, NextResponse } from "next/server";
import {
  sendReadyForPickupNotification,
  getNotificationHistoryForWorkOrder,
  getWhatsAppProviderReadiness
} from "@/lib/whatsapp-service";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workOrderId = searchParams.get("work_order_id");
    const db = getDb();
    const readiness = getWhatsAppProviderReadiness();

    if (workOrderId) {
      const wo = db.prepare("SELECT id, os_number, status FROM work_orders WHERE id = ? OR os_number = ?").get(workOrderId, workOrderId) as any;
      const history = wo ? getNotificationHistoryForWorkOrder(wo.id) : [];
      return NextResponse.json({
        success: true,
        provider_readiness: readiness,
        work_order: wo || null,
        history
      });
    }

    const recent = db.prepare("SELECT * FROM notification_history ORDER BY sent_at DESC LIMIT 30").all();
    return NextResponse.json({
      success: true,
      provider_readiness: readiness,
      history: recent
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      work_order_id,
      sent_by_user_id = "usr-giovane-01",
      origin = "workshop",
      release_event_key = "liberacao_retirada_v1",
      authorized_test_recipient = "+554196522715",
      simulate_provider_failure = false
    } = body;

    if (!work_order_id) {
      return NextResponse.json({ success: false, error: "work_order_id é obrigatório." }, { status: 400 });
    }

    const result = sendReadyForPickupNotification({
      workOrderId: work_order_id,
      sentByUserId: sent_by_user_id,
      origin,
      releaseEventKey: release_event_key,
      authorizedTestRecipient: authorized_test_recipient,
      simulateProviderFailure: Boolean(simulate_provider_failure)
    });

    const statusHttp =
      result.status === "enviado" ? 200 :
      result.status === "duplicado_bloqueado" ? 409 :
      result.status === "bloqueado_origem_invalida" ? 403 : 400;

    return NextResponse.json(result, { status: statusHttp });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
