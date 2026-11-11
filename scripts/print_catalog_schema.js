const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');

const catalogSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name='vehicle_catalog'").get();
console.log('CATALOG SCHEMA:', catalogSchema.sql);

const v3dSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name='vehicle_3d_models'").get();
console.log('\nVEHICLE_3D_MODELS SCHEMA:', v3dSchema.sql);
