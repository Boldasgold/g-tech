const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9224;

const browser = spawn(edgePath, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--disable-gpu',
  'about:blank'
]);

async function run() {
  await new Promise(r => setTimeout(r, 1500));
  const list = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
  const wsUrl = list[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);

  let id = 1;
  const send = (method, params = {}) => {
    const msgId = id++;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return msgId;
  };

  ws.addEventListener('open', () => {
    send('Runtime.enable');
    send('Page.enable');
    send('Console.enable');
    send('Page.navigate', { url: 'http://localhost:3000/oficina?os=wo-demo-129&tab=inspecao3d' });
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
      console.log(`[CONSOLE ${msg.params.type}]`, args);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[EXCEPTION]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    }
  });

  setTimeout(() => {
    ws.close();
    browser.kill();
    process.exit(0);
  }, 10000);
}

run().catch(err => {
  console.error(err);
  browser.kill();
  process.exit(1);
});
