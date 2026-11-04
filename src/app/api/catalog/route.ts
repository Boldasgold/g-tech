import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const catalog = db.prepare("SELECT * FROM vehicle_catalog ORDER BY brand ASC, model ASC").all();

    // Grouping and statistics for coverage matrix
    const bodyTypeCounts = db.prepare(`
      SELECT body_type, COUNT(*) as count, representation_type 
      FROM vehicle_catalog 
      GROUP BY body_type
    `).all();

    const quickBrands = db.prepare(`
      SELECT DISTINCT brand 
      FROM vehicle_catalog 
      WHERE is_quick_brand = 1 
      ORDER BY brand ASC
    `).all().map((r: any) => r.brand);

    return NextResponse.json({
      success: true,
      total_models: catalog.length,
      quick_brands: quickBrands,
      body_type_distribution: bodyTypeCounts,
      catalog
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

