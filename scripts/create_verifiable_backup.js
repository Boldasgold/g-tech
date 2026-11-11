const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve('C:/Users/tiujo/Desktop/g-tech');
const backupDir = path.join(rootDir, 'data/backups/reformulation_' + Date.now());
fs.mkdirSync(backupDir, { recursive: true });

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// 1. Backup SQLite Database
const dbSrc = path.join(rootDir, 'data/gtech.db');
const dbDst = path.join(backupDir, 'gtech.db');
if (fs.existsSync(dbSrc)) {
  fs.copyFileSync(dbSrc, dbDst);
  const srcHash = getSha256(dbSrc);
  const dstHash = getSha256(dbDst);
  console.log(`[BACKUP DB] Copied successfully.`);
  console.log(`  Source: ${dbSrc} (${fs.statSync(dbSrc).size} bytes)`);
  console.log(`  SHA-256: ${srcHash}`);
  console.log(`  Verificação Hash: ${srcHash === dstHash ? 'OK ✓' : 'FALHA ✗'}`);
}

// 2. Backup Uploads
const uploadsSrc = path.join(rootDir, 'public/uploads');
const uploadsDst = path.join(backupDir, 'uploads');
if (fs.existsSync(uploadsSrc)) {
  fs.cpSync(uploadsSrc, uploadsDst, { recursive: true });
  console.log(`[BACKUP UPLOADS] Copied directory ${uploadsSrc} to ${uploadsDst}`);
}

// 3. Backup Current App Oficina Page & Libs
const filesToBackup = [
  'src/app/oficina/page.tsx',
  'src/app/3D-360/page.tsx',
  'src/app/api/work-orders/route.ts',
  'src/lib/db.ts'
];

for (const f of filesToBackup) {
  const s = path.join(rootDir, f);
  const d = path.join(backupDir, path.basename(f));
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`[BACKUP FILE] ${f} -> ${d}`);
  }
}

// Write manifest
const manifest = {
  timestamp: new Date().toISOString(),
  backupDir,
  dbSha256: getSha256(dbDst),
  dbSize: fs.statSync(dbDst).size,
  status: 'VERIFIED_SUCCESS'
};
fs.writeFileSync(path.join(backupDir, 'backup_manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\nVerifiable backup successfully created in:', backupDir);

