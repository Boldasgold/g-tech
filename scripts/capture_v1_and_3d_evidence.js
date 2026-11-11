/**
 * CAPTURA AUTOMATIZADA DE EVIDÊNCIAS VISUAIS NO NAVEGADOR (EDGE CDP WEBSOCKET)
 * - Valida Golf IV, Golf VII, Jetta GLI, Arteon Shooting Brake, troca rápida, falha GLB e reload
 * - Valida Checklist de Entrada, Histórico Multi-Visitas recuperado, Checklist de Saída e Auditoria WhatsApp
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47";
const WORKSHOP_URL = "http://localhost:3001";
const cdpPort = 9446;

async function main() {
  const userDataDir = path.join(__dirname, "../data/edge_cdp_profile");
  const browser = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--window-size=1440,940",
    "about:blank"
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const tabs = await fetch(`http://127.0.0.1:${cdpPort}/json`).then(r => r.json());
  const pageTab = tabs.find(t => t.type === "page") || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 10000000);
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

  await new Promise(r => ws.addEventListener("open", r));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 940,
    deviceScaleFactor: 1,
    mobile: false
  });

  const evalJs = async (expr) => {
    const res = await send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  };

  const saveShot = async (fileName) => {
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const buf = Buffer.from(shot.data, "base64");
    const dest = path.join(ARTIFACT_DIR, fileName);
    fs.writeFileSync(dest, buf);
    console.log(`   [OK] Salvo: ${fileName} (${buf.length} bytes)`);
  };

  try {
    if (process.argv.includes("--only-arteon")) {
      console.log("4. Validando Arteon Shooting Brake + Reload de Persistência (aguardando GLB 20MB finalizar)...");
      await send("Page.navigate", { url: `${WORKSHOP_URL}/3D-360?vehicle=arteon` });
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        const ok = await evalJs(`document.body.innerText.includes('AUDITORIA 3D: CORRESPONDÊNCIA VERIFICADA')`);
        if (ok) {
          console.log(`   -> 1º carregamento concluído em ${(i + 1) * 0.5}s`);
          break;
        }
      }
      await send("Page.reload", { ignoreCache: false });
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        const ok = await evalJs(`document.body.innerText.includes('AUDITORIA 3D: CORRESPONDÊNCIA VERIFICADA')`);
        if (ok) {
          console.log(`   -> Reload concluído e persistido em ${(i + 1) * 0.5}s`);
          break;
        }
      }
      await evalJs(`document.getElementById('gtech-3d-viewer-anchor')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
      await new Promise(r => setTimeout(r, 1500));
      await saveShot("evidencia_4_arteon_3d_verificado.png");
      return;
    }
    console.log("1. Validando Golf IV em /3D-360?vehicle=golf-iv...");
    await send("Page.navigate", { url: `${WORKSHOP_URL}/3D-360?vehicle=golf-iv` });
    await new Promise(r => setTimeout(r, 2500));
    await evalJs(`document.getElementById('gtech-3d-viewer-anchor')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await new Promise(r => setTimeout(r, 800));
    const golfIvText = await evalJs(`document.body.innerText`);
    console.log("   -> Status Golf IV contém aviso:", golfIvText.includes("Projeção 3D deste veículo ainda não disponível"));
    await saveShot("evidencia_1_golf_iv_sem_glb.png");

    // 2. Troca rápida entre veículos (Golf IV -> Arteon -> Golf VII -> Jetta GLI)
    console.log("2. Testando alternância rápida entre veículos -> Jetta GLI...");
    await evalJs(`
      (() => {
        document.querySelector('[data-testid="quick-select-arteon"]')?.click();
        setTimeout(() => document.querySelector('[data-testid="quick-select-golf-vii"]')?.click(), 80);
        setTimeout(() => document.querySelector('[data-testid="quick-select-jetta-gli"]')?.click(), 160);
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
    await saveShot("evidencia_3_jetta_gli_ferrari_bloqueada.png");

    // 3. Golf VII
    console.log("3. Validando Golf VII...");
    await evalJs(`document.querySelector('[data-testid="quick-select-golf-vii"]')?.click()`);
    await new Promise(r => setTimeout(r, 1200));
    await saveShot("evidencia_2_golf_vii_sem_glb.png");

    // 4. Arteon (GLB Verificado) + Reload para confirmar persistência
    console.log("4. Validando Arteon Shooting Brake + Reload de Persistência...");
    await evalJs(`document.querySelector('[data-testid="quick-select-arteon"]')?.click()`);
    await new Promise(r => setTimeout(r, 3200));
    await send("Page.reload", { ignoreCache: false });
    await new Promise(r => setTimeout(r, 4000));
    await evalJs(`document.getElementById('gtech-3d-viewer-anchor')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await new Promise(r => setTimeout(r, 1000));
    await saveShot("evidencia_4_arteon_3d_verificado.png");

    // 5. Simular falha de carregamento GLB
    console.log("5. Testando falha de carregamento GLB...");
    await evalJs(`document.querySelector('[data-testid="quick-select-fail-glb"]')?.click()`);
    await new Promise(r => setTimeout(r, 1200));
    await saveShot("evidencia_5_falha_carregamento_glb.png");

    // Ler IDs das OS criadas na suite de testes
    const testResults = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../data/v1_full_test_results.json"), "utf8")
    );
    const wo1Id = testResults.wo1Id;
    const wo2Id = testResults.wo2Id;

    // 6. Vistoria de Entrada + Histórico Multi-Visitas Recuperado (Visita #2 preservando Visita #1)
    console.log(`6. Capturando Vistoria de Entrada e Histórico Multi-Visitas (${wo2Id})...`);
    await send("Page.navigate", { url: `${WORKSHOP_URL}/oficina?os=${wo2Id}` });
    await new Promise(r => setTimeout(r, 2500));
    await evalJs(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.innerText.includes('Vistoria Fotográfica Entrada'));
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));
    await evalJs(`document.querySelector('[data-testid="vehicle-visits-history-panel"]')?.scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await new Promise(r => setTimeout(r, 600));
    await saveShot("evidencia_6_oficina_vistoria_historico_visitas.png");

    // 7. Checklist de Entrada (10 Grupos)
    console.log(`7. Capturando Checklist de Entrada (${wo1Id})...`);
    await send("Page.navigate", { url: `${WORKSHOP_URL}/oficina?os=${wo1Id}` });
    await new Promise(r => setTimeout(r, 2500));
    await evalJs(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.innerText.includes('Checklist Técnico (10 Grupos)'));
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));
    await saveShot("evidencia_7_oficina_checklist_entrada.png");

    // 8. Checklist de Saída + Resultado do Disparo WhatsApp ("Pronto para Retirada") + Status ENTREGUE
    console.log(`8. Capturando Checklist de Saída e Auditoria WhatsApp (${wo1Id})...`);
    await evalJs(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.innerText.includes('Saída & Controle de Qualidade'));
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));
    await saveShot("evidencia_8_oficina_saida_whatsapp_entregue.png");

    console.log("🎉 Todas as 8 capturas geradas com sucesso!");
  } finally {
    ws.close();
    browser.kill();
  }
}

main().catch(err => {
  console.error("Erro na captura CDP:", err);
  process.exit(1);
});
