import { NextRequest, NextResponse } from "next/server";
import { getStaffSession, checkPermission } from "@/lib/auth-service";
import { getDb } from "@/lib/db";
import { resolveCanonicalVehicle } from "@/lib/canonical-vehicle";

const WORKER_URL = process.env.WORKER_AI_3D_URL || "http://localhost:3002";

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.headers.get("x-staff-token") || req.cookies.get("gtech_staff_session")?.value;
    const body = await req.json().catch(() => ({}));
    const token = sessionToken || body.session_token;

    if (token) {
      const session = getStaffSession(token);
      if (session && !checkPermission(session, "edit_work_order")) {
        return NextResponse.json({ success: false, error: "Acesso negado." }, { status: 403 });
      }
    }

    const { job_type, work_order_id, payload } = body;
    if (!job_type || !work_order_id) {
      return NextResponse.json(
        { success: false, error: "job_type e work_order_id são obrigatórios (não são permitidos IDs fixos de demonstração)." },
        { status: 400 }
      );
    }

    const db = getDb();
    const wo = db.prepare(`
      SELECT wo.id, wo.os_number, wo.vehicle_id, v.brand, v.model
      FROM work_orders wo
      JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE wo.id = ? OR wo.os_number = ?
    `).get(work_order_id, work_order_id) as any;

    if (!wo) {
      return NextResponse.json(
        { success: false, error: `Ordem de serviço '${work_order_id}' não encontrada.` },
        { status: 404 }
      );
    }

    const canonical = resolveCanonicalVehicle({
      vehicleKey: payload?.vehicle_key,
      brand: wo.brand,
      model: wo.model
    });

    if (job_type === "reconstruct_3d") {
      const photos = db.prepare(`
        SELECT photo_id, slot_name, file_sha256 FROM wo_visit_photos
        WHERE work_order_id = ?
      `).all(wo.id) as any[];

      if (!photos || photos.length < 2) {
        return NextResponse.json(
          {
            success: false,
            error: `Validação de fotos reprovada: A vistoria da OS ${wo.os_number} (${wo.brand} ${wo.model} • ${canonical.vehicle_key}) possui ${photos ? photos.length : 0} foto(s) anexada(s). Anexe pelo menos 2 fotografias reais distintas na aba Vistoria antes de clicar em 'Gerar projeção 3D'.`
          },
          { status: 422 }
        );
      }
    }

    const workerRes = await fetch(`${WORKER_URL}/jobs/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_type,
        work_order_id: wo.id,
        payload: {
          ...(payload || {}),
          work_order_id: wo.id,
          vehicle_id: wo.vehicle_id,
          vehicle_key: canonical.vehicle_key,
          brand: wo.brand,
          model: wo.model
        }
      })
    });

    const workerData = await workerRes.json();
    if (!workerRes.ok || !workerData.success) {
      return NextResponse.json(
        { success: false, error: workerData.error || "Erro ao enfileirar tarefa no Worker 3002." },
        { status: workerRes.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        job_id: workerData.job_id,
        job_type: workerData.job_type,
        work_order_id: wo.id,
        vehicle_key: canonical.vehicle_key,
        status: workerData.status,
        worker_pid: workerData.worker_pid
      },
      message: "Tarefa enviada ao Worker IA/3D (Porta 3002). Acompanhe o processamento até o carregamento do modelo ilustrativo texturizado."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
