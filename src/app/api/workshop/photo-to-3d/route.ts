import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveCanonicalVehicle } from "@/lib/canonical-vehicle";
import crypto from "node:crypto";

const WORKER_URL = process.env.WORKER_AI_3D_URL || "http://localhost:3002";

function ensureCanonicalDbColumns(db: any) {
  const safeAlter = (sql: string) => {
    try { db.exec(sql); } catch (_) {}
  };
  safeAlter("ALTER TABLE vehicles ADD COLUMN vehicle_key TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN vehicle_id TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN visit_id TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN file_sha256 TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN audit_status TEXT DEFAULT 'aprovado';");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN origin_type TEXT DEFAULT 'acervo_preexistente';");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN source_photos_json TEXT;");
  safeAlter("ALTER TABLE vehicle_3d_models ADD COLUMN audit_notes TEXT;");
  safeAlter("ALTER TABLE wo_inspection_visits ADD COLUMN generated_3d_model_id TEXT;");
  safeAlter("ALTER TABLE wo_inspection_visits ADD COLUMN generated_3d_glb_url TEXT;");
  safeAlter("ALTER TABLE wo_inspection_visits ADD COLUMN generated_3d_sha256 TEXT;");
}

function findVehicleAndWorkOrder(db: any, canonical: ReturnType<typeof resolveCanonicalVehicle>, requestedWorkOrderId?: string) {
  ensureCanonicalDbColumns(db);

  // 1. Se work_order_id foi explicitamente informado, buscar essa OS e validar se pertence ao veículo
  if (requestedWorkOrderId) {
    const woRow = db.prepare(`
      SELECT wo.*, v.brand as vehicle_brand, v.model as vehicle_model, v.plate as vehicle_plate,
             v.year as vehicle_year, v.body_type as vehicle_body_type, v.vehicle_key as db_vehicle_key
      FROM work_orders wo
      JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE wo.id = ? OR wo.os_number = ?
    `).get(requestedWorkOrderId, requestedWorkOrderId) as any;

    if (woRow) {
      const woCanonical = resolveCanonicalVehicle({
        vehicleKey: woRow.db_vehicle_key,
        brand: woRow.vehicle_brand,
        model: woRow.vehicle_model
      });
      if (!woRow.db_vehicle_key) {
        db.prepare("UPDATE vehicles SET vehicle_key = ? WHERE id = ?").run(woCanonical.vehicle_key, woRow.vehicle_id);
      }
      // Só retornar se não houver conflito de veículo quando vehicle_key também foi passado
      if (!canonical.vehicle_key || canonical.vehicle_key === woCanonical.vehicle_key) {
        const vehicleRow = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(woRow.vehicle_id);
        return { vehicleRow, woRow, effectiveCanonical: woCanonical };
      }
    }
  }

  // 2. Buscar veículo exatamente pelo vehicle_key canônico ou correspondência exata de marca + modelo (sem usar OS de outro veículo!)
  const allVehicles = db.prepare(`
    SELECT * FROM vehicles
    ORDER BY created_at DESC
  `).all() as any[];

  let matchedVehicle: any = null;
  for (const v of allVehicles) {
    const vCan = resolveCanonicalVehicle({
      vehicleKey: v.vehicle_key,
      brand: v.brand,
      model: v.model
    });
    if (vCan.vehicle_key === canonical.vehicle_key) {
      matchedVehicle = v;
      if (!v.vehicle_key) {
        db.prepare("UPDATE vehicles SET vehicle_key = ? WHERE id = ?").run(canonical.vehicle_key, v.id);
        matchedVehicle.vehicle_key = canonical.vehicle_key;
      }
      break;
    }
  }

  if (!matchedVehicle) {
    return { vehicleRow: null, woRow: null, effectiveCanonical: canonical };
  }

  const woRow = db.prepare(`
    SELECT wo.*, v.brand as vehicle_brand, v.model as vehicle_model, v.plate as vehicle_plate,
           v.year as vehicle_year, v.body_type as vehicle_body_type, v.vehicle_key as db_vehicle_key
    FROM work_orders wo
    JOIN vehicles v ON wo.vehicle_id = v.id
    WHERE wo.vehicle_id = ?
    ORDER BY wo.created_at DESC LIMIT 1
  `).get(matchedVehicle.id) as any;

  return { vehicleRow: matchedVehicle, woRow: woRow || null, effectiveCanonical: canonical };
}

