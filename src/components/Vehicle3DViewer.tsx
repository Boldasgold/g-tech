"use client";

import React, { useEffect, useRef, useState } from "react";
import { Vehicle3DScene, BodyType, HotspotData, ComponentMeshInfo } from "@/lib/vehicle3d";

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
  workOrderId?: string;
  replacedComponentIds?: string[];
  onSaveInspection?: (data: any) => Promise<void> | void;
  onSaveReplacement?: (data: any) => Promise<void> | void;
  onSuggestRepair?: (data: any) => Promise<void> | void;
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
  realPhotoUrl,
  workOrderId,
  replacedComponentIds = [],
  onSaveInspection,
  onSaveReplacement,
  onSuggestRepair
}: Vehicle3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Vehicle3DScene | null>(null);

  const [viewMode, setViewMode] = useState<"3d" | "photo" | "2d">("3d");
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);

  // Mechanical Inspection & Drill-down states
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>(["Veículo", "Visão Geral"]);
  const [isExploded, setIsExploded] = useState(false);
  const [isTransparent, setIsTransparent] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentMeshInfo | null>(null);

  // 10s Demo state
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoPoseInfo, setDemoPoseInfo] = useState<{ index: number; label: string } | null>(null);

  // Ficha / Form state
  const [inspStatus, setInspStatus] = useState<"ok" | "atencao" | "critico" | "nao_inspecionado">("atencao");
  const [inspTest, setInspTest] = useState("Medição dimensional com paquímetro/relógio comparador");
  const [inspMeasurement, setInspMeasurement] = useState("");
  const [inspTolerance, setInspTolerance] = useState("");
  const [inspFinding, setInspFinding] = useState("");
  const [inspPriority, setInspPriority] = useState<"baixa" | "normal" | "alta" | "critica">("normal");
  const [inspPhotoUrl, setInspPhotoUrl] = useState("");
  const [suggestRepairText, setSuggestRepairText] = useState("");
  const [suggestPricePart, setSuggestPricePart] = useState<number>(0);
  const [suggestPriceService, setSuggestPriceService] = useState<number>(0);

  // Replacement Registration Modal
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [replRemovedDesc, setReplRemovedDesc] = useState("");
  const [replInstalledDesc, setReplInstalledDesc] = useState("");
  const [replPhotoBefore, setReplPhotoBefore] = useState("");
  const [replPhotoAfter, setReplPhotoAfter] = useState("");
  const [replTechName, setReplTechName] = useState("Giovane Ribeiro");

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
      },
      onSelectComponent: (comp: ComponentMeshInfo) => {
        setSelectedComponent(comp);
        // Pre-fill defaults
        if (comp.id === "cmp-tie-rod-front-r") {
          setInspStatus("critico");
          setInspMeasurement("2.8 mm de folga");
          setInspTolerance("Máximo 1.0 mm");
          setInspFinding("Folga severa constatada no pivô esférico. Risco de desalinhamento e instabilidade.");
          setInspPriority("critica");
          setSuggestRepairText("Substituição do Terminal de Direção Dianteiro Direito + Alinhamento 3D");
          setSuggestPricePart(160);
          setSuggestPriceService(120);
        } else if (comp.id === "cmp-brake-pads-front") {
          setInspStatus("atencao");
          setInspMeasurement("2.5 mm de espessura");
          setInspTolerance("Mínimo 3.0 mm de segurança");
          setInspFinding("Pastilhas atingindo limite de desgaste da montadora.");
          setInspPriority("alta");
          setSuggestRepairText("Substituição das Pastilhas de Freio Dianteiras Cerâmica");
          setSuggestPricePart(240);
          setSuggestPriceService(140);
        } else {
          setInspStatus("ok");
          setInspMeasurement("Conforme");
          setInspTolerance("Padrão OEM");
          setInspFinding("Componente íntegro e operacional.");
          setInspPriority("normal");
          setSuggestRepairText("");
          setSuggestPricePart(0);
          setSuggestPriceService(0);
        }
      },
      onBreadcrumbChange: (crumbs: string[]) => {
        setBreadcrumbs(crumbs);
      },
      replacedComponentIds
    });

    scene.setBodyType(bodyType);
    scene.setHotspots(hotspots);
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [viewMode]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setBodyType(bodyType);
    }
  }, [bodyType]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setHotspots(hotspots);
    }
  }, [hotspots]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setAddMode(isAddMode);
    }
  }, [isAddMode]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setReplacedComponentIds(replacedComponentIds);
    }
  }, [replacedComponentIds]);

  const handleCameraView = (view: "dianteira" | "traseira" | "esquerda" | "direita" | "teto" | "reset") => {
    sceneRef.current?.setCameraView(view);
  };

  const handleZoomSystem = (sys: "motor" | "freios_diant_dir" | "suspensao" | "transmissao" | "reset") => {
    sceneRef.current?.zoomToSystem(sys);
  };

  const handleToggleExploded = () => {
    if (!sceneRef.current) return;
    const next = !isExploded;
    setIsExploded(next);
    sceneRef.current.setExploded(next);
  };

  const handleToggleTransparency = () => {
    if (!sceneRef.current) return;
    const next = sceneRef.current.toggleBodyTransparency();
    setIsTransparent(next);
  };

  const handleStartDemo10s = () => {
    if (!sceneRef.current) return;
    setIsDemoRunning(true);
    sceneRef.current.startDemo10s(
      (poseIndex, label) => {
        setDemoPoseInfo({ index: poseIndex, label });
      },
      () => {
        setIsDemoRunning(false);
        setDemoPoseInfo(null);
      }
    );
  };

  const handleStopDemo10s = () => {
    if (!sceneRef.current) return;
    sceneRef.current.stopDemo10s();
    setIsDemoRunning(false);
    setDemoPoseInfo(null);
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

  const handleSaveComponentInspection = async () => {
    if (!selectedComponent) return;
    const payload = {
      component_id: selectedComponent.id,
      status: inspStatus,
      test_performed: inspTest,
      measurement_value: inspMeasurement,
      tolerance_spec: inspTolerance,
      finding_description: inspFinding,
      priority: inspPriority,
      photo_url: inspPhotoUrl || null,
      suggested_repair: suggestRepairText || null,
      suggested_part_price: suggestPricePart,
      suggested_service_price: suggestPriceService,
      inspected_by: "Giovane Ribeiro"
    };

    if (onSaveInspection) {
      await onSaveInspection(payload);
    } else if (workOrderId) {
      await fetch(`/api/work-orders/${workOrderId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    alert(`Inspeção do componente "${selectedComponent.name}" gravada com sucesso!`);
    setSelectedComponent(null);
  };

  const handleSavePartReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComponent || !replRemovedDesc.trim() || !replInstalledDesc.trim()) {
      alert("Preencha a descrição da peça retirada e da peça nova instalada.");
      return;
    }

    const payload = {
      component_id: selectedComponent.id,
      component_name: selectedComponent.name,
      assembly_path: breadcrumbs.join(" › "),
      position_side: selectedComponent.side,
      removed_part_desc: replRemovedDesc.trim(),
      installed_part_desc: replInstalledDesc.trim(),
      photo_before_url: replPhotoBefore.trim() || "/img/vehicles/renault-duster.jpg",
      photo_after_url: replPhotoAfter.trim() || "/img/vehicles/suv-real.jpg",
      technician_name: replTechName.trim() || "Giovane Ribeiro",
      warranty_terms: "Garantia de 90 dias conforme CDC + 1 ano garantia de fábrica"
    };

    if (onSaveReplacement) {
      await onSaveReplacement(payload);
    } else if (workOrderId) {
      await fetch(`/api/work-orders/${workOrderId}/replacements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    alert(`Substituição oficial registrada! Selo PEÇA TROCADA emitido para "${selectedComponent.name}".`);
    setShowReplacementModal(false);
    setSelectedComponent(null);
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-cyan-500/30 bg-[#060c18] shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex flex-wrap justify-between items-center px-4 py-2.5 bg-[#0a1426] border-b border-cyan-500/20 text-xs gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="font-bold text-slate-200 tracking-wider uppercase font-mono">
            {vehicleLabel}
          </span>
          <span className="text-[10px] text-cyan-400/80 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
            Carroceria: {bodyType.toUpperCase()}
          </span>
        </div>

        {/* View Mode Switcher: 3D, Real Photo, 2D */}
        <div className="flex items-center gap-1.5 bg-[#060c18] p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
              viewMode === "3d" ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            🎮 3D 360°
          </button>
          <button
            type="button"
            onClick={() => setViewMode("photo")}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
              viewMode === "photo" ? "bg-amber-400 text-slate-950 shadow" : "text-slate-400 hover:text-white"
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
            📐 2D / Peças
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar (Hierarchy Drill-down) */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#081122] border-b border-cyan-500/10 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-300 overflow-x-auto">
          <span className="text-cyan-400 font-bold">📍 Navegação:</span>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-600">›</span>}
              <button
                type="button"
                onClick={() => {
                  if (idx === 0) handleZoomSystem("reset");
                  else if (crumb.includes("Motor") || crumb.includes("Propulsão")) handleZoomSystem("motor");
                  else if (crumb.includes("Freio") || crumb.includes("Rodagem")) handleZoomSystem("freios_diant_dir");
                  else if (crumb.includes("Suspensão")) handleZoomSystem("suspensao");
                }}
                className={`hover:text-cyan-300 transition ${
                  idx === breadcrumbs.length - 1 ? "text-cyan-400 font-bold" : "text-slate-400 underline decoration-slate-700"
                }`}
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* 10s Demo & Inspection Action Buttons */}
        <div className="flex items-center gap-2">
          {!isDemoRunning ? (
            <button
              type="button"
              onClick={handleStartDemo10s}
              className="px-2 py-0.5 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[10px] shadow transition flex items-center gap-1"
              title="Executar animação cinematográfica de 10 segundos da oficina"
            >
              🎬 Explorar montagem em 10s
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-black/60 px-2 py-0.5 rounded border border-cyan-500/50">
              <span className="text-[10px] text-amber-300 font-mono animate-pulse">
                {demoPoseInfo?.label || "Executando demonstração..."}
              </span>
              <button
                type="button"
                onClick={handleStopDemo10s}
                className="text-[10px] text-red-400 font-bold hover:underline"
              >
                Pular ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Display Area */}
      <div className="relative w-full h-[460px] bg-[#040812]">
        {/* VIEW 1: INTERACTIVE 3D WEBGL SCENE */}
        {viewMode === "3d" && (
          <>
            <div ref={containerRef} className="w-full h-full" />

            {/* Quick Drill-down Presets Bar */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5 bg-black/70 p-1.5 rounded-lg backdrop-blur-sm border border-cyan-500/20">
              <span className="text-[10px] font-bold text-cyan-400 self-center mr-1">Sistemas:</span>
              <button
                type="button"
                onClick={() => handleZoomSystem("motor")}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-cyan-950 text-slate-200 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500 text-[10px] font-semibold transition"
              >
                ⚙️ Motor
              </button>
              <button
                type="button"
                onClick={() => handleZoomSystem("freios_diant_dir")}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-cyan-950 text-slate-200 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500 text-[10px] font-semibold transition"
              >
                🛑 Freios D. Dir.
              </button>
              <button
                type="button"
                onClick={() => handleZoomSystem("suspensao")}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-cyan-950 text-slate-200 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500 text-[10px] font-semibold transition"
              >
                🔩 Suspensão
              </button>
              <button
                type="button"
                onClick={() => handleZoomSystem("reset")}
                className="px-2 py-1 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-700 text-[10px] font-bold transition"
              >
                ↺ Carro Inteiro
              </button>
            </div>

            {/* Right Tools Bar (Explode, Transparency, Camera Angles) */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-black/75 p-2 rounded-lg backdrop-blur-sm border border-cyan-500/20 text-[10px]">
              <button
                type="button"
                onClick={handleToggleExploded}
                className={`px-2.5 py-1.5 rounded font-bold transition text-left flex items-center justify-between ${
                  isExploded ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>💥 Vista Explodida</span>
                <span className="font-mono text-[9px] ml-1">{isExploded ? "ON" : "OFF"}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleTransparency}
                className={`px-2.5 py-1.5 rounded font-bold transition text-left flex items-center justify-between ${
                  isTransparent ? "bg-cyan-500 text-slate-950" : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>👻 Ocultar Lataria</span>
                <span className="font-mono text-[9px] ml-1">{isTransparent ? "ON" : "OFF"}</span>
              </button>

              <div className="border-t border-slate-800 pt-1 mt-1">
                <span className="text-[9px] text-slate-500 block mb-1">Ângulos de Câmera:</span>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => handleCameraView("dianteira")}
                    className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-cyan-950 text-center"
                  >
                    Frente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCameraView("traseira")}
                    className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-cyan-950 text-center"
                  >
                    Traseira
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCameraView("direita")}
                    className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-cyan-950 text-center"
                  >
                    Lado Dir.
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCameraView("esquerda")}
                    className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-cyan-950 text-center"
                  >
                    Lado Esq.
                  </button>
                </div>
              </div>
            </div>

            {/* Instruction Badge at Bottom Left */}
            <div className="absolute bottom-3 left-3 z-10 bg-black/80 px-3 py-1.5 rounded-md border border-cyan-500/20 text-[10px] text-slate-400">
              💡 <strong className="text-cyan-300">Toque no motor ou freios</strong> para entrar na montagem interna. Toque em qualquer peça visível para abrir sua <span className="text-amber-300 font-bold">Ficha Técnica</span>.
            </div>
          </>
        )}

        {/* VIEW 2: REAL VEHICLE PHOTOGRAPHY */}
        {viewMode === "photo" && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#060c18] to-[#02050c]">
            <img
              src={resolvedPhoto}
              alt={vehicleLabel}
              className="max-h-[340px] max-w-[90%] object-contain rounded-lg border border-cyan-500/30 shadow-2xl"
            />
            <div className="mt-4 text-center">
              <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">
                Fotografia Real de Referência Homologada
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Utilizada para checagem dimensional, comparação visual de peças e fidelidade à montadora.
              </p>
            </div>
          </div>
        )}

        {/* VIEW 3: 2D BLUEPRINT & COMPONENT HIERARCHY TREE */}
        {viewMode === "2d" && (
          <div className="w-full h-full overflow-y-auto p-4 bg-[#050b14] space-y-4">
            <div className="p-3 bg-[#081122] rounded-lg border border-cyan-500/20 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-xs text-cyan-400 uppercase">Esquema 2D e Árvore de Componentes</h4>
                <p className="text-[11px] text-slate-400">Navegue pelos sistemas para inspecionar componentes sem acelerador 3D.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Group 1: Propulsão */}
              <div className="p-3 rounded-lg bg-[#081122] border border-slate-800 space-y-2">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  ⚙️ Propulsão & Motor
                </span>
                <div className="space-y-1.5 pl-2 border-l border-cyan-500/30">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedComponent({
                        id: "cmp-camshaft",
                        name: "Comando de Válvulas",
                        system: "Propulsão e Alimentação",
                        assembly: "Motor › Cabeçote",
                        axle: "dianteiro",
                        side: "central",
                        meshId: "mesh_camshaft"
                      });
                    }}
                    className="w-full text-left p-1.5 rounded bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-white flex justify-between items-center"
                  >
                    <span>Comando de Válvulas (Cabeçote)</span>
                    <span className="text-[10px] text-emerald-400 font-bold">OK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedComponent({
                        id: "cmp-spark-plugs",
                        name: "Velas de Ignição (Jogo 4)",
                        system: "Propulsão e Alimentação",
                        assembly: "Motor › Ignição",
                        axle: "dianteiro",
                        side: "central",
                        meshId: "mesh_spark_plugs"
                      });
                    }}
                    className="w-full text-left p-1.5 rounded bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-white flex justify-between items-center"
                  >
                    <span>Velas de Ignição (Gap 0.9mm)</span>
                    <span className="text-[10px] text-emerald-400 font-bold">OK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedComponent({
                        id: "cmp-oil-pan",
                        name: "Cárter de Óleo & Lubrificação",
                        system: "Propulsão e Alimentação",
                        assembly: "Motor › Lubrificação",
                        axle: "dianteiro",
                        side: "central",
                        meshId: "mesh_oil_pan",
                        isReplaced: true
                      });
                    }}
                    className="w-full text-left p-1.5 rounded bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-white flex justify-between items-center border border-emerald-500/40"
                  >
                    <span>Cárter de Óleo (5W40 RN0710)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold">
                      PEÇA TROCADA
                    </span>
                  </button>
                </div>
              </div>

              {/* Group 2: Rodagem e Freios */}
              <div className="p-3 rounded-lg bg-[#081122] border border-slate-800 space-y-2">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  🛑 Rodagem, Freios & Direção
                </span>
                <div className="space-y-1.5 pl-2 border-l border-amber-500/30">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedComponent({
                        id: "cmp-tie-rod-front-r",
                        name: "Terminal de Direção Dianteiro Direito",
                        system: "Rodagem e Controle",
                        assembly: "Direção",
                        axle: "dianteiro",
                        side: "dianteira_direita",
                        meshId: "mesh_tie_rod_r",
                        isReplaced: true
                      });
                    }}
                    className="w-full text-left p-1.5 rounded bg-slate-900 hover:bg-amber-950 text-slate-300 hover:text-white flex justify-between items-center border border-emerald-500/40"
                  >
                    <span>Terminal de Direção Diant. Dir.</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold">
                      PEÇA TROCADA
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedComponent({
                        id: "cmp-brake-pads-front",
                        name: "Pastilhas de Freio Dianteiras",
                        system: "Rodagem e Controle",
                        assembly: "Freios Dianteiros",
                        axle: "dianteiro",
                        side: "dianteira_direita",
                        meshId: "mesh_brake_pad_fr"
                      });
                    }}
                    className="w-full text-left p-1.5 rounded bg-slate-900 hover:bg-amber-950 text-slate-300 hover:text-white flex justify-between items-center"
                  >
                    <span>Pastilhas de Freio Dianteiras</span>
                    <span className="text-[10px] text-amber-400 font-bold">ATENÇÃO (2.5mm)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* COMPONENT INSPECTION & FICHA TÉCNICA MODAL */}
      {/* ========================================================= */}
      {selectedComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b1528] border border-cyan-500/40 rounded-xl p-5 max-w-lg w-full shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-cyan-400">{selectedComponent.name}</h3>
                  {selectedComponent.isReplaced && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] tracking-wide">
                      ✅ PEÇA TROCADA
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {selectedComponent.system} › {selectedComponent.assembly} ({selectedComponent.side})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComponent(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Inspection & Measurement Form */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status da Inspeção</label>
                  <select
                    value={inspStatus}
                    onChange={e => setInspStatus(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-semibold"
                  >
                    <option value="ok">✅ OK (Conforme Especificação)</option>
                    <option value="atencao">⚠️ Atenção (Desgaste Moderado)</option>
                    <option value="critico">⛔ Crítico (Risco Operacional)</option>
                    <option value="nao_inspecionado">⏳ Não Inspecionado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Prioridade</label>
                  <select
                    value={inspPriority}
                    onChange={e => setInspPriority(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Medição Obtida</label>
                  <input
                    type="text"
                    value={inspMeasurement}
                    onChange={e => setInspMeasurement(e.target.value)}
                    placeholder="Ex: 2.8 mm de folga"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tolerância da Montadora</label>
                  <input
                    type="text"
                    value={inspTolerance}
                    onChange={e => setInspTolerance(e.target.value)}
                    placeholder="Ex: Máx 1.0 mm"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Ensaio / Teste Realizado</label>
                <input
                  type="text"
                  value={inspTest}
                  onChange={e => setInspTest(e.target.value)}
                  placeholder="Ex: Medição com relógio comparador / osciloscópio..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Achado Técnico & Diagnóstico</label>
                <textarea
                  rows={2}
                  value={inspFinding}
                  onChange={e => setInspFinding(e.target.value)}
                  placeholder="Descreva o achado técnico detalhado..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                />
              </div>

              {/* Suggest Repair / Quote fields */}
              <div className="p-3 bg-[#060c18] rounded-lg border border-slate-800 space-y-2">
                <span className="font-bold text-cyan-400 block">💡 Sugerir Reparo p/ Orçamento</span>
                <input
                  type="text"
                  value={suggestRepairText}
                  onChange={e => setSuggestRepairText(e.target.value)}
                  placeholder="Descrição da peça e serviço sugerido..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[10px]">Preço Peça (R$)</label>
                    <input
                      type="number"
                      value={suggestPricePart}
                      onChange={e => setSuggestPricePart(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px]">Preço Mão de Obra (R$)</label>
                    <input
                      type="number"
                      value={suggestPriceService}
                      onChange={e => setSuggestPriceService(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-between items-center pt-3 border-t border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => setShowReplacementModal(true)}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center gap-1"
              >
                🛠️ Registrar Substituição ("PEÇA TROCADA")
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedComponent(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveComponentInspection}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow transition"
                >
                  💾 Salvar Achado da Inspeção
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* REGISTRAR SUBSTITUIÇÃO DE PEÇA ("PEÇA TROCADA") MODAL */}
      {/* ========================================================= */}
      {showReplacementModal && selectedComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <form
            onSubmit={handleSavePartReplacement}
            className="bg-[#0b1528] border border-emerald-500/50 rounded-xl p-5 max-w-md w-full shadow-2xl text-slate-200 space-y-4"
          >
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  Selo Oficial de Execução
                </span>
                <h3 className="font-bold text-sm text-white">
                  Registrar Substituição: {selectedComponent.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReplacementModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Peça Retirada (Condição Anterior) *</label>
                <textarea
                  required
                  rows={2}
                  value={replRemovedDesc}
                  onChange={e => setReplRemovedDesc(e.target.value)}
                  placeholder="Ex: Peça original com desgaste severo de 2.8mm, sem condições de uso..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Peça Instalada Nova (Aplicação e Marca) *</label>
                <textarea
                  required
                  rows={2}
                  value={replInstalledDesc}
                  onChange={e => setReplInstalledDesc(e.target.value)}
                  placeholder="Ex: Terminal Nakata Blindado N-99042 Novo, com alinhamento a laser executado..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Foto Antes (Retirada)</label>
                  <input
                    type="text"
                    value={replPhotoBefore}
                    onChange={e => setReplPhotoBefore(e.target.value)}
                    placeholder="/img/... ou link"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Foto Depois (Instalada)</label>
                  <input
                    type="text"
                    value={replPhotoAfter}
                    onChange={e => setReplPhotoAfter(e.target.value)}
                    placeholder="/img/... ou link"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Mecânico Responsável</label>
                <input
                  type="text"
                  value={replTechName}
                  onChange={e => setReplTechName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowReplacementModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
              >
                Emitir Selo "PEÇA TROCADA"
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Hotspot Details View Modal */}
      {selectedHotspot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0b1528] border border-cyan-500/30 rounded-xl p-5 max-w-md w-full shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-cyan-400">{selectedHotspot.region_name}</h3>
                <span className="text-[11px] text-slate-400">
                  Lado: <strong className="text-white capitalize">{selectedHotspot.orientation_side.replace("_", " ")}</strong>
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
