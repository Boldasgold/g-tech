const fs = require('fs');
const path = require('path');

const pagePath = path.resolve('C:/Users/tiujo/Desktop/g-tech/src/app/3D-360/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Add showTelemetryDetails state
if (!content.includes('const [showTelemetryDetails, setShowTelemetryDetails]')) {
  content = content.replace(
    'const [viewerRefreshTrigger, setViewerRefreshTrigger] = useState(0);',
    'const [viewerRefreshTrigger, setViewerRefreshTrigger] = useState(0);\n  const [showTelemetryDetails, setShowTelemetryDetails] = useState(false);'
  );
  console.log('Added showTelemetryDetails state');
}

// 2. Locate Section 2 quick switcher and photo-to-3d-panel
const section2Start = content.indexOf('{/* SEÇÃO 2: VISUALIZADOR 3D INTERATIVO & DESMONTAGEM DE COMPONENTES          */}');
const viewerCall = content.indexOf('<Vehicle3DViewer', section2Start);

if (section2Start !== -1 && viewerCall !== -1) {
  const newSection2Header = `{/* SEÇÃO 2: VISUALIZADOR 3D INTERATIVO & DESMONTAGEM DE COMPONENTES          */}
        {/* ========================================================================= */}
        <div id="gtech-3d-viewer-anchor" className="space-y-3.5 scroll-mt-20">
          {/* Barra de Troca Rápida de Veículos Homologados 3D */}
          <div className="bg-slate-900/70 backdrop-blur-md p-3.5 rounded-2xl border border-cyan-500/20 shadow-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-200">
                  Frota Homologada 3D em Tempo Real
                </span>
                <span className="text-[10px] text-cyan-300 bg-cyan-950/80 border border-cyan-700/50 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  7 Modelos com Monobloco GLB
                </span>
              </div>
              <button
                type="button"
                data-testid="quick-select-fail-glb"
                onClick={() => setForcedGlbUrl("/models/vehicles/arquivo_inexistente_teste_falha.glb")}
                className={\`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border \${
                  forcedGlbUrl
                    ? "bg-rose-500 text-white border-white shadow-lg"
                    : "bg-slate-950/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border-slate-800"
                }\`}
                title="Simular arquivo GLB ausente para checar auditoria de integridade"
              >
                ⚠️ Simular Falha GLB
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "polo-hatch", label: "Polo Hatch", tag: "Novo" },
                { id: "corsa-hatch", label: "Corsa Hatch", tag: "Novo" },
                { id: "bora", label: "Bora Sedã", tag: "Acervo" },
                { id: "celta", label: "Celta 1.0", tag: "Acervo" },
                { id: "tiguan", label: "Tiguan R-Line", tag: "SUV" },
                { id: "beetle", label: "Beetle / Fusca", tag: "Clássico" },
                { id: "arteon", label: "Arteon R", tag: "Premium" },
                { id: "golf-v", label: "Golf V (MK5)", tag: "Fotos" },
                { id: "golf-vii", label: "Golf VII", tag: "Fotos" },
                { id: "golf-iv", label: "Golf IV", tag: "Fotos" },
                { id: "jetta-gli", label: "Jetta GLI", tag: "Bloqueio" }
              ].map((item) => {
                const m = VW_MODELS_CATALOG.find(v => v.id === item.id);
                if (!m) return null;
                const active = currentVwModel.id === m.id && !forcedGlbUrl;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={\`quick-select-\${item.id}\`}
                    onClick={() => handleSelectModelFromCatalog(m)}
                    className={\`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border \${
                      active
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold border-cyan-300 shadow-lg shadow-cyan-500/25 scale-[1.02]"
                        : "bg-slate-950/70 hover:bg-slate-800/80 text-slate-300 border-slate-800 hover:border-slate-700"
                    }\`}
                  >
                    <span>🚗</span>
                    <span>{item.label}</span>
                    <span className={\`text-[9px] px-1.5 py-0.5 rounded font-mono \${
                      active ? "bg-black/30 text-white font-bold" : "bg-slate-900 text-slate-400"
                    }\`}>
                      {item.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PAINEL DE RASTREAMENTO, VISTORIA E TELEMETRIA TÉCNICA */}
          <div
            data-testid="photo-to-3d-panel"
            className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-cyan-500/25 shadow-xl text-xs space-y-2.5 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                  <span>Centro de Inspeção:</span>
                  <span className="text-cyan-400">
                    {(currentVwModel.id === "celta" || currentVwModel.id.includes("corsa")) ? "Chevrolet" : "Volkswagen"} {currentVwModel.name}
                  </span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                  {currentVwModel.id === "celta" ? "chevrolet_celta" : (currentVwModel.id.includes("corsa") ? "chevrolet_corsa_hatch" : (currentVwModel.id === "bora" ? "volkswagen_bora" : (currentVwModel.id.includes("polo") ? "volkswagen_polo-hatch" : \`volkswagen_\${currentVwModel.id}\`)))}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {photoTo3dTrace?.selection_mode === "apenas_fotografia_catalogo" && (
                  <button
                    type="button"
                    data-testid="btn-abrir-vistoria-veiculo"
                    onClick={handleOpenVehicleInspection}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow transition flex items-center gap-1.5"
                  >
                    📋 Abrir Vistoria
                  </button>
                )}

                <button
                  type="button"
                  data-testid="btn-gerar-projecao-3d"
                  disabled={generating3d}
                  onClick={handleGenerate3dProjection}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
                >
                  <span>🧊</span>
                  <span>{generating3d ? "Processando no Worker..." : "Gerar Projeção 3D"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTelemetryDetails(!showTelemetryDetails)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-mono transition flex items-center gap-1"
                  title="Exibir/Ocultar rastreamento detalhado de OS, fotos e telemetria"
                >
                  <span>⚙️ Telemetria</span>
                  <span>{showTelemetryDetails ? "▲" : "▼"}</span>
                </button>
              </div>
            </div>

            {/* Aviso quando a seleção atual é apenas fotografia do catálogo */}
            {photoTo3dTrace?.selection_mode === "apenas_fotografia_catalogo" && (
              <div
                data-testid="catalog-only-warning"
                className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <strong>⚠️ Modo Catálogo:</strong> O veículo <code className="text-white">{currentVwModel.id === "celta" ? "chevrolet_celta" : (currentVwModel.id.includes("corsa") ? "chevrolet_corsa_hatch" : (currentVwModel.id === "bora" ? "volkswagen_bora" : (currentVwModel.id.includes("polo") ? "volkswagen_polo-hatch" : \`volkswagen_\${currentVwModel.id}\`)))}</code> não possui Ordem de Serviço vinculada. Para gerar modelo texturizado por fotos, abra a vistoria própria e anexe as fotos.
                </div>
              </div>
            )}

            {/* Feedback do Worker */}
            {photoTo3dFeedback && (
              <div
                data-testid="photo-to-3d-feedback"
                className={\`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 \${
                  photoTo3dFeedback.type === "error"
                    ? "bg-rose-950/80 border-rose-500/60 text-rose-200"
                    : photoTo3dFeedback.type === "success"
                    ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-200"
                    : "bg-cyan-950/80 border-cyan-500/60 text-cyan-200"
                }\`}
              >
                <span>{photoTo3dFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setPhotoTo3dFeedback(null)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Gaveta de Telemetria e Vistoria Detalhada */}
            {showTelemetryDetails && (
              <div className="pt-2.5 border-t border-slate-800 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase block">1. Identificador & Estado</span>
                    <div className="text-white font-bold">ID: {photoTo3dTrace?.canonical_vehicle_key || \`volkswagen_\${currentVwModel.id}\`}</div>
                    <div className="text-amber-300 text-[10px]">
                      Modo: {photoTo3dTrace?.selection_mode || (loadingTrace ? "carregando..." : "apenas_fotografia_catalogo")}
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase block">2. Veículo • OS • Vistoria</span>
                    <div className="text-cyan-300 truncate">
                      Veículo: <strong>{photoTo3dTrace?.vehicle_record?.id || "NENHUM (Catálogo)"}</strong>
                    </div>
                    <div className="text-slate-200 truncate">
                      OS: <strong>{photoTo3dTrace?.work_order ? \`\${photoTo3dTrace.work_order.os_number} (\${photoTo3dTrace.work_order.id})\` : "NENHUMA"}</strong>
                    </div>
                    <div className="text-slate-300 truncate">
                      Vistoria: <strong>{photoTo3dTrace?.inspection_visit ? \`\${photoTo3dTrace.inspection_visit.id} (Visita #\${photoTo3dTrace.inspection_visit.visit_number})\` : "NENHUMA"}</strong>
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase block">3. Fotos & Tarefa no Worker (3002)</span>
                    <div className="text-emerald-300">
                      Fotos Vistoria: <strong>{photoTo3dTrace?.available_visit_photos_count ?? 0} anexada(s)</strong> (mín. 2)
                    </div>
                    <div className="text-slate-300 truncate">
                      Tarefa Worker: <strong>{photoTo3dTrace?.latest_generation_job ? \`\${photoTo3dTrace.latest_generation_job.job_id} [\${photoTo3dTrace.latest_generation_job.status}]\` : "NENHUMA"}</strong>
                    </div>
                    <div className="text-amber-200 truncate">
                      Arquivo 3D: <strong>{photoTo3dTrace?.resulting_3d_model ? photoTo3dTrace.resulting_3d_model.file_name : "NENHUM"}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 font-semibold">Diagnóstico do Fluxo: </span>
                    <span className="text-cyan-300 font-mono">{photoTo3dTrace?.interruption_stage || "Verificando..."}</span>
                  </div>
                  <div className="text-[10px] text-amber-300 font-mono">
                    Gerador Local: <strong>modelo ilustrativo texturizado</strong> (forma predefinida c/ fotos)
                  </div>
                </div>

                {photoTo3dTrace?.work_order && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-xs text-cyan-300">
                        📸 Fotografias da Vistoria de <span className="text-white">Volkswagen {currentVwModel.name}</span> (OS {photoTo3dTrace.work_order.os_number} • Visita #{photoTo3dTrace.inspection_visit?.visit_number || 1}):
                      </span>
                      <Link
                        href={\`/oficina?os=\${photoTo3dTrace.work_order.id}&tab=vistoria\`}
                        className="text-[11px] text-amber-300 hover:underline font-bold"
                      >
                        Abrir esta OS completa no Painel da Oficina ↗
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {[
                        { slot: "photo_front", label: "Vista Dianteira" },
                        { slot: "photo_rear", label: "Vista Traseira" },
                        { slot: "photo_left", label: "Lateral Esquerda" },
                        { slot: "photo_right", label: "Lateral Direita" }
                      ].map((ang) => {
                        const attached = (photoTo3dTrace.available_visit_photos || []).find((p: any) => p.slot_name === ang.slot);
                        return (
                          <div key={ang.slot} className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <strong className="text-[11px] text-white">{ang.label}</strong>
                                <span className="text-[9px] font-mono text-cyan-400">{ang.slot}</span>
                              </div>
                              {attached ? (
                                <div className="space-y-1">
                                  <img src={attached.public_url} alt={ang.label} className="w-full h-20 object-cover rounded-lg border border-emerald-500/40" />
                                  <div className="text-[9px] font-mono text-emerald-300 truncate">ID: {attached.photo_id}</div>
                                  <div className="text-[9px] font-mono text-amber-300 truncate">SHA-256: {attached.file_sha256?.slice(0, 16)}...</div>
                                </div>
                              ) : (
                                <div className="h-20 rounded-lg bg-slate-950 border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500">
                                  Sem foto anexada
                                </div>
                              )}
                            </div>

                            <label className="cursor-pointer text-center py-1 px-2 rounded-lg bg-slate-800 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition block">
                              📤 Anexar {ang.label}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                data-testid={\`3d360-upload-\${ang.slot}\`}
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadVisitAnglePhoto(ang.slot, f);
                                }}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                Visualizador 3D 360° Interativo & Inspeção de Componentes
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-[10px] text-cyan-300 font-bold font-mono">
                {currentLabel} ({currentBodyType.toUpperCase()})
              </span>
              <span
                data-testid="3d360-top-projection-badge"
                className={\`px-2.5 py-0.5 rounded-full text-[10px] font-bold \${
                  photoTo3dTrace?.resulting_3d_model?.origin_type === "acervo_preexistente" || currentVwModel.id.includes("arteon") || currentVwModel.id === "beetle" || currentVwModel.id.includes("tiguan") || currentVwModel.id === "bora" || currentVwModel.id === "celta" || currentVwModel.id.includes("polo") || currentVwModel.id.includes("corsa")
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700/40"
                    : photoTo3dTrace?.resulting_3d_model?.origin_type === "gerado_por_fotos"
                    ? "bg-amber-950 text-amber-200 border border-amber-500/60"
                    : "bg-amber-950 text-amber-300 border border-amber-700/40"
                }\`}
              >
                {photoTo3dTrace?.resulting_3d_model?.origin_type === "acervo_preexistente" || currentVwModel.id.includes("arteon") || currentVwModel.id === "beetle" || currentVwModel.id.includes("tiguan") || currentVwModel.id === "bora" || currentVwModel.id === "celta" || currentVwModel.id.includes("polo") || currentVwModel.id.includes("corsa")
                  ? "A. Modelo 3D no Acervo (Verificado)"
                  : photoTo3dTrace?.resulting_3d_model?.origin_type === "gerado_por_fotos"
                  ? \`B. Modelo ilustrativo texturizado (\${photoTo3dTrace.resulting_3d_model.file_name})\`
                  : "Projeção 3D deste veículo ainda não disponível"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              🖱️ Gire em 360°, explore a vista explodida, dê zoom e inspecione componentes
            </span>
          </div>

          `;

  content = content.substring(0, section2Start) + newSection2Header + content.substring(viewerCall);
  console.log('Replaced Section 2 in page.tsx');
}

fs.writeFileSync(pagePath, content, 'utf8');
console.log('page.tsx refinement completed!');

