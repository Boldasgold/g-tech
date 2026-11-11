const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\tiujo\\.gemini\\antigravity\\brain\\81f1ee1a-b96b-49de-99b5-43ad29321e47';
const cdpPort = 9499;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('--- 1. VERIFICANDO RESPOSTAS HTTP DAS 3 PORTAS ---');
  async function checkHttp(name, url) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      const ms = Date.now() - t0;
      console.log(`[${name}] HTTP ${res.status} em ${ms}ms (${text.length} bytes)`);
      return { ok: true, status: res.status, ms, len: text.length };
    } catch(e) {
      const ms = Date.now() - t0;
      console.log(`[${name}] ERRO em ${ms}ms: ${e.message}`);
      return { ok: false, error: e.message, ms };
    }
  }

  // Consulta 1
  await checkHttp('PORTA 3000 (Site Público - 1ª consulta)', 'http://localhost:3000/');
  await checkHttp('PORTA 3002 (Worker IA/3D - 1ª consulta)', 'http://localhost:3002/');
  await checkHttp('PORTA 3001 (Vistorias V1 - 1ª consulta)', 'http://localhost:3001/vistorias');

  // Consulta 2 (Verificação de repetição / cache)
  console.log('\n--- 2. SEGUNDA ABERTURA / REQUISIÇÃO REPETIDA ---');
  await checkHttp('PORTA 3001 (Vistorias V1 - 2ª consulta)', 'http://localhost:3001/vistorias');
  await checkHttp('PORTA 3001 (API Work-Orders)', 'http://localhost:3001/api/work-orders');

  console.log('\n--- 3. ABRINDO NOVO NAVEGADOR EDGE HEADLESS VIA CDP ---');
  const userDataDir = path.join(__dirname, '../data/edge_cdp_live_v1');
  const browser = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--window-size=1680,1050',
    'about:blank'
  ]);

  await sleep(1500);

  const tabs = await fetch(`http://127.0.0.1:${cdpPort}/json`).then(r => r.json());
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const i = id++;
    const h = evt => {
      const m = JSON.parse(evt.data);
      if (m.id === i) {
        ws.removeEventListener('message', h);
        res(m.result);
      }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const consoleLogs = [];
  ws.addEventListener('message', (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Console.messageAdded') {
      consoleLogs.push(`[CONSOLE ${data.params.message.level}] ${data.params.message.text}`);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value || a.description || '').join(' ');
      consoleLogs.push(`[CONSOLE ${data.params.type}] ${text}`);
    }
  });

  console.log('Navegando para http://localhost:3001/vistorias no navegador real...');
  await send('Page.navigate', { url: 'http://localhost:3001/vistorias' });
  await sleep(2500);

  // Captura de tela
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ARTIFACT_DIR, 'v1_vistorias_confirmado.png');
  fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  console.log(`[CAPTURA SALVA] ${outPath} (${shot.data.length} b64 chars)`);

  // Extrair título e elementos visíveis da página
  const domInfo = await send('Runtime.evaluate', {
    expression: `({
      title: document.title,
      url: window.location.href,
      h1: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText).slice(0, 5),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText).slice(0, 6)
    })`,
    returnByValue: true
  });
  console.log('[DOM INFO]', JSON.stringify(domInfo.result?.value, null, 2));

  console.log('\n--- 4. LOGS DO CONSOLE DO NAVEGADOR ---');
  if (consoleLogs.length === 0) {
    console.log('Nenhum erro no console do navegador!');
  } else {
    consoleLogs.forEach(l => console.log(l));
  }

  ws.close();
  browser.kill();
  console.log('\n=== TESTES CONCLUÍDOS COM SUCESSO! ===');
}

main().catch(err => {
  console.error('Erro na execução do script:', err);
  process.exit(1);
});

