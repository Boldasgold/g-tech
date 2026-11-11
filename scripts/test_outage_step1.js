const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

async function runOutagePhase1() {
  console.log("=== FASE 1 DO TESTE DE INDISPONIBILIDADE: OFICINA (3001) PARADA ===");

  // 1. Verificar que a Oficina (3001) está realmente parada
  let workshopReachable = false;
  try {
    await fetch("http://localhost:3001/api/health");
    workshopReachable = true;
  } catch (err) {
    console.log("[OK] Serviço da Oficina (http://localhost:3001) confirmado PARADO:", err.cause?.code || err.message);
  }
  if (workshopReachable) {
    throw new Error("A oficina deveria estar parada nesta fase!");
  }

  // 2. Enviar agendamento pelo Site Público (http://localhost:3000/api/appointments)
  const testIdemKey = `outage-test-v1-${Date.now()}`;
  const randomMin = Math.random() > 0.5 ? "00" : "30";
  const randomHour = String(Math.floor(8 + Math.random() * 8)).padStart(2, "0");
  const payload = {
    customer_name: "Carlos Eduardo Rocha (Teste Outage)",
    customer_phone: "(41) 99876-5432",
    vehicle_brand: "Volkswagen",
    vehicle_model: "Golf IV 2.0",
    vehicle_plate: "GLF-4004",
    scheduled_date: "2026-12-28",
    scheduled_time: `${randomHour}:${randomMin}`,
    issue_description: "Agendamento enviado com o serviço da oficina parado",
    idempotency_key: testIdemKey
  };

  const res = await fetch("http://localhost:3000/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("\n[RESPOSTA DO SITE (HTTP " + res.status + ") COM OFICINA PARADA]:");
  console.log(JSON.stringify(data, null, 2));

  // 3. Inspecionar onde a solicitação ficou armazenada (data/site_outbox.db -> tabela site_outbox_queue)
  const outboxDb = new DatabaseSync(path.join(__dirname, "../data/site_outbox.db"));
  const storedRow = outboxDb.prepare("SELECT * FROM site_outbox_queue WHERE idempotency_key = ?").get(testIdemKey);
  console.log("\n[REGISTRO NO BANCO DO SITE data/site_outbox.db (site_outbox_queue) ENQUANTO OFICINA ESTÁ PARADA]:");
  console.log(JSON.stringify(storedRow, null, 2));

  fs.writeFileSync(
    path.join(__dirname, "../data/last_outage_test_key.json"),
    JSON.stringify({ idempotency_key: testIdemKey, payload, phase1_response: data, phase1_row: storedRow }, null, 2)
  );
}

runOutagePhase1().catch(err => {
  console.error(err);
  process.exit(1);
});

