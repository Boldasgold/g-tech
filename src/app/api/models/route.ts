import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "models", "vehicles");

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

// GET /api/models?vehicle_key=...&work_order_id=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vehicleKey = searchParams.get("vehicle_key")?.toLowerCase().trim();
    const workOrderId = searchParams.get("work_order_id")?.trim();
    const brand = searchParams.get("brand")?.trim();
    const model = searchParams.get("model")?.trim();

    const db = getDb();

    let record = null;

    if (workOrderId) {
      record = db.prepare(`
        SELECT * FROM vehicle_3d_models 
        WHERE work_order_id = ? 
        ORDER BY updated_at DESC LIMIT 1
      `).get(workOrderId) as any;
    }

    if (!record && vehicleKey) {
      record = db.prepare(`
        SELECT * FROM vehicle_3d_models 
        WHERE vehicle_key = ? 
        ORDER BY updated_at DESC LIMIT 1
      `).get(vehicleKey) as any;
    }

    if (!record && brand && model) {
      const fuzzyKey = `${brand.toLowerCase()}_${model.toLowerCase()}`;
      record = db.prepare(`
        SELECT * FROM vehicle_3d_models 
        WHERE vehicle_key LIKE ? OR (brand = ? AND (model LIKE ? OR ? LIKE '%' || model || '%'))
        ORDER BY updated_at DESC LIMIT 1
      `).get(`%${fuzzyKey}%`, brand, `%${model}%`, model) as any;
    }

    // Busca heurística por palavras-chave (ex: "jetta", "gli", "golf", "gti")
    if (!record) {
      const combined = `${vehicleKey || ""} ${model || ""} ${workOrderId || ""}`.toLowerCase();
      if (combined.includes("jetta") || combined.includes("gli") || combined.includes("wo-demo-129")) {
        record = db.prepare(`SELECT * FROM vehicle_3d_models WHERE vehicle_key = 'volkswagen_jetta-gli' LIMIT 1`).get() as any;
      } else if (combined.includes("golf") || combined.includes("gti") || combined.includes("wo-demo-128")) {
        record = db.prepare(`SELECT * FROM vehicle_3d_models WHERE vehicle_key = 'volkswagen_golf-gti' LIMIT 1`).get() as any;
      }
    }

    if (record) {
      return NextResponse.json({
        success: true,
        has_specific_model: true,
        model: {
          id: record.id,
          vehicle_key: record.vehicle_key,
          brand: record.brand,
          model: record.model,
          generation: record.generation,
          work_order_id: record.work_order_id,
          file_name: record.file_name,
          file_url: record.file_url,
          file_size_bytes: record.file_size_bytes,
          model_type: record.model_type,
          source: record.source,
          created_at: record.created_at
        }
      });
    }

    return NextResponse.json({
      success: true,
      has_specific_model: false,
      model: null,
      message: "Nenhum modelo 3D específico (GLB/GLTF) associado a este veículo no sistema.",
      illustration_fallback: "representacao_geometrica_generica"
    });
  } catch (error: any) {
    console.error("Erro ao buscar modelo 3D:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao consultar modelo 3D." },
      { status: 500 }
    );
  }
}

