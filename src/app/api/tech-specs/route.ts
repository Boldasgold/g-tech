import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand");
    const model = searchParams.get("model");
    const bodyType = searchParams.get("body_type");
    const workOrderId = searchParams.get("work_order_id");

    const db = getDb();

    let targetBrand = brand || "";
    let targetModel = model || "";
    let targetBodyType = bodyType || "";

    // If work_order_id provided, fetch vehicle brand and model from work order
    if (workOrderId) {
      const wo = db.prepare(`
        SELECT v.brand, v.model, v.body_type 
        FROM work_orders wo 
        JOIN vehicles v ON wo.vehicle_id = v.id 
        WHERE wo.id = ? OR wo.os_number = ?
      `).get(workOrderId, workOrderId) as any;

      if (wo) {
        targetBrand = wo.brand;
        targetModel = wo.model;
        targetBodyType = wo.body_type;
      }
    }

    // Try exact brand + model search
    let spec = db.prepare(`
      SELECT * FROM vehicle_tech_specs 
      WHERE LOWER(brand) = LOWER(?) AND LOWER(model) LIKE LOWER(?)
      LIMIT 1
    `).get(targetBrand, `%${targetModel.split(" ")[0]}%`) as any;

    // If not found, try by model alone
    if (!spec && targetModel) {
      spec = db.prepare(`
        SELECT * FROM vehicle_tech_specs 
        WHERE LOWER(model) LIKE LOWER(?)
        LIMIT 1
      `).get(`%${targetModel.split(" ")[0]}%`);
    }

    // If still not found, try by brand alone
    if (!spec && targetBrand) {
      spec = db.prepare(`
        SELECT * FROM vehicle_tech_specs 
        WHERE LOWER(brand) = LOWER(?)
        LIMIT 1
      `).get(targetBrand);
    }

    // Fallback by body_type
    if (!spec && targetBodyType) {
      spec = db.prepare(`
        SELECT * FROM vehicle_tech_specs 
        WHERE LOWER(body_type) = LOWER(?)
        LIMIT 1
      `).get(targetBodyType);
    }

    // Global default (Duster)
    if (!spec) {
      spec = db.prepare("SELECT * FROM vehicle_tech_specs LIMIT 1").get();
    }

    if (spec) {
      // Parse JSON fields
      spec.fuse_box_engine = spec.fuse_box_engine ? JSON.parse(spec.fuse_box_engine) : [];
      spec.fuse_box_cabin = spec.fuse_box_cabin ? JSON.parse(spec.fuse_box_cabin) : [];
      spec.common_issues = spec.common_issues ? JSON.parse(spec.common_issues) : [];
    }

    return NextResponse.json({
      success: true,
      spec
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
