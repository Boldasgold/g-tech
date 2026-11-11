import { NextRequest, NextResponse } from "next/server";
import { getStaffSession, checkPermission } from "@/lib/auth-service";
import { sendReadyForPickupNotification } from "@/lib/whatsapp-service";

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.headers.get("x-staff-token") || req.cookies.get("gtech_staff_session")?.value;
    const body = await req.json().catch(() => ({}));
    const token = sessionToken || body.session_token;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado. Autenticação de funcionário da oficina é obrigatória." },
        { status: 401 }
      );
    }

    const session = getStaffSession(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    if (!checkPermission(session, "edit_work_order")) {
      return NextResponse.json(
        { success: false, error: "Permissão insuficiente para alterar status de OS e disparar notificações." },
        { status: 403 }
      );
    }

    const { work_order_id } = body;
    if (!work_order_id) {
      return NextResponse.json(
        { success: false, error: "work_order_id é obrigatório." },
        { status: 400 }
      );
    }

    // Disparo exclusivo da oficina com controle de duplicidade
    const result = sendReadyForPickupNotification({
      workOrderId: work_order_id,
      sentByUserId: session.user.id,
      origin: "workshop"
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

