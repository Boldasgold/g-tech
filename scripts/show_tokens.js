const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "../data/gtech.db"));
console.log("Tokens:", db.prepare("SELECT * FROM customer_portal_tokens").all());

