const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const logFile = path.join(rootDir, 'logs', 'build_real.log');
const out = fs.openSync(logFile, 'w');

const child = spawn('npx.cmd', ['next', 'build', '--webpack'], {
  cwd: rootDir,
  stdio: ['ignore', out, out],
  shell: true
});

child.on('exit', (code) => {
  fs.appendFileSync(logFile, `\n[BUILD FINISHED] Code: ${code}\n`);
  console.log(`[BUILD FINISHED] Code: ${code}`);
});

child.on('error', (err) => {
  fs.appendFileSync(logFile, `\n[BUILD ERROR] ${err.message}\n`);
  console.log(`[BUILD ERROR] ${err.message}`);
});

