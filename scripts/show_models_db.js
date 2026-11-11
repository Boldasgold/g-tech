const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "../data/gtech.db"));
console.log("vehicle_3d_models:", JSON.stringify(db.prepare("SELECT * FROM vehicle_3d_models").all(), null, 2));

