const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47";
const WORKSHOP_URL = "http://localhost:3001";
const cdpPort = 9488;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const userDataDir = path.join(__dirname, "../data/edge_cdp_erp_profile");
  const browser = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--window-size=1680,1050",
    "about:blank"
  ]);

  await sleep(2500);

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
    width: 1680,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  });

  const capture = async (url, filename) => {
    console.log(`\nNavigating to ${url}...`);
    await send("Page.navigate", { url });
    await sleep(2500);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
    console.log(`Saved screenshot: ${outPath} (${shot.data.length} b64 chars)`);
  };

  // 1. Cadastro de Carros / Frota
  await capture(`${WORKSHOP_URL}/oficina?tab=veiculos`, "link_teste_cadastro_carros.png");

  // 2. Cadastro de Clientes
  await capture(`${WORKSHOP_URL}/oficina?tab=clientes`, "link_teste_cadastro_clientes.png");

  // 3. Manutenções Feitas / Histórico de Serviços
  await capture(`${WORKSHOP_URL}/oficina?tab=manutencoes`, "link_teste_manutencoes_feitas.png");

  // 4. Showroom 3D-360 redesenhado e profissional
  await capture(`${WORKSHOP_URL}/3D-360?vehicle=bora`, "link_teste_3d_360_profissional.png");

  ws.close();
  browser.kill();
  console.log("\nAll ERP and 3D screenshots captured successfully!");
}

main().catch(err => {
  console.error("Error in capture:", err);
  process.exit(1);
});

