// Automated verification of Volkswagen 51 photos and /3D-360 recognition module
const BASE_URL = "http://localhost:3000";

async function verify() {
  console.log("=== INICIANDO VERIFICAÇÃO DO MÓDULO VOLKSWAGEN & /3D-360 ===");
  let passed = 0;
  let total = 0;

  function assert(cond, desc) {
    total++;
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
    }
  }

  // 1. Healthcheck
  const rHealth = await fetch(`${BASE_URL}/api/health`);
  assert(rHealth.status === 200, "Endpoint /api/health retorna 200 OK");

  // 2. Route /3D-360
  const r3D = await fetch(`${BASE_URL}/3D-360`);
  assert(r3D.status === 200, "Rota /3D-360 retorna 200 OK");
  const html3D = await r3D.text();
  assert(html3D.includes("Reconhecimento Automático de Veículos na Oficina"), "Página /3D-360 contém título de reconhecimento");
  assert(html3D.includes("51 Modelos Volkswagen Homologados"), "Página /3D-360 lista 51 modelos homologados");

  // 3. Rewrite /3d-360
  const r3dLower = await fetch(`${BASE_URL}/3d-360`);
  assert(r3dLower.status === 200, "Rota /3d-360 (minúscula via rewrite) retorna 200 OK");

  // 4. Test Volkswagen Photographs from the 51 models
  const testPhotos = [
    "golf-gti.jpg",
    "golf-vii.jpg",
    "jetta-gli.jpg",
    "passat.jpg",
    "tiguan.jpg",
    "polo-hatch.jpg",
    "up.jpg",
    "beetle.jpg",
    "crafter.jpg",
    "transporter.jpg",
    "arteon.jpg",
    "id-3.jpg",
    "id-4.jpg",
    "touareg.jpg"
  ];

  for (const photo of testPhotos) {
    const rImg = await fetch(`${BASE_URL}/img/vehicles/volkswagen/fotos/${photo}`);
    assert(rImg.status === 200, `Foto real /img/vehicles/volkswagen/fotos/${photo} acessível (HTTP 200)`);
  }

  // 5. Test Volkswagen Recognition via /api/tech-specs
  const rVwGolf = await fetch(`${BASE_URL}/api/tech-specs?brand=Volkswagen&model=Golf%20GTI`);
  const dataGolf = await rVwGolf.json();
  assert(dataGolf.success === true && dataGolf.spec.model.includes("Golf"), "API /api/tech-specs reconhece Golf GTI como Volkswagen");
  assert(dataGolf.spec.real_photo_url.includes("golf-gti.jpg"), "API vincula foto real golf-gti.jpg");
  assert(dataGolf.spec.body_type === "hatch", "Carroceria 3D do Golf GTI definida como 'hatch'");

  const rVwJetta = await fetch(`${BASE_URL}/api/tech-specs?brand=Volkswagen&model=Jetta%20GLI`);
  const dataJetta = await rVwJetta.json();
  assert(dataJetta.spec.real_photo_url.includes("jetta-gli.jpg"), "API vincula foto real jetta-gli.jpg");
  assert(dataJetta.spec.body_type === "sedan", "Carroceria 3D do Jetta GLI definida como 'sedan'");

  const rVwTiguan = await fetch(`${BASE_URL}/api/tech-specs?brand=Volkswagen&model=Tiguan%20Allspace`);
  const dataTiguan = await rVwTiguan.json();
  assert(dataTiguan.spec.real_photo_url.includes("tiguan.jpg"), "API vincula foto real tiguan.jpg");
  assert(dataTiguan.spec.body_type === "suv", "Carroceria 3D da Tiguan definida como 'suv'");

  const rVwCrafter = await fetch(`${BASE_URL}/api/tech-specs?brand=Volkswagen&model=Crafter%20Furgão`);
  const dataCrafter = await rVwCrafter.json();
  assert(dataCrafter.spec.real_photo_url.includes("crafter.jpg"), "API vincula foto real crafter.jpg");
  assert(dataCrafter.spec.body_type === "van", "Carroceria 3D do Crafter definida como 'van'");

  // 6. Test Exclusivity: Non-Volkswagen vehicles must NOT use VW photos
  const rRenault = await fetch(`${BASE_URL}/api/tech-specs?brand=Renault&model=Duster`);
  const dataRenault = await rRenault.json();
  assert(dataRenault.spec.real_photo_url.includes("renault-duster.jpg"), "Veículo Renault Duster usa foto exclusiva da Renault (não VW)");
  assert(!dataRenault.spec.real_photo_url.includes("volkswagen"), "Exclusividade respeitada: fotos VW aplicadas apenas à Volkswagen");

  // 7. Verify /oficina dashboard
  const rOficina = await fetch(`${BASE_URL}/oficina`);
  assert(rOficina.status === 200, "Painel da Oficina /oficina retorna 200 OK");

  // 8. Verify client-side matcher script
  const rMatcher = await fetch(`${BASE_URL}/js/vw-matcher.js`);
  assert(rMatcher.status === 200, "Script cliente /js/vw-matcher.js retorna 200 OK");

  console.log(`\n=== RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO ===`);
  if (passed === total) {
    console.log("🎉 TODOS OS REQUISITOS FORAM SATISFEITOS!");
    process.exit(0);
  } else {
    console.error("⚠️ ALGUNS TESTES FALHARAM!");
    process.exit(1);
  }
}

verify().catch(err => {
  console.error("Erro na verificação:", err);
  process.exit(1);
});
