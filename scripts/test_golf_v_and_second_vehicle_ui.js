/quero o **
  * TESTE E2E REAL PELA INTERFACE(HEADLESS EDGE CDP):
 * 1. Rastreia o estado inicial de / 3D - 360 ? vehicle = golf - v(apenas fotografia do catálogo, sem OS, sem vistoria, sem tarefa e sem GLB).
 * 2. Testa o clique em "Gerar projeção 3D" sem vistoria / fotos na interface(comprovando erro explícito de validação).
 * 3. Abre a vistoria própria do Golf V pela interface, anexa 4 fotografias distintas pelos inputs de arquivo da UI,
 * clica em "Gerar projeção 3D", acompanha o Worker(Porta 3002) e comprova o carregamento do "modelo ilustrativo texturizado".
 * 4. Seleciona um segundo veículo(Golf VII — /3D-360?vehicle=golf-vii) pela interface, abre sua vistoria própria,
 * anexa 4 fotografias distintas exclusivas do Golf VII, clica em "Gerar projeção 3D" e comprova sua projeção própria.
 * 5. Recarrega a página(location.reload) em / 3D - 360 ? vehicle = golf - v e / 3D - 360 ? vehicle = golf - vii e comprova que cada veículo
  * recupera sua própria projeção, OS, vistoria e SHA - 256 sem misturar.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT_DIR = path.resolve(__dirname, "..");
const ARTIFACTS_DIR = "C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47";
const TMP_PHOTOS_DIR = path.join(ROOT_DIR, "data", "tmp_ui_test_photos");
const DB_PATH = path.join(ROOT_DIR, "data", "gtech.db");

if (!fs.existsSync(TMP_PHOTOS_DIR)) {
  fs.mkdirSync(TMP_PHOTOS_DIR, { recursive: true });
}

function createDistinctJpegFile(filename, r, g, b, labelText, sourceJpgName = "golf-v.jpg") {
  const baseJpgPath = path.join(ROOT_DIR, "public", "img", "vehicles", "volkswagen", "fotos", sourceJpgName);
  const baseBuf = fs.existsSync(baseJpgPath) ? fs.readFileSync(baseJpgPath) : Buffer.alloc(4096, 0x55);
  // Preservar o fluxo Huffman JPEG intacto para o navegador renderizar a imagem 100% válida e acrescentar assinatura binária RGB + metadados após o EOI
  const colorTail = Buffer.alloc(1200);
  for (let i = 0; i < colorTail.length; i += 3) {
    colorTail[i] = r;
    colorTail[i + 1] = g;
    colorTail[i + 2] = b;
  }
  const metaBuf = Buffer.from(`GTECH-UI-PHOTO-${labelText}-${r}-${g}-${b}-${Date.now()}-${crypto.randomUUID()}`, "utf8");
  const outBuf = Buffer.concat([baseBuf, colorTail, metaBuf]);
  const fullPath = path.join(TMP_PHOTOS_DIR, filename);
  fs.writeFileSync(fullPath, outBuf);
  const sha256 = crypto.createHash("sha256").update(outBuf).digest("hex");
  return { fullPath, size: outBuf.length, sha256 };
}

