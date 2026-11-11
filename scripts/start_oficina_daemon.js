const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const logsDir = path.join(rootDir, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFile = fs.openSync(path.join(logsDir, 'oficina.log'), 'a');
const nodeExe = process.execPath;
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');

console.log('[SPAWN] Iniciando Oficina Next.js (Porta 3001) desacoplada com logs...');

const oficina = spawn(nodeExe, [nextBin, 'dev', '--webpack', '-p', '3001'], {
  cwd: rootDir,
  stdio: ['ignore', logFile, logFile],
  detached: true
});

oficina.unref();
console.log('[SPAWN] Oficina Next.js iniciada com PID:', oficina.pid);
process.exit(0);

