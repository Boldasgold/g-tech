const fs = require('fs');
const { execSync } = require('child_process');

const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifactDir = 'C:/Users/tiujo/.gemini/antigravity/brain/81f1ee1a-b96b-49de-99b5-43ad29321e47';

const shots = [
  { name: 'captura_oficina_jetta_gli.png', url: 'http://localhost:3000/oficina?os=wo-demo-129&tab=inspecao3d' },
  { name: 'captura_oficina_golf_gti.png', url: 'http://localhost:3000/oficina?os=wo-demo-128&tab=inspecao3d' },
  { name: 'captura_3d_360_vw.png', url: 'http://localhost:3000/3D-360' }
];

for (const s of shots) {
  const dest = `${artifactDir}/${s.name}`;
  console.log(`Capturando ${s.name} de ${s.url}...`);
  try {
    execSync(`"${edgePath}" --headless --disable-gpu --window-size=1280,820 --screenshot="${dest}" "${s.url}"`, { timeout: 25000 });
    console.log(`Salvo em: ${dest} (${fs.statSync(dest).size} bytes)`);
  } catch (err) {
    console.error(`Erro ao capturar ${s.name}:`, err.message);
  }
}

