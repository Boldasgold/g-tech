const fs = require('fs');
const { execSync } = require('child_process');

const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let browserPath = null;
if (fs.existsSync(edgePath)) {
  browserPath = edgePath;
  console.log('Found Edge at:', edgePath);
} else if (fs.existsSync(chromePath)) {
  browserPath = chromePath;
  console.log('Found Chrome at:', chromePath);
} else {
  console.log('No browser executable found');
}

if (browserPath) {
  const artifactDir = 'C:/Users/tiujo/.gemini/antigravity/brain/81f1ee1a-b96b-49de-99b5-43ad29321e47';
  const oficinaShot = `${artifactDir}/captura_oficina_jetta.png`;
  const viewerShot = `${artifactDir}/captura_3d_360.png`;

  console.log('Capturando tela de /oficina...');
  try {
    execSync(`"${browserPath}" --headless --disable-gpu --window-size=1280,800 --screenshot="${oficinaShot}" http://localhost:3000/oficina`, { timeout: 20000 });
    console.log('Captura salva em:', oficinaShot);
  } catch (e) {
    console.error('Erro na captura /oficina:', e.message);
  }

  console.log('Capturando tela de /3D-360...');
  try {
    execSync(`"${browserPath}" --headless --disable-gpu --window-size=1280,800 --screenshot="${viewerShot}" http://localhost:3000/3D-360`, { timeout: 20000 });
    console.log('Captura salva em:', viewerShot);
  } catch (e) {
    console.error('Erro na captura /3D-360:', e.message);
  }
}