// POST /api/models (Upload e Associação de Modelo 3D)
export async function POST(req: NextRequest) {
  try {
    ensureUploadDir();
    const contentType = req.headers.get("content-type") || "";

    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let vehicleKey = "";
    let brand = "Volkswagen";
    let model = "Jetta GLI";
    let generation = "Geração VII (A7)";
    let workOrderId: string | null = null;
    let modelType = "malha_externa_monobloco";
    let source = "importacao_tripo3d";

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
      model = (formData.get("model") as string) || "Jetta GLI";
      generation = (formData.get("generation") as string) || "";
      workOrderId = (formData.get("work_order_id") as string) || null;
      modelType = (formData.get("model_type") as string) || "malha_externa_monobloco";
      source = (formData.get("source") as string) || "importacao_tripo3d";

      const bytes = await file.arrayBuffer();
      fileBuffer = Buffer.from(bytes);
    } else {
      const body = await req.json();
      const { file_base64, file_name, vehicle_key: vKey, brand: br, model: md, generation: gen, work_order_id: wId, model_type: mType } = body;

      if (!file_base64 || !file_name) {
        return NextResponse.json(
          { success: false, error: "Dados do arquivo 3D incompletos (file_base64 e file_name são obrigatórios)." },
          { status: 400 }
        );
      }

      fileName = file_name;
      vehicleKey = vKey || "veiculo_generico";
      brand = br || "Volkswagen";
      model = md || "Jetta GLI";
      generation = gen || "";
      workOrderId = wId || null;
      modelType = mType || "malha_externa_monobloco";

      const base64Data = file_base64.replace(/^data:.*?;base64,/, "");
      fileBuffer = Buffer.from(base64Data, "base64");
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "Arquivo 3D vazio ou inválido." },
        { status: 400 }
      );
    }

    // 1. Validação de tamanho (máximo 60MB)
    const MAX_SIZE = 60 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "O arquivo 3D excede o limite máximo permitido de 60MB." },
        { status: 400 }
      );
    }

    // 2. Validação de formato (GLB / GLTF)
    const ext = path.extname(fileName).toLowerCase();
    if (ext !== ".glb" && ext !== ".gltf") {
      return NextResponse.json(
        { success: false, error: "Formato não suportado. Envie arquivos .GLB (binário glTF) ou .GLTF." },
        { status: 400 }
      );
    }

    // Validação de cabeçalho mágico para GLB (0x46546C67 = "glTF")
    if (ext === ".glb") {
      if (fileBuffer.length < 12) {
        return NextResponse.json(
          { success: false, error: "Arquivo GLB corrompido ou incompleto." },
          { status: 400 }
        );
      }
      const magic = fileBuffer.toString("ascii", 0, 4);
      if (magic !== "glTF") {
        return NextResponse.json(
          { success: false, error: "Arquivo inválido: o cabeçalho binário não corresponde a um arquivo glTF/GLB válido." },
          { status: 400 }
        );
      }
    }

    // 3. Salvar o arquivo no disco do servidor
    const sanitizedKey = vehicleKey.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const timestamp = Date.now();
    const savedFileName = `${sanitizedKey}_${timestamp}${ext}`;
    const destinationPath = path.join(UPLOAD_DIR, savedFileName);

    fs.writeFileSync(destinationPath, fileBuffer);

    const publicUrl = `/models/vehicles/${savedFileName}`;

    // 4. Gravar a associação persistente no banco de dados SQLite
    const db = getDb();
    const recordId = `v3d-${crypto.randomUUID()}`;

    db.prepare(`
      INSERT INTO vehicle_3d_models (
        id, vehicle_key, brand, model, generation, work_order_id, 
        file_name, file_url, file_size_bytes, model_type, source, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
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
      modelType,
      source
    );

    return NextResponse.json({
      success: true,
      message: `Modelo 3D "${fileName}" associado e salvo com sucesso!`,
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
        model_type: modelType,
        source
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
      target = db.prepare("SELECT * FROM vehicle_3d_models WHERE work_order_id = ?").get(workOrderId);
    } else if (vehicleKey) {
      target = db.prepare("SELECT * FROM vehicle_3d_models WHERE vehicle_key = ?").get(vehicleKey);
    }

    if (!target) {
      return NextResponse.json(
        { success: false, message: "Nenhum vínculo de modelo 3D encontrado para remover." },
        { status: 404 }
      );
    }

    // Excluir registro no banco
    db.prepare("DELETE FROM vehicle_3d_models WHERE id = ?").run(target.id);

    // Se o arquivo existir na pasta local e for seguro remover
    if (target.file_url && target.file_url.startsWith("/models/vehicles/")) {
      const fullPath = path.join(process.cwd(), "public", target.file_url);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (unlinkErr) {
          console.warn("Aviso ao remover arquivo 3D do disco:", unlinkErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Vínculo do modelo 3D "${target.file_name}" desvinculado com sucesso. Sistema retornou à representação ilustrativa genérica.`
    });
  } catch (error: any) {
    console.error("Erro ao desvincular modelo 3D:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao desvincular modelo 3D." },
      { status: 500 }
    );
  }
}
