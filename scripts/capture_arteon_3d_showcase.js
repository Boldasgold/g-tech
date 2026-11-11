const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47";
const WORKSHOP_URL = "http://localhost:3001";
const cdpPort = 9455;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const userDataDir = path.join(__dirname, "../data/edge_cdp_arteon_profile");
  const browser = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--window-size=1600,1150",
    "about:blank"
  ]);

  await sleep(2000);

  const tabs = await fetch(`http://127.0.0.1:${cdpPort}/json`).then(r => r.json());
  const pageTab = tabs.find(t => t.type === "page") || tabs[0];
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

  await new Promise(r => ws.addEventListener("open", r));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1150,
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
    console.log(`[OK] Screenshot salvo: ${dest} (${buf.length} bytes)`);
  };

  try {
    console.log("1. Abrindo /3D-360?vehicle=arteon e aguardando carregamento do GLB (20.26 MB)...");
    await send("Page.navigate", { url: `${WORKSHOP_URL}/3D-360?vehicle=arteon` });

    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const loaded = await evalJs(`Boolean(document.querySelector('[data-testid="verified-3d-audit-badge"]'))`);
      if (loaded) {
        console.log(`   -> Modelo 3D carregado em ${(i + 1) * 0.5}s!`);
        break;
      }
    }
    // Aguardar também os 2 subsistemas (car_chassis.glb e volkswagen_arteon_chassis.glb) terminarem de carregar
    await sleep(2500);

    await evalJs(`
      document.getElementById("gtech-3d-viewer-anchor")?.scrollIntoView({ behavior: "instant", block: "start" });
    `);
    await sleep(600);

    // Captura 1: Carroceria Externa Sólida (volkswagen_arteon_shooting_brake.glb)
    await evalJs(`
      Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Lataria"))?.click();
    `);
    await sleep(800);
    await saveShot("arteon_3d_1_carroceria_solida.png");

    // Captura 2: Raio-X + Suspensão Amarela (car_chassis.glb)
    await evalJs(`
      Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Suspensão"))?.click();
    `);
    await sleep(800);
    await saveShot("arteon_3d_2_raiox_suspensao.png");

    // Captura 3: Raio-X + Motor TSI & Trem de Força (volkswagen_arteon_chassis.glb)
    await evalJs(`
      Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Motor/Trem"))?.click();
    `);
    await sleep(800);
    await saveShot("arteon_3d_3_raiox_motor_trem.png");

  } finally {
    ws.close();
    browser.kill();
  }
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});

