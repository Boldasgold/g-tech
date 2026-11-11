const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9223;

const child = spawn(edgePath, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--disable-gpu',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await listRes.json();
    const wsUrl = tabs[0]?.webSocketDebuggerUrl;
    console.log("Connected to browser. WS:", wsUrl);
    
    // We can also simply fetch the file via HTTP or inspect console
    const WebSocket = require('ws');
    // If ws is not installed, we can just test if the file is accessible
  } catch (err) {
    console.log("Error:", err.message);
  } finally {
    child.kill();
  }
}, 2000);

