"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Vehicle3DScene, BodyType, HotspotData, ComponentMeshInfo } from "@/lib/vehicle3d";
import { recognizeVehicle } from "@/lib/vw-recognition";

export type ModelStatus = 
  | "verificando"
  | "carregando"
  | "especifico_carregado"
  | "ausente_ilustrativo"
  | "erro_carregamento";

export interface ActiveModelMetadata {
  id?: string;
  vehicle_key?: string;
  brand?: string;
  model?: string;
  generation?: string;
  work_order_id?: string;
  file_name: string;
  file_url: string;
  file_size_bytes?: number;
  model_type: "malha_externa_monobloco" | "modelo_com_pecas_segmentadas";
  source?: string;
  created_at?: string;
}

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
  vehicleKey?: string;
  brand?: string;
  model?: string;
  generation?: string;
  initialGlbUrl?: string;
  replacedComponentIds?: string[];
  onSaveInspection?: (data: any) => Promise<void> | void;
  onSaveReplacement?: (data: any) => Promise<void> | void;
  onSuggestRepair?: (data: any) => Promise<void> | void;
}

// 6 OEM Automotive Paint Finishes
const OEM_PAINT_COLORS = [
  { name: "Azul Safira G-Tech", hex: 0x0088ff, bg: "bg-[#0088ff]" },
  { name: "Prata Reflex", hex: 0xcbd5e1, bg: "bg-[#cbd5e1]" },
  { name: "Cinza Nardo", hex: 0x64748b, bg: "bg-[#64748b]" },
  { name: "Preto Ninja Carbon", hex: 0x090d16, bg: "bg-[#090d16]" },
  { name: "Branco Puro", hex: 0xf8fafc, bg: "bg-[#f8fafc]" },
  { name: "Vermelho Flash", hex: 0xdc2626, bg: "bg-[#dc2626]" },
];

function playWorkshopAudio(type: "click" | "scan" | "camera" | "beep", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "click") {
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === "beep") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === "scan") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(960, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === "camera") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1100, ctx.currentTime);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    }
  } catch {
    // AudioContext blocked
  }
}

