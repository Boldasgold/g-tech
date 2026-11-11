import { NextRequest, NextResponse } from "next/server";
import { getStaffSession, checkPermission } from "@/lib/auth-service";
import { drainPendingSyncQueue } from "@/lib/sync/offline-sync-service";

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
    if (!session || !checkPermission(session, "view_work_orders")) {
      return NextResponse.json(
        { success: false, error: "Acesso negado." },
        { status: 403 }
      );
    }

    const result = drainPendingSyncQueue();
    return NextResponse.json({
      success: true,
      message: `Fila de sincronização processada: ${result.processed} sincronizados, ${result.errors} erros.`,
      result
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

