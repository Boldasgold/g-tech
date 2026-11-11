import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const db = getDb();

    const row = db.prepare(`
      SELECT * FROM processing_jobs_queue
      WHERE id = ?
    `).get(jobId) as any;

    if (!row) {
      return NextResponse.json({ success: false, error: "Tarefa não localizada na fila processing_jobs_queue." }, { status: 404 });
    }

    const parsedResult = row.result_payload ? JSON.parse(row.result_payload) : null;

    return NextResponse.json({
      success: true,
      job: {
        job_id: row.id,
        job_type: row.job_type,
        work_order_id: row.work_order_id,
        status: row.status,
        attempts: row.attempts,
        error_message: row.error_message || null,
        created_at: row.created_at,
        started_at: row.started_at,
        completed_at: row.completed_at,
        result: parsedResult
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
