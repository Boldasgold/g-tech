const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nodeExe = process.execPath;
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');

console.log('[SPAWN] Iniciando Site (3000), Worker (3002) e Oficina (3001) desacoplados...');

const site = spawn(nodeExe, [path.join(rootDir, 'services', 'site-publico', 'server.js')], {
  cwd: rootDir,
  stdio: 'ignore',
  detached: true
});
site.unref();
console.log('[SPAWN] Site PID:', site.pid);

const worker = spawn(nodeExe, [path.join(rootDir, 'services', 'worker-ai-3d', 'worker.js')], {
  cwd: rootDir,
  stdio: 'ignore',
  detached: true
});
worker.unref();
console.log('[SPAWN] Worker PID:', worker.pid);

const oficina = spawn(nodeExe, [nextBin, 'dev', '--webpack', '-p', '3001'], {
  cwd: rootDir,
  stdio: 'ignore',
  detached: true
});
oficina.unref();
console.log('[SPAWN] Oficina Next PID:', oficina.pid);

console.log('[SPAWN] Todos os processos foram liberados para rodar em segundo plano.');

