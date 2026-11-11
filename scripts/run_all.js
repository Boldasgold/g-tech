const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const next = require('next');

const rootDir = path.resolve(__dirname, '..');

console.log('[MASTER] ====================================================');
console.log('[MASTER] INICIALIZANDO ECOSSISTEMA G-TECH (PORTAS 3000, 3001, 3002)');
console.log('[MASTER] ====================================================');

// 1. Iniciar Site Público na porta 3000
const site = spawn(process.execPath, [path.join(rootDir, 'services', 'site-publico', 'server.js')], {
  cwd: rootDir,
  stdio: 'inherit'
});
site.on('error', (err) => console.error('[SITE-3000] Erro:', err));
site.on('exit', (code) => console.log(`[SITE-3000] Encerrou com código ${code}`));

// 2. Iniciar Worker IA/3D na porta 3002
const worker = spawn(process.execPath, [path.join(rootDir, 'services', 'worker-ai-3d', 'worker.js')], {
  cwd: rootDir,
  stdio: 'inherit'
});
worker.on('error', (err) => console.error('[WORKER-3002] Erro:', err));
worker.on('exit', (code) => console.log(`[WORKER-3002] Encerrou com código ${code}`));

const { parse } = require('url');

// 3. Iniciar G-Tech Vistorias V1 (Next.js Webpack) na porta 3001
const app = next({
  dev: true,
  dir: rootDir,
  port: 3001,
  hostname: '127.0.0.1',
  webpack: true,
  customServer: true
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(3001, '0.0.0.0', (err) => {
    if (err) {
      console.error('[VISTORIAS-3001] Erro no listen:', err);
      process.exit(1);
    }
    console.log('[MASTER] >>> TODOS OS 3 SERVIÇOS ESTÃO ATIVOS E PRONTOS! <<<');
    console.log('[MASTER] 🟢 Porta 3000: http://localhost:3000 (Site Público)');
    console.log('[MASTER] 🟢 Porta 3001: http://localhost:3001/vistorias (G-Tech Vistorias V1)');
    console.log('[MASTER] 🟢 Porta 3002: http://localhost:3002 (Worker IA/3D)');
  });
}).catch((err) => {
  console.error('[VISTORIAS-3001] Erro fatal no Next.js prepare:', err);
  process.exit(1);
});

