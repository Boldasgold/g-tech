const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const logFile = path.join(rootDir, 'logs', 'build_and_start.log');
const logsDir = path.join(rootDir, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

log('--- INICIANDO BUILD E INICIALIZACAO DOS SERVICOS G-TECH ---');

try {
  log('Passo 1/4: Executando next build --webpack...');
  execSync('npm.cmd run build', { cwd: rootDir, stdio: 'inherit' });
  log('Passo 1/4: Build concluído com sucesso!');
} catch (err) {
  log(`ERRO NO BUILD: ${err.message}`);
  process.exit(1);
}

log('Passo 2/4: Iniciando Site Público na porta 3000...');
const site = spawn(process.execPath, [path.join(rootDir, 'services', 'site-publico', 'server.js')], {
  cwd: rootDir,
  stdio: 'inherit'
});

log('Passo 3/4: Iniciando Worker IA/3D na porta 3002...');
const worker = spawn(process.execPath, [path.join(rootDir, 'services', 'worker-ai-3d', 'worker.js')], {
  cwd: rootDir,
  stdio: 'inherit'
});

log('Passo 4/4: Iniciando Servidor da Oficina na porta 3001...');
const oficina = spawn('npm.cmd', ['run', 'start:oficina'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

log('Todos os serviços da G-Tech foram inicializados com sucesso e estão rodando em portas dedicadas.');

site.on('exit', (code) => log(`[EXIT] Site encerrou com código ${code}`));
worker.on('exit', (code) => log(`[EXIT] Worker encerrou com código ${code}`));
oficina.on('exit', (code) => log(`[EXIT] Oficina encerrou com código ${code}`));

