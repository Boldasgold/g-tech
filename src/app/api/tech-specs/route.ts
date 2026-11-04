import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recognizeVehicle } from "@/lib/vw-recognition";

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

    // Check Volkswagen intelligent recognition for 51 official models
    const vwRec = recognizeVehicle(targetBrand, targetModel, targetBodyType);
    if (vwRec.isVolkswagen && vwRec.matchedModel) {
      const m = vwRec.matchedModel;
      const vwSpec = {
        id: `spec-vw-${m.id}`,
        brand: "Volkswagen",
        model: m.name,
        years: m.years,
        engine: m.engine,
        body_type: m.bodyType,
        real_photo_url: m.photoUrl,
        oil_viscosity: m.oilViscosity,
        oil_capacity_liters: m.oilCapacityLiters,
        oil_norm: m.oilNorm,
        coolant_type: "Aditivo G12 / G13 Rosa Orgânico (VW TL 774)",
        coolant_capacity_liters: 6.0,
        brake_fluid: "DOT 4 Sintético Especial",
        tire_pressure_front_psi: m.tirePressureFrontPsi,
        tire_pressure_rear_psi: m.tirePressureRearPsi,
        tire_pressure_loaded_psi: m.tirePressureLoadedPsi,
        spark_plugs_gap_mm: m.sparkPlugsGapMm,
        fuse_box_engine: [
          { fuse: "F1", amp: "30A", color: "#22c55e", desc: "Ventoinha do Radiador / Eletroventilador PWM" },
          { fuse: "F2", amp: "20A", color: "#eab308", desc: "Bomba de Combustível de Alta Pressão" },
          { fuse: "F3", amp: "15A", color: "#3b82f6", desc: "Bobinas de Ignição Individuais e Injetores TSI" },
          { fuse: "F4", amp: "40A", color: "#f97316", desc: "Módulo ABS / ESC / Controle de Tração ASR" },
          { fuse: "F5", amp: "50A", color: "#ef4444", desc: "Direção Eletroassistida (Servotronic)" }
        ],
        fuse_box_cabin: [
          { fuse: "F10", amp: "15A", color: "#3b82f6", desc: "Tomada de Diagnóstico OBD2 e Central Gateway" },
          { fuse: "F11", amp: "20A", color: "#eab308", desc: "Vidros Elétricos e Trava Central" },
          { fuse: "F12", amp: "10A", color: "#ef4444", desc: "Painel de Instrumentos Digital Active Info Display" }
        ],
        common_issues: [
          {
            symptom: "Falha de ignição em aceleração e luz EPC acesa",
            cause: "Fissura na cerâmica da vela ou isolamento térmico das bobinas individuais.",
            procedure: "Testar pulso secundário no osciloscópio e aplicar velas de irídio com gap calibrado."
          },
          {
            symptom: "Consumo de água de arrefecimento sem vazamento visível no chão",
            cause: "Desgaste ou folga na carcaça plástica da bomba d'água / válvula termostática.",
            procedure: "Pressurizar sistema de arrefecimento a 1.5 bar e inspecionar módulo termostático sob coletor."
          }
        ],
        is_recognized_vw: true,
        catalog_id: m.id,
        category: m.category,
        license: m.license,
        author: m.author
      };
      return NextResponse.json({ success: true, spec: vwSpec, recognized_vw: true });
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