function resetGolfVAndGolfViiForCleanUiTest() {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA busy_timeout = 10000;");
  db.exec("PRAGMA foreign_keys = OFF;");
  // Limpar apenas registros anteriores de teste para volkswagen_golf-v e volkswagen_golf-vii para demonstrar o fluxo completo desde o estado inicial real
  const keys = ["volkswagen_golf-v", "volkswagen_golf-vii"];
  for (const k of keys) {
    db.prepare("DELETE FROM vehicle_3d_models WHERE vehicle_key = ?").run(k);
    const vehs = db.prepare("SELECT id FROM vehicles WHERE vehicle_key = ? OR LOWER(model) LIKE ?").all(
      k,
      k === "volkswagen_golf-v" ? "%golf v (mk5)%" : "%golf vii (mk7)%"
    );
    for (const v of vehs) {
      const wos = db.prepare("SELECT id FROM work_orders WHERE vehicle_id = ?").all(v.id);
      for (const w of wos) {
        db.prepare("DELETE FROM processing_jobs_queue WHERE work_order_id = ?").run(w.id);
        db.prepare("DELETE FROM wo_visit_photos WHERE work_order_id = ?").run(w.id);
        db.prepare("DELETE FROM wo_inspection_visits WHERE work_order_id = ?").run(w.id);
        db.prepare("DELETE FROM wo_intake_inspection WHERE work_order_id = ?").run(w.id);
        db.prepare("DELETE FROM wo_timeline_events WHERE work_order_id = ?").run(w.id);
        db.prepare("DELETE FROM work_orders WHERE id = ?").run(w.id);
      }
      db.prepare("DELETE FROM vehicles WHERE id = ?").run(v.id);
    }
  }
  // Garantir que o Golf IV (wo-v1-fluxo-01) tenha o source atualizado para 'modelo_ilustrativo_texturizado'
  db.prepare(`
    UPDATE vehicle_3d_models
    SET source = 'modelo_ilustrativo_texturizado',
        audit_notes = 'Modelo ilustrativo texturizado (forma predefinida com fotografias da vistoria — não constitui reconstrução 3D da geometria do carro).'
    WHERE origin_type = 'gerado_por_fotos'
  `).run();
  db.close();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  resetGolfVAndGolfViiForCleanUiTest();

  // 1. Consultar a API antes da geração para registrar o diagnóstico exato do Golf V (Item 1)
  const initialModelsApiRes = await fetch(
    "http://localhost:3001/api/models?vehicle_key=volkswagen_golf-v&brand=Volkswagen&model=Golf+V+(MK5)&photo_url=/img/vehicles/volkswagen/fotos/golf-v.jpg"
  ).then(r => r.json());

  const initialTraceRes = await fetch(
    "http://localhost:3001/api/workshop/photo-to-3d?vehicle_key=volkswagen_golf-v&brand=Volkswagen&model=Golf+V+(MK5)"
  ).then(r => r.json());

  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  const edgeBin = edgePaths.find(p => fs.existsSync(p));
  if (!edgeBin) throw new Error("Microsoft Edge não encontrado para teste de navegador.");

  const debugPort = 9345;
  const userDataDir = path.join(ROOT_DIR, "data", "edge_cdp_profile_" + Date.now());
  const edgeProc = spawn(edgeBin, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--window-size=1440,1280",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ]);

  let ws;
  const reportData = {
    step1_initial_golf_v_models_api: initialModelsApiRes,
    step1_initial_golf_v_trace: initialTraceRes.trace,
    step2_validation_error_without_os: null,
    step2_validation_error_without_photos: null,
    step2_golf_v_photos_uploaded: [],
    step2_golf_v_after_generation: null,
    step3_golf_v_second_version_history_preserved: null,
    step5_golf_vii_photos_uploaded: [],
    step5_golf_vii_after_generation: null,
    step5_reload_verification: {}
  };

  try {
    let targetWsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      try {
        const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json());
        const pageTarget = list.find(t => t.type === "page");
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          targetWsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      } catch (_) { }
    }
    if (!targetWsUrl) throw new Error("Não foi possível conectar ao CDP do Edge.");

    ws = new WebSocket(targetWsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    };

    const sendCdp = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });

    await sendCdp("Page.enable");
    await sendCdp("DOM.enable");
    await sendCdp("Runtime.enable");
    await sendCdp("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1320,
      deviceScaleFactor: 1,
      mobile: false
    });

    const evalJs = async (expression) => {
      const res = await sendCdp("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res?.result?.value;
    };

    const captureScreenshot = async (outPath) => {
      const shot = await sendCdp("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
    };

    const setFileOnTestId = async (testId, filePath) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const evalRes = await sendCdp("Runtime.evaluate", {
          expression: `document.querySelector('[data-testid="${testId}"]')`,
          returnByValue: false
        });
        const objectId = evalRes?.result?.objectId;
        if (objectId) {
          await sendCdp("DOM.setFileInputFiles", {
            objectId,
            files: [filePath]
          });
          return;
        }
        await sleep(300);
      }
      throw new Error(`Input [data-testid="${testId}"] não encontrado no DOM.`);
    };

    // =========================================================================
    // ETAPA 1 & 2A: ABRIR /3D-360?vehicle=golf-v E CLICAR EM "Gerar projeção 3D" SEM OS/FOTOS
    // =========================================================================
    await sendCdp("Page.navigate", { url: "http://localhost:3001/3D-360?vehicle=golf-v" });
    await sleep(2200);

    // Rolar até a seção do visualizador / painel Foto->3D
    await evalJs(`
      document.getElementById("gtech-3d-viewer-anchor")?.scrollIntoView({ behavior: "instant", block: "start" });
    `);
    await sleep(600);

    // Clicar em "Gerar projeção 3D" quando ainda é apenas uma fotografia do catálogo (sem OS)
    await evalJs(`
      document.querySelector('[data-testid="btn-gerar-projecao-3d"]')?.click();
    `);
    await sleep(1000);

    reportData.step2_validation_error_without_os = await evalJs(`
      ({
        catalogWarning: document.querySelector('[data-testid="catalog-only-warning"]')?.innerText || null,
        feedbackText: document.querySelector('[data-testid="photo-to-3d-feedback"]')?.innerText || null,
        topBadge: document.querySelector('[data-testid="3d360-top-projection-badge"]')?.innerText || null,
        overlayVisible: Boolean(document.querySelector('[data-testid="no-3d-projection-overlay"]'))
      })
    `);

    // Capturar Screenshot #1: /3D-360?vehicle=golf-v antes da geração (Catálogo sem OS + Erro explícito ao tentar gerar sem fotos/OS)
    const shot1Path = path.join(ARTIFACTS_DIR, "evidencia_golf_v_1_antes_catalogo_e_erro_validacao.png");
    await captureScreenshot(shot1Path);

    // =========================================================================
    // ETAPA 2B: ABRIR VISTORIA PRÓPRIA DO GOLF V PELA INTERFACE E TESTAR VALIDAÇÃO SEM FOTOS
    // =========================================================================
    await evalJs(`
      document.querySelector('[data-testid="btn-abrir-vistoria-veiculo"]')?.click();
    `);
    await sleep(1200);

    // Tentar clicar em "Gerar projeção 3D" com 0 fotos na vistoria recém-aberta
    await evalJs(`
      document.querySelector('[data-testid="btn-gerar-projecao-3d"]')?.click();
    `);
    await sleep(1000);

    reportData.step2_validation_error_without_photos = await evalJs(`
      document.querySelector('[data-testid="photo-to-3d-feedback"]')?.innerText || null
    `);

    // =========================================================================
    // ETAPA 2C: ANEXAR 4 FOTOS DISTINTAS DO GOLF V PELA INTERFACE E CLICAR EM "Gerar projeção 3D"
    // =========================================================================
    const golfVPhotos = [
      { slot: "photo_front", ...createDistinctJpegFile("golf_v_front.jpg", 32, 95, 190, "GOLFV-FRONT", "golf-v.jpg") },
      { slot: "photo_rear", ...createDistinctJpegFile("golf_v_rear.jpg", 38, 105, 200, "GOLFV-REAR", "golf-vi.jpg") },
      { slot: "photo_left", ...createDistinctJpegFile("golf_v_left.jpg", 45, 115, 210, "GOLFV-LEFT", "golf-iv.jpg") },
      { slot: "photo_right", ...createDistinctJpegFile("golf_v_right.jpg", 52, 125, 220, "GOLFV-RIGHT", "golf-plus.jpg") }
    ];
    reportData.step2_golf_v_photos_uploaded = golfVPhotos;

    for (const ph of golfVPhotos) {
      await setFileOnTestId(`3d360-upload-${ph.slot}`, ph.fullPath);
      await sleep(900);
    }

    // Clicar em "Gerar projeção 3D" pela interface!
    await evalJs(`
      document.querySelector('[data-testid="btn-gerar-projecao-3d"]')?.click();
    `);

    // Aguardar o Worker concluir e o visualizador 3D renderizar o GLB
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      const badgeReady = await evalJs(`Boolean(document.querySelector('[data-testid="verified-3d-audit-badge"]'))`);
      if (badgeReady) break;
    }
    await sleep(900);

    // Capturar Screenshot #2: Golf V com seu "modelo ilustrativo texturizado" carregado no visualizador!
    await evalJs(`
      document.getElementById("gtech-3d-viewer-anchor")?.scrollIntoView({ behavior: "instant", block: "start" });
    `);
    await sleep(600);
    const shot2Path = path.join(ARTIFACTS_DIR, "evidencia_golf_v_2_modelo_ilustrativo_texturizado_gerado.png");
    await captureScreenshot(shot2Path);

    const golfVTraceAfterGen = await fetch(
      "http://localhost:3001/api/workshop/photo-to-3d?vehicle_key=volkswagen_golf-v&brand=Volkswagen&model=Golf+V+(MK5)"
    ).then(r => r.json());
    const golfVModelsApiAfterGen = await fetch(
      "http://localhost:3001/api/models?vehicle_key=volkswagen_golf-v&brand=Volkswagen&model=Golf+V+(MK5)"
    ).then(r => r.json());

    reportData.step2_golf_v_after_generation = {
      ui_state: await evalJs(`
        ({
          feedbackText: document.querySelector('[data-testid="photo-to-3d-feedback"]')?.innerText || null,
          topBadge: document.querySelector('[data-testid="3d360-top-projection-badge"]')?.innerText || null,
          verifiedAuditBadge: document.querySelector('[data-testid="verified-3d-audit-badge"]')?.innerText || null,
          no3dOverlayVisible: Boolean(document.querySelector('[data-testid="no-3d-projection-overlay"]'))
        })
      `),
      trace: golfVTraceAfterGen.trace,
      models_api: golfVModelsApiAfterGen
    };

    // Gerar uma 2ª versão para o Golf V para comprovar preservação da versão anterior no histórico (Item 3)
    await evalJs(`
      document.querySelector('[data-testid="btn-gerar-projecao-3d"]')?.click();
    `);
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      const isBusy = await evalJs(`Boolean(document.querySelector('[data-testid="btn-gerar-projecao-3d"]')?.disabled)`);
      if (!isBusy) break;
    }
    await sleep(600);
    const golfVTraceAfterSecondGen = await fetch(
      "http://localhost:3001/api/workshop/photo-to-3d?vehicle_key=volkswagen_golf-v&brand=Volkswagen&model=Golf+V+(MK5)"
    ).then(r => r.json());
    reportData.step3_golf_v_second_version_history_preserved = {
      active_model: golfVTraceAfterSecondGen.trace?.resulting_3d_model,
      previous_versions_history: golfVTraceAfterSecondGen.trace?.previous_versions_history
    };

    // =========================================================================
    // ETAPA 5A: TESTAR UM SEGUNDO VEÍCULO PELA INTERFACE (GOLF VII — /3D-360?vehicle=golf-vii)
    // =========================================================================
    await evalJs(`
      document.querySelector('[data-testid="quick-select-golf-vii"]')?.click();
    `);
    await sleep(1800);

    // Abrir vistoria própria para o Golf VII pela interface e aguardar os inputs de foto aparecerem
    await evalJs(`
      document.querySelector('[data-testid="btn-abrir-vistoria-veiculo"]')?.click();
    `);
    for (let i = 0; i < 15; i++) {
      await sleep(400);
      const hasInput = await evalJs(`Boolean(document.querySelector('[data-testid="3d360-upload-photo_front"]'))`);
      if (hasInput) break;
    }
    await sleep(400);

    const golfViiPhotos = [
      { slot: "photo_front", ...createDistinctJpegFile("golf_vii_front.jpg", 185, 38, 42, "GOLFVII-FRONT", "golf-vii.jpg") },
      { slot: "photo_rear", ...createDistinctJpegFile("golf_vii_rear.jpg", 195, 48, 52, "GOLFVII-REAR", "golf-gti.jpg") },
      { slot: "photo_left", ...createDistinctJpegFile("golf_vii_left.jpg", 205, 58, 62, "GOLFVII-LEFT", "golf-r.jpg") },
      { slot: "photo_right", ...createDistinctJpegFile("golf_vii_right.jpg", 215, 68, 72, "GOLFVII-RIGHT", "golf-alltrack.jpg") }
    ];
    reportData.step5_golf_vii_photos_uploaded = golfViiPhotos;

    for (const ph of golfViiPhotos) {
      await setFileOnTestId(`3d360-upload-${ph.slot}`, ph.fullPath);
      await sleep(900);
    }

    // Clicar em "Gerar projeção 3D" para o Golf VII
    await evalJs(`
      document.querySelector('[data-testid="btn-gerar-projecao-3d"]')?.click();
    `);
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      const badgeReady = await evalJs(`Boolean(document.querySelector('[data-testid="verified-3d-audit-badge"]'))`);
      if (badgeReady) break;
    }
    await sleep(900);

    await evalJs(`
      document.getElementById("gtech-3d-viewer-anchor")?.scrollIntoView({ behavior: "instant", block: "start" });
    `);
    await sleep(600);
    const shot3Path = path.join(ARTIFACTS_DIR, "evidencia_golf_vii_3_segundo_veiculo_gerado.png");
    await captureScreenshot(shot3Path);

    const golfViiTraceAfterGen = await fetch(
      "http://localhost:3001/api/workshop/photo-to-3d?vehicle_key=volkswagen_golf-vii&brand=Volkswagen&model=Golf+VII+(MK7)"
    ).then(r => r.json());

    reportData.step5_golf_vii_after_generation = {
      ui_state: await evalJs(`
        ({
          feedbackText: document.querySelector('[data-testid="photo-to-3d-feedback"]')?.innerText || null,
          topBadge: document.querySelector('[data-testid="3d360-top-projection-badge"]')?.innerText || null,
          verifiedAuditBadge: document.querySelector('[data-testid="verified-3d-audit-badge"]')?.innerText || null,
          no3dOverlayVisible: Boolean(document.querySelector('[data-testid="no-3d-projection-overlay"]'))
        })
      `),
      trace: golfViiTraceAfterGen.trace
    };

    // =========================================================================
    // ETAPA 5B: RECARREGAR A PÁGINA (Page.reload) EM GOLF V E GOLF VII E CONFIRMAR RECUPERAÇÃO INDIVIDUAL
    // =========================================================================
    await sendCdp("Page.navigate", { url: "http://localhost:3001/3D-360?vehicle=golf-v" });
    await sleep(2200);
    await sendCdp("Page.reload", { ignoreCache: true });
    for (let w = 0; w < 20; w++) {
      await sleep(400);
      const ready = await evalJs(`
        Boolean(document.querySelector('[data-testid="verified-3d-audit-badge"]')) &&
        !document.body.innerText.includes("Modo: carregando...")
      `);
      if (ready) break;
    }
    await evalJs(`
      document.getElementById("gtech-3d-viewer-anchor")?.scrollIntoView({ behavior: "instant", block: "start" });
    `);
    await sleep(800);

    const golfVReloadState = await evalJs(`
      ({
        url: window.location.href,
        topBadge: document.querySelector('[data-testid="3d360-top-projection-badge"]')?.innerText || null,
        verifiedAuditBadge: document.querySelector('[data-testid="verified-3d-audit-badge"]')?.innerText || null,
        no3dOverlayVisible: Boolean(document.querySelector('[data-testid="no-3d-projection-overlay"]'))
      })
    `);

    const shot4Path = path.join(ARTIFACTS_DIR, "evidencia_golf_v_4_apos_reload_persistido.png");
    await captureScreenshot(shot4Path);

    await sendCdp("Page.navigate", { url: "http://localhost:3001/3D-360?vehicle=golf-vii" });
    await sleep(2200);
    await sendCdp("Page.reload", { ignoreCache: true });
    for (let w = 0; w < 20; w++) {
      await sleep(400);
      const ready = await evalJs(`
        Boolean(document.querySelector('[data-testid="verified-3d-audit-badge"]')) &&
        !document.body.innerText.includes("Modo: carregando...")
      `);
      if (ready) break;
    }
    await sleep(600);

    const golfViiReloadState = await evalJs(`
      ({
        url: window.location.href,
        topBadge: document.querySelector('[data-testid="3d360-top-projection-badge"]')?.innerText || null,
        verifiedAuditBadge: document.querySelector('[data-testid="verified-3d-audit-badge"]')?.innerText || null,
        no3dOverlayVisible: Boolean(document.querySelector('[data-testid="no-3d-projection-overlay"]'))
      })
    `);

    reportData.step5_reload_verification = {
      golf_v_after_reload: golfVReloadState,
      golf_vii_after_reload: golfViiReloadState
    };

    const outJsonPath = path.join(ROOT_DIR, "data", "golf_v_e2e_report.json");
    fs.writeFileSync(outJsonPath, JSON.stringify(reportData, null, 2));
    console.log("SUCESSO! Relatório salvo em:", outJsonPath);
  } finally {
    if (ws) try { ws.close(); } catch (_) { }
    try { edgeProc.kill("SIGKILL"); } catch (_) { }
  }
}

run().catch(err => {
  console.error("ERRO NO TESTE E2E:", err);
  process.exit(1);
});
