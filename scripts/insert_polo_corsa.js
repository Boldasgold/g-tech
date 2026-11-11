const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/gtech.db');

const upsert = db.prepare(`
  INSERT OR REPLACE INTO vehicle_3d_models (
    id, vehicle_key, brand, model, generation, work_order_id,
    file_name, file_url, file_size_bytes, file_sha256,
    model_type, source, audit_status, origin_type, audit_notes,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'malha_externa_monobloco', 'modelo_especifico_verificado', 'aprovado_verificado', 'acervo_preexistente', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
`);

// Polo
upsert.run(
  'v3d-polo-01',
  'volkswagen_polo',
  'Volkswagen',
  'Polo',
  'MK6 (2018 - 2024)',
  'volkswagen_polo.glb',
  '/models/vehicles/volkswagen_polo.glb',
  19723192,
  '5c541c1213473202502b5ba69e484f7cfb5ad8091dc9ac1dac5ae349d8076fec',
  'Modelo 3D oficial Volkswagen Polo (Draco + WebP) salvo no acervo permanente.'
);

upsert.run(
  'v3d-polo-hatch-01',
  'volkswagen_polo-hatch',
  'Volkswagen',
  'Polo Hatch / Track / GTS',
  'MK6 (2018 - 2024)',
  'volkswagen_polo.glb',
  '/models/vehicles/volkswagen_polo.glb',
  19723192,
  '5c541c1213473202502b5ba69e484f7cfb5ad8091dc9ac1dac5ae349d8076fec',
  'Modelo 3D oficial Volkswagen Polo Hatch salvo no acervo permanente.'
);

// Corsa
upsert.run(
  'v3d-corsa-01',
  'chevrolet_corsa',
  'Chevrolet',
  'Corsa Hatch 1.0 / 1.6',
  'Geração B (1994 - 2002)',
  'chevrolet_corsa_hatch.glb',
  '/models/vehicles/chevrolet_corsa_hatch.glb',
  19817240,
  'b089a45358f2e1c9ff910edece96a3c10b5b305e725bdac43dd1e3b861476df5',
  'Modelo 3D oficial Chevrolet Corsa Hatch (Draco + WebP) salvo no acervo permanente.'
);

upsert.run(
  'v3d-corsa-hatch-01',
  'chevrolet_corsa_hatch',
  'Chevrolet',
  'Corsa Hatch 1.0 / 1.6',
  'Geração B (1994 - 2002)',
  'chevrolet_corsa_hatch.glb',
  '/models/vehicles/chevrolet_corsa_hatch.glb',
  19817240,
  'b089a45358f2e1c9ff910edece96a3c10b5b305e725bdac43dd1e3b861476df5',
  'Modelo 3D oficial Chevrolet Corsa Hatch salvo no acervo permanente.'
);

upsert.run(
  'v3d-corsa-vw-alias',
  'volkswagen_corsa-hatch',
  'Chevrolet',
  'Corsa Hatch 1.0 / 1.6',
  'Geração B (1994 - 2002)',
  'chevrolet_corsa_hatch.glb',
  '/models/vehicles/chevrolet_corsa_hatch.glb',
  19817240,
  'b089a45358f2e1c9ff910edece96a3c10b5b305e725bdac43dd1e3b861476df5',
  'Alias de compatibilidade do catálogo para Chevrolet Corsa Hatch.'
);

console.log('[OK] Modelos Polo e Corsa inseridos no SQLite com sucesso!');

