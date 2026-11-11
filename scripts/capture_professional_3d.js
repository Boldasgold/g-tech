const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47";
const WORKSHOP_URL = "http://localhost:3001";
const cdpPort = 9475;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const userDataDir = path.join(__dirname, "../data/edge_cdp_pro_profile");
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

  const evalJs = async (expr) => {
    const res = await send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  };

  const captureVehicle = async (vehicleId, outputFilename) => {
    console.log(`\nNavigating to ${WORKSHOP_URL}/3D-360?vehicle=${vehicleId}...`);
    await send("Page.navigate", { url: `${WORKSHOP_URL}/3D-360?vehicle=${vehicleId}` });

    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const ready = await evalJs(`
        Boolean(document.querySelector('[data-testid="verified-3d-audit-badge"]'))
      `);
      if (ready) break;
    }

    await sleep(2000);

    // Scroll to the 3D viewer section
    await evalJs(`
      const el = document.getElementById('gtech-3d-viewer-anchor');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    await sleep(1000);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    const outPath = path.join(ARTIFACT_DIR, outputFilename);
    fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
    console.log(`Saved screenshot: ${outPath} (${shot.data.length} b64 chars)`);
  };

  await captureVehicle("bora", "tela_profissional_bora_3d.png");
  await captureVehicle("polo-hatch", "tela_profissional_polo_3d.png");
  await captureVehicle("corsa-hatch", "tela_profissional_corsa_3d.png");

  ws.close();
  browser.kill();
  console.log("\nAll professional 3D screenshots captured successfully!");
}

main().catch(err => {
  console.error("Error in capture:", err);
  process.exit(1);
});

