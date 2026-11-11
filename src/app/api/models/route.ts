import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveCanonicalVehicle } from "@/lib/canonical-vehicle";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "models", "vehicles");

// Lista negra de hashes SHA-256 de malhas incompatíveis identificadas em auditoria (Ferrari 458 Italia / Three.js)
const BLOCKED_GLB_HASHES = new Set([
  "cafe3f48da6797aa9bde75ca768bc5b57db366575fd233e90df186ae988a876e"
]);

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function computeFileSha256(fileUrl: string): string | null {
  try {
    let relPath = (fileUrl || "").replace(/^\//, "");
    if (relPath.startsWith("api/models/file/")) {
      relPath = path.join("models", "vehicles", path.basename(relPath));
    }
    const fullPath = path.join(process.cwd(), "public", relPath);
    if (!fs.existsSync(fullPath)) return null;
    const buf = fs.readFileSync(fullPath);
    return crypto.createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

function recordSelectionAudit(db: any, entry: {
  selected_vehicle_id: string;
  work_order_id?: string | null;
  brand?: string | null;
  model?: string | null;
  photo_used?: string | null;
  glb_url_loaded: string;
  glb_sha256: string;
  association_origin: string;
  audit_result: string;
}) {
  try {
    const id = `msal-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO model_selection_audit_log (
        id, selected_vehicle_id, work_order_id, brand, model,
        photo_used, glb_url_loaded, glb_sha256, association_origin, audit_result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.selected_vehicle_id,
      entry.work_order_id || null,
      entry.brand || null,
      entry.model || null,
      entry.photo_used || null,
      entry.glb_url_loaded,
      entry.glb_sha256,
      entry.association_origin,
      entry.audit_result
    );
    return id;
  } catch (e) {
    console.warn("[Audit3D] Falha ao gravar log de seleção 3D:", e);
    return null;
  }
}

// GET /api/models?vehicle_key=...&work_order_id=...&brand=...&model=...&photo_url=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawVehicleKey = searchParams.get("vehicle_key")?.toLowerCase().trim() || "";
    const workOrderId = searchParams.get("work_order_id")?.trim() || "";
    const brand = searchParams.get("brand")?.trim() || "";
    const model = searchParams.get("model")?.trim() || "";
    const photoUrl = searchParams.get("photo_url")?.trim() || "";
    const listAudit = searchParams.get("audit_history") === "1";

    const db = getDb();

    if (listAudit) {
      const logs = db.prepare(`
        SELECT * FROM model_selection_audit_log
        ORDER BY created_at DESC LIMIT 50
      `).all();
      const catalogModels = db.prepare(`
        SELECT id, vehicle_key, brand, model, generation, work_order_id, file_name, file_url, file_size_bytes, file_sha256, audit_status, origin_type, audit_notes
        FROM vehicle_3d_models
      `).all();
      return NextResponse.json({
        success: true,
        blocked_hashes: Array.from(BLOCKED_GLB_HASHES),
        catalog_models: catalogModels,
        selection_audit_logs: logs
      });
    }

    // Resolver chave canônica unificada (cadastro, worker, API e visualizador)
    const canonical = resolveCanonicalVehicle({
      vehicleKey: rawVehicleKey,
      brand,
      model
    });
    const normalizedKey = canonical.vehicle_key;

    const selectedVehicleId = normalizedKey || workOrderId || `${brand}_${model}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");

    // 1. Buscar associação exata por work_order_id ou vehicle_key canônico (SEM heurística frouxa que misture modelos diferentes)
    let candidate: any = null;
    if (workOrderId) {
      candidate = db.prepare(`
        SELECT * FROM vehicle_3d_models
        WHERE work_order_id = ? AND audit_status NOT IN ('desvinculado', 'substituido_nova_geracao')
        ORDER BY updated_at DESC, created_at DESC LIMIT 1
      `).get(workOrderId);
    }

    if (!candidate && normalizedKey) {
      candidate = db.prepare(`
        SELECT * FROM vehicle_3d_models
        WHERE vehicle_key = ? AND audit_status NOT IN ('desvinculado', 'substituido_nova_geracao')
        ORDER BY updated_at DESC, created_at DESC LIMIT 1
      `).get(normalizedKey);
    }

    // Buscar versões anteriores preservadas no histórico para este veículo / OS
    const previousVersions = normalizedKey
      ? db.prepare(`
          SELECT id, vehicle_key, vehicle_id, work_order_id, visit_id, file_name, file_url, file_size_bytes, file_sha256, source, origin_type, audit_status, created_at, updated_at
          FROM vehicle_3d_models
          WHERE vehicle_key = ? AND audit_status = 'substituido_nova_geracao'
          ORDER BY created_at DESC
        `).all(normalizedKey)
      : [];

    // 2. Se encontrou candidato no banco, verificar integridade e bloqueio de SHA-256 (Regra 2: Bloquear Ferrari cafe3f48...)
    if (candidate) {
      const realSha256 = computeFileSha256(candidate.file_url) || candidate.file_sha256 || "ARQUIVO_NAO_ENCONTRADO";

      if (
        BLOCKED_GLB_HASHES.has(realSha256) ||
        candidate.audit_status === "bloqueado_malha_incompativel"
      ) {
        const auditId = recordSelectionAudit(db, {
          selected_vehicle_id: selectedVehicleId,
          work_order_id: workOrderId || candidate.work_order_id,
          brand: brand || candidate.brand,
          model: model || candidate.model,
          photo_used: photoUrl,
          glb_url_loaded: "BLOQUEADO (" + candidate.file_url + ")",
          glb_sha256: realSha256,
          association_origin: "bloqueado_auditoria_sha256",
          audit_result: "Malha 3D incompatível bloqueada (SHA-256 cafe3f48... corresponde a Ferrari 458 Italia). Exibindo fotografia real com aviso."
        });

        return NextResponse.json({
          success: true,
          has_specific_model: false,
          has_representative_mesh: false,
          projection_available: false,
          blocked_incompatible_mesh: true,
          model: null,
          previous_versions: previousVersions,
          status_message: "Projeção 3D deste veículo ainda não disponível",
          message: "Projeção 3D deste veículo ainda não disponível",
          audit_trace: {
            audit_id: auditId,
            selected_vehicle_id: selectedVehicleId,
            work_order_id: workOrderId || null,
            photo_used: photoUrl || null,
            glb_url_loaded: null,
            blocked_file_url: candidate.file_url,
            glb_sha256: realSha256,
            association_origin: "bloqueado_auditoria_sha256",
            reason: "Arquivo GLB com SHA-256 cafe3f48... (Ferrari 458 Italia) foi bloqueado pela auditoria para impedir representação incorreta."
          }
        });
      }

      if (realSha256 === "ARQUIVO_NAO_ENCONTRADO") {
        const auditId = recordSelectionAudit(db, {
          selected_vehicle_id: selectedVehicleId,
          work_order_id: workOrderId,
          brand,
          model,
          photo_used: photoUrl,
          glb_url_loaded: "nenhum",
          glb_sha256: "ARQUIVO_AUSENTE",
          association_origin: "arquivo_ausente",
          audit_result: "Arquivo GLB referenciado não existe no disco."
        });

        return NextResponse.json({
          success: true,
          has_specific_model: false,
          has_representative_mesh: false,
          projection_available: false,
          model: null,
          previous_versions: previousVersions,
          status_message: "Projeção 3D deste veículo ainda não disponível",
          message: "Projeção 3D deste veículo ainda não disponível",
          audit_trace: {
            audit_id: auditId,
            selected_vehicle_id: selectedVehicleId,
            photo_used: photoUrl || null,
            glb_url_loaded: null,
            glb_sha256: "ARQUIVO_AUSENTE",
            association_origin: "sem_modelo_3d"
          }
        });
      }

      // Modelo 3D aprovado!
      const originCategory = candidate.origin_type === "gerado_por_fotos"
        ? "gerado_por_fotos"
        : "acervo_preexistente";

      const isTexturedIllustrative = originCategory === "gerado_por_fotos";

      const auditId = recordSelectionAudit(db, {
        selected_vehicle_id: selectedVehicleId,
        work_order_id: workOrderId || candidate.work_order_id,
        brand: brand || candidate.brand,
        model: model || candidate.model,
        photo_used: photoUrl,
        glb_url_loaded: candidate.file_url,
        glb_sha256: realSha256,
        association_origin: isTexturedIllustrative ? "modelo_ilustrativo_texturizado" : originCategory,
        audit_result: isTexturedIllustrative
          ? "Modelo ilustrativo texturizado (forma predefinida com fotografias da vistoria) carregado"
          : `GLB autêntico carregado (${originCategory})`
      });

      return NextResponse.json({
        success: true,
        has_specific_model: true,
        has_representative_mesh: false,
        projection_available: true,
        model: {
          id: candidate.id,
          vehicle_key: candidate.vehicle_key,
          vehicle_id: candidate.vehicle_id || null,
          brand: candidate.brand,
          model: candidate.model,
          generation: candidate.generation,
          work_order_id: candidate.work_order_id,
          visit_id: candidate.visit_id || null,
          file_name: candidate.file_name,
          file_url: candidate.file_url,
          file_size_bytes: candidate.file_size_bytes,
          file_sha256: realSha256,
          model_type: candidate.model_type,
          source: isTexturedIllustrative ? "modelo_ilustrativo_texturizado" : candidate.source,
          classification: isTexturedIllustrative
            ? "modelo ilustrativo texturizado"
            : "modelo 3d verificado do acervo",
          origin_type: originCategory,
          is_approximate: isTexturedIllustrative,
          source_photos: candidate.source_photos_json ? JSON.parse(candidate.source_photos_json) : [],
          created_at: candidate.created_at,
          fidelity_disclaimer: isTexturedIllustrative
            ? "MODELO ILUSTRATIVO TEXTURIZADO: Forma predefinida com aplicação das fotografias da vistoria (não constitui reconstrução 3D da geometria do carro)."
            : "Modelo 3D correspondente carregado do acervo verificado."
        },
        previous_versions: previousVersions,
        status_message: isTexturedIllustrative
          ? "Modelo ilustrativo texturizado (forma predefinida com fotografias da vistoria)"
          : "Modelo 3D específico carregado do acervo",
        message: isTexturedIllustrative
          ? "Modelo ilustrativo texturizado associado ao veículo, à OS, à vistoria e às fotos de origem."
          : "Modelo 3D específico associado e verificado por SHA-256.",
        audit_trace: {
          audit_id: auditId,
          selected_vehicle_id: selectedVehicleId,
          work_order_id: workOrderId || candidate.work_order_id || null,
          visit_id: candidate.visit_id || null,
          vehicle_id: candidate.vehicle_id || null,
          photo_used: photoUrl || null,
          glb_url_loaded: candidate.file_url,
          glb_sha256: realSha256,
          association_origin: isTexturedIllustrative ? "modelo_ilustrativo_texturizado" : originCategory,
          classification: isTexturedIllustrative ? "modelo ilustrativo texturizado" : "acervo_verificado",
          is_approximate: isTexturedIllustrative
        }
      });
    }

    // 3. Nenhum modelo 3D associado a este veículo (ex: Golf IV, Golf VII sem GLB válido, Duster, etc.)
    // Regra 3: Sem modelo correspondente, exibir a fotografia com "Projeção 3D deste veículo ainda não disponível". Não substituir por outro carro!
    const auditId = recordSelectionAudit(db, {
      selected_vehicle_id: selectedVehicleId,
      work_order_id: workOrderId || null,
      brand: brand || null,
      model: model || null,
      photo_used: photoUrl || null,
      glb_url_loaded: "nenhum",
      glb_sha256: "N/A",
      association_origin: "sem_modelo_3d",
      audit_result: "Sem GLB correspondente no acervo; exibindo fotografia real com aviso 'Projeção 3D deste veículo ainda não disponível'."
    });

    return NextResponse.json({
      success: true,
      has_specific_model: false,
      has_representative_mesh: false,
      projection_available: false,
      model: null,
      status_message: "Projeção 3D deste veículo ainda não disponível",
      message: "Projeção 3D deste veículo ainda não disponível",
      audit_trace: {
        audit_id: auditId,
        selected_vehicle_id: selectedVehicleId,
        work_order_id: workOrderId || null,
        photo_used: photoUrl || null,
        glb_url_loaded: null,
        glb_sha256: null,
        association_origin: "sem_modelo_3d"
      }
    });
  } catch (error: any) {
    console.error("Erro ao buscar modelo 3D:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao consultar modelo 3D." },
      { status: 500 }
    );
  }
}

// POST /api/models (Upload e Associação de Modelo 3D com Verificação SHA-256)
export async function POST(req: NextRequest) {
  try {
    ensureUploadDir();
    const contentType = req.headers.get("content-type") || "";

    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let vehicleKey = "";
    let brand = "Volkswagen";
    let model = "";
    let generation = "";
    let workOrderId: string | null = null;
    let modelType = "malha_externa_monobloco";
    let source = "upload_oficina";
    let originType = "acervo_preexistente";
    let sourcePhotos: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: "Nenhum arquivo 3D enviado." },
          { status: 400 }
        );
      }

      fileName = file.name;
      vehicleKey = (formData.get("vehicle_key") as string) || "veiculo_generico";
      brand = (formData.get("brand") as string) || "Volkswagen";
      model = (formData.get("model") as string) || vehicleKey;
      generation = (formData.get("generation") as string) || "";
      workOrderId = (formData.get("work_order_id") as string) || null;
      modelType = (formData.get("model_type") as string) || "malha_externa_monobloco";
      source = (formData.get("source") as string) || "upload_oficina";
      originType = (formData.get("origin_type") as string) || "acervo_preexistente";

      const bytes = await file.arrayBuffer();
      fileBuffer = Buffer.from(bytes);
    } else {
      const body = await req.json();
      const {
        file_base64,
        file_name,
        vehicle_key: vKey,
        brand: br,
        model: md,
        generation: gen,
        work_order_id: wId,
        model_type: mType,
        origin_type: oType,
        source_photos: sPhotos
      } = body;

      if (!file_base64 || !file_name) {
        return NextResponse.json(
          { success: false, error: "Dados do arquivo 3D incompletos (file_base64 e file_name são obrigatórios)." },
          { status: 400 }
        );
      }

      fileName = file_name;
      vehicleKey = vKey || "veiculo_generico";
      brand = br || "Volkswagen";
      model = md || vehicleKey;
      generation = gen || "";
      workOrderId = wId || null;
      modelType = mType || "malha_externa_monobloco";
      originType = oType || "acervo_preexistente";
      sourcePhotos = Array.isArray(sPhotos) ? sPhotos : [];

      const base64Data = file_base64.replace(/^data:.*?;base64,/, "");
      fileBuffer = Buffer.from(base64Data, "base64");
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "Arquivo 3D vazio ou inválido." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 60 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "O arquivo 3D excede o limite máximo permitido de 60MB." },
        { status: 400 }
      );
    }

    const ext = path.extname(fileName).toLowerCase();
    if (ext !== ".glb" && ext !== ".gltf") {
      return NextResponse.json(
        { success: false, error: "Formato não suportado. Envie arquivos .GLB ou .GLTF." },
        { status: 400 }
      );
    }

    if (ext === ".glb") {
      if (fileBuffer.length < 12 || fileBuffer.toString("ascii", 0, 4) !== "glTF") {
        return NextResponse.json(
          { success: false, error: "Arquivo inválido: cabeçalho binário não corresponde a glTF/GLB." },
          { status: 400 }
        );
      }
    }

    // Auditoria SHA-256: bloquear malha incompatível (Ferrari cafe3f48...)
    const fileSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    if (BLOCKED_GLB_HASHES.has(fileSha256)) {
      return NextResponse.json(
        {
          success: false,
          blocked_by_audit: true,
          file_sha256: fileSha256,
          error: "Upload bloqueado pela auditoria 3D: o arquivo enviado possui SHA-256 cafe3f48... (Ferrari 458 Italia), incompatível com o veículo selecionado."
        },
        { status: 422 }
      );
    }

    const sanitizedKey = vehicleKey.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const timestamp = Date.now();
    const savedFileName = `${sanitizedKey}_${timestamp}${ext}`;
    const destinationPath = path.join(UPLOAD_DIR, savedFileName);

    fs.writeFileSync(destinationPath, fileBuffer);
    const publicUrl = `/models/vehicles/${savedFileName}`;

    const db = getDb();
    const recordId = `v3d-${crypto.randomUUID()}`;

    db.prepare(`
      INSERT INTO vehicle_3d_models (
        id, vehicle_key, brand, model, generation, work_order_id,
        file_name, file_url, file_size_bytes, file_sha256,
        model_type, source, audit_status, origin_type, source_photos_json,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aprovado', ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(
      recordId,
      vehicleKey.toLowerCase(),
      brand,
      model,
      generation,
      workOrderId,
      fileName,
      publicUrl,
      fileBuffer.length,
      fileSha256,
      modelType,
      source,
      originType,
      JSON.stringify(sourcePhotos)
    );

    return NextResponse.json({
      success: true,
      message: `Modelo 3D "${fileName}" verificado (SHA-256: ${fileSha256.slice(0, 12)}...) e associado com sucesso!`,
      model: {
        id: recordId,
        vehicle_key: vehicleKey.toLowerCase(),
        brand,
        model,
        generation,
        work_order_id: workOrderId,
        file_name: fileName,
        file_url: publicUrl,
        file_size_bytes: fileBuffer.length,
        file_sha256: fileSha256,
        model_type: modelType,
        source,
        origin_type: originType,
        source_photos: sourcePhotos
      }
    });
  } catch (error: any) {
    console.error("Erro no upload do modelo 3D:", error);
    return NextResponse.json(
      { success: false, error: `Erro no processamento do modelo 3D: ${error.message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/models?id=... OU ?vehicle_key=...&work_order_id=...
// Preserva registro histórico marcando como 'desvinculado' (não apaga arquivos indiscriminadamente)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const vehicleKey = searchParams.get("vehicle_key")?.toLowerCase().trim();
    const workOrderId = searchParams.get("work_order_id")?.trim();

    const db = getDb();

    let target: any = null;
    if (id) {
      target = db.prepare("SELECT * FROM vehicle_3d_models WHERE id = ?").get(id);
    } else if (workOrderId) {
      target = db.prepare("SELECT * FROM vehicle_3d_models WHERE work_order_id = ? AND audit_status = 'aprovado'").get(workOrderId);
    } else if (vehicleKey) {
      target = db.prepare("SELECT * FROM vehicle_3d_models WHERE vehicle_key = ? AND audit_status = 'aprovado'").get(vehicleKey);
    }

    if (!target) {
      return NextResponse.json(
        { success: false, message: "Nenhum vínculo ativo de modelo 3D encontrado para desvincular." },
        { status: 404 }
      );
    }

    db.prepare(`
      UPDATE vehicle_3d_models
      SET audit_status = 'desvinculado',
          audit_notes = 'Desvinculado manualmente pelo operador; registro histórico preservado.',
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(target.id);

    return NextResponse.json({
      success: true,
      message: `Vínculo do modelo 3D "${target.file_name}" desvinculado com preservação de histórico.`
    });
  } catch (error: any) {
    console.error("Erro ao desvincular modelo 3D:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao desvincular modelo 3D." },
      { status: 500 }
    );
  }
}