// GET /api/workshop/photo-to-3d?vehicle_key=...&work_order_id=...&brand=...&model=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawVehicleKey = searchParams.get("vehicle_key") || "";
    const workOrderId = searchParams.get("work_order_id") || "";
    const brand = searchParams.get("brand") || "Volkswagen";
    const model = searchParams.get("model") || "";

    const db = getDb();
    const canonical = resolveCanonicalVehicle({
      vehicleKey: rawVehicleKey,
      brand,
      model
    });

    const { vehicleRow, woRow, effectiveCanonical } = findVehicleAndWorkOrder(db, canonical, workOrderId);

    const visitRow = woRow
      ? (db.prepare(`
          SELECT * FROM wo_inspection_visits
          WHERE work_order_id = ? AND inspection_stage = 'entrada'
          ORDER BY visit_number DESC LIMIT 1
        `).get(woRow.id) as any)
      : null;

    const visitPhotos = woRow
      ? (db.prepare(`
          SELECT photo_id, work_order_id, visit_id, vehicle_id, visit_number,
                 slot_name, original_filename, stored_path, public_url,
                 mime_type, file_size_bytes, file_sha256, uploaded_by, created_at
          FROM wo_visit_photos
          WHERE work_order_id = ?
          ORDER BY created_at ASC
        `).all(woRow.id) as any[])
      : [];

    // Tarefas na fila do Worker IA/3D para esta OS ou vehicle_key
    let jobs: any[] = [];
    if (woRow) {
      jobs = db.prepare(`
        SELECT * FROM processing_jobs_queue
        WHERE work_order_id = ?
        ORDER BY created_at DESC LIMIT 10
      `).all(woRow.id) as any[];
    } else {
      const recentJobs = db.prepare(`
        SELECT * FROM processing_jobs_queue
        ORDER BY created_at DESC LIMIT 30
      `).all() as any[];
      jobs = recentJobs.filter(j => {
        try {
          const p = JSON.parse(j.input_payload || "{}");
          return p.vehicle_key === effectiveCanonical.vehicle_key;
        } catch {
          return false;
        }
      });
    }

    const latestJob = jobs.length > 0
      ? {
          ...jobs[0],
          parsed_result: jobs[0].result_payload ? JSON.parse(jobs[0].result_payload) : null
        }
      : null;

    // Modelo 3D ativo para este vehicle_key ou work_order_id
    let activeModel: any = null;
    if (woRow) {
      activeModel = db.prepare(`
        SELECT * FROM vehicle_3d_models
        WHERE work_order_id = ? AND audit_status NOT IN ('desvinculado', 'substituido_nova_geracao')
        ORDER BY updated_at DESC, created_at DESC LIMIT 1
      `).get(woRow.id);
    }
    if (!activeModel) {
      activeModel = db.prepare(`
        SELECT * FROM vehicle_3d_models
        WHERE vehicle_key = ? AND audit_status NOT IN ('desvinculado', 'substituido_nova_geracao')
        ORDER BY updated_at DESC, created_at DESC LIMIT 1
      `).get(effectiveCanonical.vehicle_key);
    }

    const previousModels = db.prepare(`
      SELECT id, vehicle_key, vehicle_id, work_order_id, visit_id, file_name, file_url,
             file_size_bytes, file_sha256, source, origin_type, audit_status, created_at
      FROM vehicle_3d_models
      WHERE vehicle_key = ? AND audit_status = 'substituido_nova_geracao'
      ORDER BY created_at DESC
    `).all(effectiveCanonical.vehicle_key);

    // Determinar o estado exato da seleção e em qual etapa o fluxo está
    let selectionMode:
      | "acervo_verificado_preexistente"
      | "apenas_fotografia_catalogo"
      | "vistoria_aberta_aguardando_fotos"
      | "pronto_para_gerar_projecao_3d"
      | "processando_no_worker"
      | "modelo_ilustrativo_texturizado_disponivel" = "apenas_fotografia_catalogo";

    let interruptionStage = "";
    let statusExplanation = "";

    if (activeModel && activeModel.origin_type === "acervo_preexistente") {
      selectionMode = "acervo_verificado_preexistente";
      interruptionStage = "NENHUMA — Modelo 3D verificado do acervo carregado.";
      statusExplanation = `Modelo 3D verificado no acervo (${activeModel.file_name}) disponível para ${effectiveCanonical.vehicle_key}.`;
    } else if (latestJob && (latestJob.status === "enfileirado" || latestJob.status === "processando")) {
      selectionMode = "processando_no_worker";
      interruptionStage = `EM_PROCESSAMENTO_NO_WORKER (${latestJob.status.toUpperCase()})`;
      statusExplanation = `Tarefa ${latestJob.id} está ${latestJob.status} no Worker IA/3D (Porta 3002).`;
    } else if (activeModel && activeModel.origin_type === "gerado_por_fotos") {
      selectionMode = "modelo_ilustrativo_texturizado_disponivel";
      interruptionStage = "NENHUMA — Modelo ilustrativo texturizado gerado e vinculado.";
      statusExplanation = `Modelo ilustrativo texturizado (${activeModel.file_name}) vinculado ao veículo ${effectiveCanonical.vehicle_key}, OS ${activeModel.work_order_id} e vistoria ${activeModel.visit_id || visitRow?.id || "N/A"}.`;
    } else if (!vehicleRow || !woRow) {
      selectionMode = "apenas_fotografia_catalogo";
      interruptionStage = "ETAPA 1 INTERROMPIDA: Seleção é apenas uma fotografia do catálogo (sem veículo cadastrado, sem OS e sem vistoria em wo_inspection_visits).";
      statusExplanation = `O item selecionado (${effectiveCanonical.brand} ${effectiveCanonical.model_name} • ${effectiveCanonical.vehicle_key}) possui apenas a fotografia estática do catálogo (${effectiveCanonical.catalog_photo_url || "N/A"}) e não possui Ordem de Serviço nem vistoria vinculada. Ele NÃO é associado silenciosamente à OS de outro veículo.`;
    } else if (visitPhotos.length < 2) {
      selectionMode = "vistoria_aberta_aguardando_fotos";
      interruptionStage = `ETAPA 2 INTERROMPIDA: Vistoria aberta (${woRow.os_number}), porém há apenas ${visitPhotos.length} fotografia(s) anexada(s) em wo_visit_photos (mínimo exigido: 2 ângulos reais distintos).`;
      statusExplanation = `Veículo ${effectiveCanonical.vehicle_key} vinculado à OS ${woRow.os_number} e Vistoria ${visitRow?.id || "pendente"}, mas faltam fotografias reais da vistoria (${visitPhotos.length}/2 mínimas).`;
    } else {
      selectionMode = "pronto_para_gerar_projecao_3d";
      interruptionStage = "ETAPA 3 AGUARDANDO ACIONAMENTO: Fotos da vistoria validadas; aguardando clique em 'Gerar projeção 3D'.";
      statusExplanation = `Veículo ${effectiveCanonical.vehicle_key} com OS ${woRow.os_number}, Vistoria ${visitRow?.id} e ${visitPhotos.length} fotos reais validadas. Pronto para gerar modelo ilustrativo texturizado.`;
    }

    return NextResponse.json({
      success: true,
      trace: {
        ui_selected_identifier: rawVehicleKey || workOrderId || effectiveCanonical.vehicle_key,
        canonical_vehicle_key: effectiveCanonical.vehicle_key,
        catalog_id: effectiveCanonical.catalog_id,
        brand: effectiveCanonical.brand,
        model_name: effectiveCanonical.model_name,
        selection_mode: selectionMode,
        interruption_stage: interruptionStage,
        status_explanation: statusExplanation,
        catalog_photo_url: effectiveCanonical.catalog_photo_url,
        vehicle_record: vehicleRow
          ? {
              id: vehicleRow.id,
              vehicle_key: vehicleRow.vehicle_key || effectiveCanonical.vehicle_key,
              brand: vehicleRow.brand,
              model: vehicleRow.model,
              plate: vehicleRow.plate,
              year: vehicleRow.year,
              body_type: vehicleRow.body_type
            }
          : null,
        work_order: woRow
          ? {
              id: woRow.id,
              os_number: woRow.os_number,
              status: woRow.status,
              vehicle_id: woRow.vehicle_id,
              customer_id: woRow.customer_id
            }
          : null,
        inspection_visit: visitRow
          ? {
              id: visitRow.id,
              work_order_id: visitRow.work_order_id,
              vehicle_id: visitRow.vehicle_id,
              visit_number: visitRow.visit_number,
              inspection_stage: visitRow.inspection_stage,
              generated_3d_model_id: visitRow.generated_3d_model_id || null,
              generated_3d_glb_url: visitRow.generated_3d_glb_url || null,
              generated_3d_sha256: visitRow.generated_3d_sha256 || null
            }
          : null,
        available_visit_photos_count: visitPhotos.length,
        available_visit_photos: visitPhotos,
        latest_generation_job: latestJob
          ? {
              job_id: latestJob.id,
              job_type: latestJob.job_type,
              work_order_id: latestJob.work_order_id,
              status: latestJob.status,
              attempts: latestJob.attempts,
              error_message: latestJob.error_message || null,
              created_at: latestJob.created_at,
              started_at: latestJob.started_at,
              completed_at: latestJob.completed_at,
              result: latestJob.parsed_result
            }
          : null,
        resulting_3d_model: activeModel
          ? {
              id: activeModel.id,
              vehicle_key: activeModel.vehicle_key,
              vehicle_id: activeModel.vehicle_id || null,
              work_order_id: activeModel.work_order_id || null,
              visit_id: activeModel.visit_id || null,
              file_name: activeModel.file_name,
              file_url: activeModel.file_url,
              file_size_bytes: activeModel.file_size_bytes,
              file_sha256: activeModel.file_sha256,
              source: activeModel.source,
              origin_type: activeModel.origin_type,
              classification: activeModel.origin_type === "gerado_por_fotos"
                ? "modelo ilustrativo texturizado"
                : "modelo 3d verificado do acervo",
              source_photos: activeModel.source_photos_json ? JSON.parse(activeModel.source_photos_json) : [],
              created_at: activeModel.created_at
            }
          : null,
        previous_versions_history: previousModels,
        local_generator_audit: {
          builder_file: "services/worker-ai-3d/photo_to_glb_builder.js",
          geometry_determination: "Formas geométricas predefinidas (prismas retangulares fixos em createBoxGeometryData + planos 2D em createPhotoPlaneGeometryData)",
          reconstructs_car_features: false,
          mandatory_label: "modelo ilustrativo texturizado"
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/workshop/photo-to-3d
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "gerar_projecao_3d";
    const rawVehicleKey = body.vehicle_key || "";
    const requestedWorkOrderId = body.work_order_id || "";
    const brand = body.brand || "Volkswagen";
    const model = body.model || "";
    const plate = (body.plate || "").trim();
    const customerName = (body.customer_name || "Cliente Recepção G-Tech").trim();

    const db = getDb();
    const canonical = resolveCanonicalVehicle({
      vehicleKey: rawVehicleKey,
      brand,
      model
    });

    // AÇÃO 1: Abrir fluxo de vistoria próprio para o veículo selecionado no catálogo (sem associá-lo silenciosamente à OS de outro veículo!)
    if (action === "abrir_vistoria_veiculo") {
      let { vehicleRow, woRow } = findVehicleAndWorkOrder(db, canonical, requestedWorkOrderId);
      const slug = (canonical.catalog_id || canonical.vehicle_key.replace(/^volkswagen_/, "")).replace(/[^a-z0-9-]+/g, "-");
      const shortTs = Date.now().toString().slice(-5);

      if (!vehicleRow) {
        const custId = `cust-${slug}-${shortTs}`;
        db.prepare(`
          INSERT OR IGNORE INTO customers (id, company_id, name, phone, email, document, notes)
          VALUES (?, 'gtech-paranagua', ?, '+554196522715', ?, '000.000.000-00', ?)
        `).run(
          custId,
          `${customerName} (${canonical.model_name})`,
          `${slug}@cliente.gtech.pgua.br`,
          `Cadastro aberto pela interface para vistoria do veículo ${canonical.brand} ${canonical.model_name} (${canonical.vehicle_key}).`
        );

        const vehId = `veh-${slug}-${shortTs}`;
        const autoPlate = plate || `VW-${slug.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()}${shortTs.slice(-2)}`;
        db.prepare(`
          INSERT INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type, vehicle_key)
          VALUES (?, ?, ?, ?, ?, '2020', 'Homologado G-Tech', 'Original Vistoria', 45000, 'Gasolina/Flex', ?, ?)
        `).run(
          vehId,
          custId,
          autoPlate,
          canonical.brand,
          canonical.model_name,
          canonical.body_type || "hatch",
          canonical.vehicle_key
        );
        vehicleRow = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehId);
      }

      if (!woRow) {
        const woId = `wo-${slug}-${shortTs}`;
        const osNumber = `GT-OS-${slug.toUpperCase().slice(0, 6)}-${shortTs}`;
        db.prepare(`
          INSERT INTO work_orders (
            id, company_id, os_number, customer_id, vehicle_id,
            assigned_mechanic_id, initial_scope, customer_complaint,
            diagnostic_authorized, diagnostic_fee, fuel_level_entry, km_entry, status, priority
          ) VALUES (?, 'gtech-paranagua', ?, ?, ?, 'user-giovane', ?, ?, 1, 180.0, '1/2', 45000, 'vistoria', 'normal')
        `).run(
          woId,
          osNumber,
          vehicleRow.customer_id,
          vehicleRow.id,
          `Vistoria fotográfica de entrada e geração de modelo ilustrativo texturizado (${canonical.brand} ${canonical.model_name})`,
          `Abertura explícita de vistoria para ${canonical.brand} ${canonical.model_name} (${canonical.vehicle_key}).`
        );
        woRow = db.prepare("SELECT * FROM work_orders WHERE id = ?").get(woId);
      }

      // Garantir registro em wo_inspection_visits
      let visitRow = db.prepare(`
        SELECT * FROM wo_inspection_visits
        WHERE work_order_id = ? AND inspection_stage = 'entrada'
        ORDER BY visit_number DESC LIMIT 1
      `).get(woRow.id) as any;

      if (!visitRow) {
        const maxRow = db.prepare(`
          SELECT COALESCE(MAX(visit_number), 0) as max_visit
          FROM wo_inspection_visits
          WHERE vehicle_id = ?
        `).get(vehicleRow.id) as any;
        const nextVisitNumber = (maxRow?.max_visit || 0) + 1;
        const visitId = `vis-in-${slug}-v${nextVisitNumber}-${shortTs}`;
        db.prepare(`
          INSERT INTO wo_inspection_visits (
            id, work_order_id, vehicle_id, visit_number,
            inspection_stage, odometer_km, fuel_level, photos_json, checklist_json, notes, inspector_name
          ) VALUES (?, ?, ?, ?, 'entrada', 45000, '50%', '{}', '[]', ?, 'Giovane Ribeiro')
        `).run(
          visitId,
          woRow.id,
          vehicleRow.id,
          nextVisitNumber,
          `Vistoria aberta pela interface para ${canonical.brand} ${canonical.model_name} (${canonical.vehicle_key}).`
        );
        visitRow = db.prepare("SELECT * FROM wo_inspection_visits WHERE id = ?").get(visitId);
      }

      return NextResponse.json({
        success: true,
        action: "abrir_vistoria_veiculo",
        message: `Vistoria aberta exclusivamente para ${canonical.brand} ${canonical.model_name} (${canonical.vehicle_key}) • OS ${woRow.os_number} • Visita #${visitRow.visit_number}. Agora anexe as fotografias reais da vistoria e clique em 'Gerar projeção 3D'.`,
        canonical_vehicle_key: canonical.vehicle_key,
        vehicle: vehicleRow,
        work_order: woRow,
        visit: visitRow
      });
    }

    // AÇÃO 2: Validar fotos necessárias e enviar tarefa "Gerar projeção 3D" ao Worker (Porta 3002)
    const { vehicleRow, woRow, effectiveCanonical } = findVehicleAndWorkOrder(db, canonical, requestedWorkOrderId);

    if (!vehicleRow || !woRow) {
      return NextResponse.json(
        {
          success: false,
          error_code: "CATALOG_PHOTO_ONLY_NO_OS",
          error: `A seleção atual (${canonical.brand} ${canonical.model_name} • ${canonical.vehicle_key}) é apenas uma fotografia do catálogo e não possui Ordem de Serviço nem vistoria vinculada. Clique em 'Abrir Vistoria para Este Veículo' e anexe as fotos antes de gerar a projeção 3D.`,
          canonical_vehicle_key: canonical.vehicle_key,
          selection_mode: "apenas_fotografia_catalogo"
        },
        { status: 422 }
      );
    }

    const visitRow = db.prepare(`
      SELECT * FROM wo_inspection_visits
      WHERE work_order_id = ? AND inspection_stage = 'entrada'
      ORDER BY visit_number DESC LIMIT 1
    `).get(woRow.id) as any;

    const visitPhotos = db.prepare(`
      SELECT * FROM wo_visit_photos
      WHERE work_order_id = ?
      ORDER BY created_at ASC
    `).all(woRow.id) as any[];

    if (!visitPhotos || visitPhotos.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error_code: "INSUFFICIENT_VISIT_PHOTOS",
          error: `Validação de fotos reprovada: A vistoria da OS ${woRow.os_number} (${effectiveCanonical.brand} ${effectiveCanonical.model_name} • ${effectiveCanonical.vehicle_key}) possui ${visitPhotos ? visitPhotos.length : 0} fotografia(s) anexada(s). Anexe pelo menos 2 fotografias reais distintas (ex.: Vista Dianteira e Vista Traseira/Lateral) antes de clicar em 'Gerar projeção 3D'.`,
          canonical_vehicle_key: effectiveCanonical.vehicle_key,
          work_order_id: woRow.id,
          os_number: woRow.os_number,
          visit_id: visitRow?.id || null,
          available_visit_photos_count: visitPhotos ? visitPhotos.length : 0
        },
        { status: 422 }
      );
    }

    // Enviar tarefa ao Worker independente na porta 3002
    const workerRes = await fetch(`${WORKER_URL}/jobs/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_type: "reconstruct_3d",
        work_order_id: woRow.id,
        payload: {
          work_order_id: woRow.id,
          os_number: woRow.os_number,
          visit_id: visitRow ? visitRow.id : null,
          visit_number: visitRow ? visitRow.visit_number : 1,
          vehicle_id: vehicleRow.id,
          vehicle_key: effectiveCanonical.vehicle_key,
          brand: vehicleRow.brand,
          model: vehicleRow.model,
          source_photo_ids: visitPhotos.map((p: any) => p.photo_id)
        }
      })
    });

    const workerData = await workerRes.json();
    if (!workerRes.ok || !workerData.success) {
      throw new Error(workerData.error || "Falha ao enfileirar tarefa no Worker IA/3D (Porta 3002).");
    }

    return NextResponse.json({
      success: true,
      action: "gerar_projecao_3d",
      job_id: workerData.job_id,
      status: workerData.status,
      worker_pid: workerData.worker_pid,
      canonical_vehicle_key: effectiveCanonical.vehicle_key,
      vehicle_id: vehicleRow.id,
      work_order_id: woRow.id,
      os_number: woRow.os_number,
      visit_id: visitRow?.id || null,
      source_photos_count: visitPhotos.length,
      classification: "modelo ilustrativo texturizado",
      message: `Tarefa ${workerData.job_id} enviada ao Worker (Porta 3002) para gerar o modelo ilustrativo texturizado de ${effectiveCanonical.brand} ${effectiveCanonical.model_name} (${effectiveCanonical.vehicle_key}).`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

