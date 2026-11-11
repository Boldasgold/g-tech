/**
 * Captura evidências visuais reais no navegador (Microsoft Edge Headless via CDP)
 * para os 5 requisitos da continuação da G-Tech V1.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ARTIFACT_DIR = "C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47";
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

function findEdge() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Microsoft Edge não encontrado.");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

async function captureScreenshot(cdp, fileName) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(data, "base64"));
  console.log("SAVED_SCREENSHOT:", outPath);
  return outPath;
}

async function run() {
  const edgeExe = findEdge();
  const debugPort = 9344;
  const userDataDir = path.join(process.env.TEMP || "C:\\Windows\\Temp", `edge_cdp_v1_p2_${Date.now()}`);

  const proc = spawn(edgeExe, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--window-size=1440,1080",
    "about:blank"
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 25; i++) {
      await sleep(400);
      try {
        const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        targets = await r.json();
        if (targets && targets.length > 0) break;
      } catch {}
    }

    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1120,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 1. Abrir /oficina e selecionar a OS-2026-0901 (wo-v1-fluxo-01) pelo <select> de Ordem de Serviço (ou pela tabela)
    await cdp.send("Page.navigate", { url: "http://localhost:3001/oficina" });
    await sleep(3000);

    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const sel = document.querySelector("select");
        if (sel) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
          if (setter) setter.call(sel, "wo-v1-fluxo-01");
          else sel.value = "wo-v1-fluxo-01";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return "selected_via_dropdown";
        }
        return "no_select";
      })()`
    });
    await sleep(3000);

    // 2. Captura 2: Representação 3D Aproximada Gerada pelas Fotos da Vistoria na Oficina (aba inspecao3d)
    await captureScreenshot(cdp, "evidencia_v1_p2_2_foto_para_3d_aproximado_oficina.png");

    // 3. Mudar para a aba "Vistoria Fotográfica Entrada" e capturar as 4 fotos reais com IDs/SHA-256 + Histórico das 2 Visitas
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const b = btns.find(el => el.textContent && el.textContent.includes("Vistoria Fotográfica Entrada"));
        if (b) b.click();
        return Boolean(b);
      })()`
    });
    await sleep(1800);
    await captureScreenshot(cdp, "evidencia_v1_p2_1_vistoria_fotos_reais_hashes.png");

    // 4. Mudar para a aba "Saída & Controle de Qualidade" e capturar a sequência estrita de 5 marcos + estados do WhatsApp
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const b = btns.find(el => el.textContent && el.textContent.includes("Saída & Controle de Qualidade"));
        if (b) b.click();
        return Boolean(b);
      })()`
    });
    await sleep(1800);
    await captureScreenshot(cdp, "evidencia_v1_p2_3_sequencia_saida_whatsapp_entregue.png");

    // 5. Abrir /3D-360 (Golf IV carregando a representação 3D aproximada gerada pelas fotos)
    await cdp.send("Page.navigate", { url: "http://localhost:3001/3D-360" });
    await sleep(3200);
    await captureScreenshot(cdp, "evidencia_v1_p2_4_scanner_3d_360_aproximado.png");

    cdp.close();
  } finally {
    try {
      proc.kill();
    } catch {}
  }
}

run().catch((e) => {
  console.error("SCREENSHOT_ERR:", e);
  process.exit(1);
});
