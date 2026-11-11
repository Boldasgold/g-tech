const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const rootDir = path.resolve(__dirname, '..');
const nodeExe = process.execPath;
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');

console.log('[RUNNER] Iniciando os 3 serviços da G-Tech (3000, 3001, 3002)...');

// 1. Site público (porta 3000)
const site = spawn(nodeExe, [path.join(rootDir, 'services', 'site-publico', 'server.js')], {
  cwd: rootDir,
  stdio: 'inherit'
});

// 2. Worker IA/3D (porta 3002)
const worker = spawn(nodeExe, [path.join(rootDir, 'services', 'worker-ai-3d', 'worker.js')], {
  cwd: rootDir,
  stdio: 'inherit'
});

// 3. Oficina Next.js (porta 3001)
const oficina = spawn(nodeExe, [nextBin, 'dev', '--webpack', '-p', '3001'], {
  cwd: rootDir,
  stdio: 'inherit'
});

// Warmup automático da rota 3D-360 para responder instantaneamente ao usuário
setTimeout(() => {
  console.log('[WARMUP] Pré-aquecendo rota /3D-360 para resposta imediata...');
  http.get('http://localhost:3001/3D-360', (res) => {
    console.log('[WARMUP] Rota /3D-360 pré-aquecida com status:', res.statusCode);
  }).on('error', () => {});
}, 3500);

site.on('exit', (code) => console.log(`[EXIT] Site público encerrou com código ${code}`));
worker.on('exit', (code) => console.log(`[EXIT] Worker IA/3D encerrou com código ${code}`));
oficina.on('exit', (code) => console.log(`[EXIT] Oficina Next encerrou com código ${code}`));
