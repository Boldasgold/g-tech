import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const exportCsv = searchParams.get("export") === "csv";
    const db = getDb();

    if (exportCsv) {
      const rows = db.prepare(`
        SELECT 
          wo.os_number,
          c.name as customer_name,
          c.phone as customer_phone,
          v.brand, v.model, v.plate,
          wo.status,
          wo.created_at,
          COALESCE(q.total_amount, 0) as quote_total,
          COALESCE(q.authorized_total, 0) as authorized_total
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        JOIN vehicles v ON wo.vehicle_id = v.id
        LEFT JOIN wo_quotes q ON q.work_order_id = wo.id AND q.version_number = (
          SELECT MAX(version_number) FROM wo_quotes WHERE work_order_id = wo.id
        )
        ORDER BY wo.created_at DESC
      `).all() as any[];

      const headers = "OS;Cliente;Telefone;Veiculo;Placa;Status;Data;Valor_Orcado;Valor_Autorizado\n";
      const csvLines = rows.map(r => 
        `"${r.os_number}";"${r.customer_name}";"${r.customer_phone}";"${r.brand} ${r.model}";"${r.plate || ''}";"${r.status}";"${r.created_at}";"${r.quote_total}";"${r.authorized_total}"`
      ).join("\n");

      return new NextResponse(headers + csvLines, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gtech_relatorio_os_${Date.now()}.csv"`
        }
      });
    }

    // Aggregate statistics
    const totalOs = (db.prepare("SELECT COUNT(*) as c FROM work_orders").get() as any).c;
    const activeOs = (db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status NOT IN ('finalizada', 'entregue')").get() as any).c;
    const finishedOs = (db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status IN ('finalizada', 'entregue')").get() as any).c;

    const totalApts = (db.prepare("SELECT COUNT(*) as c FROM appointments").get() as any).c;
    const convertedApts = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'convertido_os'").get() as any).c;
    const conversionRate = totalApts > 0 ? ((convertedApts / totalApts) * 100).toFixed(1) : "0.0";

    const quotesStats = db.prepare(`
      SELECT 
        COUNT(*) as total_quotes,
        SUM(total_amount) as sum_orçado,
        SUM(authorized_total) as sum_autorizado
      FROM wo_quotes
    `).get() as any;

    const decisionsCount = db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM wo_customer_decisions 
      GROUP BY action
    `).all() as any[];

    // Body type coverage stats
    const catalogStats = db.prepare(`
      SELECT body_type, COUNT(*) as count 
      FROM vehicle_catalog 
      GROUP BY body_type
    `).all() as any[];

    return NextResponse.json({
      success: true,
      metrics: {
        total_work_orders: totalOs,
        active_work_orders: activeOs,
        finished_work_orders: finishedOs,
        total_appointments: totalApts,
        converted_appointments: convertedApts,
        conversion_rate_pct: conversionRate,
        quotes: {
          total: quotesStats.total_quotes || 0,
          total_budgeted_brl: quotesStats.sum_orçado || 0,
          total_authorized_brl: quotesStats.sum_autorizado || 0
        },
        decisions: decisionsCount,
        body_type_coverage: catalogStats
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

