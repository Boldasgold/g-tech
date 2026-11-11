const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "../data/gtech.db"));

try {
  db.exec("ALTER TABLE appointments ADD COLUMN idempotency_key TEXT;");
  console.log("Added idempotency_key column to appointments");
} catch (e) {
  console.log("idempotency_key already exists or error:", e.message);
}

try {
  db.exec("ALTER TABLE appointments ADD COLUMN linked_work_order_id TEXT;");
  console.log("Added linked_work_order_id column to appointments");
} catch (e) {
  console.log("linked_work_order_id already exists or error:", e.message);
}

