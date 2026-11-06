const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/tiujo/Desktop/g-tech/data/gtech.db');
const wos = db.prepare(`
  SELECT wo.id, wo.os_number, v.brand, v.model, v.plate 
  FROM work_orders wo 
  JOIN vehicles v ON wo.vehicle_id = v.id
`).all();
console.log(wos);