function resolveRealPhoto(label: string, bodyType: string, overrideUrl?: string): string {
  if (overrideUrl) return overrideUrl;
  const recognition = recognizeVehicle("", label, bodyType);
  return recognition.photoUrl;
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
  vehicleKey,
  brand,
  model,
  generation,
  initialGlbUrl,
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

  // High-Tech Pro Features: Paint, Sound, Laser, Fullscreen, Telemetry
  const [activePaintHex, setActivePaintHex] = useState(0x0088ff);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLaserScanning, setIsLaserScanning] = useState(false);
  const [laserProgress, setLaserProgress] = useState(0);
  const [telemetry, setTelemetry] = useState({
    azimuthDeg: 42,
    elevationDeg: 20,
    distance: 4.2,
    componentsCount: 16
  });

  // Real Vehicle Photo Integration in 3D (Showroom Backdrop Screen & Floating PIP HUD)
  const [show3DBackdrop, setShow3DBackdrop] = useState(true);
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Specific 3D Model State & Manager
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customModelLoaded, setCustomModelLoaded] = useState<string | null>(null);
  const [glbProgress, setGlbProgress] = useState<number | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("verificando");
  const [activeModelData, setActiveModelData] = useState<ActiveModelMetadata | null>(null);
  const [showModelManagerModal, setShowModelManagerModal] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedUploadType, setSelectedUploadType] = useState<"malha_externa_monobloco" | "modelo_com_pecas_segmentadas">("malha_externa_monobloco");
  const [uploadScope, setUploadScope] = useState<"vehicle_model" | "work_order">("vehicle_model");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const recognition = recognizeVehicle("", vehicleLabel, bodyType);
  const effectiveBodyType = recognition.isVolkswagen ? recognition.bodyType : bodyType;
  const resolvedPhoto = realPhotoUrl || recognition.photoUrl;

  const effectiveVehicleKey = useMemo(() => {
    if (vehicleKey) return vehicleKey.toLowerCase().trim();
    if (recognition.isVolkswagen && recognition.matchedModel) {
      return `volkswagen_${recognition.matchedModel.id}`.toLowerCase();
    }
    return vehicleLabel.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "_");
  }, [vehicleKey, recognition, vehicleLabel]);

  // Upload and persist 3D model (GLB/GLTF)
  const handleUploadAndBindModel = async (file: File) => {
    if (!file) return;
    setUploadingModel(true);
    setUploadError(null);
    try {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (ext !== ".glb" && ext !== ".gltf") {
        throw new Error("Formato não suportado. Envie um arquivo .GLB ou .GLTF.");
      }

      playWorkshopAudio("scan", soundEnabled);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vehicle_key", effectiveVehicleKey);
      formData.append("brand", brand || (recognition.isVolkswagen ? "Volkswagen" : vehicleLabel.split(" ")[0]));
      formData.append("model", model || (recognition.matchedModel?.name || vehicleLabel));
      formData.append("generation", generation || (recognition.matchedModel?.generation || ""));
      if (uploadScope === "work_order" && workOrderId) {
        formData.append("work_order_id", workOrderId);
      }
      formData.append("model_type", selectedUploadType);
      formData.append("source", "importacao_tripo3d");

      const res = await fetch("/api/models", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar modelo 3D no servidor.");
      }

      // Carregar imediatamente na cena 3D
      if (sceneRef.current) {
        setModelStatus("carregando");
        setGlbProgress(0);
        await sceneRef.current.loadGLBModel(data.model.file_url, (pct) => setGlbProgress(pct));
        setActiveModelData(data.model);
        setCustomModelLoaded(data.model.file_name);
        setModelStatus("especifico_carregado");
        setGlbProgress(null);
      }

      playWorkshopAudio("beep", soundEnabled);
      setShowModelManagerModal(false);
      alert(`Modelo 3D "${data.model.file_name}" associado e carregado com sucesso!`);
    } catch (err: any) {
      setUploadError(err.message || "Erro no upload do arquivo.");
    } finally {
      setUploadingModel(false);
    }
  };

  const handleGlbFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadAndBindModel(file);
    }
  };

  // Desvincular modelo e restaurar representação ilustrativa genérica
  const handleUnbindModel = async () => {
    if (!activeModelData) return;
    if (!confirm("Deseja realmente desvincular este modelo 3D? O visualizador retornará à representação ilustrativa genérica.")) return;

    try {
      const res = await fetch(`/api/models?id=${activeModelData.id || ""}&vehicle_key=${effectiveVehicleKey}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Erro ao desvincular modelo.");
      }

      sceneRef.current?.unloadCustomModel();
      setActiveModelData(null);
      setCustomModelLoaded(null);
      setModelStatus("ausente_ilustrativo");
      setShowModelManagerModal(false);
      playWorkshopAudio("click", soundEnabled);
      alert("Modelo desvinculado com sucesso. Sistema retornou à representação ilustrativa genérica.");
    } catch (err: any) {
      alert(`Erro ao desvincular: ${err.message}`);
    }
  };

  // Ficha / Form state
  const [inspStatus, setInspStatus] = useState<"ok" | "atencao" | "critico" | "nao_inspecionado" | "substituicao_recomendada" | "substituicao_realizada">("atencao");
  const [inspServiceType, setInspServiceType] = useState<"troca_peca" | "limpeza" | "regulagem" | "inspecao" | "reparo">("troca_peca");
  const [inspTest, setInspTest] = useState("Medição dimensional com paquímetro/relógio comparador");
  const [inspMeasurement, setInspMeasurement] = useState("");
  const [inspTolerance, setInspTolerance] = useState("");
  const [inspFinding, setInspFinding] = useState("");
  const [inspPriority, setInspPriority] = useState<"baixa" | "normal" | "alta" | "critica">("normal");
  const [inspPhotoUrl, setInspPhotoUrl] = useState("");
  const [suggestRepairText, setSuggestRepairText] = useState("");
  const [suggestPartCode, setSuggestPartCode] = useState("");
  const [suggestQuantity, setSuggestQuantity] = useState<number>(1);
  const [suggestPricePart, setSuggestPricePart] = useState<number>(0);
  const [suggestPriceService, setSuggestPriceService] = useState<number>(0);

  // Component search drawer state
  const [showComponentSearch, setShowComponentSearch] = useState(false);
  const [compSearchTerm, setCompSearchTerm] = useState("");

  // Replacement Registration Modal
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [replRemovedDesc, setReplRemovedDesc] = useState("");
  const [replInstalledDesc, setReplInstalledDesc] = useState("");
  const [replPartCode, setReplPartCode] = useState("");
  const [replManufacturer, setReplManufacturer] = useState("OEM / Homologado G-Tech");
  const [replMileage, setReplMileage] = useState("45.000 km");
  const [replWarranty, setReplWarranty] = useState("90 dias conforme CDC + 1 ano garantia de fábrica");
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

    scene.setBodyType(effectiveBodyType);
    scene.setHotspots(hotspots);
    scene.setRealPhotoBackdrop(resolvedPhoto, show3DBackdrop);
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [viewMode]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setRealPhotoBackdrop(resolvedPhoto, show3DBackdrop);
    }
  }, [resolvedPhoto, show3DBackdrop]);

  useEffect(() => {
    if (sceneRef.current) {
      setTimeout(() => sceneRef.current?.onWindowResize(), 80);
    }
  }, [isSplitView]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setBodyType(effectiveBodyType);
    }
  }, [effectiveBodyType]);

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

  // Checagem e carregamento de modelo 3D específico (GLB/GLTF) ou fallback ilustrativo
  useEffect(() => {
    let isCancelled = false;

    const checkAndLoadModel = async () => {
      if (!sceneRef.current || viewMode !== "3d") return;

      setModelStatus("verificando");
      setGlbProgress(null);

      // Se initialGlbUrl for passado explicitamente
      if (initialGlbUrl) {
        try {
          setModelStatus("carregando");
          await sceneRef.current.loadGLBModel(initialGlbUrl, (pct) => {
            if (!isCancelled) setGlbProgress(pct);
          });
          if (!isCancelled) {
            setModelStatus("especifico_carregado");
            setActiveModelData({
              file_name: initialGlbUrl.split("/").pop() || "modelo.glb",
              file_url: initialGlbUrl,
              model_type: "malha_externa_monobloco"
            });
            setGlbProgress(null);
          }
          return;
        } catch {
          if (!isCancelled) {
            sceneRef.current?.unloadCustomModel();
            setModelStatus("erro_carregamento");
          }
          return;
        }
      }

      try {
        const query = new URLSearchParams();
        if (effectiveVehicleKey) query.set("vehicle_key", effectiveVehicleKey);
        if (workOrderId) query.set("work_order_id", workOrderId);
        if (brand) query.set("brand", brand);
        if (model) query.set("model", model);

        const res = await fetch(`/api/models?${query.toString()}`);
        if (!res.ok) throw new Error("Falha na consulta do modelo 3D");
        const data = await res.json();

        if (isCancelled) return;

        if (data.has_specific_model && data.model?.file_url) {
          setModelStatus("carregando");
          setActiveModelData(data.model);
          setCustomModelLoaded(data.model.file_name);

          await sceneRef.current.loadGLBModel(data.model.file_url, (pct) => {
            if (!isCancelled) setGlbProgress(pct);
          });

          if (!isCancelled) {
            setModelStatus("especifico_carregado");
            setGlbProgress(null);
          }
        } else {
          // Arquivo 3D específico ausente no repositório/banco
          sceneRef.current.unloadCustomModel();
          setActiveModelData(null);
          setCustomModelLoaded(null);
          setModelStatus("ausente_ilustrativo");
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.warn("Aviso na checagem do modelo 3D:", err);
        sceneRef.current?.unloadCustomModel();
        setActiveModelData(null);
        setModelStatus("erro_carregamento");
      }
    };

    checkAndLoadModel();

    return () => {
      isCancelled = true;
    };
  }, [effectiveVehicleKey, workOrderId, brand, model, viewMode, initialGlbUrl]);

  // Telemetry real-time loop (4Hz)
  useEffect(() => {
    if (viewMode !== "3d") return;
    const interval = setInterval(() => {
      if (sceneRef.current) {
        const tel = sceneRef.current.getTelemetry();
        setTelemetry({
          azimuthDeg: tel.azimuthDeg,
          elevationDeg: tel.elevationDeg,
          distance: tel.distance,
          componentsCount: tel.componentsCount
        });
      }
    }, 250);
    return () => clearInterval(interval);
  }, [viewMode]);

  const handleSelectPaint = (hex: number) => {
    setActivePaintHex(hex);
    playWorkshopAudio("click", soundEnabled);
    sceneRef.current?.setPaintColor(hex);
  };

  const handleStartLaserScan = () => {
    if (!sceneRef.current || isLaserScanning) return;
    setIsLaserScanning(true);
    setLaserProgress(0);
    playWorkshopAudio("scan", soundEnabled);
    sceneRef.current.triggerLaserScan(
      (prog) => setLaserProgress(prog),
      () => {
        setIsLaserScanning(false);
        playWorkshopAudio("beep", soundEnabled);
      }
    );
  };

  const handleToggleFullscreen = () => {
    playWorkshopAudio("click", soundEnabled);
    const root = containerRef.current?.parentElement?.parentElement;
    if (!root) return;
    if (!document.fullscreenElement) {
      root.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleCameraView = (view: "dianteira" | "traseira" | "esquerda" | "direita" | "teto" | "reset") => {
    playWorkshopAudio("click", soundEnabled);
    sceneRef.current?.setCameraView(view);
  };

  const handleZoomSystem = (sys: "motor" | "freios_diant_dir" | "suspensao" | "transmissao" | "reset") => {
    playWorkshopAudio("click", soundEnabled);
    sceneRef.current?.zoomToSystem(sys);
    if (sys === "motor") {
      setBreadcrumbs(["Veículo", "Propulsão e Alimentação", "Motor (Bloco, Cabeçote & Lubrificação)"]);
      setIsTransparent(true);
    } else if (sys === "freios_diant_dir") {
      setBreadcrumbs(["Veículo", "Rodagem e Controle", "Freios Dianteiros (Lado Direito)"]);
    } else if (sys === "suspensao") {
      setBreadcrumbs(["Veículo", "Chassi & Rodagem", "Suspensão Dianteira"]);
    } else if (sys === "reset") {
      setBreadcrumbs(["Veículo", "Visão Geral"]);
      setIsTransparent(false);
    }
  };

  const handleToggleExploded = () => {
    if (!sceneRef.current) return;
    const next = !isExploded;
    setIsExploded(next);
    playWorkshopAudio("click", soundEnabled);
    sceneRef.current.setExploded(next);
  };

  const handleToggleTransparency = () => {
    if (!sceneRef.current) return;
    const next = sceneRef.current.toggleBodyTransparency();
    setIsTransparent(next);
    playWorkshopAudio("click", soundEnabled);
  };

  const handleStartDemo10s = () => {
    if (!sceneRef.current) return;
    setIsDemoRunning(true);
    playWorkshopAudio("camera", soundEnabled);
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
    const totalCalc = (suggestQuantity * suggestPricePart) + suggestPriceService;
    const payload = {
      component_id: selectedComponent.id,
      status: inspStatus,
      service_type: inspServiceType,
      test_performed: inspTest,
      measurement_value: inspMeasurement,
      tolerance_spec: inspTolerance,
      finding_description: inspFinding,
      priority: inspPriority,
      photo_url: inspPhotoUrl || null,
      suggested_repair: suggestRepairText || null,
      part_code: suggestPartCode || null,
      quantity: suggestQuantity,
      suggested_part_price: suggestPricePart,
      suggested_service_price: suggestPriceService,
      total_price: totalCalc,
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

    alert(`Inspeção do componente "${selectedComponent.name}" gravada com sucesso! (Total R$ ${totalCalc.toFixed(2).replace('.', ',')})`);
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
      part_code: replPartCode.trim() || "OEM-GTECH",
      manufacturer: replManufacturer.trim() || "Homologado G-Tech",
      mileage: replMileage.trim() || "45.000 km",
      removed_part_desc: replRemovedDesc.trim(),
      installed_part_desc: replInstalledDesc.trim(),
      photo_before_url: replPhotoBefore.trim() || "/img/vehicles/renault-duster.jpg",
      photo_after_url: replPhotoAfter.trim() || "/img/vehicles/suv-real.jpg",
      technician_name: replTechName.trim() || "Giovane Ribeiro",
      warranty_terms: replWarranty.trim() || "Garantia de 90 dias conforme CDC + 1 ano garantia de fábrica"
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

    selectedComponent.isReplaced = true;
    setInspStatus("substituicao_realizada");

    alert(`Substituição oficial registrada! Selo PEÇA TROCADA emitido para "${selectedComponent.name}".`);
    setShowReplacementModal(false);
    setSelectedComponent(null);
  };

  return (
    <div className="viewer-root-container relative w-full rounded-xl overflow-hidden border border-cyan-500/30 bg-[#060c18] shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex flex-wrap justify-between items-center px-4 py-2.5 bg-[#0a1426] border-b border-cyan-500/20 text-xs gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="font-bold text-slate-200 tracking-wider uppercase font-mono">
            {vehicleLabel}
          </span>
          <span className="text-[10px] text-cyan-400/80 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded font-mono">
            Carroceria: {effectiveBodyType.toUpperCase()}
          </span>

          {/* Status Real do Modelo 3D */}
          {modelStatus === "especifico_carregado" && activeModelData && (
            <button
              type="button"
              onClick={() => setShowModelManagerModal(true)}
              className="text-[10px] text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900/80 px-2 py-0.5 rounded font-bold flex items-center gap-1.5 shadow-sm transition"
              title="Modelo 3D específico vinculado e carregado com sucesso. Clique para gerenciar."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              🎯 3D Específico: {activeModelData.file_name} ({activeModelData.model_type === "modelo_com_pecas_segmentadas" ? "Peças Técnicas" : "Malha Monobloco"})
            </button>
          )}

          {modelStatus === "ausente_ilustrativo" && (
            <button
              type="button"
              onClick={() => setShowModelManagerModal(true)}
              className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-500/50 hover:bg-amber-900/80 px-2 py-0.5 rounded font-medium flex items-center gap-1.5 shadow-sm transition"
              title="Nenhum arquivo 3D específico (.glb/.gltf) encontrado para este veículo. A cena exibe representação ilustrativa genérica. Clique para vincular um arquivo 3D real."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              ⚠️ Ilustrativo Genérico • Modelo 3D ausente
              <span className="text-[9px] underline text-amber-200 font-bold ml-0.5">+ Vincular GLB</span>
            </button>
          )}

          {modelStatus === "carregando" && (
            <span className="text-[10px] text-cyan-300 bg-cyan-950/80 border border-cyan-500/50 px-2 py-0.5 rounded font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              ⏳ Carregando 3D {glbProgress !== null ? `${glbProgress}%` : "..."}
            </span>
          )}

          {modelStatus === "erro_carregamento" && (
            <button
              type="button"
              onClick={() => setShowModelManagerModal(true)}
              className="text-[10px] text-rose-300 bg-rose-950/80 border border-rose-500/50 hover:bg-rose-900/80 px-2 py-0.5 rounded font-medium flex items-center gap-1.5 transition"
              title="Falha ao carregar a malha 3D. A cena retornou à representação ilustrativa genérica. Clique para tentar novamente."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              Falha no Modelo 3D • Ilustrativo Ativo
            </button>
          )}

          {/* Foto 2D de Referência (Separada explicitamente da malha 3D) */}
          {resolvedPhoto && (
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="text-[10px] text-slate-300 bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 px-2 py-0.5 rounded font-mono flex items-center gap-1 transition"
              title="Fotografia 2D de referência oficial. Clique para ver em alta definição."
            >
              📸 Foto 2D: {recognition.matchedModel?.name || vehicleLabel}
            </button>
          )}
        </div>

        {/* View Mode Switcher, Paint Finishes, Sound & Fullscreen */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Paint Colors Palette */}
          {viewMode === "3d" && (
            <div className="hidden sm:flex items-center gap-1.5 bg-[#060c18] px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Pintura:</span>
              {OEM_PAINT_COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleSelectPaint(c.hex)}
                  title={c.name}
                  className={`w-3.5 h-3.5 rounded-full ${c.bg} transition border ${
                    activePaintHex === c.hex ? "ring-2 ring-cyan-400 scale-125 border-white shadow-sm" : "border-slate-700 opacity-75 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Sound Mute Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Desativar Efeitos Sonoros" : "Ativar Efeitos Sonoros"}
            className="px-2 py-1 rounded bg-[#060c18] hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition"
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia (Oficina)"}
            className="px-2 py-1 rounded bg-[#060c18] hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition font-mono font-bold"
          >
            {isFullscreen ? "🗗" : "⛶"}
          </button>

          {/* View Mode Switcher: 3D, Real Photo, 2D */}
          <div className="flex items-center gap-1.5 bg-[#060c18] p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setViewMode("3d");
                playWorkshopAudio("click", soundEnabled);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                viewMode === "3d" ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              🎮 3D 360°
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("photo");
                playWorkshopAudio("camera", soundEnabled);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                viewMode === "photo" ? "bg-amber-400 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              📸 Foto Real
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("2d");
                playWorkshopAudio("click", soundEnabled);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                viewMode === "2d" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              📐 2D / Peças
            </button>
          </div>
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
      <div className="relative w-full h-[480px] bg-[#040812]">
        {/* VIEW 1: INTERACTIVE 3D WEBGL SCENE */}
        {viewMode === "3d" && (
          <div className="w-full h-full relative flex flex-col md:flex-row">
            {/* 3D WebGL Canvas */}
            <div
              ref={containerRef}
              className={`h-full transition-all duration-300 relative ${
                isSplitView ? "w-full md:w-1/2 border-r border-cyan-500/30" : "w-full"
              }`}
            />

            {/* Split View Right Pane: High-Res Real Photography & Comparison */}
            {isSplitView && (
              <div className="w-full md:w-1/2 h-full bg-[#030713] p-4 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 border-cyan-500/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                        {recognition.isVolkswagen ? "Fotografia Real Oficial Volkswagen" : "Fotografia Real Homologada"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSplitView(false)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700"
                    >
                      Fechar Split ✕
                    </button>
                  </div>

                  <div
                    className="relative group cursor-pointer overflow-hidden rounded-xl border border-cyan-500/30 shadow-2xl bg-black"
                    onClick={() => setShowPhotoModal(true)}
                  >
                    <img
                      src={resolvedPhoto}
                      alt={vehicleLabel}
                      className="w-full h-[230px] object-contain group-hover:scale-102 transition duration-300"
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-[10px] text-cyan-300 border border-cyan-500/40">
                      🔍 Clique para Zoom HD
                    </div>
                  </div>

                  {recognition.isVolkswagen && recognition.matchedModel ? (
                    <div className="bg-[#060c18] p-3 rounded-lg border border-slate-800 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Modelo Oficial:</span>
                        <strong className="text-white">Volkswagen {recognition.matchedModel.name} ({recognition.matchedModel.generation})</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Motorização:</span>
                        <strong className="text-cyan-300">{recognition.matchedModel.engine}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Óleo Homologado:</span>
                        <strong className="text-emerald-400 font-mono">{recognition.matchedModel.oilViscosity} ({recognition.matchedModel.oilCapacityLiters}L)</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pressão Pneus:</span>
                        <strong className="text-slate-200 font-mono">{recognition.matchedModel.tirePressureFrontPsi}/{recognition.matchedModel.tirePressureRearPsi} PSI</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#060c18] p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                      Fotografia oficial para checagem dimensional e tolerância metrológica.
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span>Acervo Oficial G-Tech Paranaguá–PR</span>
                  <button
                    type="button"
                    onClick={() => setShowPhotoModal(true)}
                    className="text-cyan-400 hover:underline font-bold"
                  >
                    Abrir em Tela Cheia ↗
                  </button>
                </div>
              </div>
            )}

            {/* Quick Drill-down Presets Bar & Breadcrumb Navigation */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-black/80 p-1.5 rounded-lg backdrop-blur-sm border border-cyan-500/25 max-w-full">
              <span className="text-[10px] font-bold text-cyan-400 self-center mr-1">Sistemas:</span>
              <button
                type="button"
                onClick={() => handleZoomSystem("motor")}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-cyan-950 text-slate-200 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500 text-[10px] font-semibold transition"
              >
                ⚙️ Motor (Zoom & Raio-X)
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

              {/* Breadcrumb Indicator */}
              {breadcrumbs.length > 2 && (
                <div className="hidden md:flex items-center gap-1 pl-2 border-l border-slate-700 text-[10px] text-cyan-300">
                  <span className="font-semibold text-slate-400">Trilha:</span>
                  <span className="truncate max-w-[200px]">{breadcrumbs.join(" › ")}</span>
                  <button
                    type="button"
                    onClick={() => handleZoomSystem("reset")}
                    className="ml-1 px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
                  >
                    ← Voltar
                  </button>
                </div>
              )}
            </div>

            {/* Unsegmented GLB Mesh Disclaimer Banner */}
            {customModelLoaded && (
              <div className="absolute top-14 left-3 z-20 bg-amber-950/90 border border-amber-500/50 text-amber-200 px-3 py-1.5 rounded-lg text-[10px] max-w-sm shadow-xl flex items-center gap-2">
                <span>⚠️</span>
                <span><strong>Malha Externa GLB:</strong> Modelo monobloco não segmentado. Desmontagem e peças internas estão disponíveis no modelo homologado G-Tech.</span>
              </div>
            )}

            {/* Floating Picture-in-Picture (PIP) HUD Badge (Top-Left over 3D Canvas) */}
            {resolvedPhoto && !isSplitView && (
              <div
                className={`absolute top-14 left-3 z-20 transition-all duration-300 ${
                  isPipMinimized ? "w-auto" : "w-64 sm:w-72"
                }`}
              >
                {isPipMinimized ? (
                  <button
                    type="button"
                    onClick={() => setIsPipMinimized(false)}
                    className="flex items-center gap-2 bg-[#060c18]/90 hover:bg-[#0a1529] border border-cyan-500/50 rounded-lg px-2.5 py-1.5 shadow-xl backdrop-blur-md text-xs text-white group"
                    title="Expandir Foto Real do Veículo"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-cyan-300">📸 Foto Real</span>
                    <span className="text-[10px] text-slate-400 font-mono">[{recognition.isVolkswagen ? "VW" : "Homologada"}]</span>
                  </button>
                ) : (
                  <div className="bg-[#050b14]/95 backdrop-blur-md rounded-xl border border-cyan-500/40 p-2.5 shadow-2xl space-y-2">
                    {/* PIP Header */}
                    <div className="flex items-center justify-between gap-1 border-b border-cyan-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                          {recognition.isVolkswagen ? "📸 Foto Real Oficial VW" : "📸 Foto Real Homologada"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setIsSplitView(true)}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-slate-900 text-slate-300 border-slate-700 hover:text-cyan-300 hover:border-cyan-500 transition"
                          title="Modo Lado a Lado (3D + Foto)"
                        >
                          🌓 Dividir
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPipMinimized(true)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                          title="Minimizar badge"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Real Vehicle Thumbnail with 1-click zoom */}
                    <div
                      className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
                      onClick={() => setShowPhotoModal(true)}
                    >
                      <img
                        src={resolvedPhoto}
                        alt={vehicleLabel}
                        className="w-full h-32 object-cover object-center group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-between p-2">
                        <span className="text-[10px] text-cyan-300 font-bold flex items-center gap-1">
                          🔍 Clique para Ampliar
                        </span>
                        <span className="text-[9px] text-slate-300 bg-black/60 px-1 rounded">HD</span>
                      </div>
                    </div>

                    {/* Vehicle Specs Info */}
                    <div className="text-[10px] space-y-0.5">
                      <div className="font-bold text-white truncate">
                        {recognition.isVolkswagen && recognition.matchedModel
                          ? `Volkswagen ${recognition.matchedModel.name}`
                          : vehicleLabel}
                      </div>
                      {recognition.isVolkswagen && recognition.matchedModel && (
                        <>
                          <div className="text-slate-400 text-[9px] truncate">
                            {recognition.matchedModel.variant} ({recognition.matchedModel.years})
                          </div>
                          <div className="flex items-center justify-between text-[9px] pt-1 border-t border-slate-800/80">
                            <span className="text-slate-400">Motor:</span>
                            <span className="font-semibold text-cyan-300 truncate max-w-[140px]">{recognition.matchedModel.engine}</span>
                          </div>
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-400">Óleo:</span>
                            <span className="font-mono text-emerald-400">{recognition.matchedModel.oilViscosity}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Backdrop in 3D toggle button */}
                    <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[9px]">
                      <span className="text-slate-400">Telão Showroom 3D:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !show3DBackdrop;
                          setShow3DBackdrop(nextVal);
                          sceneRef.current?.setRealPhotoBackdrop(resolvedPhoto, nextVal);
                        }}
                        className={`px-2 py-0.5 rounded font-bold border transition ${
                          show3DBackdrop
                            ? "bg-cyan-950 text-cyan-300 border-cyan-500/60"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {show3DBackdrop ? "🖥️ Ativo no 3D" : "Desligado"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Right Tools Bar (Laser Scan, Tripo3D Import, Explode, Transparency, Camera Angles) */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-black/80 p-2 rounded-lg backdrop-blur-sm border border-cyan-500/25 text-[10px] shadow-xl">
              {/* Laser Scan 360 Trigger */}
              <button
                type="button"
                onClick={handleStartLaserScan}
                disabled={isLaserScanning}
                className={`px-2.5 py-1.5 rounded font-bold transition text-left flex items-center justify-between ${
                  isLaserScanning
                    ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 animate-pulse"
                    : "bg-gradient-to-r from-cyan-950 to-blue-950 text-cyan-300 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/30"
                }`}
                title="Executar varredura a laser holográfica de geometria"
              >
                <span>⚡ Laser Scan 360°</span>
                <span className="font-mono text-[9px] ml-1">{isLaserScanning ? `${laserProgress}%` : "SCAN"}</span>
              </button>

              {/* Showroom Screen 3D Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextVal = !show3DBackdrop;
                  setShow3DBackdrop(nextVal);
                  sceneRef.current?.setRealPhotoBackdrop(resolvedPhoto, nextVal);
                }}
                className={`px-2.5 py-1.5 rounded font-bold transition text-left flex items-center justify-between ${
                  show3DBackdrop
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
                title="Ligar/Desligar telão 3D com foto real do carro atrás da plataforma"
              >
                <span>🖥️ Telão 3D</span>
                <span className="font-mono text-[9px] ml-1">{show3DBackdrop ? "ON" : "OFF"}</span>
              </button>

              {/* Split View Toggle */}
              <button
                type="button"
                onClick={() => setIsSplitView(!isSplitView)}
                className={`px-2.5 py-1.5 rounded font-bold transition text-left flex items-center justify-between ${
                  isSplitView
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
                title="Visualizar 3D interativo e Foto Real lado a lado"
              >
                <span>🌓 Lado a Lado</span>
                <span className="font-mono text-[9px] ml-1">{isSplitView ? "ATIVO" : "SPLIT"}</span>
              </button>

              {/* Gerenciador de Modelo 3D (GLB/GLTF) */}
              <button
                type="button"
                onClick={() => setShowModelManagerModal(true)}
                className={`px-2.5 py-1.5 rounded font-bold transition text-left flex items-center justify-between border ${
                  modelStatus === "especifico_carregado"
                    ? "bg-gradient-to-r from-emerald-950 to-teal-950 text-emerald-300 hover:from-emerald-900 hover:to-teal-900 border-emerald-500/50"
                    : "bg-gradient-to-r from-purple-950 to-indigo-950 text-purple-300 hover:from-purple-900 hover:to-indigo-900 border-purple-500/40"
                }`}
                title="Abrir gerenciador de arquivos 3D do veículo (GLB/GLTF)"
              >
                <span>📦 Modelo 3D Real</span>
                <span className="font-mono text-[9px] ml-1">
                  {modelStatus === "especifico_carregado" ? "ATIVO" : "+ GLB"}
                </span>
              </button>

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
                  <button
                    type="button"
                    onClick={() => handleCameraView("teto")}
                    className="col-span-2 p-1 rounded bg-slate-900 text-slate-300 hover:bg-cyan-950 text-center"
                  >
                    Teto / Superior
                  </button>
                </div>
              </div>
            </div>

            {/* Laser Scanning Visual Effect Overlay */}
            {isLaserScanning && (
              <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center bg-cyan-950/20 backdrop-blur-[1px]">
                <div className="bg-[#050e1f]/95 border border-cyan-400 p-4 rounded-xl shadow-2xl shadow-cyan-500/40 text-center space-y-2 max-w-sm">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 font-mono">
                      VARREDURA VISUAL ASSISTIVA
                    </span>
                  </div>
                  <p className="text-xs font-extrabold text-white">
                    Projeção Visual de Linhas e Contornos da Carroceria
                  </p>
                  <div className="relative w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto border border-cyan-500/40">
                    <div className="scanner-beam-line" />
                  </div>
                  <span className="text-[9px] text-slate-400 block font-sans">
                    * Efeito gráfico assistivo de apresentação. Não constitui medição a laser física nem diagnóstico de bancada.
                  </span>
                </div>
              </div>
            )}

            {/* Instruction Badge at Bottom Left */}
            <div className="absolute bottom-3 left-3 z-10 bg-black/80 px-3 py-1.5 rounded-md border border-cyan-500/20 text-[10px] text-slate-400 max-w-xs">
              💡 <strong className="text-cyan-300">Toque no motor ou freios</strong> para entrar na montagem interna. Toque em qualquer peça para abrir sua <span className="text-amber-300 font-bold">Ficha Técnica</span>.
            </div>

            {/* Real-time Diagnostic Telemetry HUD (Bottom Right) */}
            <div className="hidden sm:block absolute bottom-3 right-3 z-10 bg-black/85 px-3 py-2 rounded-lg border border-cyan-500/30 text-[10px] font-mono text-cyan-300 shadow-xl pointer-events-none space-y-0.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">AZIMUTE:</span>
                <span className="font-bold text-white">{telemetry.azimuthDeg}°</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">ELEVAÇÃO:</span>
                <span className="font-bold text-white">{telemetry.elevationDeg}°</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">DISTÂNCIA:</span>
                <span className="font-bold text-white">{telemetry.distance}m</span>
              </div>
              <div className="border-t border-slate-800 pt-0.5 mt-0.5 flex items-center justify-between gap-4 text-[9px]">
                <span className="text-emerald-400 font-bold">● SISTEMA CALIBRADO</span>
                <span className="text-slate-400">{telemetry.componentsCount} PEÇAS</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: REAL VEHICLE PHOTOGRAPHY */}
        {viewMode === "photo" && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#060c18] to-[#02050c] overflow-y-auto">
            <img
              src={resolvedPhoto}
              alt={vehicleLabel}
              className="max-h-[300px] max-w-[90%] object-contain rounded-lg border border-cyan-500/30 shadow-2xl"
            />
            <div className="mt-4 text-center max-w-xl">
              <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">
                {recognition.isVolkswagen && recognition.matchedModel
                  ? `Fotografia Real: Volkswagen ${recognition.matchedModel.name} (${recognition.matchedModel.generation})`
                  : "Fotografia Real de Referência Homologada"}
              </span>
              {recognition.isVolkswagen && recognition.matchedModel ? (
                <div className="mt-1 space-y-1">
                  <p className="text-[11px] text-slate-300 font-medium">
                    Motorização: <strong className="text-white">{recognition.matchedModel.engine}</strong> | Categoria: <strong className="text-cyan-300">{recognition.matchedModel.category}</strong>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Óleo Homologado: <strong className="text-emerald-400 font-mono">{recognition.matchedModel.oilViscosity}</strong> ({recognition.matchedModel.oilCapacityLiters}L) • Pneus: <strong className="text-slate-200 font-mono">{recognition.matchedModel.tirePressureFrontPsi}/{recognition.matchedModel.tirePressureRearPsi} PSI</strong>
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono mt-1">
                    Foto: {recognition.matchedModel.author} ({recognition.matchedModel.license}) • Acervo Oficial G-Tech Paranaguá
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Utilizada para checagem dimensional, comparação visual de peças e fidelidade à montadora.
                </p>
              )}
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
                  <label className="block text-slate-400 font-semibold mb-1">Status da Inspeção *</label>
                  <select
                    value={inspStatus}
                    onChange={e => {
                      const val = e.target.value as any;
                      if (val === "substituicao_realizada" && !selectedComponent.isReplaced) {
                        alert("O status 'Substituição realizada' exige o registro formal de execução técnica. Clique em 'Registrar Substituição' abaixo.");
                        return;
                      }
                      setInspStatus(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-semibold"
                  >
                    <option value="nao_inspecionado">⏳ Não Inspecionado</option>
                    <option value="ok">✅ OK (Conforme Especificação OEM)</option>
                    <option value="atencao">⚠️ Atenção (Desgaste Moderado)</option>
                    <option value="critico">⛔ Crítico (Risco Operacional)</option>
                    <option value="substituicao_recomendada">🔄 Substituição Recomendada</option>
                    <option value="substituicao_realizada" disabled={!selectedComponent.isReplaced}>
                      🏆 Substituição Realizada (Selo Peça Trocada)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tipo de Serviço Sugerido</label>
                  <select
                    value={inspServiceType}
                    onChange={e => setInspServiceType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="troca_peca">🛠️ Troca de Peça (Substituição)</option>
                    <option value="limpeza">🧼 Limpeza / Descarbonização</option>
                    <option value="regulagem">📐 Regulagem / Calibração</option>
                    <option value="inspecao">🔍 Inspeção Dedicada / Ensaio</option>
                    <option value="reparo">⚙️ Reparo / Recondicionamento</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Prioridade</label>
                  <select
                    value={inspPriority}
                    onChange={e => setInspPriority(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="baixa">Baixa (Monitoramento)</option>
                    <option value="normal">Normal (Preventiva)</option>
                    <option value="alta">Alta (Troca Próxima)</option>
                    <option value="critica">Crítica (Risco Iminente)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Código da Peça / OEM</label>
                  <input
                    type="text"
                    value={suggestPartCode}
                    onChange={e => setSuggestPartCode(e.target.value)}
                    placeholder="Ex: 06L 115 562 B"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono"
                  />
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

              {/* Escala Visual de Desgaste Metrológico */}
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-semibold uppercase">Escala de Conformidade Metrológica (G-Tech)</span>
                  <span className={`font-bold font-mono ${
                    inspStatus === "ok" ? "text-emerald-400" :
                    inspStatus === "atencao" ? "text-amber-400" :
                    inspStatus === "substituicao_realizada" ? "text-emerald-400" :
                    inspStatus === "substituicao_recomendada" ? "text-orange-400" :
                    inspStatus === "critico" ? "text-red-400" : "text-slate-400"
                  }`}>
                    {inspStatus === "ok" ? "TOLERÂNCIA OEM (100% OK)" :
                     inspStatus === "atencao" ? "DESGASTE MODERADO (50% ALERTA)" :
                     inspStatus === "substituicao_recomendada" ? "SUBSTITUIÇÃO RECOMENDADA" :
                     inspStatus === "substituicao_realizada" ? "PEÇA NOVA INSTALADA (100% OK)" :
                     inspStatus === "critico" ? "LIMITE EXCEDIDO (TROCA OBRIGATÓRIA)" : "AGUARDANDO MEDIÇÃO"}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex p-0.5 border border-slate-700">
                  <div className={`h-full rounded-full transition-all duration-300 ${
                    inspStatus === "ok" || inspStatus === "substituicao_realizada" ? "w-1/3 bg-emerald-500 shadow-sm shadow-emerald-500/50" :
                    inspStatus === "atencao" ? "w-2/3 bg-amber-500 shadow-sm shadow-amber-500/50" :
                    inspStatus === "substituicao_recomendada" ? "w-5/6 bg-orange-500 shadow-sm shadow-orange-500/50" :
                    inspStatus === "critico" ? "w-full bg-red-500 shadow-sm shadow-red-500/50" : "w-1/12 bg-slate-600"
                  }`} />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>0% Seguro</span>
                  <span>50% Alerta Preventivo</span>
                  <span>100% Risco de Quebra</span>
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
                <div className="flex justify-between items-center">
                  <span className="font-bold text-cyan-400 block">💡 Composição de Orçamento Automotivo</span>
                  <span className="text-[10px] text-slate-400 font-mono">Valores em Reais (R$)</span>
                </div>
                
                <input
                  type="text"
                  value={suggestRepairText}
                  onChange={e => setSuggestRepairText(e.target.value)}
                  placeholder="Descrição da peça ou serviço para o orçamento..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                />
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[10px]">Qtd. Peças</label>
                    <input
                      type="number"
                      min="1"
                      value={suggestQuantity}
                      onChange={e => setSuggestQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px]">Preço Unit. Peça (R$)</label>
                    <input
                      type="number"
                      value={suggestPricePart}
                      onChange={e => setSuggestPricePart(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px]">Mão de Obra (R$)</label>
                    <input
                      type="number"
                      value={suggestPriceService}
                      onChange={e => setSuggestPriceService(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-mono"
                    />
                  </div>
                </div>

                {/* Total Calculado ao Vivo em R$ */}
                <div className="p-2.5 rounded bg-cyan-950/60 border border-cyan-500/30 flex justify-between items-center text-xs">
                  <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                    <span>💰</span>
                    <span>Total Previsto:</span>
                  </span>
                  <span className="font-mono font-black text-amber-400 text-sm">
                    R$ {((suggestQuantity * suggestPricePart) + suggestPriceService).toFixed(2).replace('.', ',')}
                  </span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Código OEM / Fabricante</label>
                  <input
                    type="text"
                    value={replPartCode}
                    onChange={e => setReplPartCode(e.target.value)}
                    placeholder="Ex: NAK-99042 / 1K0 423 811"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Fabricante / Fornecedor</label>
                  <input
                    type="text"
                    value={replManufacturer}
                    onChange={e => setReplManufacturer(e.target.value)}
                    placeholder="Ex: Nakata / Bosch / TRW"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Quilometragem do Veículo</label>
                  <input
                    type="text"
                    value={replMileage}
                    onChange={e => setReplMileage(e.target.value)}
                    placeholder="Ex: 48.250 km"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 font-mono"
                  />
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

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Termos de Garantia</label>
                <input
                  type="text"
                  value={replWarranty}
                  onChange={e => setReplWarranty(e.target.value)}
                  placeholder="Ex: 90 dias legal + 1 ano fabricante"
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
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="block text-slate-500 font-semibold uppercase text-[10px]">Foto / Evidência</span>
                    <button
                      type="button"
                      onClick={() => {
                        sceneRef.current?.setRealPhotoBackdrop(selectedHotspot.photo_url || undefined, true);
                        setShow3DBackdrop(true);
                      }}
                      className="text-[10px] text-cyan-300 hover:text-white px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 font-bold flex items-center gap-1 transition"
                      title="Projetar esta foto no telão 3D de showroom"
                    >
                      🖥️ Exibir no Telão 3D
                    </button>
                  </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-medium">Descrição Detalhada do Registro *</label>
                  <button
                    type="button"
                    onClick={() => {
                      let desc = `Inspeção metrológica na região ${pendingHit.region_name}: `;
                      if (hsDamageType === "risco") {
                        desc += "Risco de ~6cm na camada de verniz/tinta original, sem deformação estrutural da chapa.";
                        setHsSeverity("baixa");
                      } else if (hsDamageType === "amassado") {
                        desc += "Amassado com vincos perceptíveis sob reflexo de luz. Recomendado alinhamento técnico / martelinho de ouro.";
                        setHsSeverity("media");
                      } else if (hsDamageType === "trinca") {
                        desc += "Trinca visível com perda de estanqueidade e integridade mecânica. Substituição recomendada.";
                        setHsSeverity("alta");
                      } else if (hsDamageType === "vazamento") {
                        desc += "Gotejamento de fluido ativo na carcaça com perda de nível. Risco crítico de contaminação e superaquecimento.";
                        setHsSeverity("critica");
                      } else if (hsDamageType === "folga") {
                        desc += "Folga axial/radial superior a 2.5 mm detectada com relógio comparador. Acima do padrão OEM da montadora.";
                        setHsSeverity("critica");
                      } else {
                        desc += "Desgaste mecânico acentuado no componente. Substituição preventiva antes do rompimento.";
                        setHsSeverity("alta");
                      }
                      setHsDescription(desc);
                    }}
                    className="text-[10px] text-amber-300 hover:text-white font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/50 transition flex items-center gap-1 shadow-sm"
                  >
                    ⚡ Preencher Laudo com IA
                  </button>
                </div>
                <textarea
                  required
                  rows={3}
                  value={hsDescription}
                  onChange={e => setHsDescription(e.target.value)}
                  placeholder="Descreva a avaria ou clique em 'Preencher Laudo com IA'..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Foto Real da Avaria / Evidência</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) setHsPhotoUrl(ev.target.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-cyan-900 file:text-cyan-200 hover:file:bg-cyan-800 cursor-pointer bg-slate-900 border border-slate-700 rounded p-1"
                  />
                  <input
                    type="text"
                    value={hsPhotoUrl}
                    onChange={e => setHsPhotoUrl(e.target.value)}
                    placeholder="Ou informe o link/URL da foto..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:border-cyan-400 focus:outline-none text-[11px]"
                  />
                </div>
                {hsPhotoUrl && (
                  <div className="mt-2 relative">
                    <img src={hsPhotoUrl} alt="Preview da Avaria" className="h-28 w-full object-cover rounded border border-cyan-500/40" />
                    <button
                      type="button"
                      onClick={() => setHsPhotoUrl("")}
                      className="absolute top-1 right-1 bg-black/80 hover:bg-black text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold"
                    >
                      Remover Foto ✕
                    </button>
                  </div>
                )}
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

      {/* Fullscreen High-Resolution Photo Modal */}
      {showPhotoModal && resolvedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-[#070e1b] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-3 border-b border-cyan-500/20 bg-[#0a1529]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-bold text-sm text-white">
                  {recognition.isVolkswagen && recognition.matchedModel
                    ? `Volkswagen ${recognition.matchedModel.name} — Fotografia Oficial Homologada`
                    : `Fotografia Real: ${vehicleLabel}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/70">
              <img
                src={resolvedPhoto}
                alt={vehicleLabel}
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-2xl border border-cyan-500/30"
              />
            </div>

            {recognition.isVolkswagen && recognition.matchedModel ? (
              <div className="p-3 bg-[#081122] border-t border-slate-800 text-xs flex flex-wrap justify-between items-center gap-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-slate-400">Motor: <strong className="text-cyan-300">{recognition.matchedModel.engine}</strong></span>
                  <span className="text-slate-400">Óleo: <strong className="text-emerald-400 font-mono">{recognition.matchedModel.oilViscosity}</strong></span>
                  <span className="text-slate-400">Pneus: <strong className="text-slate-200 font-mono">{recognition.matchedModel.tirePressureFrontPsi}/{recognition.matchedModel.tirePressureRearPsi} PSI</strong></span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {recognition.matchedModel.author} ({recognition.matchedModel.license}) • G-Tech Paranaguá
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#081122] border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
                <span>Fotografia oficial para checagem metrológica e de integridade física.</span>
                <span className="text-[10px] text-slate-500 font-mono">Acervo G-Tech Paranaguá</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GERENCIADOR DE MODELOS 3D ESPECÍFICOS (GLB/GLTF) MODAL    */}
      {/* ========================================================= */}
      {showModelManagerModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative max-w-2xl w-full bg-[#070e1b] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col my-8">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-cyan-500/20 bg-[#0a1529]">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🛠️</span>
                <div>
                  <h3 className="font-bold text-sm text-white">Gerenciador de Modelos 3D do Veículo</h3>
                  <p className="text-[11px] text-cyan-300/80">
                    {vehicleLabel} • Chave: <span className="font-mono text-white">{effectiveVehicleKey}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModelManagerModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
              {/* Differentiating the 3 asset types */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-[#050b16] p-3 rounded-xl border border-slate-800">
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="font-bold text-slate-200 text-[11px] mb-1 flex items-center gap-1.5">
                    <span>📸</span> 1. Foto de Referência (2D)
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Fotografia real do veículo. Não é modelo 3D. Usada no telão showroom de fundo para comparação visual de lataria e peças.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40">
                  <div className="font-bold text-purple-300 text-[11px] mb-1 flex items-center gap-1.5">
                    <span>🧊</span> 2. Malha Monobloco (3D)
                  </div>
                  <p className="text-[10px] text-purple-200/80 leading-relaxed">
                    Arquivo .GLB contínuo (gerado por IA tipo Tripo3D ou scanner). Permite giro 360°, sem separação de peças internas mecânicas.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                  <div className="font-bold text-emerald-300 text-[11px] mb-1 flex items-center gap-1.5">
                    <span>⚙️</span> 3. Peças Segmentadas (3D)
                  </div>
                  <p className="text-[10px] text-emerald-200/80 leading-relaxed">
                    Modelo técnico avançado com malhas independentes de motor, freios e suspensão para inspeção componente a componente na OS.
                  </p>
                </div>
              </div>

              {/* Status do Modelo Ativo */}
              <div className="rounded-xl border p-4 bg-[#0a1426] border-slate-800 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span>Situação Atual da Visualização 3D</span>
                  <span className="text-[10px] font-mono font-normal text-slate-400">
                    OS: {workOrderId || "Geral do Modelo"}
                  </span>
                </h4>

                {modelStatus === "especifico_carregado" && activeModelData ? (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Modelo 3D Específico Vinculado e Ativo
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                          {activeModelData.model_type === "modelo_com_pecas_segmentadas" ? "Peças Segmentadas" : "Malha Monobloco"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Nome do Arquivo:</span>
                          <span className="font-mono text-white truncate block">{activeModelData.file_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Tamanho:</span>
                          <span className="font-mono text-slate-200">
                            {activeModelData.file_size_bytes ? `${(activeModelData.file_size_bytes / (1024 * 1024)).toFixed(2)} MB` : "N/D"}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[10px]">Caminho Público:</span>
                          <span className="font-mono text-cyan-300 text-[10px]">{activeModelData.file_url}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleUnbindModel}
                      className="w-full py-2 px-3 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-200 font-semibold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <span>🗑️</span> Desvincular Modelo 3D (Restaurar Representação Ilustrativa)
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/40 space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                      <span>⚠️</span>
                      <span>Representação Ilustrativa Genérica em Exibição</span>
                    </div>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      Nenhum arquivo 3D específico (.GLB / .GLTF) foi vinculado a este modelo ({vehicleLabel}). O visualizador está exibindo uma carroceria geométrica procedural de segurança, com pneus e plataforma neutra.
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Para exibir o modelo 3D real idêntico ao carro, envie o arquivo .GLB exportado do software CAD, scanner ou Tripo3D abaixo.
                    </p>
                  </div>
                )}
              </div>

              {/* Upload e Associação de Novo Modelo 3D */}
              <div className="rounded-xl border p-4 bg-[#0a1426] border-slate-800 space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <span>📥</span> Vincular Arquivo 3D (.GLB / .GLTF)
                </h4>

                {uploadError && (
                  <div className="p-2.5 rounded bg-rose-950/80 border border-rose-500 text-rose-200 text-xs">
                    ❌ {uploadError}
                  </div>
                )}

                {/* Tipo de Modelo */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-300 font-semibold block">Tipo da Malha 3D Enviada:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 transition ${
                      selectedUploadType === "malha_externa_monobloco"
                        ? "bg-purple-950/40 border-purple-500 text-purple-200"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}>
                      <input
                        type="radio"
                        name="model_type"
                        checked={selectedUploadType === "malha_externa_monobloco"}
                        onChange={() => setSelectedUploadType("malha_externa_monobloco")}
                        className="mt-0.5 text-purple-500"
                      />
                      <div>
                        <span className="font-bold text-xs block text-white">Malha Externa Monobloco</span>
                        <span className="text-[10px] text-slate-400">Gerado por IA (Tripo3D) ou escaneamento externo 360°.</span>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 transition ${
                      selectedUploadType === "modelo_com_pecas_segmentadas"
                        ? "bg-emerald-950/40 border-emerald-500 text-emerald-200"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}>
                      <input
                        type="radio"
                        name="model_type"
                        checked={selectedUploadType === "modelo_com_pecas_segmentadas"}
                        onChange={() => setSelectedUploadType("modelo_com_pecas_segmentadas")}
                        className="mt-0.5 text-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-xs block text-white">Peças Segmentadas (CAD)</span>
                        <span className="text-[10px] text-slate-400">Componentes individuais (motor, freios, suspensão).</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Escopo de Associação */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-300 font-semibold block">Escopo do Vínculo:</span>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="upload_scope"
                        checked={uploadScope === "vehicle_model"}
                        onChange={() => setUploadScope("vehicle_model")}
                        className="text-cyan-500"
                      />
                      <span className="text-xs text-slate-200">
                        Vincular ao modelo de carro (<strong>{vehicleLabel}</strong>) para toda a oficina
                      </span>
                    </label>

                    {workOrderId && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="upload_scope"
                          checked={uploadScope === "work_order"}
                          onChange={() => setUploadScope("work_order")}
                          className="text-cyan-500"
                        />
                        <span className="text-xs text-slate-200">
                          Vincular apenas a esta Ordem de Serviço (<strong>{workOrderId}</strong>)
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Drag and Drop Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleUploadAndBindModel(file);
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                    isDraggingFile
                      ? "border-cyan-400 bg-cyan-950/40"
                      : "border-slate-700 bg-slate-900/50 hover:border-cyan-500/60"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".glb,.gltf"
                    className="hidden"
                    onChange={handleGlbFileUpload}
                  />

                  {uploadingModel ? (
                    <div className="py-3 space-y-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block animate-ping"></span>
                      <p className="font-bold text-cyan-300 text-xs">Enviando e processando arquivo 3D...</p>
                      <p className="text-[10px] text-slate-400">Gravando associação persistente no banco de dados e preparando cena.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-3xl">📦</div>
                      <p className="text-xs font-semibold text-slate-200">
                        Arraste seu arquivo <span className="text-cyan-400 font-mono">.GLB</span> ou <span className="text-cyan-400 font-mono">.GLTF</span> aqui
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Tamanho máximo: 60MB • Compatível com Tripo3D, Blender, 3ds Max e formatos glTF 2.0
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition"
                      >
                        Selecionar Arquivo no Computador
                      </button>
                    </div>
                  )}
                </div>

                {/* Tripo3D Integration Assistant */}
                <div className="p-3 rounded-lg bg-[#050b16] border border-purple-900/40 flex items-start gap-3">
                  <span className="text-2xl">✨</span>
                  <div className="space-y-1">
                    <span className="font-bold text-purple-300 text-xs block">
                      Integração com o Tripo3D Studio
                    </span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Você pode transformar a fotografia real do veículo em um modelo 3D (.GLB) no <strong>Tripo3D</strong>. Basta carregar a foto do veículo no Studio, gerar a malha tridimensional e exportar em .GLB.
                    </p>
                    <a
                      href="https://studio.tripo3d.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-bold underline decoration-purple-600 pt-0.5"
                    >
                      Abrir Tripo3D Studio em nova guia ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#0a1529] border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModelManagerModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
