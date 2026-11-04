"use client";

import React, { useEffect, useRef, useState } from "react";
import { Vehicle3DScene, BodyType, HotspotData } from "@/lib/vehicle3d";

interface Vehicle3DViewerProps {
  bodyType: BodyType;
  hotspots?: HotspotData[];
  readOnly?: boolean;
  onAddHotspot?: (hotspot: {
    region_name: string;
    orientation_side: string;
    pos_x: number;
    pos_y: number;
    pos_z: number;
    severity: "baixa" | "media" | "alta" | "critica";
    hotspot_type: "avaria_entrada" | "achado_tecnico" | "servico_concluido";
    damage_type: string;
    description: string;
    photo_url?: string;
  }) => Promise<void> | void;
  onDeleteHotspot?: (hotspotId: string) => Promise<void> | void;
  vehicleLabel?: string;
  realPhotoUrl?: string;
}

function resolveRealPhoto(label: string, bodyType: string, overrideUrl?: string): string {
  if (overrideUrl) return overrideUrl;
  const l = (label || "").toLowerCase();
  if (l.includes("duster")) return "/img/vehicles/renault-duster.jpg";
  if (l.includes("sandero") || l.includes("stepway") || l.includes("kwid")) return "/img/vehicles/renault-sandero.jpg";
  if (l.includes("logan")) return "/img/vehicles/renault-logan.jpg";
  if (l.includes("oroch")) return "/img/vehicles/renault-oroch.jpg";
  if (l.includes("master")) return "/img/vehicles/renault-master.jpg";
  if (l.includes("onix")) return "/img/vehicles/chevrolet-onix.jpg";
  if (l.includes("gol") || l.includes("polo")) return "/img/vehicles/volkswagen-gol.jpg";

  if (bodyType === "suv") return "/img/vehicles/suv-real.jpg";
  if (bodyType === "sedan") return "/img/vehicles/sedan-real.jpg";
  if (bodyType === "picape") return "/img/vehicles/picape-real.jpg";
  if (bodyType === "van") return "/img/vehicles/van-real.jpg";
  return "/img/vehicles/hatch-real.jpg";
}

