const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9333;

const browser = spawn(edgePath, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--disable-gpu',
  'about:blank'
]);

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  console.log("Found tab:", pageTab.title, pageTab.url);
  const wsUrl = pageTab.webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);

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

  ws.addEventListener('open', async () => {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Console.enable');
    console.log("Navigating...");
    await send('Page.navigate', { url: 'http://localhost:3000/oficina?os=wo-demo-129&tab=inspecao3d' });

    // Wait 8 seconds for page load and model attempt
    await new Promise(r => setTimeout(r, 8000));

    // Evaluate in page
    const res = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            return {
              href: window.location.href,
              origin: window.location.origin
            };
          } catch (e) {
            return { error: e.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log("Location:", JSON.stringify(res));

    const netRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const r = await fetch(window.location.origin + '/models/vehicles/volkswagen_jetta_gli.glb');
            return { status: r.status };
          } catch (e) {
            return { error: e.name + ': ' + e.message, stack: e.stack };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log("Fetch test:", JSON.stringify(netRes));

    // Check window errors or console logs
    const modelStatusRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[title*="Falha"], button[title*="Ilustrativo"], button[title*="específico"]');
          return {
            buttonText: btn ? btn.innerText : 'null',
            buttonTitle: btn ? btn.getAttribute('title') : 'null'
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Button status:", JSON.stringify(modelStatusRes));

    ws.close();
    browser.kill();
  });
}

run().catch(e => {
  console.error("Runner error:", e);
  browser.kill();
});
