import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { getDb } = require("../src/lib/db.ts");

const db = getDb();
const comps = db.prepare("SELECT count(*) as c FROM vehicle_components").get();
const insps = db.prepare("SELECT count(*) as c FROM wo_component_inspections").get();
const repls = db.prepare("SELECT count(*) as c FROM wo_replaced_parts").get();

console.log("Components count:", comps.c);
console.log("Inspections count:", insps.c);
console.log("Replaced parts count:", repls.c);
