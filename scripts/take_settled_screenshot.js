const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47';
const port = 9444;

const browser = spawn(edgePath, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--window-size=1280,850',
  'about:blank'
]);

async function captureUrl(url, outName) {
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 1000000);
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });

  console.log(`Navigated to ${url}, waiting for model to load and settle...`);
  // Wait up to 30s, polling modelStatus
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const isCarregando = text.includes('Carregando 3D');
          const isEspecifico = text.includes('Modelo 3D Original') || text.includes('Específico');
          const isRepresentativo = text.includes('3D Representativo') || text.includes('Ilustrativo');
          const isFalha = text.includes('Falha no Modelo');
          return { isCarregando, isEspecifico, isRepresentativo, isFalha };
        })()
      `,
      returnByValue: true
    });
    const val = res?.result?.value;
    if (val && !val.isCarregando && (val.isEspecifico || val.isRepresentativo || val.isFalha)) {
      console.log(`Settled after ${(i + 1) * 0.5}s:`, val);
      break;
    }
  }

  // Extra 2s for rendering frame
  await new Promise(r => setTimeout(r, 2000));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  const dest = `${artifactDir}\\${outName}`;
  fs.writeFileSync(dest, buf);
  console.log(`Saved screenshot: ${dest} (${buf.length} bytes)`);
  ws.close();
}

async function main() {
  await new Promise(r => setTimeout(r, 1500));
  try {
    await captureUrl('http://localhost:3000/oficina?os=wo-demo-132&tab=inspecao3d', 'captura_oficina_arteon.png');
    await captureUrl('http://localhost:3000/oficina?os=wo-demo-129&tab=inspecao3d', 'captura_oficina_jetta_gli.png');
    await captureUrl('http://localhost:3000/oficina?os=wo-demo-128&tab=inspecao3d', 'captura_oficina_golf_gti.png');
    await captureUrl('http://localhost:3000/3D-360', 'captura_3d_360_vw.png');
  } finally {
    browser.kill();
  }
}

main().catch(e => {
  console.error(e);
  browser.kill();
});