export default function Vehicle3DViewer({
  bodyType = "suv",
  hotspots = [],
  readOnly = true,
  onAddHotspot,
  onDeleteHotspot,
  vehicleLabel = "Veículo",
  realPhotoUrl
}: Vehicle3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Vehicle3DScene | null>(null);

  const [viewMode, setViewMode] = useState<"3d" | "photo" | "2d">("3d");
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);

  // New hotspot form state
  const [pendingHit, setPendingHit] = useState<{
    region_name: string;
    orientation_side: string;
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [hsType, setHsType] = useState<"avaria_entrada" | "achado_tecnico" | "servico_concluido">("avaria_entrada");
  const [hsSeverity, setHsSeverity] = useState<"baixa" | "media" | "alta" | "critica">("baixa");
  const [hsDamageType, setHsDamageType] = useState("risco");
  const [hsDescription, setHsDescription] = useState("");
  const [hsPhotoUrl, setHsPhotoUrl] = useState("");

  const resolvedPhoto = resolveRealPhoto(vehicleLabel, bodyType, realPhotoUrl);

  useEffect(() => {
    if (!containerRef.current || viewMode !== "3d") return;

    const scene = new Vehicle3DScene(containerRef.current, {
      onAddHotspot: (hit: any) => {
        setPendingHit(hit);
      },
      onSelectHotspot: (hs: HotspotData) => {
        setSelectedHotspot(hs);
      }
    });

    scene.setBodyType(bodyType);
    scene.setHotspots(hotspots);
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [viewMode]);

  // Update body type if prop changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setBodyType(bodyType);
    }
  }, [bodyType]);

  // Update hotspots if props change
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setHotspots(hotspots);
    }
  }, [hotspots]);

  // Toggle add mode
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setAddMode(isAddMode);
    }
  }, [isAddMode]);

  const handleCameraView = (view: "dianteira" | "traseira" | "esquerda" | "direita" | "teto" | "reset") => {
    sceneRef.current?.setCameraView(view);
  };

  const handleSaveHotspot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingHit || !hsDescription.trim() || !onAddHotspot) return;

    await onAddHotspot({
      region_name: pendingHit.region_name,
      orientation_side: pendingHit.orientation_side,
      pos_x: pendingHit.x,
      pos_y: pendingHit.y,
      pos_z: pendingHit.z,
      severity: hsSeverity,
      hotspot_type: hsType,
      damage_type: hsDamageType,
      description: hsDescription.trim(),
      photo_url: hsPhotoUrl.trim() || undefined
    });

    setPendingHit(null);
    setHsDescription("");
    setHsPhotoUrl("");
    setIsAddMode(false);
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 bg-[#060c18] shadow-2xl">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#0b1528] border-b border-slate-800 text-xs gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="font-bold text-slate-200">
            {viewMode === "3d" ? "REPRESENTAÇÃO ILUSTRATIVA 3D" : viewMode === "photo" ? "FOTOGRAFIA REAL DO MODELO" : "VISTA TÉCNICA 2D"}
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-500/30 text-cyan-300 font-mono uppercase">
            {bodyType}
          </span>
          <span className="text-slate-400 font-medium">({vehicleLabel})</span>
        </div>

        {/* View Mode Switcher Buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                viewMode === "3d" ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              🎮 3D 360°
            </button>
            <button
              type="button"
              onClick={() => setViewMode("photo")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                viewMode === "photo" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              📸 Foto Real
            </button>
            <button
              type="button"
              onClick={() => setViewMode("2d")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                viewMode === "2d" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              📐 2D
            </button>
          </div>

          {!readOnly && viewMode === "3d" && (
            <button
              type="button"
              onClick={() => setIsAddMode(!isAddMode)}
              className={`px-3 py-1 rounded font-semibold text-[11px] transition ${
                isAddMode
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {isAddMode ? "✕ Cancelar" : "+ Marcar Avaria"}
            </button>
          )}
        </div>
      </div>

      {/* 1. 3D WebGL Mode */}
      {viewMode === "3d" && (
        <div className="relative w-full h-[380px] sm:h-[440px]">
          <div ref={containerRef} className="w-full h-full" />

          {/* Camera controls toolbar */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 z-10">
            <button
              type="button"
              onClick={() => handleCameraView("dianteira")}
              className="px-2 py-1 text-[10px] rounded bg-slate-800 hover:bg-cyan-900/50 text-slate-300 hover:text-cyan-300"
            >
              Dianteira
            </button>
            <button
              type="button"
              onClick={() => handleCameraView("esquerda")}
              className="px-2 py-1 text-[10px] rounded bg-slate-800 hover:bg-cyan-900/50 text-slate-300 hover:text-cyan-300"
            >
              Lateral Esq.
            </button>
            <button
              type="button"
              onClick={() => handleCameraView("direita")}
              className="px-2 py-1 text-[10px] rounded bg-slate-800 hover:bg-cyan-900/50 text-slate-300 hover:text-cyan-300"
            >
              Lateral Dir.
            </button>
            <button
              type="button"
              onClick={() => handleCameraView("traseira")}
              className="px-2 py-1 text-[10px] rounded bg-slate-800 hover:bg-cyan-900/50 text-slate-300 hover:text-cyan-300"
            >
              Traseira
            </button>
            <button
              type="button"
              onClick={() => handleCameraView("teto")}
              className="px-2 py-1 text-[10px] rounded bg-slate-800 hover:bg-cyan-900/50 text-slate-300 hover:text-cyan-300"
            >
              Teto
            </button>
            <button
              type="button"
              onClick={() => handleCameraView("reset")}
              className="px-2 py-1 text-[10px] rounded bg-cyan-700/60 hover:bg-cyan-600 text-cyan-100 font-bold"
              title="Redefinir visualização"
            >
              ↺ Reset
            </button>
          </div>

          {/* Add mode instructions banner */}
          {isAddMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/90 text-slate-950 font-bold px-4 py-1.5 rounded-full text-xs shadow-lg flex items-center gap-2 animate-bounce">
              <span>🎯 Clique sobre a lataria do modelo 3D para assinalar a avaria</span>
            </div>
          )}

          {/* Hotspots legend */}
          <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 text-[10px] space-y-1 text-slate-300 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Avaria de Entrada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>Achado Técnico</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Serviço Concluído</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Real Photo Mode */}
      {viewMode === "photo" && (
        <div className="relative w-full h-[380px] sm:h-[440px] bg-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden">
          <div className="relative max-w-2xl w-full h-full flex flex-col items-center justify-center">
            <img
              src={resolvedPhoto}
              alt={vehicleLabel}
              className="max-h-[300px] sm:max-h-[340px] w-auto object-contain rounded-xl shadow-2xl border border-slate-800"
            />

            {/* Badges and metadata over real photo */}
            <div className="mt-3 flex flex-wrap items-center justify-between w-full px-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px] uppercase">
                  📸 Foto Real de Referência
                </span>
                <span className="font-semibold text-slate-200">{vehicleLabel}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Padrão Original de Montadora • Homologado G-Tech
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 2D Fallback & Semantic Regions List */}
      {viewMode === "2d" && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#081122]">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Regiões do Veículo</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { name: "Dianteira / Capô", side: "dianteira" },
                { name: "Para-choque Dianteiro", side: "dianteira" },
                { name: "Lateral Dianteira Esquerda", side: "lateral_esquerda" },
                { name: "Lateral Dianteira Direita", side: "lateral_direita" },
                { name: "Lateral Traseira Esquerda", side: "lateral_esquerda" },
                { name: "Lateral Traseira Direita", side: "lateral_direita" },
                { name: "Tampa Traseira / Porta-malas", side: "traseira" },
                { name: "Para-choque Traseiro", side: "traseira" },
                { name: "Teto / Vidros", side: "teto" },
                { name: "Motor / Transmissão", side: "motor" }
              ].map(r => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => {
                    if (!readOnly) {
                      setPendingHit({
                        region_name: r.name,
                        orientation_side: r.side,
                        x: 0,
                        y: 0.5,
                        z: 0
                      });
                    }
                  }}
                  className="p-2 text-left rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
                >
                  <span className="block font-medium">{r.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{r.side}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              Marcadores Registrados ({hotspots.length})
            </h4>
            {hotspots.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum marcador registrado no veículo.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {hotspots.map(hs => (
                  <div
                    key={hs.id}
                    onClick={() => setSelectedHotspot(hs)}
                    className="p-2.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{hs.region_name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          hs.hotspot_type === "servico_concluido"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : hs.hotspot_type === "achado_tecnico"
                            ? "bg-red-950 text-red-400 border border-red-800"
                            : "bg-amber-950 text-amber-400 border border-amber-800"
                        }`}
                      >
                        {hs.hotspot_type.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] line-clamp-2">{hs.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Hotspot Detail Modal */}
      {selectedHotspot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0b1528] border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-cyan-400">{selectedHotspot.region_name}</h3>
                <span className="text-[11px] text-slate-400">
                  Lado: {selectedHotspot.orientation_side} | Severidade: {selectedHotspot.severity}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHotspot(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="block text-slate-500 font-semibold uppercase text-[10px]">Tipo de Registro</span>
                <span className="font-medium text-slate-300 capitalize">{selectedHotspot.hotspot_type.replace("_", " ")}</span>
              </div>
              <div>
                <span className="block text-slate-500 font-semibold uppercase text-[10px]">Descrição Técnica</span>
                <p className="text-slate-200 bg-slate-900 p-2.5 rounded border border-slate-800 leading-relaxed">
                  {selectedHotspot.description}
                </p>
              </div>

              {selectedHotspot.photo_url && (
                <div>
                  <span className="block text-slate-500 font-semibold uppercase text-[10px] mb-1">Foto / Evidência</span>
                  <img
                    src={selectedHotspot.photo_url}
                    alt="Evidência"
                    className="w-full h-44 object-cover rounded border border-slate-700"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              {!readOnly && onDeleteHotspot && (
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteHotspot(selectedHotspot.id);
                    setSelectedHotspot(null);
                  }}
                  className="px-3 py-1.5 rounded bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-semibold"
                >
                  Excluir Marcador
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedHotspot(null)}
                className="ml-auto px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Hotspot Creation Form Modal */}
      {pendingHit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleSaveHotspot}
            className="bg-[#0b1528] border border-cyan-500/30 rounded-xl p-5 max-w-md w-full shadow-2xl text-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-cyan-400">Registrar Avaria / Achado</h3>
                <span className="text-[11px] text-slate-400">
                  Região Selecionada: <strong className="text-white">{pendingHit.region_name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPendingHit(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Classificação</label>
                  <select
                    value={hsType}
                    onChange={e => setHsType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="avaria_entrada">Avaria de Entrada</option>
                    <option value="achado_tecnico">Achado Técnico</option>
                    <option value="servico_concluido">Serviço Concluído</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Severidade</label>
                  <select
                    value={hsSeverity}
                    onChange={e => setHsSeverity(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="baixa">Baixa (Estética/Leve)</option>
                    <option value="media">Média (Atenção)</option>
                    <option value="alta">Alta (Urgente)</option>
                    <option value="critica">Crítica (Risco de Segurança)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Tipo do Dano</label>
                <select
                  value={hsDamageType}
                  onChange={e => setHsDamageType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                >
                  <option value="risco">Risco / Arranhão</option>
                  <option value="amassado">Amassado / Batida</option>
                  <option value="trinca">Trinca / Quebrado</option>
                  <option value="vazamento">Vazamento de Fluido</option>
                  <option value="folga">Folga Excessiva / Ruído</option>
                  <option value="desgaste">Desgaste Irregular</option>
                  <option value="outro">Outro defeito</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Descrição Detalhada do Registro *</label>
                <textarea
                  required
                  rows={3}
                  value={hsDescription}
                  onChange={e => setHsDescription(e.target.value)}
                  placeholder="Descreva a avaria ou achado técnico observado na região..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">URL da Foto / Evidência (Opcional)</label>
                <input
                  type="text"
                  value={hsPhotoUrl}
                  onChange={e => setHsPhotoUrl(e.target.value)}
                  placeholder="https://... ou caminho da imagem anexada"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPendingHit(null)}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/50"
              >
                Salvar Marcador
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
