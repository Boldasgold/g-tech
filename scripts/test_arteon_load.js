const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9555;

const browser = spawn(edgePath, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--window-size=1280,850',
  'about:blank'
]);

async function run() {
  await new Promise(r => setTimeout(r, 1500));
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

  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
      console.log(`[PAGE LOG ${msg.params.type}]`, text);
    }
  });

  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  console.log("Navigating to test Arteon GLB directly in Three.js...");
  await send('Page.navigate', { url: 'http://localhost:3000/oficina' });
  await new Promise(r => setTimeout(r, 4000));

  const testRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const res = await fetch('/models/vehicles/volkswagen_arteon_shooting_brake.glb');
          const blob = await res.blob();
          return { status: res.status, size: blob.size, type: blob.type };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log("Fetch Arteon GLB in browser:", JSON.stringify(testRes));

  ws.close();
  browser.kill();
}

run().catch(e => {
  console.error(e);
  browser.kill();
});

