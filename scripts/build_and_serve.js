const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const logFile = path.join(rootDir, 'logs', 'build_and_serve.log');
const logsDir = path.join(rootDir, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const out = fs.openSync(logFile, 'a');

function appendLog(msg) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}

appendLog('=== INICIANDO BUILD DE PRODUCAO NEXT.JS ===');

const build = spawn('npx.cmd', ['next', 'build', '--webpack'], {
  cwd: rootDir,
  stdio: ['ignore', out, out],
  shell: true
});

build.on('exit', (code) => {
  appendLog(`Build finalizado com código ${code}`);
  if (code === 0) {
    appendLog('Iniciando os 3 serviços em produção...');

    // 1. Site público (porta 3000)
    spawn(process.execPath, [path.join(rootDir, 'services', 'site-publico', 'server.js')], {
      cwd: rootDir,
      stdio: ['ignore', out, out]
    });
    appendLog('Site público iniciado na porta 3000.');

    // 2. Worker IA/3D (porta 3002)
    spawn(process.execPath, [path.join(rootDir, 'services', 'worker-ai-3d', 'worker.js')], {
      cwd: rootDir,
      stdio: ['ignore', out, out]
    });
    appendLog('Worker IA/3D iniciado na porta 3002.');

    // 3. Oficina Next.js (porta 3001)
    spawn('npx.cmd', ['next', 'start', '-p', '3001'], {
      cwd: rootDir,
      stdio: ['ignore', out, out],
      shell: true
    });
    appendLog('Oficina Next.js iniciada na porta 3001 em modo produção!');
  } else {
    appendLog(`FALHA NO BUILD COM CODIGO ${code}`);
  }
});

