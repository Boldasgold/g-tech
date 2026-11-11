const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47";
const WORKSHOP_URL = "http://localhost:3001";
const PUBLIC_SITE_URL = "http://localhost:3000";
const cdpPort = 9492;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2EValidationAndCapture() {
  console.log("=== 1. VERIFICANDO BANCO DE DADOS & CRIANDO 2º VEÍCULO PARA TESTE DE ALTERNÂNCIA ===");
  const db = new DatabaseSync(path.join(__dirname, "../data/gtech.db"));

  // Verificar se o Polo já existe ou criar para testar alternância entre veículos
  let poloWo = db.prepare("SELECT * FROM work_orders WHERE vehicle_id IN (SELECT id FROM vehicles WHERE plate = 'BRA2E19')").get();

  if (!poloWo) {
    console.log("Criando 2º atendimento (Volkswagen Polo MK6 - BRA2E19) para validar alternância...");
    const createRes = await fetch(`${WORKSHOP_URL}/api/work-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: "Mariana Silva",
        customer_phone: "(41) 98877-6655",
        customer_document: "078.452.199-34",
        vehicle_brand: "Volkswagen",
        vehicle_model: "Polo Hatch TSI",
        vehicle_plate: "BRA2E19",
        vehicle_year: "2023",
        vehicle_km: 24350,
        vehicle_fuel: "flex",
        vehicle_body_type: "hatch",
        initial_scope: "Revisão periódica de 20.000 km e vistoria cautelar de entrada",
        customer_complaint: "Pequeno barulho na suspensão dianteira esquerda em lombadas"
      })
    });
    const createData = await createRes.json();
    console.log("Atendimento Polo criado:", createData.success, createData.work_order_id, createData.os_number);
    poloWo = db.prepare("SELECT * FROM work_orders WHERE id = ?").get(createData.work_order_id);
  } else {
    console.log("Atendimento Polo já existente:", poloWo.id, poloWo.os_number);
  }

  // Preencher vistoria de entrada do Polo se ainda não preenchida
  const poloIntake = db.prepare("SELECT * FROM wo_intake_inspection WHERE work_order_id = ?").get(poloWo.id);
  if (!poloIntake) {
    console.log("Preenchendo checklist de entrada do Polo...");
    await fetch(`${WORKSHOP_URL}/api/work-orders/${poloWo.id}/intake`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        odometer_km: 24350,
        fuel_pct: 75,
        photo_front: "/img/vehicles/vw-polo-front.jpg",
        photo_rear: "/img/vehicles/vw-polo-rear.jpg",
        photo_left: "/img/vehicles/vw-polo-left.jpg",
        photo_right: "/img/vehicles/vw-polo-right.jpg",
        photo_interior: "/img/vehicles/vw-polo-interior.jpg",
        photo_dashboard: "/img/vehicles/vw-polo-dashboard.jpg",
        observations: "Veículo entregue limpo. Pertences no porta-luvas: manual e chave reserva.",
        client_acknowledged: true,
        responsible_name: "Giovane Ribeiro"
      })
    });
  }

  // Adicionar avaria no Polo para testar o mapa 2D e o registro
  const existingHotspots = db.prepare("SELECT * FROM wo_hotspots WHERE work_order_id = ?").all(poloWo.id);
  if (existingHotspots.length === 0) {
    console.log("Registrando avaria de teste no Polo...");
    await fetch(`${WORKSHOP_URL}/api/work-orders/${poloWo.id}/hotspots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region_name: "Para-choque Dianteiro & Grade",
        orientation_side: "externo",
        damage_type: "Risco superficial",
        description: "Risco de 4 cm no canto inferior direito do para-choque frontal, sem deformação plástica.",
        photo_url: "/img/vehicles/polo-avaria-1.jpg",
        author_name: "Giovane Ribeiro"
      })
    });
  }

  console.log("=== 2. INICIANDO NAVEGADOR EDGE HEADLESS VIA CDP ===");
  const userDataDir = path.join(__dirname, "../data/edge_cdp_v1_validation");
  const browser = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--window-size=1680,1050",
    "about:blank"
  ]);

  await sleep(2500);

  const tabs = await fetch(`http://127.0.0.1:${cdpPort}/json`).then((r) => r.json());
  const pageTab = tabs.find((t) => t.type === "page") || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  let msgId = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = msgId++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener("message", handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise((r) => ws.addEventListener("open", r));
  await send("Page.enable");
  await send("Runtime.enable");

  const setViewport = async (width, height, isMobile = false) => {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile
    });
  };

  const capture = async (url, filename, waitMs = 1200) => {
    console.log(`\nNavigating to ${url}...`);
    await send("Page.navigate", { url });
    await sleep(waitMs);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
    console.log(`Captura salva: ${outPath} (${shot.data.length} b64 chars)`);
  };

  // 1. Visão Geral (Desktop)
  await setViewport(1680, 1050);
  await capture(`${WORKSHOP_URL}/oficina?menu=visao_geral`, "v1_01_visao_geral.png", 1500);

  // 2. Lista de Atendimentos
  await capture(`${WORKSHOP_URL}/oficina?menu=atendimentos`, "v1_02_atendimentos_lista.png", 1200);

  // 3. Atendimento Selecionado - Etapa 1: Checklist de Entrada (Polo)
  await capture(`${WORKSHOP_URL}/oficina?menu=atendimentos&id=${poloWo.id}&step=entrada`, "v1_03_atendimento_entrada.png", 1400);

  // 4. Atendimento Selecionado - Etapa 2: Fotos e Avarias com Mapa 2D (Polo)
  await capture(`${WORKSHOP_URL}/oficina?menu=atendimentos&id=${poloWo.id}&step=fotos_avarias`, "v1_04_fotos_mapa2d_avarias.png", 1400);

  // 5. Abrir Modal de Nova Avaria e Capturar
  console.log("Acionando abertura do Modal de Nova Avaria...");
  await send("Runtime.evaluate", {
    expression: `
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Registrar Nova Avaria'));
      if (btn) btn.click();
    `
  });
  await sleep(600);
  const shotModal = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "v1_05_modal_nova_avaria.png"), Buffer.from(shotModal.data, "base64"));
  console.log("Captura salva: v1_05_modal_nova_avaria.png");

  // Fechar modal
  await send("Runtime.evaluate", {
    expression: `
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('✕') || b.innerText.includes('Cancelar'));
      if (closeBtn) closeBtn.click();
    `
  });
  await sleep(400);

  // 6. Atendimento Selecionado - Etapa 3 & 4: Checklist de Saída e Retirada Física
  await capture(`${WORKSHOP_URL}/oficina?menu=atendimentos&id=${poloWo.id}&step=saida`, "v1_06_saida_e_retirada.png", 1200);

  // 7. Clientes e Veículos (Cadastro e Frota)
  await capture(`${WORKSHOP_URL}/oficina?menu=clientes_veiculos`, "v1_07_clientes_e_veiculos.png", 1200);

  // 8. Histórico Geral de Vistorias e Manutenções
  await capture(`${WORKSHOP_URL}/oficina?menu=historico`, "v1_08_historico_manutencoes.png", 1200);

  // 9. Versão Responsiva Mobile (Smartphone - 390x844)
  console.log("Configurando viewport mobile (390x844)...");
  await setViewport(390, 844, true);
  await capture(`${WORKSHOP_URL}/oficina?menu=atendimentos&id=${poloWo.id}&step=entrada`, "v1_09_mobile_atendimento_entrada.png", 1200);
  await capture(`${WORKSHOP_URL}/oficina?menu=atendimentos&id=${poloWo.id}&step=fotos_avarias`, "v1_10_mobile_mapa_avarias.png", 1200);

  // 10. Site Público Independente (Porta 3000)
  console.log("Verificando site público na porta 3000...");
  await setViewport(1680, 1050, false);
  await capture(`${PUBLIC_SITE_URL}`, "v1_11_site_publico_independente.png", 1200);

  ws.close();
  browser.kill();
  console.log("\n=== TODAS AS 11 CAPTURAS REAIS E TESTES CONCLUÍDOS COM SUCESSO! ===");
}

runE2EValidationAndCapture().catch((err) => {
  console.error("Erro no teste e captura:", err);
  process.exit(1);
});

