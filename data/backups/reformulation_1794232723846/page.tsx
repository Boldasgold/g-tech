"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
    VW_MODELS_CATALOG.find(m => m.id === "golf-iv") || VW_MODELS_CATALOG[0]
  );
  const [customModelText, setCustomModelText] = useState("");
  const [forcedGlbUrl, setForcedGlbUrl] = useState<string | undefined>(undefined);

  // Estado do fluxo real Foto -> 3D pela interface para o veículo selecionado
  const [photoTo3dTrace, setPhotoTo3dTrace] = useState<any | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [photoTo3dFeedback, setPhotoTo3dFeedback] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);
  const [generating3d, setGenerating3d] = useState(false);
  const [viewerRefreshTrigger, setViewerRefreshTrigger] = useState(0);
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(false);

  const loadVehiclePhotoTo3dTrace = async (vwModel: VwModelData) => {
    setLoadingTrace(true);
    try {
      const isChevrolet = vwModel.id === "celta" || vwModel.id.includes("corsa");
      const canonicalKey = vwModel.id.includes("arteon")
        ? "volkswagen_arteon"
        : (vwModel.id === "celta" ? "chevrolet_celta" : (vwModel.id.includes("corsa") ? "chevrolet_corsa_hatch" : (vwModel.id === "bora" ? "volkswagen_bora" : (vwModel.id.includes("polo") ? "volkswagen_polo-hatch" : `volkswagen_${vwModel.id}`))));
      const brand = isChevrolet ? "Chevrolet" : "Volkswagen";
      const res = await fetch(
        `/api/workshop/photo-to-3d?vehicle_key=${encodeURIComponent(canonicalKey)}&brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(vwModel.name)}`
      );
      const data = await res.json();
      if (data.success && data.trace) {
        setPhotoTo3dTrace(data.trace);
        if (data.trace.resulting_3d_model) {
          setFidelityLevel("especifico_verificado");
        } else {
          const isVerifiedAcervo = vwModel.id.includes("arteon") || vwModel.id === "beetle" || vwModel.id.includes("tiguan") || vwModel.id === "bora" || vwModel.id === "celta" || vwModel.id.includes("polo") || vwModel.id.includes("corsa");
          setFidelityLevel(isVerifiedAcervo ? "especifico_verificado" : "sem_recurso_3d");
        }
      }
    } catch (err) {
      console.error("Erro ao consultar rastreamento Foto->3D:", err);
    } finally {
      setLoadingTrace(false);
    }
  };

  // Restore persisted vehicle selection on mount (URL ?vehicle= or localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get("vehicle");
    const savedId = paramId || window.localStorage.getItem("gtech_selected_vw_model_id");
    let targetModel = currentVwModel;
    if (savedId) {
      const found = VW_MODELS_CATALOG.find(m => m.id === savedId || `volkswagen_${m.id}` === savedId || (savedId === "polo" && m.id === "polo-hatch") || (savedId === "corsa" && m.id === "corsa-hatch"));
      if (found) {
        targetModel = found;
        setCurrentVwModel(found);
        setActivePhoto(found.photoUrl);
        setActivePhotoFilename(found.photoFile);
        const isChevrolet = found.id === "celta" || found.id.includes("corsa");
        setConfirmBrand(isChevrolet ? "Chevrolet" : "Volkswagen");
        setConfirmModel(found.name);
        setConfirmGen(found.generation);
        setConfirmBodyType(found.bodyType);
        const isVerifiedAcervo = found.id.includes("arteon") || found.id === "beetle" || found.id.includes("tiguan") || found.id === "bora" || found.id === "celta" || found.id.includes("polo") || found.id.includes("corsa");
        setFidelityLevel(isVerifiedAcervo ? "especifico_verificado" : "sem_recurso_3d");
        window.localStorage.setItem("gtech_selected_vw_model_id", found.id);
      }
    }
    loadVehiclePhotoTo3dTrace(targetModel);
  }, []);

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

  // Category count metrics for accurate UI tabs
  const categoryCounts = useMemo(() => ({
    todos: VW_MODELS_CATALOG.length,
    golf: VW_MODELS_CATALOG.filter(m => m.id.startsWith("golf") || m.id.startsWith("e-golf")).length,
    sedan: VW_MODELS_CATALOG.filter(m => m.bodyType === "sedan").length,
    hatch: VW_MODELS_CATALOG.filter(m => m.bodyType === "hatch" && !m.id.startsWith("golf") && !m.id.startsWith("e-golf")).length,
    suv: VW_MODELS_CATALOG.filter(m => m.bodyType === "suv").length,
    van: VW_MODELS_CATALOG.filter(m => m.bodyType === "van").length,
  }), []);

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
    const isChev = filename.toLowerCase().includes("celta") || filename.toLowerCase().includes("corsa") || (hint && (hint.toLowerCase().includes("celta") || hint.toLowerCase().includes("corsa")));
    const defaultBrand = isChev ? "Chevrolet" : "Volkswagen";
    const rec = recognizeVehicle(defaultBrand, hint || filename);
    const matched = rec.matchedModel;
    const modelName = matched ? matched.name : (hint || "Golf IV");
    const body: BodyType = matched ? matched.bodyType : rec.bodyType;
    const gen = matched ? matched.generation : "Geração Homologada";
    const hasVerifiedGlb = matched
      ? matched.id.includes("arteon") || matched.id === "beetle" || matched.id.includes("tiguan") || matched.id === "bora" || matched.id === "celta" || matched.id.includes("polo") || matched.id.includes("corsa")
      : filename.toLowerCase().includes("arteon") || filename.toLowerCase().includes("beetle") || filename.toLowerCase().includes("fusca") || filename.toLowerCase().includes("tiguan") || filename.toLowerCase().includes("bora") || filename.toLowerCase().includes("celta") || filename.toLowerCase().includes("polo") || filename.toLowerCase().includes("corsa");
    const fid: FidelityLevel = hasVerifiedGlb ? "especifico_verificado" : "sem_recurso_3d";
    const finalBrand = (matched && (matched.id === "celta" || matched.id.includes("corsa"))) || isChev ? "Chevrolet" : "Volkswagen";

    setAiScanResult({
      source: "fallback_catalogo",
      visible_features: `Silhueta visual correspondente a ${modelName}, proporções de ${gen}. ${
        hasVerifiedGlb
          ? "A. Modelo 3D correspondente previamente disponível no acervo."
          : "Projeção 3D deste veículo ainda não disponível (Malha Ferrari cafe3f48... bloqueada pela auditoria)."
      }`,
      suggested_brand: finalBrand,
      suggested_model: modelName,
      suggested_generation: gen,
      body_type: body,
      color: "Padrão G-Tech Homologado",
      doubts: "Identificação externa assistida pelo catálogo da oficina. Reconstrução 3D por fotos (Cat. B) pendente de integração de motor fotogramétrico.",
      fidelity_level: fid,
      confidence_note: "Identificação técnica assistida com auditoria SHA-256 ativa."
    });

    setConfirmBrand(finalBrand);
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
    setForcedGlbUrl(undefined);
    setPhotoTo3dFeedback(null);
    const isChevrolet = model.id === "celta" || model.id.includes("corsa");
    const brand = isChevrolet ? "Chevrolet" : "Volkswagen";
    setSelectedBrand(brand);
    setCurrentVwModel(model);
    setCustomModelText("");
    setActivePhoto(model.photoUrl);
    setActivePhotoFilename(model.photoFile);
    setConfirmBrand(brand);
    setConfirmModel(model.name);
    setConfirmGen(model.generation);
    setConfirmBodyType(model.bodyType);
    const isVerified = model.id.includes("arteon") || model.id === "beetle" || model.id.includes("tiguan") || model.id === "bora" || model.id === "celta" || model.id.includes("polo") || model.id.includes("corsa");
    setFidelityLevel(isVerified ? "especifico_verificado" : "sem_recurso_3d");
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gtech_selected_vw_model_id", model.id);
      const url = new URL(window.location.href);
      url.searchParams.set("vehicle", model.id);
      window.history.replaceState({}, "", url.toString());
    }
    // Nota: Clicar na galeria NUNCA dispara modelos pagos nem associa silenciosamente à OS de outro veículo
    loadVehiclePhotoTo3dTrace(model);
    triggerScanPipeline(model.photoUrl, model.photoFile, model.name);
  };

  // Abrir vistoria própria para o veículo selecionado quando ele é apenas uma fotografia do catálogo
  const handleOpenVehicleInspection = async () => {
    const isChevrolet = currentVwModel.id === "celta" || currentVwModel.id.includes("corsa");
    const brand = isChevrolet ? "Chevrolet" : "Volkswagen";
    setPhotoTo3dFeedback({ type: "info", text: `Abrindo cadastro, OS e vistoria exclusivos para ${brand} ${currentVwModel.name}...` });
    try {
      const canonicalKey = currentVwModel.id.includes("arteon")
        ? "volkswagen_arteon"
        : (currentVwModel.id === "celta" ? "chevrolet_celta" : (currentVwModel.id.includes("corsa") ? "chevrolet_corsa_hatch" : (currentVwModel.id === "bora" ? "volkswagen_bora" : (currentVwModel.id.includes("polo") ? "volkswagen_polo-hatch" : `volkswagen_${currentVwModel.id}`))));
      const res = await fetch("/api/workshop/photo-to-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "abrir_vistoria_veiculo",
          vehicle_key: canonicalKey,
          brand: brand,
          model: currentVwModel.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setPhotoTo3dFeedback({ type: "success", text: data.message });
        await loadVehiclePhotoTo3dTrace(currentVwModel);
      } else {
        setPhotoTo3dFeedback({ type: "error", text: data.error || "Erro ao abrir vistoria para o veículo." });
      }
    } catch (err: any) {
      setPhotoTo3dFeedback({ type: "error", text: `Erro de rede: ${err.message}` });
    }
  };

  // Upload de fotografia real para um ângulo da vistoria do veículo selecionado
  const handleUploadVisitAnglePhoto = async (slotName: string, file: File) => {
    if (!photoTo3dTrace?.work_order?.id) {
      setPhotoTo3dFeedback({
        type: "error",
        text: "Abra primeiro a vistoria própria deste veículo antes de anexar fotografias."
      });
      return;
    }
    setPhotoTo3dFeedback({ type: "info", text: `Enviando fotografia real para o ângulo '${slotName}'...` });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slot_name", slotName);
      fd.append("uploaded_by", "Giovane Ribeiro");

      const res = await fetch(`/api/work-orders/${photoTo3dTrace.work_order.id}/intake/upload`, {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        setPhotoTo3dFeedback({
          type: "success",
          text: `📸 ${data.message} (ID: ${data.photo.photo_id} • SHA-256: ${data.photo.file_sha256.slice(0, 16)}...)`
        });
        await loadVehiclePhotoTo3dTrace(currentVwModel);
      } else {
        setPhotoTo3dFeedback({ type: "error", text: `⚠️ ${data.error}` });
      }
    } catch (err: any) {
      setPhotoTo3dFeedback({ type: "error", text: `Erro no upload da foto: ${err.message}` });
    }
  };

  // Botão "Gerar projeção 3D": valida fotos necessárias, envia tarefa ao Worker (Porta 3002), acompanha e carrega o resultado
  const handleGenerate3dProjection = async () => {
    setGenerating3d(true);
    setPhotoTo3dFeedback({
      type: "info",
      text: `Validando vistoria e fotografias de Volkswagen ${currentVwModel.name} (volkswagen_${currentVwModel.id})...`
    });
    try {
      const canonicalKey = currentVwModel.id.includes("arteon") ? "volkswagen_arteon" : `volkswagen_${currentVwModel.id}`;
      const res = await fetch("/api/workshop/photo-to-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "gerar_projecao_3d",
          vehicle_key: canonicalKey,
          work_order_id: photoTo3dTrace?.work_order?.id || "",
          brand: "Volkswagen",
          model: currentVwModel.name
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPhotoTo3dFeedback({
          type: "error",
          text: `❌ ${data.error || "Não foi possível iniciar a geração da projeção 3D."}`
        });
        await loadVehiclePhotoTo3dTrace(currentVwModel);
        setGenerating3d(false);
        return;
      }

      const jobId = data.job_id;
      setPhotoTo3dFeedback({
        type: "info",
        text: `⏳ Tarefa ${jobId} enfileirada no Worker (Porta 3002 • PID ${data.worker_pid}). Acompanhando processamento...`
      });

      // Acompanhar processamento da tarefa no Worker até concluir ou falhar
      let finished = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        const jobRes = await fetch(`/api/workshop/jobs/${jobId}`);
        const jobData = await jobRes.json();
        if (jobData.success && jobData.job) {
          const st = jobData.job.status;
          if (st === "concluido") {
            finished = true;
            const resPayload = jobData.job.result || {};
            setPhotoTo3dFeedback({
              type: "success",
              text: `✅ Concluído! Modelo ilustrativo texturizado gerado (${resPayload.generated_glb_filename || "GLB"}) • SHA-256: ${(resPayload.generated_glb_sha256 || "").slice(0, 16)}... • Vinculado a ${canonicalKey}, OS ${resPayload.os_number || data.os_number} e Visita ${resPayload.visit_id || data.visit_id}. Carregando no visualizador 3D!`
            });
            await loadVehiclePhotoTo3dTrace(currentVwModel);
            setViewerRefreshTrigger(prev => prev + 1);
            break;
          } else if (st === "falha") {
            finished = true;
            setPhotoTo3dFeedback({
              type: "error",
              text: `❌ Falha no Worker: ${jobData.job.error_message || "Erro no processamento."}`
            });
            await loadVehiclePhotoTo3dTrace(currentVwModel);
            break;
          } else {
            setPhotoTo3dFeedback({
              type: "info",
              text: `⚙️ Worker processando tarefa ${jobId} (estado: ${st})...`
            });
          }
        }
      }

      if (!finished) {
        await loadVehiclePhotoTo3dTrace(currentVwModel);
        setViewerRefreshTrigger(prev => prev + 1);
      }
    } catch (err: any) {
      setPhotoTo3dFeedback({ type: "error", text: `Erro ao acionar geração 3D: ${err.message}` });
    } finally {
      setGenerating3d(false);
    }
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

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link
              href="/oficina?tab=quadro"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 font-semibold"
            >
              <span>📋</span>
              <span>Ordens</span>
            </Link>
            <Link
              href="/oficina?tab=veiculos"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 font-semibold"
            >
              <span>🚗</span>
              <span>Carros</span>
            </Link>
            <Link
              href="/oficina?tab=clientes"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 font-semibold"
            >
              <span>👤</span>
              <span>Clientes</span>
            </Link>
            <Link
              href="/oficina?tab=manutencoes"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 font-semibold"
            >
              <span>🔧</span>
              <span>Manutenções</span>
            </Link>
            <Link
              href="/"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            >
              Site ↗
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
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                  forcedGlbUrl
                    ? "bg-rose-500 text-white border-white shadow-lg"
                    : "bg-slate-950/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border-slate-800"
                }`}
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
                    data-testid={`quick-select-${item.id}`}
                    onClick={() => handleSelectModelFromCatalog(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                      active
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold border-cyan-300 shadow-lg shadow-cyan-500/25 scale-[1.02]"
                        : "bg-slate-950/70 hover:bg-slate-800/80 text-slate-300 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span>🚗</span>
                    <span>{item.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      active ? "bg-black/30 text-white font-bold" : "bg-slate-900 text-slate-400"
                    }`}>
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
                  {currentVwModel.id === "celta" ? "chevrolet_celta" : (currentVwModel.id.includes("corsa") ? "chevrolet_corsa_hatch" : (currentVwModel.id === "bora" ? "volkswagen_bora" : (currentVwModel.id.includes("polo") ? "volkswagen_polo-hatch" : `volkswagen_${currentVwModel.id}`)))}
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
                  <strong>⚠️ Modo Catálogo:</strong> O veículo <code className="text-white">{currentVwModel.id === "celta" ? "chevrolet_celta" : (currentVwModel.id.includes("corsa") ? "chevrolet_corsa_hatch" : (currentVwModel.id === "bora" ? "volkswagen_bora" : (currentVwModel.id.includes("polo") ? "volkswagen_polo-hatch" : `volkswagen_${currentVwModel.id}`)))}</code> não possui Ordem de Serviço vinculada. Para gerar modelo texturizado por fotos, abra a vistoria própria e anexe as fotos.
                </div>
              </div>
            )}

            {/* Feedback do Worker */}
            {photoTo3dFeedback && (
              <div
                data-testid="photo-to-3d-feedback"
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                  photoTo3dFeedback.type === "error"
                    ? "bg-rose-950/80 border-rose-500/60 text-rose-200"
                    : photoTo3dFeedback.type === "success"
                    ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-200"
                    : "bg-cyan-950/80 border-cyan-500/60 text-cyan-200"
                }`}
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
                    <div className="text-white font-bold">ID: {photoTo3dTrace?.canonical_vehicle_key || `volkswagen_${currentVwModel.id}`}</div>
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
                      OS: <strong>{photoTo3dTrace?.work_order ? `${photoTo3dTrace.work_order.os_number} (${photoTo3dTrace.work_order.id})` : "NENHUMA"}</strong>
                    </div>
                    <div className="text-slate-300 truncate">
                      Vistoria: <strong>{photoTo3dTrace?.inspection_visit ? `${photoTo3dTrace.inspection_visit.id} (Visita #${photoTo3dTrace.inspection_visit.visit_number})` : "NENHUMA"}</strong>
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase block">3. Fotos & Tarefa no Worker (3002)</span>
                    <div className="text-emerald-300">
                      Fotos Vistoria: <strong>{photoTo3dTrace?.available_visit_photos_count ?? 0} anexada(s)</strong> (mín. 2)
                    </div>
                    <div className="text-slate-300 truncate">
                      Tarefa Worker: <strong>{photoTo3dTrace?.latest_generation_job ? `${photoTo3dTrace.latest_generation_job.job_id} [${photoTo3dTrace.latest_generation_job.status}]` : "NENHUMA"}</strong>
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
                        href={`/oficina?os=${photoTo3dTrace.work_order.id}&tab=vistoria`}
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
                                data-testid={`3d360-upload-${ang.slot}`}
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
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  photoTo3dTrace?.resulting_3d_model?.origin_type === "acervo_preexistente" || currentVwModel.id.includes("arteon") || currentVwModel.id === "beetle" || currentVwModel.id.includes("tiguan") || currentVwModel.id === "bora" || currentVwModel.id === "celta" || currentVwModel.id.includes("polo") || currentVwModel.id.includes("corsa")
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700/40"
                    : photoTo3dTrace?.resulting_3d_model?.origin_type === "gerado_por_fotos"
                    ? "bg-amber-950 text-amber-200 border border-amber-500/60"
                    : "bg-amber-950 text-amber-300 border border-amber-700/40"
                }`}
              >
                {photoTo3dTrace?.resulting_3d_model?.origin_type === "acervo_preexistente" || currentVwModel.id.includes("arteon") || currentVwModel.id === "beetle" || currentVwModel.id.includes("tiguan") || currentVwModel.id === "bora" || currentVwModel.id === "celta" || currentVwModel.id.includes("polo") || currentVwModel.id.includes("corsa")
                  ? "A. Modelo 3D no Acervo (Verificado)"
                  : photoTo3dTrace?.resulting_3d_model?.origin_type === "gerado_por_fotos"
                  ? `B. Modelo ilustrativo texturizado (${photoTo3dTrace.resulting_3d_model.file_name})`
                  : "Projeção 3D deste veículo ainda não disponível"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              🖱️ Gire em 360°, explore a vista explodida, dê zoom e inspecione componentes
            </span>
          </div>

          <Vehicle3DViewer
            bodyType={currentBodyType}
            vehicleLabel={`Volkswagen ${currentVwModel.name}`}
            vehicleKey={`volkswagen_${currentVwModel.id}`}
            workOrderId={photoTo3dTrace?.work_order?.id}
            brand="Volkswagen"
            model={currentVwModel.name}
            generation={currentVwModel.generation}
            realPhotoUrl={currentVwModel.photoUrl}
            initialGlbUrl={forcedGlbUrl}
            refreshTrigger={viewerRefreshTrigger}
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
                Acervo Oficial G-Tech • {VW_MODELS_CATALOG.length} Modelos Homologados
              </span>
              <h3 className="font-bold text-sm text-white mt-1">
                Galeria Multimarcas de Referência (Fotografias Reais)
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
                Todos ({categoryCounts.todos})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("golf")}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  activeCategory === "golf" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Golf Family ({categoryCounts.golf})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("sedan")}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  activeCategory === "sedan" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Sedans ({categoryCounts.sedan})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("hatch")}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  activeCategory === "hatch" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Hatches ({categoryCounts.hatch})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("suv")}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  activeCategory === "suv" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                SUVs ({categoryCounts.suv})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("van")}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  activeCategory === "van" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Vans & Comerciais ({categoryCounts.van})
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
