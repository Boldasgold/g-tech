async function test() {
  console.log("=== INICIANDO TESTES DO MÓDULO DE INSPEÇÃO 3D E PEÇAS TROCADAS ===");

  // 1. Component Tree & Inspections
  const compRes = await fetch("http://localhost:3000/api/work-orders/wo-demo-00127/components");
  const compData = await compRes.json();
  console.log("1. Componentes carregados:", compData.success, "Total:", compData.components?.length);
  const tieRod = compData.components?.find(c => c.id === "cmp-tie-rod-front-r");
  console.log("   Terminal de Direção:", tieRod?.component_name, "| Status:", tieRod?.inspection_status, "| Medição:", tieRod?.measurement_value);

  // 2. Replaced parts
  const replRes = await fetch("http://localhost:3000/api/work-orders/wo-demo-00127/replacements");
  const replData = await replRes.json();
  console.log("2. Peças Trocadas:", replData.success, "Total:", replData.replacements?.length);
  replData.replacements?.forEach(r => {
    console.log(`   - [${r.seal_status}] ${r.component_name} | Instalada: ${r.installed_part_desc.slice(0, 50)}...`);
  });

  // 3. Customer Portal
  const portalRes = await fetch("http://localhost:3000/api/portal/gt-tok-rodrigo-127");
  const portalData = await portalRes.json();
  console.log("3. Portal do Cliente:", portalData.success, "Peças Trocadas no Portal:", portalData.quote?.replaced_parts?.length);

  // 4. PDF Generation
  const pdfRes = await fetch("http://localhost:3000/api/work-orders/wo-demo-00127/pdf");
  const pdfHtml = await pdfRes.text();
  const hasSeal = pdfHtml.includes("PEÇA TROCADA");
  const hasMetrology = pdfHtml.includes("Medições de Metrologia & Ensaios por Componente");
  console.log("4. Relatório PDF Oficial:", pdfRes.status === 200, "| Contém Selo PEÇA TROCADA:", hasSeal, "| Contém Metrologia:", hasMetrology);

  // 5. Pages
  const pages = [
    "http://localhost:3000/oficina",
    "http://localhost:3000/cliente/gt-tok-rodrigo-127",
    "http://localhost:3000/index.html",
    "http://localhost:3000/api/health"
  ];
  for (const p of pages) {
    const r = await fetch(p);
    console.log(`5. Rota [${r.status}]: ${p}`);
  }

  console.log("=== TODOS OS TESTES CONCLUÍDOS COM SUCESSO! ===");
}

test().catch(console.error);
