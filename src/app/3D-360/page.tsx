"use client";

import React, { useState, useMemo } from "react";
import Vehicle3DViewer from "@/components/Vehicle3DViewer";
import { VW_MODELS_CATALOG, VwModelData, recognizeVehicle } from "@/lib/vw-recognition";
import { BodyType } from "@/lib/vehicle3d";
import Link from "next/link";

export default function Vehicle3D360Page() {
  const [selectedBrand, setSelectedBrand] = useState("Volkswagen");
  const [searchQuery, setSearchQuery] = useState("");
  const [plateInput, setPlateInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<"todos" | "golf" | "sedan" | "hatch" | "suv" | "van">("todos");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Default to Golf VII GTI
  const [currentVwModel, setCurrentVwModel] = useState<VwModelData>(
    VW_MODELS_CATALOG.find(m => m.id === "golf-gti") || VW_MODELS_CATALOG[0]
  );
  
  // Custom vehicle name when typing
  const [customModelText, setCustomModelText] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Recognition calculation
  const recognition = useMemo(() => {
    if (selectedBrand === "Volkswagen") {
      if (customModelText.trim()) {
        return recognizeVehicle("Volkswagen", customModelText);
      }
      return recognizeVehicle("Volkswagen", currentVwModel.name);
    } else {
      return recognizeVehicle(selectedBrand, customModelText || "Veículo de Entrada");
    }
  }, [selectedBrand, customModelText, currentVwModel]);

  // Filtered VW catalog for browser
  const filteredVwModels = useMemo(() => {
    return VW_MODELS_CATALOG.filter(m => {
      // Category filter
      if (activeCategory === "golf" && !m.id.startsWith("golf") && !m.id.startsWith("e-golf")) return false;
      if (activeCategory === "sedan" && m.bodyType !== "sedan") return false;
      if (activeCategory === "hatch" && (m.bodyType !== "hatch" || m.id.startsWith("golf"))) return false;
      if (activeCategory === "suv" && m.bodyType !== "suv") return false;
      if (activeCategory === "van" && m.bodyType !== "van") return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.variant.toLowerCase().includes(q) ||
          m.engine.toLowerCase().includes(q) ||
          m.years.includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  const handleSelectModel = (model: VwModelData) => {
    setSelectedBrand("Volkswagen");
    setCurrentVwModel(model);
    setCustomModelText("");
  };

  const currentLabel = recognition.isVolkswagen
    ? (recognition.matchedModel?.name ? `Volkswagen ${recognition.matchedModel.name}` : recognition.displayName)
    : `${selectedBrand} ${customModelText || "Veículo"}`;

  const currentBodyType: BodyType = recognition.bodyType;
  const currentPhoto = recognition.photoUrl;

  return (
    <div className="min-h-screen bg-[#04070d] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top G-Tech Workshop Navigation Header */}
      <header className="border-b border-cyan-500/20 bg-[#060c18]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-black text-sm shadow-lg shadow-cyan-500/20">
                GT
              </span>
              <div>
                <h1 className="text-sm font-bold text-white tracking-wider flex items-center gap-1.5">
                  G-TECH <span className="text-cyan-400">3D-360°</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-mono">
                  Centro de Diagnóstico • Giovane Ribeiro • Paranaguá–PR
                </p>
              </div>
            </Link>

            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold">
              51 Modelos Volkswagen Homologados
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              ← Voltar ao Site
            </Link>
            <Link
              href="/oficina"
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-md transition flex items-center gap-1.5"
            >
              📋 Abrir Gestão da Oficina
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 w-full space-y-6 flex-1">
        {/* Banner de Apresentação e Reconhecimento de Entrada */}
        <div className="bg-gradient-to-r from-[#081329] via-[#091834] to-[#081122] p-6 rounded-2xl border border-cyan-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  Módulo de Entrada • Inspeção 3D & Vistoria Mecânica
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Reconhecimento Automático de Veículos na Oficina
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Ao dar entrada na G-Tech, o veículo é identificado com precisão metrológica. O sistema reconhece 
                automaticamente o modelo dentre os <strong className="text-cyan-300">51 modelos e variações Volkswagen</strong> (Golf GTI, R, TSI, Jetta GLI, Passat, Tiguan, Polo, Up!, Crafter e ID Elétricos), vincula a fotografia real homologada e gera a representação 3D interativa com desmontagem técnica de peças.
              </p>
            </div>

            <div className="bg-[#050b16]/80 p-3.5 rounded-xl border border-cyan-500/20 text-xs space-y-1 self-start min-w-[200px]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Local da Oficina</span>
              <strong className="text-white block">Divinéia, Paranaguá–PR</strong>
              <span className="text-[11px] text-cyan-400 font-mono block">R. Maria da Conceição T. de Souza, 815</span>
              <span className="text-[11px] text-amber-400 font-mono">WhatsApp: (41) 9652-2715</span>
            </div>
          </div>
        </div>

        {/* Painel de Identificação / Entrada de Veículo */}
        <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              🚗 Painel de Identificação de Veículo na Recepção
            </h3>
            <span className="text-[11px] text-slate-400">
              Digite a placa, selecione a montadora ou busque pelo modelo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            {/* Placa do Veículo com Emblema Mercosul Real */}
            <div className="sm:col-span-4">
              <label className="block text-slate-400 font-semibold mb-1">Placa (Entrada Oficina)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: BRA2E19"
                  value={plateInput}
                  onChange={e => setPlateInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-[#050b16] border border-cyan-500/30 rounded-lg p-2 text-white font-mono font-bold tracking-wider uppercase focus:outline-none focus:border-cyan-400"
                />
                {/* Placa Padrão Mercosul Autêntica */}
                <div className="w-24 h-9 bg-white rounded border-2 border-slate-900 shadow-md flex flex-col overflow-hidden select-none shrink-0">
                  <div className="bg-[#003399] px-1 py-0.5 flex items-center justify-between text-white text-[6px] font-bold tracking-wider leading-none">
                    <span>BRASIL</span>
                    <span>🇧🇷</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center font-mono font-black text-slate-950 text-xs uppercase tracking-wider leading-none">
                    {plateInput.trim() || "GTC•2026"}
                  </div>
                </div>
              </div>
            </div>

            {/* Montadora Selector */}
            <div className="sm:col-span-3">
              <label className="block text-slate-400 font-semibold mb-1">Montadora *</label>
              <select
                value={selectedBrand}
                onChange={e => {
                  setSelectedBrand(e.target.value);
                  setCustomModelText("");
                }}
                className="w-full bg-[#050b16] border border-slate-700 rounded-lg p-2 text-white font-semibold focus:outline-none focus:border-cyan-400"
              >
                <option value="Volkswagen">Volkswagen (51 Modelos Homologados)</option>
                <option value="Renault">Renault (Especialidade Giovane Ribeiro)</option>
                <option value="Chevrolet">Chevrolet</option>
                <option value="Fiat">Fiat</option>
                <option value="Ford">Ford</option>
                <option value="Toyota">Toyota</option>
                <option value="Honda">Honda</option>
                <option value="Hyundai">Hyundai</option>
                <option value="Jeep">Jeep</option>
                <option value="Peugeot">Peugeot</option>
                <option value="Citroën">Citroën</option>
                <option value="Nissan">Nissan</option>
              </select>
            </div>

            {/* Modelo / Busca Rápida */}
            <div className="sm:col-span-5">
              <label className="block text-slate-400 font-semibold mb-1">
                {selectedBrand === "Volkswagen" ? "Buscar entre os 51 Modelos VW ou Digitar" : "Modelo do Veículo"}
              </label>
              <input
                type="text"
                placeholder={selectedBrand === "Volkswagen" ? "Digite: Golf GTI, Jetta, Tiguan, Polo, Up, Passat..." : "Ex: Duster 2.0, Onix Turbo, Sandero..."}
                value={customModelText || (selectedBrand === "Volkswagen" ? currentVwModel.name : "")}
                onChange={e => {
                  setCustomModelText(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                className="w-full bg-[#050b16] border border-cyan-500/30 rounded-lg p-2 text-white font-semibold focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Atalhos Rápidos para Modelos Populares */}
          {selectedBrand === "Volkswagen" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1">
              <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">Modelos Populares:</span>
              {[
                { label: "Golf GTI", id: "golf-gti" },
                { label: "Jetta GLI", id: "jetta-gli" },
                { label: "Polo GTS", id: "polo-hatch" },
                { label: "Tiguan Allspace", id: "tiguan" },
                { label: "Passat R-Line", id: "passat" },
                { label: "Up! TSI", id: "up" },
                { label: "ID.4 Elétrico", id: "id-4" },
                { label: "Transporter T6", id: "transporter" }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const match = VW_MODELS_CATALOG.find(m => m.id === item.id);
                    if (match) handleSelectModel(match);
                  }}
                  className="px-2 py-0.5 rounded-full bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500 text-[10px] whitespace-nowrap transition"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* HUD de Reconhecimento em Tempo Real */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#050e1f] via-[#07152d] to-[#071329] border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-2xl shadow-inner">
                {recognition.isVolkswagen ? "🚗" : "🔧"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40 text-[10px] font-bold uppercase tracking-wider">
                    {recognition.isVolkswagen ? "Reconhecimento Inteligente VW: Ativo" : "Veículo Detectado"}
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    Carroceria: {currentBodyType.toUpperCase()}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mt-0.5">
                  {currentLabel}
                </h4>
                <p className="text-xs text-slate-400">
                  {recognition.isVolkswagen && recognition.matchedModel
                    ? `${recognition.matchedModel.generation} • Motor: ${recognition.matchedModel.engine}`
                    : "Padrão de oficina G-Tech para vistoria técnica e diagnóstico avançado"}
                </p>
              </div>
            </div>

            {/* Ações Técnicas Diretas da Oficina */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `*G-TECH PARANAGUÁ — LAUDO DE ENTRADA*\nVeículo: ${currentLabel}\nPlaca: ${plateInput || "Não informada"}\nÓleo Homologado: ${recognition.specs?.oilViscosity || "5W40"} (${recognition.specs?.oilCapacityLiters || 4.5}L) Norma ${recognition.specs?.oilNorm || "VW 502.00"}\nPneus: ${recognition.specs?.tirePressureFrontPsi || 32}/${recognition.specs?.tirePressureRearPsi || 30} PSI\nOficina: Giovane Ribeiro • Paranaguá-PR`;
                  navigator.clipboard.writeText(text);
                  showToast("Ficha técnica copiada!");
                }}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-1"
                title="Copiar Laudo Técnico"
              >
                📋 Copiar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-1"
                title="Imprimir Ficha de Vistoria Oficial"
              >
                🖨️ Imprimir
              </button>

              <a
                href={`https://wa.me/554196522715?text=${encodeURIComponent(`Olá Giovane! Estou dando entrada com o veículo ${currentLabel} (Placa ${plateInput || "A combinar"}). Gostaria de realizar o diagnóstico avançado na G-Tech.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow transition flex items-center gap-1"
              >
                💬 WhatsApp
              </a>

              <Link
                href={`/oficina?new_os=1&brand=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(currentLabel)}&plate=${encodeURIComponent(plateInput)}`}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-1.5"
              >
                🛠️ Abrir OS na Oficina
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toastMsg && (
          <div className="fixed top-16 right-4 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-2">
            <span>✓</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Visualizador 3D-360 e Inspeção Mecânica */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Visualizador 3D 360° Interativo & Raio-X de Componentes
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-[10px] text-cyan-300 font-bold">
                {currentLabel}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Gire com o mouse/toque, explore a vista explodida e toque nos componentes
            </span>
          </div>

          <Vehicle3DViewer
            bodyType={currentBodyType}
            vehicleLabel={currentLabel}
            realPhotoUrl={currentPhoto}
            readOnly={false}
          />
        </div>

        {/* Seção Exclusiva: Seletor Visual dos 51 Modelos Volkswagen Homologados */}
        {selectedBrand === "Volkswagen" && (
          <div className="bg-[#081122] p-5 rounded-xl border border-cyan-500/30 space-y-4 shadow-xl">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold uppercase">
                  Acervo Oficial G-Tech
                </span>
                <h3 className="font-bold text-sm text-white mt-1">
                  Galeria de Modelos Volkswagen Homologados (51 Fotografias Reais)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toque em qualquer modelo para carregar instantaneamente sua foto real, especificações StartMyCar e representação 3D.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5 bg-[#050b16] p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCategory("todos")}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    activeCategory === "todos" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Todos ({VW_MODELS_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("golf")}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    activeCategory === "golf" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Golf Family (16)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("sedan")}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    activeCategory === "sedan" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sedans & Fastbacks (14)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("hatch")}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    activeCategory === "hatch" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Hatches & Compactos (9)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("suv")}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    activeCategory === "suv" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  SUVs (5)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("van")}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    activeCategory === "van" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Vans & Comerciais (7)
                </button>
              </div>
            </div>

            {/* Grid of Model Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredVwModels.map((model) => {
                const isSelected = currentVwModel.id === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleSelectModel(model)}
                    className={`p-2 rounded-xl text-left transition flex flex-col justify-between border ${
                      isSelected
                        ? "bg-cyan-950/70 border-cyan-400 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400"
                        : "bg-slate-900/80 hover:bg-slate-800 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/40 mb-2 border border-slate-800/80">
                      <img
                        src={model.photoUrl}
                        alt={model.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        loading="lazy"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] bg-black/80 font-mono text-cyan-300 font-bold uppercase">
                        {model.bodyType}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <strong className={`text-xs block line-clamp-1 ${isSelected ? "text-cyan-300" : "text-white"}`}>
                        {model.name}
                      </strong>
                      <span className="text-[10px] text-slate-400 block line-clamp-1">
                        {model.variant}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 block">
                        {model.years}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ficha Técnica StartMyCar do Veículo Reconhecido */}
        <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                📊 Especificações Técnicas de Fábrica (StartMyCar Intelligence)
              </h3>
              <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                Parâmetros Oficiais de Engenharia • {currentLabel}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `*ESPECIFICAÇÕES STARTMYCAR — ${currentLabel}*\n- Óleo do Motor: ${recognition.specs?.oilViscosity || "5W40"} (${recognition.specs?.oilCapacityLiters || 4.5}L) - Norma: ${recognition.specs?.oilNorm || "VW 502 00 / 508 88"}\n- Pressão dos Pneus: ${recognition.specs?.tirePressureFrontPsi || 32} PSI Diant. / ${recognition.specs?.tirePressureRearPsi || 30} PSI Tras. (Carga: ${recognition.specs?.tirePressureLoadedPsi || 36} PSI)\n- Gap de Velas: ${recognition.specs?.sparkPlugsGapMm || 0.8} mm\n- Arrefecimento: Aditivo Orgânico Rosa G12/G13 (50/50)\n- Transmissão: DSG Dupla Embreagem / Manual Sintético 75W\n- Bateria: EFB / AGM 70Ah Start-Stop`;
                  navigator.clipboard.writeText(text);
                  showToast("Ficha StartMyCar copiada com sucesso!");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-1"
              >
                📋 Copiar Especificações
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* 1. Óleo Recomendado */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 hover:border-amber-500/40 transition">
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">1. Óleo do Motor</span>
              <strong className="text-sm font-bold text-amber-400 block font-mono">
                {recognition.specs?.oilViscosity || "5W40 100% Sintético"}
              </strong>
              <p className="text-[11px] text-slate-300">
                Capacidade: <strong className="text-white">{recognition.specs?.oilCapacityLiters || 4.5} Litros</strong>
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Norma: {recognition.specs?.oilNorm || "VW 502 00 / 508 88"}
              </p>
            </div>

            {/* 2. Pressão dos Pneus */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 hover:border-cyan-500/40 transition">
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">2. Pressão dos Pneus</span>
              <strong className="text-sm font-bold text-cyan-400 block font-mono">
                {recognition.specs?.tirePressureFrontPsi || 32}/{recognition.specs?.tirePressureRearPsi || 30} PSI
              </strong>
              <p className="text-[11px] text-slate-300">
                Sob Carga: <strong className="text-amber-300">{recognition.specs?.tirePressureLoadedPsi || 36} PSI</strong>
              </p>
              <p className="text-[10px] text-slate-500">
                Calibragem a frio
              </p>
            </div>

            {/* 3. Ignição & Velas */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 hover:border-emerald-500/40 transition">
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">3. Ignição & Velas</span>
              <strong className="text-sm font-bold text-emerald-400 block font-mono">
                Gap: {recognition.specs?.sparkPlugsGapMm || 0.8} mm
              </strong>
              <p className="text-[11px] text-slate-300">
                Bobinas Dinâmicas
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Calibre de lâminas
              </p>
            </div>

            {/* 4. Arrefecimento */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 hover:border-pink-500/40 transition">
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">4. Arrefecimento</span>
              <strong className="text-sm font-bold text-pink-400 block font-mono">
                G12 / G13 Rosa
              </strong>
              <p className="text-[11px] text-slate-300">
                Proporção: <strong className="text-white">50% Aditivo</strong>
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Pto. Ebulição: 135°C
              </p>
            </div>

            {/* 5. Câmbio / Transmissão */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 hover:border-purple-500/40 transition">
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">5. Transmissão</span>
              <strong className="text-sm font-bold text-purple-400 block font-mono">
                DSG / Manual
              </strong>
              <p className="text-[11px] text-slate-300">
                Troca: <strong className="text-white">60.000 km</strong>
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Fluido Sintético 75W
              </p>
            </div>

            {/* 6. Bateria & Elétrica */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 hover:border-blue-500/40 transition">
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">6. Bateria & Partida</span>
              <strong className="text-sm font-bold text-blue-400 block font-mono">
                EFB / AGM 70Ah
              </strong>
              <p className="text-[11px] text-slate-300">
                Corrente: <strong className="text-white">640A (EN)</strong>
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Start-Stop Inteligente
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé e Contato da Oficina */}
        <div className="p-5 rounded-xl bg-[#060c18] border border-cyan-500/20 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <strong className="text-white text-sm block">G-Tech Serviços Automotivos Paranaguá</strong>
            <span>Rua Maria da Conceição Teixeira de Souza, 815, Oficina, Divinéia, Paranaguá–PR, CEP 83212-440</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/554196522715?text=Ol%C3%A1%20Giovane!%20Estou%20vendo%20o%20Scanner%203D%20na%20G-Tech%20e%20gostaria%20de%20agendar%20um%20atendimento."
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow"
            >
              💬 Falar com Giovane Ribeiro no WhatsApp
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

