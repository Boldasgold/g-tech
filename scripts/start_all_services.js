const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const logDir = path.join(rootDir, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const nodeExe = process.execPath;
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');

function startDetached(name, cmd, args) {
  const outLog = fs.openSync(path.join(logDir, `${name}.log`), 'a');
  const errLog = fs.openSync(path.join(logDir, `${name}.err`), 'a');

  const child = spawn(cmd, args, {
    cwd: rootDir,
    detached: true,
    stdio: ['ignore', outLog, errLog],
    windowsHide: true
  });

  child.unref();
  console.log(`[STARTED] ${name} PID=${child.pid}`);
  return child.pid;
}

// 1. Site público (porta 3000)
startDetached('site-publico', nodeExe, [path.join(rootDir, 'services', 'site-publico', 'server.js')]);

// 2. Worker IA/3D (porta 3002)
startDetached('worker-ai-3d', nodeExe, [path.join(rootDir, 'services', 'worker-ai-3d', 'worker.js')]);

// 3. Oficina Next.js (porta 3001)
startDetached('oficina-next', nodeExe, [path.join(rootDir, 'server_oficina.js')]);
console.log('Todos os 3 processos foram iniciados com sucesso!');
