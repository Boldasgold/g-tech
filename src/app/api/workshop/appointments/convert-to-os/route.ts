import { NextRequest, NextResponse } from "next/server";
import { getStaffSession, checkPermission } from "@/lib/auth-service";
import { convertAppointmentToWorkOrder } from "@/lib/sync/offline-sync-service";

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.headers.get("x-staff-token") || req.cookies.get("gtech_staff_session")?.value;
    const body = await req.json().catch(() => ({}));
    const token = sessionToken || body.session_token;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const session = getStaffSession(token);
    if (!session || !checkPermission(session, "edit_work_order")) {
      return NextResponse.json(
        { success: false, error: "Apenas funcionários autorizados da oficina podem converter agendamentos em OS." },
        { status: 403 }
      );
    }

    const { appointment_id, service_description } = body;
    if (!appointment_id) {
      return NextResponse.json(
        { success: false, error: "appointment_id é obrigatório." },
        { status: 400 }
      );
    }

    const result = convertAppointmentToWorkOrder(appointment_id, session.user.id, service_description);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

