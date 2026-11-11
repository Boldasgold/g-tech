const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const rootDir = path.resolve(__dirname, '..');
const logFile = path.join(rootDir, 'logs', 'vistorias_service.log');
const logsDir = path.join(rootDir, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const out = fs.openSync(logFile, 'a');

console.log('[SERVICE] Iniciando G-Tech Vistorias na porta 3001...');

const proc = spawn('cmd.exe', ['/c', 'npx', 'next', 'dev', '--webpack', '-p', '3001'], {
  cwd: rootDir,
  detached: true,
  stdio: ['ignore', out, out]
});

proc.unref();

console.log('[SERVICE] Processo desanexado com PID:', proc.pid);

// Aguarda 4 segundos e testa conexão
setTimeout(() => {
  const req = http.get('http://localhost:3001/vistorias', (res) => {
    console.log('[SERVICE] Conexão bem-sucedida! Status HTTP:', res.statusCode);
    process.exit(0);
  });
  req.on('error', (err) => {
    console.log('[SERVICE] Tentando aguardar mais 3 segundos... Erro inicial:', err.message);
    setTimeout(() => {
      const req2 = http.get('http://localhost:3001/vistorias', (res2) => {
        console.log('[SERVICE] Conexão bem-sucedida no 2º teste! Status HTTP:', res2.statusCode);
        process.exit(0);
      });
      req2.on('error', (err2) => {
        console.error('[SERVICE] Erro final:', err2.message);
        process.exit(1);
      });
    }, 3000);
  });
}, 4000);

