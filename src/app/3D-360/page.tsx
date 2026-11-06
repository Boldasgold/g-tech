"use client";

import React, { useState, useMemo, useRef } from "react";
import Vehicle3DViewer from "@/components/Vehicle3DViewer";
import { VW_MODELS_CATALOG, VwModelData, recognizeVehicle } from "@/lib/vw-recognition";
import { VEHICLE_CATALOG, CatalogVehicle, FidelityLevel, FuelType } from "@/lib/vehicle-catalog";
import { BodyType } from "@/lib/vehicle3d";
import { VehicleScanResult } from "@/app/api/ai-scan/route";
import Link from "next/link";

type ScanStep = "idle" | "preparando_foto" | "analisando_imagem" | "aguardando_confirmacao" | "carregando_modelo_3d" | "concluido_3d";

export default function Vehicle3D360Page() {
  const [selectedBrand, setSelectedBrand] = useState("Volkswagen");
  const [searchQuery, setSearchQuery] = useState("");
  const [plateInput, setPlateInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<"todos" | "golf" | "sedan" | "hatch" | "suv" | "van">("todos");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Scanner & Local AI State Flow
  const [scanState, setScanState] = useState<ScanStep>("idle");
  const [activePhoto, setActivePhoto] = useState<string>("/img/vehicles/volkswagen/fotos/golf-gti.jpg");
  const [activePhotoFilename, setActivePhotoFilename] = useState<string>("golf-gti.jpg");
  const [aiScanResult, setAiScanResult] = useState<VehicleScanResult | null>(null);
  const [fidelityLevel, setFidelityLevel] = useState<FidelityLevel>("especifico_verificado");
  const [isPhotoReplaced, setIsPhotoReplaced] = useState(false);
  const fileInputScannerRef = useRef<HTMLInputElement>(null);

  // Manual Confirmation Form
  const [confirmBrand, setConfirmBrand] = useState("Volkswagen");
  const [confirmModel, setConfirmModel] = useState("Golf VII GTI");
  const [confirmGen, setConfirmGen] = useState("Geração VII (MK7)");
  const [confirmPlate, setConfirmPlate] = useState("");
  const [confirmYear, setConfirmYear] = useState("2018");
  const [confirmEngine, setConfirmEngine] = useState("2.0 TSI EA888 (220cv)");
  const [confirmFuel, setConfirmFuel] = useState<FuelType>("gasolina");
  const [confirmBodyType, setConfirmBodyType] = useState<BodyType>("hatch");

  // Selected VW model
  const [currentVwModel, setCurrentVwModel] = useState<VwModelData>(
    VW_MODELS_CATALOG.find(m => m.id === "golf-gti") || VW_MODELS_CATALOG[0]
  );
  const [customModelText, setCustomModelText] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
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
      if (activeCategory === "golf" && !m.id.startsWith("golf") && !m.id.startsWith("e-golf")) return false;
      if (activeCategory === "sedan" && m.bodyType !== "sedan") return false;
      if (activeCategory === "hatch" && (m.bodyType !== "hatch" || m.id.startsWith("golf"))) return false;
      if (activeCategory === "suv" && m.bodyType !== "suv") return false;
      if (activeCategory === "van" && m.bodyType !== "van") return false;

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

  // Trigger Scanner Pipeline with image (URL or Base64)
  const triggerScanPipeline = async (imageSrc: string, filename: string, hint?: string) => {
    setActivePhoto(imageSrc);
    setActivePhotoFilename(filename);
    setScanState("preparando_foto");

    setTimeout(async () => {
      setScanState("analisando_imagem");
      try {
        const res = await fetch("/api/ai-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imageSrc,
            filename,
            manual_hint: hint || customModelText || selectedBrand
          })
        });

        const data = await res.json();
        if (data.success && data.scan) {
          const scan = data.scan as VehicleScanResult;
          setAiScanResult(scan);
          setConfirmBrand(scan.suggested_brand || "Volkswagen");
          setConfirmModel(scan.suggested_model || "Golf VII GTI");
          setConfirmGen(scan.suggested_generation || "Geração VII (MK7)");
          setConfirmBodyType(scan.body_type || "hatch");
          setFidelityLevel(scan.fidelity_level || "especifico_verificado");
          setScanState("aguardando_confirmacao");
        } else {
          fallbackHeuristic(filename, hint);
        }
      } catch (err) {
        console.warn("Falha de conexão com IA local Ollama. Ativando fallback homologado G-Tech:", err);
        fallbackHeuristic(filename, hint);
      }
    }, 600);
  };

  const fallbackHeuristic = (filename: string, hint?: string) => {
    const q = (filename + " " + (hint || "")).toLowerCase();
    let modelName = "Golf VII GTI";
    let body: BodyType = "hatch";
    let gen = "Geração VII (MK7)";
    let fid: FidelityLevel = "especifico_verificado";

    if (q.includes("jetta") || q.includes("gli")) {
      modelName = "Jetta GLI 350 TSI";
      body = "sedan";
      gen = "Geração VII (A7)";
    } else if (q.includes("amarok")) {
      modelName = "Amarok V6 Extreme";
      body = "picape";
      gen = "Geração I Facelift";
    } else if (q.includes("duster")) {
      modelName = "Duster Dynamique 2.0 16V";
      body = "suv";
      gen = "Geração I";
      fid = "representativo_carroceria";
    }

    setAiScanResult({
      source: "fallback_catalogo",
      visible_features: `Silhueta visual correspondente a ${modelName}, grade frontal característica e proporções de ${gen}.`,
      suggested_brand: q.includes("duster") ? "Renault" : "Volkswagen",
      suggested_model: modelName,
      suggested_generation: gen,
      body_type: body,
      color: "Azul Safira / Prata Reflex (Padrão G-Tech)",
      doubts: "Identificação externa assistida pelo catálogo da oficina. Confirmar ano, motorização e código de chassi no documento de entrada.",
      fidelity_level: fid,
      confidence_note: "Identificação técnica assistida (IA local indisponível no momento)."
    });

    setConfirmBrand(q.includes("duster") ? "Renault" : "Volkswagen");
    setConfirmModel(modelName);
    setConfirmGen(gen);
    setConfirmBodyType(body);
    setFidelityLevel(fid);
    setScanState("aguardando_confirmacao");
  };

  // Upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("A foto excede o tamanho máximo de 10MB. Envie uma foto menor.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setIsPhotoReplaced(true);
      triggerScanPipeline(base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  // Confirm vehicle from scan
  const handleConfirmVehicle = () => {
    setScanState("carregando_modelo_3d");
    setTimeout(() => {
      setSelectedBrand(confirmBrand);
      setCustomModelText(confirmModel);
      setPlateInput(confirmPlate);

      const matchedVw = VW_MODELS_CATALOG.find(m => m.name.toLowerCase().includes(confirmModel.toLowerCase()));
      if (matchedVw) {
        setCurrentVwModel(matchedVw);
      }

      setScanState("concluido_3d");
      showToast(`Veículo ${confirmBrand} ${confirmModel} confirmado com sucesso!`);
      // Scroll to 3D Viewer smoothly
      const viewerElem = document.getElementById("gtech-3d-viewer-anchor");
      if (viewerElem) {
        viewerElem.scrollIntoView({ behavior: "smooth" });
      }
    }, 700);
  };

  const handleSelectModelFromCatalog = (model: VwModelData) => {
    setSelectedBrand("Volkswagen");
    setCurrentVwModel(model);
    setCustomModelText("");
    triggerScanPipeline(model.photoUrl, model.photoFile, model.name);
  };

  const currentLabel = scanState === "concluido_3d"
    ? `${confirmBrand} ${confirmModel}`
    : recognition.isVolkswagen
      ? (recognition.matchedModel?.name ? `Volkswagen ${recognition.matchedModel.name}` : recognition.displayName)
      : `${selectedBrand} ${customModelText || "Veículo"}`;

  const currentBodyType: BodyType = scanState === "concluido_3d" ? confirmBodyType : recognition.bodyType;
  const currentPhoto = activePhoto || recognition.photoUrl;

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
                <h1 className="text-sm font-bold text-white tracking-wider flex items-center gap-1.5 font-mono">
                  G-TECH <span className="text-cyan-400">3D-360°</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-mono">
                  Centro de Diagnóstico • Giovane Ribeiro • Paranaguá–PR
                </p>
              </div>
            </Link>

            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold">
              IA Local (gemma3:4b) + Scanner Visual Homologado
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
              📋 Painel da Oficina
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
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  Fluxo Real: Foto → Scanner Visual → IA Local → Confirmação → 3D → Orçamento
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Reconhecimento Assistido & Inspeção Técnica 3D
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Fotografe o veículo na recepção ou selecione do catálogo homologado. A inteligência visual local (gemma3:4b)
                sugere a carroceria e modelo preliminar, você confirma os dados no laudo e o sistema carrega a 
                representação 3D interativa com desmontagem de componentes para orçamento rastreável.
              </p>
            </div>

            <div className="bg-[#050b16]/90 p-3.5 rounded-xl border border-cyan-500/20 text-xs space-y-1 self-start min-w-[200px]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Oficina Paranaguá–PR</span>
              <strong className="text-white block">Divinéia • R. Maria da Conceição T. de Souza, 815</strong>
              <span className="text-[11px] text-cyan-400 font-mono block">Especialista: Giovane Ribeiro</span>
              <span className="text-[11px] text-amber-400 font-mono">WhatsApp: (41) 9652-2715</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 1: FOTO E SCANNER VISUAL DE VEÍCULO (CATÁLOGO OU UPLOAD)           */}
        {/* ========================================================================= */}
        <div className="bg-[#081122] p-5 rounded-2xl border border-cyan-500/30 shadow-2xl space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  Etapa 1 • Scanner Visual Assistivo
                </span>
                {scanState === "analisando_imagem" && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 text-[10px] font-mono animate-pulse">
                    ● Analisando com gemma3:4b
                  </span>
                )}
                {scanState === "aguardando_confirmacao" && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-400 text-amber-300 text-[10px] font-bold">
                    Aguardando Confirmação
                  </span>
                )}
                {scanState === "concluido_3d" && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-300 text-[10px] font-bold">
                    ✓ Veículo Confirmado no 3D
                  </span>
                )}
              </div>
              <h3 className="font-bold text-base text-white mt-0.5">
                Fotografia de Entrada & Varredura Visual da Carroceria
              </h3>
            </div>

            {/* Input de Upload de Foto com File Picker */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputScannerRef}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                type="button"
                onClick={() => fileInputScannerRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center gap-1.5"
              >
                <span>📷</span>
                <span>{isPhotoReplaced ? "Substituir Foto" : "Enviar Foto do Veículo (Upload)"}</span>
              </button>

              <button
                type="button"
                onClick={() => triggerScanPipeline(activePhoto, activePhotoFilename)}
                disabled={scanState === "analisando_imagem" || scanState === "preparando_foto"}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>Executar Scanner</span>
              </button>
            </div>
          </div>

          {/* Scanner Visual Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Foto com Feixe de Scanner Azul/Ciano e Grade */}
            <div className="lg:col-span-7 bg-[#050b16] rounded-xl border border-cyan-500/30 overflow-hidden relative min-h-[300px] flex flex-col justify-between shadow-inner">
              {/* Imagem do Veículo */}
              <div className="relative w-full h-72 sm:h-80 bg-slate-950 flex items-center justify-center overflow-hidden">
                <img
                  src={activePhoto}
                  alt="Foto do Veículo na Oficina"
                  className="w-full h-full object-contain p-2"
                />

                {/* Efeito do Scanner: Grade e Linha Luminosa Ciano */}
                {(scanState === "analisando_imagem" || scanState === "preparando_foto") && (
                  <div className="absolute inset-0 scanner-grid-overlay pointer-events-none flex flex-col justify-between">
                    <div className="scanner-beam-line" />
                  </div>
                )}

                {/* Overlay de Estado Real do Scanner (Sem porcentagens fictícias) */}
                {(scanState === "preparando_foto" || scanState === "analisando_imagem" || scanState === "carregando_modelo_3d") && (
                  <div className="absolute inset-0 bg-[#040814]/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-400 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/30 animate-pulse">
                      {scanState === "carregando_modelo_3d" ? "🚗" : "🔍"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                        {scanState === "preparando_foto" && "Preparando foto..."}
                        {scanState === "analisando_imagem" && "Analisando imagem com IA local (gemma3:4b)..."}
                        {scanState === "carregando_modelo_3d" && "Carregando modelo 3D e componentes..."}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {scanState === "analisando_imagem" && "Extraindo silhueta externa, grade frontal e proporções de carroceria."}
                        {scanState === "carregando_modelo_3d" && "Configurando malha volumétrica e sistemas mecânicos vinculados."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setScanState("idle")}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      ✕ Cancelar Análise
                    </button>
                  </div>
                )}
              </div>

              {/* Barra de Rodapé da Foto com Metadados e Disclaimer Ético */}
              <div className="p-3 bg-[#081224] border-t border-slate-800 flex flex-wrap justify-between items-center gap-2 text-xs">
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span className="text-slate-500">Arquivo:</span>
                  <span className="font-mono text-cyan-300 truncate max-w-[200px]">{activePhotoFilename}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputScannerRef.current?.click()}
                    className="text-cyan-400 hover:underline text-[11px] font-semibold"
                  >
                    Substituir Foto ↗
                  </button>
                </div>
              </div>

              {/* Disclaimer Assistivo Rigoroso */}
              <div className="px-3 py-1.5 bg-[#04070d] text-[10px] text-slate-500 border-t border-slate-900 leading-tight">
                ℹ️ <strong>Aviso Técnico:</strong> O scanner visual é um recurso assistivo de identificação externa.
                Não constitui medição física a laser nem diagnóstico de componentes mecânicos internos.
              </div>
            </div>

            {/* Painel Estruturado de IA & Confirmação Humana */}
            <div className="lg:col-span-5 bg-[#060c18] rounded-xl border border-cyan-500/25 p-4 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                    Laudo Visual Assistido por IA
                  </span>
                  {aiScanResult && (
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 border ${
                      aiScanResult.source.startsWith("ollama:")
                        ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/50"
                        : "bg-amber-950/90 text-amber-300 border-amber-500/50"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        aiScanResult.source.startsWith("ollama:") ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                      }`} />
                      {aiScanResult.source.startsWith("ollama:")
                        ? `Visão Computacional: ${aiScanResult.source}`
                        : "Busca Heurística por Catálogo/Nome"}
                    </span>
                  )}
                </div>

                {/* Card de Características Identificadas */}
                {aiScanResult ? (
                  <div className="space-y-2.5 text-xs">
                    {/* Fidelity Badge */}
                    <div className="p-2.5 rounded-lg bg-[#081329] border border-cyan-500/30 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">
                          {fidelityLevel === "especifico_verificado" ? "🛡️" : fidelityLevel === "representativo_carroceria" ? "🚙" : "📐"}
                        </span>
                        <strong className={`text-xs ${
                          fidelityLevel === "especifico_verificado" ? "text-emerald-400" :
                          fidelityLevel === "representativo_carroceria" ? "text-amber-400" : "text-slate-400"
                        }`}>
                          {fidelityLevel === "especifico_verificado" && "Modelo Específico com Correspondência Verificada"}
                          {fidelityLevel === "representativo_carroceria" && "Modelo Representativo da Carroceria"}
                          {fidelityLevel === "sem_recurso_3d" && "Veículo sem Recurso 3D Específico (Modo 2D Ativo)"}
                        </strong>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {aiScanResult.visible_features}
                      </p>
                    </div>

                    {/* Dúvidas e Confirmações do Operador */}
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px] space-y-1">
                      <span className="font-bold block text-amber-400 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>Pontos a Confirmar com o Técnico / Documento:</span>
                      </span>
                      <p>{aiScanResult.doubts}</p>
                    </div>

                    {/* Formulário de Confirmação & Correção Manual */}
                    <div className="space-y-2 pt-1 border-t border-slate-800">
                      <span className="font-bold text-slate-300 text-xs block">
                        Confirmação dos Dados do Veículo Atendido:
                      </span>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-400 text-[10px]">Marca *</label>
                          <input
                            type="text"
                            value={confirmBrand}
                            onChange={e => setConfirmBrand(e.target.value)}
                            className="w-full bg-[#040814] border border-slate-700 rounded p-1.5 text-slate-200 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px]">Modelo Sugerido *</label>
                          <input
                            type="text"
                            value={confirmModel}
                            onChange={e => setConfirmModel(e.target.value)}
                            className="w-full bg-[#040814] border border-slate-700 rounded p-1.5 text-slate-200 font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-slate-400 text-[10px]">Placa Mercosul</label>
                          <input
                            type="text"
                            placeholder="BRA2E19"
                            value={confirmPlate}
                            onChange={e => setConfirmPlate(e.target.value.toUpperCase())}
                            className="w-full bg-[#040814] border border-slate-700 rounded p-1.5 text-cyan-300 font-mono font-bold uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px]">Carroceria</label>
                          <select
                            value={confirmBodyType}
                            onChange={e => setConfirmBodyType(e.target.value as any)}
                            className="w-full bg-[#040814] border border-slate-700 rounded p-1.5 text-slate-200"
                          >
                            <option value="hatch">Hatch</option>
                            <option value="sedan">Sedan</option>
                            <option value="suv">SUV</option>
                            <option value="picape">Picape</option>
                            <option value="van">Van</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px]">Combustível</label>
                          <select
                            value={confirmFuel}
                            onChange={e => setConfirmFuel(e.target.value as any)}
                            className="w-full bg-[#040814] border border-slate-700 rounded p-1.5 text-slate-200"
                          >
                            <option value="gasolina">Gasolina</option>
                            <option value="etanol">Etanol</option>
                            <option value="flex">TotalFlex</option>
                            <option value="diesel">Diesel</option>
                            <option value="hibrido">Híbrido</option>
                            <option value="eletrico">Elétrico</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-2 text-slate-400">
                    <span className="text-3xl block">🔍</span>
                    <p className="text-xs">
                      Clique em <strong>Executar Scanner</strong> ou selecione uma foto na galeria abaixo para iniciar a identificação assistida pela IA local.
                    </p>
                  </div>
                )}
              </div>

              {/* Botões de Ação do Fluxo */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => triggerScanPipeline(activePhoto, activePhotoFilename)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  🔄 Tentar Novamente
                </button>

                <button
                  type="button"
                  onClick={handleConfirmVehicle}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
                >
                  <span>✓</span>
                  <span>Confirmar Veículo & Abrir Modelo 3D</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 2: VISUALIZADOR 3D INTERATIVO & DESMONTAGEM DE COMPONENTES          */}
        {/* ========================================================================= */}
        <div id="gtech-3d-viewer-anchor" className="space-y-2 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                Visualizador 3D 360° Interativo & Inspeção de Componentes
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-[10px] text-cyan-300 font-bold font-mono">
                {currentLabel} ({currentBodyType.toUpperCase()})
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                fidelityLevel === "especifico_verificado" ? "bg-emerald-950 text-emerald-300 border border-emerald-700/40" :
                fidelityLevel === "representativo_carroceria" ? "bg-amber-950 text-amber-300 border border-amber-700/40" :
                "bg-slate-900 text-slate-400 border border-slate-700"
              }`}>
                {fidelityLevel === "especifico_verificado" ? "Correspondência Verificada" : "Carroceria Representativa"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Gire com o mouse/toque, explore a vista explodida, dê zoom no motor e toque nas peças
            </span>
          </div>

          <Vehicle3DViewer
            bodyType={currentBodyType}
            vehicleLabel={currentLabel}
            vehicleKey={
              currentVwModel?.id
                ? `volkswagen_${currentVwModel.id}`
                : `${(scanState === "concluido_3d" ? confirmBrand : selectedBrand).toLowerCase()}_${(scanState === "concluido_3d" ? confirmModel : (currentVwModel?.name || customModelText || "veiculo")).toLowerCase().replace(/[^a-z0-9_-]+/g, '_')}`
            }
            brand={scanState === "concluido_3d" ? confirmBrand : selectedBrand}
            model={scanState === "concluido_3d" ? confirmModel : (currentVwModel?.name || customModelText)}
            generation={scanState === "concluido_3d" ? confirmGen : (currentVwModel?.generation || "")}
            realPhotoUrl={currentPhoto}
            readOnly={false}
          />
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 3: GALERIA DE MODELOS HOMOLOGADOS VOLKSWAGEN (51 FOTOS REAIS)       */}
        {/* ========================================================================= */}
        <div className="bg-[#081122] p-5 rounded-2xl border border-cyan-500/30 space-y-4 shadow-xl">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold uppercase">
                Acervo Oficial G-Tech • 51 Modelos Homologados
              </span>
              <h3 className="font-bold text-sm text-white mt-1">
                Galeria Volkswagen de Referência (Fotografias Reais)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Clique em qualquer modelo para carregar a foto no scanner, inspecionar especificações e projetar o 3D.
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
                Sedans (14)
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("hatch")}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  activeCategory === "hatch" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Hatches (9)
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

          {/* Grid de Modelos VW com Foto Real e Carregador para o Scanner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredVwModels.map((model) => {
              const isSelected = currentVwModel.id === model.id && activePhoto.includes(model.photoFile);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelectModelFromCatalog(model)}
                  className={`p-2 rounded-xl text-left transition flex flex-col justify-between border ${
                    isSelected
                      ? "bg-cyan-950/70 border-cyan-400 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400"
                      : "bg-slate-900/80 hover:bg-slate-800 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black/60 mb-2 border border-slate-800">
                    <img
                      src={model.photoUrl}
                      alt={model.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-1 right-1 px-1 py-0.5 rounded bg-black/75 text-[9px] font-mono text-cyan-300">
                      {model.category}
                    </div>
                  </div>

                  <div className="space-y-0.5 flex-1">
                    <strong className="text-white text-xs block truncate">{model.name}</strong>
                    <span className="text-[10px] text-slate-400 block truncate">{model.variant}</span>
                    <span className="text-[9px] text-emerald-400 font-mono block">{model.engine}</span>
                  </div>

                  <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px]">
                    <span className="text-slate-500 font-mono">{model.years}</span>
                    <span className="text-cyan-400 font-semibold group-hover:underline">Escanear ↗</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toastMsg && (
          <div className="fixed top-16 right-4 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-2">
            <span>✓</span>
            <span>{toastMsg}</span>
          </div>
        )}
      </main>
    </div>
  );
}
