import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const zipPath = 'C:/Users/tiujo/.gemini/antigravity/brain/81f1ee1a-b96b-49de-99b5-43ad29321e47/.user_uploaded/media_1793830366515_f8ba299c.zip';
const targetDir = 'C:/Users/tiujo/Desktop/g-tech/public/img/vehicles/volkswagen';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Extract using powershell Expand-Archive
console.log('Extracting zip to:', targetDir);
const psCmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`;
execSync(psCmd, { stdio: 'inherit' });

console.log('Extraction complete! Files in target:');
const files = fs.readdirSync(targetDir);
console.log(files);

if (fs.existsSync(path.join(targetDir, 'creditos.csv'))) {
  const csv = fs.readFileSync(path.join(targetDir, 'creditos.csv'), 'utf8');
  console.log('--- CREDITOS.CSV PREVIEW ---');
  console.log(csv.split('\n').slice(0, 20).join('\n'));
}
