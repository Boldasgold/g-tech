"use client";

import React, { useState } from "react";

export interface DamagePoint {
  id: string;
  region_name: string;
  damage_type: string;
  description: string;
  severity?: string;
  photo_url?: string;
  author_name?: string;
  created_at?: string;
}

interface DamageMap2DProps {
  damages: DamagePoint[];
  onSelectRegion?: (regionName: string) => void;
  selectedRegion?: string;
  readOnly?: boolean;
}

export default function DamageMap2D({
  damages = [],
  onSelectRegion,
  selectedRegion,
  readOnly = false
}: DamageMap2DProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const regions = [
    { id: "frente", label: "Para-choque Dianteiro & Grade", x: 125, y: 35, width: 90, height: 45 },
    { id: "capo", label: "Capô do Motor", x: 110, y: 85, width: 120, height: 75 },
    { id: "parabrisa", label: "Para-brisa Dianteiro", x: 115, y: 165, width: 110, height: 45 },
    { id: "teto", label: "Teto da Cabine", x: 110, y: 215, width: 120, height: 110 },
    { id: "vidro_traseiro", label: "Vidro Traseiro", x: 115, y: 330, width: 110, height: 40 },
    { id: "porta_malas", label: "Porta-Malas / Tampa Traseira", x: 110, y: 375, width: 120, height: 60 },
    { id: "traseira", label: "Para-choque Traseiro", x: 120, y: 440, width: 100, height: 45 },
    
    // Laterais
    { id: "lateral_esq_diant", label: "Para-lama Diant. Esquerdo", x: 45, y: 80, width: 55, height: 70 },
    { id: "lateral_esq_portas", label: "Portas Lado Esquerdo", x: 40, y: 160, width: 60, height: 170 },
    { id: "lateral_esq_tras", label: "Para-lama Tras. Esquerdo", x: 45, y: 340, width: 55, height: 80 },

    { id: "lateral_dir_diant", label: "Para-lama Diant. Direito", x: 240, y: 80, width: 55, height: 70 },
    { id: "lateral_dir_portas", label: "Portas Lado Direito", x: 240, y: 160, width: 60, height: 170 },
    { id: "lateral_dir_tras", label: "Para-lama Tras. Direito", x: 240, y: 340, width: 55, height: 80 },

    // Rodas
    { id: "roda_diant_esq", label: "Roda Dianteira Esquerda", x: 20, y: 90, width: 22, height: 50 },
    { id: "roda_tras_esq", label: "Roda Traseira Esquerda", x: 20, y: 360, width: 22, height: 50 },
    { id: "roda_diant_dir", label: "Roda Dianteira Direita", x: 298, y: 90, width: 22, height: 50 },
    { id: "roda_tras_dir", label: "Roda Traseira Direita", x: 298, y: 360, width: 22, height: 50 },
  ];

  const getDamagesForRegion = (regionId: string) => {
    return damages.filter(d => 
      d.region_name?.toLowerCase().includes(regionId.toLowerCase()) ||
      regionId.toLowerCase().includes(d.region_name?.toLowerCase() || "")
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <h4 className="text-base font-bold text-slate-900">
              Mapa 2D de Avarias
            </h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Esquema ilustrativo da carroceria. Clique em uma região para registrar ou inspecionar avarias.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
            <span className="text-slate-600">Sem avaria</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600" />
            <span className="text-slate-600">Avaria registrada ({damages.length})</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-6">
        {/* SVG Top-down Vehicle Schematic */}
        <div className="relative w-[340px] h-[500px] flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 p-2">
          <svg
            viewBox="0 0 340 500"
            className="w-full h-full select-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outline of the Car Body */}
            <path
              d="M 110 30 
                 Q 170 15 230 30 
                 Q 260 45 265 80 
                 L 265 140 
                 Q 275 160 275 220 
                 L 275 320 
                 Q 275 370 265 400 
                 L 265 450 
                 Q 240 485 170 485 
                 Q 100 485 75 450 
                 L 75 400 
                 Q 65 370 65 320 
                 L 65 220 
                 Q 65 160 75 140 
                 L 75 80 
                 Q 80 45 110 30 Z"
              fill="#ffffff"
              stroke="#94a3b8"
              strokeWidth="3"
            />

            {/* Clickable Car Regions */}
            {regions.map((reg) => {
              const regionDamages = getDamagesForRegion(reg.id);
              const hasDamage = regionDamages.length > 0;
              const isSelected = selectedRegion === reg.id;
              const isHovered = hoveredRegion === reg.id;

              return (
                <g key={reg.id}>
                  <rect
                    x={reg.x}
                    y={reg.y}
                    width={reg.width}
                    height={reg.height}
                    rx="8"
                    className={`cursor-pointer transition-colors duration-200 ${
                      hasDamage
                        ? "fill-rose-100 stroke-rose-500 stroke-2"
                        : isSelected
                        ? "fill-blue-100 stroke-blue-600 stroke-2"
                        : isHovered
                        ? "fill-slate-100 stroke-slate-400 stroke-1"
                        : "fill-transparent stroke-slate-300 stroke-1"
                    }`}
                    onClick={() => !readOnly && onSelectRegion && onSelectRegion(reg.id)}
                    onMouseEnter={() => setHoveredRegion(reg.id)}
                    onMouseLeave={() => setHoveredRegion(null)}
                  />

                  {/* Damage indicator Pin */}
                  {hasDamage && (
                    <circle
                      cx={reg.x + reg.width / 2}
                      cy={reg.y + reg.height / 2}
                      r="10"
                      className="fill-rose-500 animate-pulse pointer-events-none"
                    />
                  )}

                  {hasDamage && (
                    <text
                      x={reg.x + reg.width / 2}
                      y={reg.y + reg.height / 2 + 4}
                      textAnchor="middle"
                      className="fill-white font-bold text-[10px] pointer-events-none font-mono"
                    >
                      {regionDamages.length}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Car Front Label */}
            <text x="170" y="24" textAnchor="middle" className="fill-slate-400 font-bold text-[11px] uppercase tracking-widest pointer-events-none">
              ▲ Frente do Veículo ▲
            </text>
            <text x="170" y="495" textAnchor="middle" className="fill-slate-400 font-bold text-[11px] uppercase tracking-widest pointer-events-none">
              ▼ Traseira ▼
            </text>
          </svg>
        </div>

        {/* Region Details / Interactive Inspector */}
        <div className="flex-1 w-full space-y-3">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Região Selecionada
            </span>
            <h5 className="text-base font-bold text-slate-900">
              {regions.find(r => r.id === (selectedRegion || hoveredRegion))?.label || "Selecione uma região no mapa ao lado"}
            </h5>
            <p className="text-xs text-slate-600">
              {regions.find(r => r.id === (selectedRegion || hoveredRegion))
                ? `Avarias apontadas nesta área: ${getDamagesForRegion(selectedRegion || hoveredRegion || "").length}`
                : "Clique na dianteira, lateral, teto ou traseira do veículo para visualizar ou cadastrar apontamentos."}
            </p>
          </div>

          {/* List of damages registered on this vehicle */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Apontamentos Registrados ({damages.length})
            </span>

            {damages.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-xs">
                Nenhuma avaria registrada neste atendimento. Lataria em conformidade inicial.
              </div>
            ) : (
              damages.map((dmg, idx) => (
                <div
                  key={dmg.id || idx}
                  className="p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <strong className="text-slate-900 text-sm">{dmg.region_name || "Região geral"}</strong>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                        {dmg.damage_type || "Avaria"}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      {dmg.description || "Sem descrição informada."}
                    </p>
                    <span className="text-[11px] text-slate-400 block">
                      Registrado por {dmg.author_name || "Vistoriador"} • {dmg.created_at ? new Date(dmg.created_at).toLocaleDateString("pt-BR") : "Data de entrada"}
                    </span>
                  </div>

                  {dmg.photo_url && (
                    <img
                      src={dmg.photo_url}
                      alt={dmg.region_name}
                      className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-sm flex-shrink-0"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

