import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VISITS_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "visits");

function ensureVisitsUploadDir() {
  if (!fs.existsSync(VISITS_UPLOAD_DIR)) {
    fs.mkdirSync(VISITS_UPLOAD_DIR, { recursive: true });
  }
}

const VALID_SLOTS = new Set([
  "photo_front",
  "photo_rear",
  "photo_left",
  "photo_right",
  "photo_interior",
  "photo_dashboard"
]);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();

    const wo = db.prepare("SELECT id, os_number, vehicle_id FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const currentOsPhotos = db.prepare(`
      SELECT * FROM wo_visit_photos
      WHERE work_order_id = ?
      ORDER BY created_at ASC
    `).all(wo.id);

    const allVehicleVisitPhotos = db.prepare(`
      SELECT p.*, w.os_number
      FROM wo_visit_photos p
      LEFT JOIN work_orders w ON p.work_order_id = w.id
      WHERE p.vehicle_id = ?
      ORDER BY p.visit_number DESC, p.created_at ASC
    `).all(wo.vehicle_id);

    return NextResponse.json({
      success: true,
      work_order_id: wo.id,
      os_number: wo.os_number,
      vehicle_id: wo.vehicle_id,
      current_os_photos: currentOsPhotos,
      all_vehicle_visit_photos: allVehicleVisitPhotos
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureVisitsUploadDir();
    const { id } = await context.params;
    const db = getDb();

    const wo = db.prepare("SELECT id, os_number, vehicle_id, customer_id FROM work_orders WHERE id = ? OR os_number = ?").get(id, id) as any;
    if (!wo) {
      return NextResponse.json({ success: false, error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;
    let originalFilename = "foto_vistoria.jpg";
    let mimeType = "image/jpeg";
    let slotName = "photo_front";
    let uploadedBy = "Giovane Ribeiro";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      slotName = ((formData.get("slot_name") as string) || "photo_front").trim();
      uploadedBy = ((formData.get("uploaded_by") as string) || "Giovane Ribeiro").trim();

      if (!file) {
        return NextResponse.json({ success: false, error: "Arquivo de fotografia (file) é obrigatório." }, { status: 400 });
      }
      originalFilename = file.name || "foto_capturada.jpg";
      mimeType = file.type || "image/jpeg";
      const arrayBuf = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } else {
      const body = await req.json();
      slotName = (body.slot_name || "photo_front").trim();
      uploadedBy = (body.uploaded_by || "Giovane Ribeiro").trim();
      originalFilename = body.original_filename || body.filename || `${slotName}.jpg`;
      mimeType = body.mime_type || "image/jpeg";

      if (body.base64_data) {
        const cleanBase64 = String(body.base64_data).replace(/^data:.*?;base64,/, "");
        fileBuffer = Buffer.from(cleanBase64, "base64");
      } else {
        return NextResponse.json({
          success: false,
          error: "Envie o arquivo binário via multipart/form-data (campo 'file') ou 'base64_data' real."
        }, { status: 400 });
      }
    }

    if (!VALID_SLOTS.has(slotName)) {
      return NextResponse.json({
        success: false,
        error: `Slot inválido: ${slotName}. Use photo_front, photo_rear, photo_left, photo_right, photo_interior ou photo_dashboard.`
      }, { status: 400 });
    }

    if (!fileBuffer || fileBuffer.length < 64) {
      return NextResponse.json({
        success: false,
        error: "Arquivo de imagem inválido ou vazio."
      }, { status: 400 });
    }

    const fileSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const fileSizeBytes = fileBuffer.length;

    // Determinar o número da visita desta OS
    let existingVisit = db.prepare(`
      SELECT * FROM wo_inspection_visits
      WHERE work_order_id = ? AND inspection_stage = 'entrada'
    `).get(wo.id) as any;

    let visitNumber = existingVisit?.visit_number;
    if (!visitNumber) {
      const maxRow = db.prepare(`
        SELECT COALESCE(MAX(visit_number), 0) as max_visit
        FROM wo_inspection_visits
        WHERE vehicle_id = ? AND work_order_id != ?
      `).get(wo.vehicle_id, wo.id) as any;
      visitNumber = (maxRow?.max_visit || 0) + 1;
    }

    // Regra Estrita 1: Proibir reutilização do mesmo arquivo binário (mesmo SHA-256) para ângulos diferentes ou visitas distintas
    const duplicateInSameOsOtherSlot = db.prepare(`
      SELECT photo_id, slot_name, original_filename FROM wo_visit_photos
      WHERE work_order_id = ? AND slot_name != ? AND file_sha256 = ?
    `).get(wo.id, slotName, fileSha256) as any;

    if (duplicateInSameOsOtherSlot) {
      return NextResponse.json({
        success: false,
        error: `Violação de integridade fotográfica: O arquivo enviado possui o mesmo hash SHA-256 (${fileSha256.slice(0, 16)}...) já utilizado no ângulo '${duplicateInSameOsOtherSlot.slot_name}' (${duplicateInSameOsOtherSlot.photo_id}). Cada ângulo deve receber uma fotografia genuinamente diferente.`
      }, { status: 422 });
    }

    const duplicateInPreviousVisit = db.prepare(`
      SELECT photo_id, visit_number, slot_name, work_order_id FROM wo_visit_photos
      WHERE vehicle_id = ? AND work_order_id != ? AND file_sha256 = ?
    `).get(wo.vehicle_id, wo.id, fileSha256) as any;

    if (duplicateInPreviousVisit) {
      return NextResponse.json({
        success: false,
        error: `Violação de integridade de histórico: O arquivo enviado possui o mesmo hash SHA-256 (${fileSha256.slice(0, 16)}...) já registrado na Visita #${duplicateInPreviousVisit.visit_number} (${duplicateInPreviousVisit.photo_id}). Visitas distintas devem conter fotografias reais distintas.`
      }, { status: 422 });
    }

    const ext = path.extname(originalFilename).toLowerCase() || ".jpg";
    const photoId = `pho-v${visitNumber}-${slotName.replace("photo_", "")}-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 4)}`;
    const storedFileName = `visita_${visitNumber}_${wo.id}_${slotName}_${photoId}${ext}`;
    const storedFullPath = path.join(VISITS_UPLOAD_DIR, storedFileName);
    const publicUrl = `/api/uploads/visits/${storedFileName}`;

    fs.writeFileSync(storedFullPath, fileBuffer);

    // Garantir registro em wo_inspection_visits para esta OS
    if (!existingVisit) {
      const newVisitId = `vis-in-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;
      const initialPhotos = { [slotName]: publicUrl };
      db.prepare(`
        INSERT INTO wo_inspection_visits (
          id, work_order_id, vehicle_id, visit_number,
          inspection_stage, odometer_km, fuel_level, photos_json, checklist_json, notes, inspector_name
        ) VALUES (?, ?, ?, ?, 'entrada', 0, '50%', ?, '[]', '', ?)
      `).run(newVisitId, wo.id, wo.vehicle_id, visitNumber, JSON.stringify(initialPhotos), uploadedBy);
      existingVisit = db.prepare("SELECT * FROM wo_inspection_visits WHERE id = ?").get(newVisitId) as any;
    } else {
      let currentPhotosObj: Record<string, any> = {};
      try {
        currentPhotosObj = JSON.parse(existingVisit.photos_json || "{}");
      } catch {
        currentPhotosObj = {};
      }
      currentPhotosObj[slotName] = publicUrl;
      db.prepare(`
        UPDATE wo_inspection_visits
        SET photos_json = ?
        WHERE id = ?
      `).run(JSON.stringify(currentPhotosObj), existingVisit.id);
    }

    // Remover registro anterior apenas deste mesmo slot na mesma OS (se o operador estiver substituindo o ângulo da visita atual), preservando visitas passadas
    db.prepare(`
      DELETE FROM wo_visit_photos
      WHERE work_order_id = ? AND slot_name = ?
    `).run(wo.id, slotName);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO wo_visit_photos (
        photo_id, work_order_id, visit_id, vehicle_id, visit_number,
        slot_name, original_filename, stored_path, public_url,
        mime_type, file_size_bytes, file_sha256, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      photoId,
      wo.id,
      existingVisit.id,
      wo.vehicle_id,
      visitNumber,
      slotName,
      originalFilename,
      `public/uploads/visits/${storedFileName}`,
      publicUrl,
      mimeType,
      fileSizeBytes,
      fileSha256,
      uploadedBy,
      now
    );

    // Atualizar também wo_intake_inspection da OS atual
    const existingIntake = db.prepare("SELECT id FROM wo_intake_inspection WHERE work_order_id = ?").get(wo.id) as any;
    if (existingIntake) {
      db.prepare(`UPDATE wo_intake_inspection SET ${slotName} = ?, responsible_name = ? WHERE work_order_id = ?`)
        .run(publicUrl, uploadedBy, wo.id);
    } else {
      db.prepare(`
        INSERT INTO wo_intake_inspection (id, work_order_id, ${slotName}, responsible_name)
        VALUES (?, ?, ?, ?)
      `).run(`intake-${Date.now()}`, wo.id, publicUrl, uploadedBy);
    }

    // Registrar auditoria SHA-256 da foto
    db.prepare(`
      INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256)
      VALUES (?, 'gtech-paranagua', 'wo_visit_photos', ?, 'UPLOAD_VISIT_PHOTO', ?, 'mecanico', ?, ?)
    `).run(
      `aud-pho-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
      photoId,
      uploadedBy,
      JSON.stringify({
        photo_id: photoId,
        work_order_id: wo.id,
        visit_id: existingVisit.id,
        visit_number: visitNumber,
        slot_name: slotName,
        original_filename: originalFilename,
        public_url: publicUrl,
        file_size_bytes: fileSizeBytes,
        file_sha256: fileSha256
      }),
      fileSha256
    );

    return NextResponse.json({
      success: true,
      message: `Fotografia real anexada ao slot '${slotName}' da Visita #${visitNumber} com sucesso!`,
      photo: {
        photo_id: photoId,
        work_order_id: wo.id,
        visit_id: existingVisit.id,
        vehicle_id: wo.vehicle_id,
        visit_number: visitNumber,
        slot_name: slotName,
        original_filename: originalFilename,
        stored_path: `public/uploads/visits/${storedFileName}`,
        public_url: publicUrl,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
        file_sha256: fileSha256,
        uploaded_by: uploadedBy,
        created_at: now
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
