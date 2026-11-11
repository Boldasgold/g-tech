"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import DamageMap2D, { DamagePoint } from "@/components/vistorias/DamageMap2D";
import NewAvariaModal from "@/components/vistorias/NewAvariaModal";
import PhotoZoomModal from "@/components/vistorias/PhotoZoomModal";

// Dynamic import for 3D Viewer so it only loads on demand without slowing down the inspection flow
const Vehicle3DViewer = dynamic(() => import("@/components/Vehicle3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] w-full bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 text-sm">
      Carregando visualizador 3D homologado...
    </div>
  )
});

type ActiveMenu = "visao_geral" | "atendimentos" | "clientes_veiculos" | "historico" | "configuracoes";
type WorkflowStep = "entrada" | "fotos_avarias" | "saida" | "retirada";

export default function GTechVistoriasPage() {
  // Navigation & Menu State
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>("atendimentos");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Workflow State within an Atendimento
  const [activeStep, setActiveStep] = useState<WorkflowStep>("entrada");
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null);
  const [selectedWo, setSelectedWo] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Lists & Filters
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchFilter, setSearchFilter] = useState("");

  // Sub-tab for Clientes & Veículos
  const [clientVehiclesTab, setClientVehiclesTab] = useState<"veiculos" | "clientes">("veiculos");

  // Checklist de Entrada Form State
  const [intakeForm, setIntakeForm] = useState({
    odometer_km: "",
    fuel_level: "1/2",
    responsible_name: "Giovane Ribeiro",
    observations: "",
    // Itens recebidos
    chave_presencial: "conforme",
    chave_reserva: "nao_verificado",
    manual_proprietario: "conforme",
    documento_crlv: "conforme",
    estepe: "conforme",
    macaco_chave_roda: "conforme",
    triangulo: "conforme",
    pertences_interior: "conforme",
    pertences_descricao: "",
    // Condições externas
    lataria_geral: "conforme",
    vidros_retrovisores: "conforme",
    palhetas_limpador: "conforme",
    iluminacao_farois: "conforme",
    pneus_estado: "conforme"
  });
  const [savingIntake, setSavingIntake] = useState(false);
  const [intakeSuccessMsg, setIntakeSuccessMsg] = useState<string | null>(null);

  // Fotos & Avarias State
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [showAvariaModal, setShowAvariaModal] = useState(false);
  const [selectedDamageRegion, setSelectedDamageRegion] = useState("Para-choque Dianteiro & Grade");
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [zoomImageTitle, setZoomImageTitle] = useState("");
  const [show3dSection, setShow3dSection] = useState(false);

  // Checklist de Saída & Retirada State
  const [exitForm, setExitForm] = useState({
    vehicle_cleaned: true,
    warning_lights_cleared: true,
    road_test_ok: true,
    parts_returned: true,
    wheel_torque_checked: true,
    recommendations: "",
    delivered_by: "Giovane Ribeiro",
    delivered_to_name: "",
    delivered_to_document: ""
  });
  const [savingExit, setSavingExit] = useState(false);
  const [exitSuccessMsg, setExitSuccessMsg] = useState<string | null>(null);
  const [whatsappDispatchMsg, setWhatsappDispatchMsg] = useState<string | null>(null);

  // Modais de Cadastro Rápido (Novo Atendimento, Novo Carro, Novo Cliente)
  const [showNewOsModal, setShowNewOsModal] = useState(false);
  const [newOsForm, setNewOsForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_document: "",
    vehicle_brand: "Volkswagen",
    vehicle_model: "",
    vehicle_plate: "",
    vehicle_year: "2023",
    vehicle_km: "",
    vehicle_body_type: "hatch",
    initial_scope: "Vistoria completa e revisão de entrada",
    customer_complaint: ""
  });

  const [showNewVehicleModal, setShowNewVehicleModal] = useState(false);
  const [newVehicleForm, setNewVehicleForm] = useState({
    plate: "",
    brand: "Volkswagen",
    model: "",
    year: "2023",
    motor: "1.0 TSI",
    color: "Prata",
    km: "35000",
    fuel: "flex",
    body_type: "hatch",
    customer_name: "",
    customer_phone: ""
  });

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    document: "",
    notes: ""
  });

  // Load Work Orders List
  const loadWorkOrders = async () => {
    try {
      const res = await fetch(`/api/work-orders?status=${statusFilter}&search=${encodeURIComponent(searchFilter)}`);
      const data = await res.json();
      if (data.success) {
        setWorkOrders(data.work_orders || []);
      }
    } catch (err) {
      console.error("Erro ao carregar atendimentos", err);
    }
  };

  // Load Vehicles
  const loadVehicles = async () => {
    try {
      const res = await fetch(`/api/work-orders?view=vehicles&search=${encodeURIComponent(searchFilter)}`);
      const data = await res.json();
      if (data.success) {
        setVehiclesList(data.vehicles || []);
      }
    } catch (err) {
      console.error("Erro ao carregar veículos", err);
    }
  };

  // Load Customers
  const loadCustomers = async () => {
    try {
      const res = await fetch(`/api/work-orders?view=customers&search=${encodeURIComponent(searchFilter)}`);
      const data = await res.json();
      if (data.success) {
        setCustomersList(data.customers || []);
      }
    } catch (err) {
      console.error("Erro ao carregar clientes", err);
    }
  };

  // Load Complete Details for a Single Atendimento
  const loadWoDetails = async (id: string) => {
    setLoadingDetails(true);
    setIntakeSuccessMsg(null);
    setExitSuccessMsg(null);
    try {
      const res = await fetch(`/api/work-orders/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedWo(data);
        setSelectedWoId(data.work_order.id);

        // Prepopulate intake form if already recorded
        if (data.intake_inspection) {
          setIntakeForm(prev => ({
            ...prev,
            odometer_km: data.intake_inspection.odometer_km ? String(data.intake_inspection.odometer_km) : "",
            observations: data.intake_inspection.observations || "",
            responsible_name: data.intake_inspection.responsible_name || "Giovane Ribeiro"
          }));
        } else if (data.work_order.km_entry) {
          setIntakeForm(prev => ({
            ...prev,
            odometer_km: String(data.work_order.km_entry)
          }));
        }

        // Prepopulate exit form if existing
        if (data.exit_checklist) {
          setExitForm(prev => ({
            ...prev,
            vehicle_cleaned: Boolean(data.exit_checklist.vehicle_cleaned),
            warning_lights_cleared: Boolean(data.exit_checklist.warning_lights_cleared),
            road_test_ok: Boolean(data.exit_checklist.road_test_ok),
            parts_returned: Boolean(data.exit_checklist.parts_returned),
            wheel_torque_checked: Boolean(data.exit_checklist.wheel_torque_checked),
            recommendations: data.exit_checklist.recommendations || "",
            delivered_to_name: data.exit_checklist.delivered_to_name || data.work_order.customer_name || ""
          }));
        } else {
          setExitForm(prev => ({
            ...prev,
            delivered_to_name: data.work_order.customer_name || ""
          }));
        }
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes da OS", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Initial load and URL query param restoration
  useEffect(() => {
    loadWorkOrders();
    loadVehicles();
    loadCustomers();
    setLoading(false);
  }, [statusFilter, searchFilter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const osParam = params.get("os") || params.get("id");
      const menuParam = params.get("menu") || params.get("tab");
      const stepParam = params.get("step");
      if (osParam) {
        loadWoDetails(osParam);
        setActiveMenu("atendimentos");
      }
      if (stepParam === "entrada" || stepParam === "fotos_avarias" || stepParam === "saida" || stepParam === "retirada") {
        setActiveStep(stepParam as Step);
      }
      if (menuParam === "visao_geral" || menuParam === "atendimentos" || menuParam === "clientes_veiculos" || menuParam === "historico" || menuParam === "configuracoes") {
        setActiveMenu(menuParam as ActiveMenu);
      }
    }
  }, []);

  // Save Intake Checklist
  const handleSaveIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWo) return;
    setSavingIntake(true);
    setIntakeSuccessMsg(null);
    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odometer_km: intakeForm.odometer_km ? parseInt(intakeForm.odometer_km, 10) : null,
          fuel_pct: intakeForm.fuel_level === "Cheio" ? 100 : intakeForm.fuel_level === "3/4" ? 75 : intakeForm.fuel_level === "1/2" ? 50 : intakeForm.fuel_level === "1/4" ? 25 : 10,
          observations: intakeForm.observations,
          responsible_name: intakeForm.responsible_name,
          client_acknowledged: true,
          items_received: {
            chave_presencial: intakeForm.chave_presencial,
            chave_reserva: intakeForm.chave_reserva,
            manual_proprietario: intakeForm.manual_proprietario,
            documento_crlv: intakeForm.documento_crlv,
            estepe: intakeForm.estepe,
            macaco_chave_roda: intakeForm.macaco_chave_roda,
            triangulo: intakeForm.triangulo,
            pertences_interior: intakeForm.pertences_interior,
            pertences_descricao: intakeForm.pertences_descricao
          },
          external_conditions: {
            lataria: intakeForm.lataria_geral,
            vidros: intakeForm.vidros_retrovisores,
            palhetas: intakeForm.palhetas_limpador,
            iluminacao: intakeForm.iluminacao_farois,
            pneus: intakeForm.pneus_estado
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setIntakeSuccessMsg("Checklist de entrada salvo com sucesso no banco de dados.");
        loadWoDetails(selectedWo.work_order.id);
        loadWorkOrders();
      } else {
        alert(data.error || "Erro ao salvar checklist de entrada.");
      }
    } catch (err: any) {
      alert("Falha de conexão ao salvar checklist.");
    } finally {
      setSavingIntake(false);
    }
  };

  // Upload Visit Photo
  const handleUploadPhotoSlot = async (slotName: string, file: File) => {
    if (!selectedWo || !file) return;
    setUploadingSlot(slotName);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("slot_name", slotName);
      formData.append("work_order_id", selectedWo.work_order.id);

      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/intake/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        loadWoDetails(selectedWo.work_order.id);
      } else {
        alert(data.error || "Erro ao enviar fotografia.");
      }
    } catch (err) {
      alert("Falha ao enviar arquivo de imagem.");
    } finally {
      setUploadingSlot(null);
    }
  };

  // Save New Avaria / Hotspot
  const handleSaveAvaria = async (avariaData: {
    region_name: string;
    damage_type: string;
    description: string;
    photo_file?: File | null;
    author_name: string;
  }) => {
    if (!selectedWo) return;

    let uploadedPhotoUrl = "/img/vehicles/generic-damage.jpg";

    if (avariaData.photo_file) {
      const fd = new FormData();
      fd.append("photo", avariaData.photo_file);
      fd.append("slot_name", "avaria_" + Date.now());
      fd.append("work_order_id", selectedWo.work_order.id);
      try {
        const upRes = await fetch(`/api/work-orders/${selectedWo.work_order.id}/intake/upload`, {
          method: "POST",
          body: fd
        });
        const upData = await upRes.json();
        if (upData.success && upData.photo_url) {
          uploadedPhotoUrl = upData.photo_url;
        }
      } catch (e) {
        console.warn("Upload de foto da avaria falhou, salvando sem foto:", e);
      }
    }

    const payload = {
      hotspot_type: "dano_externo",
      region_name: avariaData.region_name,
      orientation_side: "externo",
      pos_x: 0,
      pos_y: 0,
      pos_z: 0,
      severity: avariaData.damage_type.includes("profundo") || avariaData.damage_type.includes("Trinca") ? "alta" : "media",
      damage_type: avariaData.damage_type,
      description: avariaData.description,
      photo_url: uploadedPhotoUrl,
      author_name: avariaData.author_name || "Giovane Ribeiro"
    };

    const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/hotspots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      loadWoDetails(selectedWo.work_order.id);
    } else {
      throw new Error(data.error || "Erro ao salvar avaria.");
    }
  };

  // Concluir Checklist de Saída e Liberar para Retirada (com disparo WhatsApp)
  const handleCompleteExitChecklist = async () => {
    if (!selectedWo) return;
    setSavingExit(true);
    setExitSuccessMsg(null);
    setWhatsappDispatchMsg(null);
    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "concluir_checklist_saida",
          road_test_ok: exitForm.road_test_ok,
          warning_lights_cleared: exitForm.warning_lights_cleared,
          parts_returned: exitForm.parts_returned,
          vehicle_cleaned: exitForm.vehicle_cleaned,
          wheel_torque_checked: exitForm.wheel_torque_checked,
          recommendations: exitForm.recommendations,
          delivered_by: exitForm.delivered_by
        })
      });
      const data = await res.json();
      if (data.success) {
        setExitSuccessMsg("Checklist de saída concluído! Veículo liberado para retirada com sucesso.");

        // Disparo seguro de aviso WhatsApp com proteção contra duplicidade
        try {
          const wpRes = await fetch("/api/workshop/whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-staff-token": "session-giovane-director-token-2026"
            },
            body: JSON.stringify({
              work_order_id: selectedWo.work_order.id,
              release_event_key: `liberacao_retirada_${selectedWo.work_order.id}`,
              authorized_test_recipient: selectedWo.work_order.customer_phone || "+554196522715"
            })
          });
          const wpData = await wpRes.json();
          if (wpData.success) {
            setWhatsappDispatchMsg(`Aviso WhatsApp registrado: [${wpData.deliveryStatus} • ${wpData.providerName}] para ${wpData.recipientPhone}.`);
          } else {
            setWhatsappDispatchMsg(`Aviso WhatsApp: [${wpData.status || "registrado"}] ${wpData.message || wpData.error}`);
          }
        } catch (wpErr) {
          console.warn("Disparo WhatsApp não executado no modo teste:", wpErr);
        }

        loadWoDetails(selectedWo.work_order.id);
        loadWorkOrders();
      } else {
        alert(data.error || "Erro ao concluir checklist de saída.");
      }
    } catch (err: any) {
      alert("Falha de conexão ao concluir saída.");
    } finally {
      setSavingExit(false);
    }
  };

  // Confirmar Retirada Física (Veículo Entregue)
  const handleConfirmPickup = async () => {
    if (!selectedWo) return;
    if (!exitForm.delivered_to_name.trim()) {
      alert("Informe o nome do cliente ou portador que realizou a retirada física.");
      return;
    }

    setSavingExit(true);
    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "confirmar_retirada_entregue",
          delivered_to_name: exitForm.delivered_to_name.trim(),
          delivered_by: exitForm.delivered_by,
          pickup_confirmed_by_staff_name: exitForm.delivered_by
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Retirada física confirmada com sucesso! Veículo entregue a "${exitForm.delivered_to_name}".`);
        loadWoDetails(selectedWo.work_order.id);
        loadWorkOrders();
      } else {
        alert(data.error || "Erro ao confirmar retirada.");
      }
    } catch (err: any) {
      alert("Falha de conexão ao confirmar retirada.");
    } finally {
      setSavingExit(false);
    }
  };

  // Submit New Atendimento / Work Order
  const handleCreateNewOs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOsForm)
      });
      const data = await res.json();
      if (data.success) {
        alert(`Novo atendimento criado com sucesso! Número da OS: ${data.work_order.os_number}`);
        setShowNewOsModal(false);
        setNewOsForm({
          customer_name: "",
          customer_phone: "",
          customer_document: "",
          vehicle_brand: "Volkswagen",
          vehicle_model: "",
          vehicle_plate: "",
          vehicle_year: "2023",
          vehicle_km: "",
          vehicle_body_type: "hatch",
          initial_scope: "Vistoria completa e revisão de entrada",
          customer_complaint: ""
        });
        await loadWorkOrders();
        loadWoDetails(data.work_order.id);
        setActiveMenu("atendimentos");
      } else {
        alert(data.error || "Erro ao criar atendimento.");
      }
    } catch (err) {
      alert("Falha de conexão ao criar atendimento.");
    }
  };

  // Calculated Real Indicators for Visão Geral
  const metrics = useMemo(() => {
    const total = workOrders.length;
    const emEntrada = workOrders.filter(w => w.status === "aberta" || w.status === "inspecao").length;
    const emVistoria = workOrders.filter(w => w.status === "diagnostico" || w.status === "orcamento_aprovado" || w.status === "execucao").length;
    const prontos = workOrders.filter(w => w.status === "finalizada").length;
    const entregues = workOrders.filter(w => w.status === "entregue").length;
    return { total, emEntrada, emVistoria, prontos, entregues };
  }, [workOrders]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex font-sans antialiased">
      {/* ========================================================================= */}
      {/* 1. SIDEBAR / MENU LATERAL EM AZUL-MARINHO                                 */}
      {/* ========================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 sm:w-72 bg-[#0f172a] text-slate-200 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col">
          {/* Logo & Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white text-base shadow-md">
                GT
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-wide">
                  G-TECH VISTORIAS
                </h1>
                <p className="text-[12px] text-slate-400 font-medium">
                  Vistorias & Pátio • Paranaguá/PR
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white text-lg p-1"
            >
              ✕
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5">
            {[
              { id: "visao_geral", label: "Visão Geral", icon: "📊" },
              { id: "atendimentos", label: "Atendimentos", icon: "📋", badge: workOrders.length },
              { id: "clientes_veiculos", label: "Clientes e Veículos", icon: "👥" },
              { id: "historico", label: "Histórico", icon: "📁" },
              { id: "configuracoes", label: "Configurações", icon: "⚙️" }
            ].map((item) => {
              const active = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`menu-btn-${item.id}`}
                  onClick={() => {
                    setActiveMenu(item.id as ActiveMenu);
                    setSidebarOpen(false);
                  }}
                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-base font-semibold transition-all flex items-center justify-between ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                      active ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#0b1329] text-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs">
              GR
            </div>
            <div className="overflow-hidden">
              <strong className="text-slate-200 block truncate">Giovane Ribeiro</strong>
              <span className="text-slate-400 text-[11px] block">Responsável Técnico</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>G-Tech V1 Ativa</span>
            </span>
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline font-semibold"
            >
              Site Público ↗
            </a>
          </div>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. ÁREA PRINCIPAL CLARA COM CARTÕES BRANCOS                              */}
      {/* ========================================================================= */}
      <div className="flex-1 md:ml-64 lg:ml-72 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              aria-label="Abrir Menu Lateral"
            >
              ☰
            </button>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block">
                {activeMenu === "visao_geral" && "Painel de Controle"}
                {activeMenu === "atendimentos" && "Gestão de Vistorias"}
                {activeMenu === "clientes_veiculos" && "Cadastros da Oficina"}
                {activeMenu === "historico" && "Arquivo e Auditoria"}
                {activeMenu === "configuracoes" && "Parâmetros do Sistema"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {activeMenu === "visao_geral" && "Visão Geral do Pátio"}
                {activeMenu === "atendimentos" && (selectedWo ? `Vistoria ${selectedWo.work_order.os_number}` : "Atendimentos e Vistorias")}
                {activeMenu === "clientes_veiculos" && "Clientes e Veículos"}
                {activeMenu === "historico" && "Histórico de Atendimentos"}
                {activeMenu === "configuracoes" && "Configurações da Oficina"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="btn-novo-atendimento-top"
              onClick={() => setShowNewOsModal(true)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base shadow-sm transition flex items-center gap-2"
            >
              <span>+</span>
              <span>Novo Atendimento</span>
            </button>
          </div>
        </header>

        {/* Main View Area */}
        <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* ========================================================================= */}
          {/* MENU 1: VISÃO GERAL                                                       */}
          {/* ========================================================================= */}
          {activeMenu === "visao_geral" && (
            <div className="space-y-6">
              {/* Real Metrics Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {[
                  { label: "Veículos no Pátio", val: metrics.emEntrada + metrics.emVistoria, icon: "🚗", color: "blue" },
                  { label: "Aguardando Saída", val: metrics.emVistoria, icon: "⏳", color: "amber" },
                  { label: "Prontos para Retirada", val: metrics.prontos, icon: "🟢", color: "emerald" },
                  { label: "Entregues ao Cliente", val: metrics.entregues, icon: "✓", color: "slate" }
                ].map((m, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
                      <span>{m.label}</span>
                      <span className="text-xl">{m.icon}</span>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 font-mono">
                      {m.val}
                    </div>
                    <p className="text-xs text-slate-400">
                      Calculado com base nos registros reais da oficina
                    </p>
                  </div>
                ))}
              </div>

              {/* Quick Actions & Recent Work Orders */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Atendimentos em Andamento no Pátio
                    </h3>
                    <p className="text-xs text-slate-500">
                      Selecione qualquer veículo para abrir sua vistoria técnica completa
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMenu("atendimentos")}
                    className="text-blue-600 hover:underline text-sm font-semibold"
                  >
                    Ver Todos os Atendimentos →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workOrders.slice(0, 6).map((wo) => (
                    <div
                      key={wo.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-white shadow-xs transition space-y-3 flex flex-col justify-between cursor-pointer"
                      onClick={() => {
                        loadWoDetails(wo.id);
                        setActiveMenu("atendimentos");
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-md bg-white border border-blue-900 text-slate-950 font-mono font-bold text-xs">
                            {wo.vehicle_plate}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            wo.status === "finalizada"
                              ? "bg-emerald-100 text-emerald-800"
                              : wo.status === "entregue"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {wo.status === "finalizada" ? "Pronto p/ Retirada" : wo.status === "entregue" ? "Entregue" : "Em Atendimento"}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900">
                          {wo.vehicle_brand} {wo.vehicle_model}
                        </h4>
                        <p className="text-xs text-slate-600">
                          Cliente: <strong>{wo.customer_name}</strong> • OS {wo.os_number}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <span>Entrada: {new Date(wo.created_at).toLocaleDateString("pt-BR")}</span>
                        <span className="text-blue-600 font-bold">Abrir Vistoria →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MENU 2: ATENDIMENTOS & VISTORIAS (LISTA E DETALHES)                      */}
          {/* ========================================================================= */}
          {activeMenu === "atendimentos" && (
            <div className="space-y-6">
              {/* Quando NENHUM atendimento está selecionado: Exibir Lista */}
              {!selectedWo && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                  {/* Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-600 mr-1">Filtrar:</span>
                      {[
                        { id: "todos", label: "Todos" },
                        { id: "aberta", label: "Em Entrada" },
                        { id: "inspecao", label: "Em Vistoria" },
                        { id: "finalizada", label: "Prontos p/ Retirada" },
                        { id: "entregue", label: "Entregues" }
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setStatusFilter(st.id)}
                          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-sm font-semibold transition ${
                            statusFilter === st.id
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="🔍 Buscar placa, modelo ou cliente..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-full sm:w-72"
                      />
                    </div>
                  </div>

                  {/* Table of Atendimentos */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                          <th className="py-3 px-4">OS nº</th>
                          <th className="py-3 px-4">Placa / Veículo</th>
                          <th className="py-3 px-4">Cliente / Contato</th>
                          <th className="py-3 px-4">Situação Atual</th>
                          <th className="py-3 px-4">Data de Entrada</th>
                          <th className="py-3 px-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-base">
                        {workOrders.map((wo) => (
                          <tr
                            key={wo.id}
                            className="hover:bg-slate-50/80 transition cursor-pointer"
                            onClick={() => loadWoDetails(wo.id)}
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {wo.os_number}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <span className="px-2.5 py-0.5 rounded bg-white border border-blue-900 font-mono font-black text-xs text-slate-950 shadow-xs">
                                  {wo.vehicle_plate}
                                </span>
                                <div>
                                  <strong className="text-slate-900 block">{wo.vehicle_brand} {wo.vehicle_model}</strong>
                                  <span className="text-xs text-slate-500 font-mono">Ano {wo.vehicle_year || "N/I"}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <strong className="text-slate-900 block">{wo.customer_name}</strong>
                              <span className="text-xs text-slate-500">{wo.customer_phone}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                wo.status === "finalizada"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : wo.status === "entregue"
                                  ? "bg-slate-100 text-slate-700 border border-slate-300"
                                  : "bg-blue-100 text-blue-800 border border-blue-300"
                              }`}>
                                {wo.status === "finalizada" ? "Pronto p/ Retirada" : wo.status === "entregue" ? "Entregue" : "Em Atendimento"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-sm text-slate-600">
                              {new Date(wo.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-semibold text-sm transition"
                              >
                                Abrir Vistoria →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quando um atendimento ESTÁ SELECIONADO: Exibir Header Fixo + Stepper de 4 Etapas */}
              {selectedWo && (
                <div className="space-y-6">
                  {/* Header Fixo do Atendimento */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedWo(null)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                        >
                          ← Voltar à Lista
                        </button>
                        <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                          {selectedWo.work_order.os_number}
                        </span>
                        <div className="px-3 py-1 rounded bg-white text-slate-950 font-black font-mono text-sm tracking-wider border-2 border-blue-900 shadow-xs">
                          {selectedWo.work_order.vehicle_plate}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          selectedWo.work_order.status === "finalizada"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : selectedWo.work_order.status === "entregue"
                            ? "bg-slate-100 text-slate-700 border border-slate-300"
                            : "bg-blue-100 text-blue-800 border border-blue-300"
                        }`}>
                          {selectedWo.work_order.status === "finalizada" ? "✓ Pronto para Retirada" : selectedWo.work_order.status === "entregue" ? "✓ Veículo Entregue" : "Em Atendimento / Vistoria"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedWo.work_order.customer_phone && (
                          <a
                            href={`https://wa.me/55${selectedWo.work_order.customer_phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition flex items-center gap-1.5"
                          >
                            <span>💬</span>
                            <span>WhatsApp ({selectedWo.work_order.customer_phone})</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Vehicle & Customer Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-xs text-slate-500 uppercase font-semibold block">Veículo</span>
                        <strong className="text-slate-900 text-base">{selectedWo.work_order.vehicle_brand} {selectedWo.work_order.vehicle_model}</strong>
                        <span className="text-xs text-slate-500 block">Ano {selectedWo.work_order.vehicle_year || "N/I"} • Cor {selectedWo.work_order.vehicle_color || "Prata"}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-xs text-slate-500 uppercase font-semibold block">Cliente</span>
                        <strong className="text-slate-900 text-base">{selectedWo.work_order.customer_name}</strong>
                        <span className="text-xs text-slate-500 block">CPF: {selectedWo.work_order.customer_document || "Não informado"}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-xs text-slate-500 uppercase font-semibold block">Quilometragem</span>
                        <strong className="text-slate-900 text-base font-mono">
                          {selectedWo.work_order.km_entry ? selectedWo.work_order.km_entry.toLocaleString("pt-BR") + " km" : "Não informada"}
                        </strong>
                        <span className="text-xs text-slate-500 block">Nível Combustível: {intakeForm.fuel_level}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-xs text-slate-500 uppercase font-semibold block">Vistoriador Responsável</span>
                        <strong className="text-slate-900 text-base">{selectedWo.work_order.mechanic_name || "Giovane Ribeiro"}</strong>
                        <span className="text-xs text-slate-500 block">Entrada em {new Date(selectedWo.work_order.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* STEPPER DE 4 ETAPAS (ENTRADA -> FOTOS/AVARIAS -> SAÍDA -> RETIRADA)      */}
                    {/* ========================================================================= */}
                    <div className="pt-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "entrada", label: "1. Entrada", desc: "Checklist de Recepção" },
                          { id: "fotos_avarias", label: "2. Fotos e Avarias", desc: "Registro Visual & Mapa 2D" },
                          { id: "saida", label: "3. Checklist de Saída", desc: "Conferência e Liberação" },
                          { id: "retirada", label: "4. Retirada", desc: "Entrega Física ao Cliente" }
                        ].map((st) => {
                          const active = activeStep === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setActiveStep(st.id as WorkflowStep)}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                active
                                  ? "bg-blue-50 border-blue-600 text-blue-900 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <strong className={`block text-sm sm:text-base font-bold ${active ? "text-blue-700" : "text-slate-800"}`}>
                                {st.label}
                              </strong>
                              <span className="text-xs text-slate-500 hidden sm:block">
                                {st.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* ETAPA 1: CHECKLIST DE ENTRADA                                            */}
                  {/* ========================================================================= */}
                  {activeStep === "entrada" && (
                    <form onSubmit={handleSaveIntake} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            Checklist de Entrada do Veículo
                          </h3>
                          <p className="text-sm text-slate-500">
                            Preencha a conferência presencial de itens recebidos e condições de recebimento
                          </p>
                        </div>

                        {intakeSuccessMsg && (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-sm font-semibold flex items-center gap-1.5 border border-emerald-300">
                            <span>✓</span>
                            <span>{intakeSuccessMsg}</span>
                          </span>
                        )}
                      </div>

                      {/* Grupo 1: Quilometragem e Nível de Combustível */}
                      <div className="space-y-3">
                        <h4 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2.5">
                          Quilometragem e Combustível
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                              Quilometragem Atual (KM) *
                            </label>
                            <input
                              type="number"
                              required
                              placeholder="Ex: 45000"
                              value={intakeForm.odometer_km}
                              onChange={(e) => setIntakeForm({ ...intakeForm, odometer_km: e.target.value })}
                              className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-base text-slate-900 font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                              Nível de Combustível no Painel *
                            </label>
                            <div className="grid grid-cols-5 gap-1.5">
                              {["Reserva", "1/4", "1/2", "3/4", "Cheio"].map((nv) => (
                                <button
                                  key={nv}
                                  type="button"
                                  onClick={() => setIntakeForm({ ...intakeForm, fuel_level: nv })}
                                  className={`min-h-[46px] rounded-xl text-sm font-bold border transition ${
                                    intakeForm.fuel_level === nv
                                      ? "bg-blue-600 text-white border-blue-700"
                                      : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                                  }`}
                                >
                                  {nv}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Grupo 2: Itens Recebidos com o Veículo */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2.5">
                          Itens Recebidos com o Veículo
                        </h4>
                        <p className="text-xs text-slate-500">
                          Selecione o estado real de cada acessório entregue pelo cliente na recepção
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { key: "chave_presencial", label: "Chave Principal / Presencial" },
                            { key: "chave_reserva", label: "Chave Reserva" },
                            { key: "manual_proprietario", label: "Manual do Proprietário" },
                            { key: "documento_crlv", label: "Documento do Veículo (CRLV)" },
                            { key: "estepe", label: "Estepe (Pneu Sobressalente)" },
                            { key: "macaco_chave_roda", label: "Macaco & Chave de Roda" },
                            { key: "triangulo", label: "Triângulo de Sinalização" },
                            { key: "pertences_interior", label: "Pertences no Interior Declarados" }
                          ].map((item) => {
                            const val = (intakeForm as any)[item.key];
                            return (
                              <div key={item.key} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                                <div className="grid grid-cols-3 gap-1 text-xs">
                                  {[
                                    { id: "nao_verificado", label: "⚪ Não verif." },
                                    { id: "conforme", label: "🟢 Conforme" },
                                    { id: "com_observacao", label: "🟡 Obs." }
                                  ].map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setIntakeForm({ ...intakeForm, [item.key]: opt.id })}
                                      className={`py-1.5 px-2 rounded-lg font-semibold border transition text-center ${
                                        val === opt.id
                                          ? opt.id === "conforme"
                                            ? "bg-emerald-100 text-emerald-800 border-emerald-400 font-bold"
                                            : opt.id === "com_observacao"
                                            ? "bg-amber-100 text-amber-800 border-amber-400 font-bold"
                                            : "bg-slate-200 text-slate-800 border-slate-400 font-bold"
                                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grupo 3: Observações Gerais e Responsável */}
                      <div className="space-y-4 pt-2">
                        <h4 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2.5">
                          Observações Gerais da Vistoria de Entrada
                        </h4>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Relato do Cliente e Observações do Atendente
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Anote detalhes de avarias pré-existentes, solicitação do cliente ou pertences deixados no interior..."
                            value={intakeForm.observations}
                            onChange={(e) => setIntakeForm({ ...intakeForm, observations: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-base text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Responsável Técnico pela Vistoria *
                          </label>
                          <input
                            type="text"
                            required
                            value={intakeForm.responsible_name}
                            onChange={(e) => setIntakeForm({ ...intakeForm, responsible_name: e.target.value })}
                            className="w-full sm:w-80 min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-base text-slate-900 font-semibold"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          O checklist é salvo de forma definitiva no banco de dados SQLite oficial.
                        </span>

                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={savingIntake}
                            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                          >
                            <span>💾</span>
                            <span>{savingIntake ? "Salvando..." : "Salvar Checklist de Entrada"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveStep("fotos_avarias")}
                            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-base transition"
                          >
                            Avançar para Fotos & Avarias →
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* ========================================================================= */}
                  {/* ETAPA 2: FOTOS E AVARIAS                                                  */}
                  {/* ========================================================================= */}
                  {activeStep === "fotos_avarias" && (
                    <div className="space-y-6">
                      {/* Top Action Bar */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            Registro Fotográfico & Apontamento de Avarias
                          </h3>
                          <p className="text-sm text-slate-500">
                            Evidências reais da vistoria de entrada. Todas as fotos são associadas permanentemente à OS {selectedWo.work_order.os_number}.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDamageRegion("Para-choque Dianteiro & Grade");
                              setShowAvariaModal(true);
                            }}
                            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm sm:text-base shadow-sm transition flex items-center gap-2"
                          >
                            <span>+</span>
                            <span>Apontar Nova Avaria</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShow3dSection(!show3dSection)}
                            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
                          >
                            <span>🧊</span>
                            <span className="ml-1.5">{show3dSection ? "Ocultar Monobloco 3D" : "Visualizar Monobloco 3D"}</span>
                          </button>
                        </div>
                      </div>

                      {/* 6 Slots Padronizados de Fotos */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <h4 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2.5">
                          Fotografias Oficiais dos 6 Ângulos
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            { slot: "photo_front", label: "Frente do Veículo", desc: "Grade, faróis e para-choque" },
                            { slot: "photo_rear", label: "Traseira", desc: "Lanternas, tampa e para-choque" },
                            { slot: "photo_left", label: "Lateral Esquerda", desc: "Portas e para-lamas esquerdos" },
                            { slot: "photo_right", label: "Lateral Direita", desc: "Portas e para-lamas direitos" },
                            { slot: "photo_interior", label: "Interior & Painel", desc: "Hodômetro, bancos e acabamentos" },
                            { slot: "photo_dashboard", label: "Detalhes de Avarias", desc: "Aproximação de riscos/amassados" }
                          ].map((item) => {
                            const photoUrl = selectedWo.intake_inspection?.[item.slot];
                            const isBusy = uploadingSlot === item.slot;

                            return (
                              <div
                                key={item.slot}
                                className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3 flex flex-col justify-between"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <strong className="text-base font-bold text-slate-900">{item.label}</strong>
                                    {photoUrl ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                        ✓ Registrada
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs">
                                        Pendente
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">{item.desc}</p>
                                </div>

                                {/* Photo Preview Box */}
                                <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 flex items-center justify-center">
                                  {photoUrl ? (
                                    <img
                                      src={photoUrl}
                                      alt={item.label}
                                      className="w-full h-full object-cover cursor-pointer hover:scale-102 transition duration-200"
                                      onClick={() => {
                                        setZoomImageUrl(photoUrl);
                                        setZoomImageTitle(item.label);
                                      }}
                                    />
                                  ) : (
                                    <div className="text-center p-4 space-y-1 text-slate-400">
                                      <span className="text-3xl block">📷</span>
                                      <span className="text-xs block font-medium">Nenhuma foto anexada</span>
                                    </div>
                                  )}

                                  {photoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setZoomImageUrl(photoUrl);
                                        setZoomImageTitle(item.label);
                                      }}
                                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-semibold backdrop-blur-xs"
                                    >
                                      🔍 Ampliar
                                    </button>
                                  )}
                                </div>

                                {/* Upload Button */}
                                <label className="min-h-[42px] px-4 py-2 rounded-xl bg-white border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 font-semibold text-sm cursor-pointer shadow-xs transition flex items-center justify-center gap-2">
                                  <span>{isBusy ? "Enviando imagem..." : photoUrl ? "Substituir Fotografia" : "Anexar Foto"}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    disabled={isBusy}
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadPhotoSlot(item.slot, file);
                                    }}
                                  />
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mapa 2D Interativo de Avarias */}
                      <DamageMap2D
                        damages={selectedWo.hotspots || []}
                        selectedRegion={selectedDamageRegion}
                        onSelectRegion={(reg) => {
                          setSelectedDamageRegion(reg);
                          setShowAvariaModal(true);
                        }}
                      />

                      {/* Visualizador 3D Opcional (Lazy-loaded) */}
                      {show3dSection && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                              <h4 className="text-base font-bold text-slate-900">
                                Visualização Tridimensional do Veículo
                              </h4>
                              <p className="text-xs text-slate-500">
                                Monobloco 3D de referência homologado para checagem de alinhamento e proporções
                              </p>
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                              Veículo: {selectedWo.work_order.vehicle_brand} {selectedWo.work_order.vehicle_model}
                            </span>
                          </div>

                          <Vehicle3DViewer
                            bodyType={selectedWo.work_order.vehicle_body_type || "hatch"}
                            vehicleLabel={`${selectedWo.work_order.vehicle_brand} ${selectedWo.work_order.vehicle_model}`}
                            vehicleKey={selectedWo.work_order.vehicle_key || `volkswagen_${selectedWo.work_order.vehicle_model.toLowerCase().replace(/\s+/g, "_")}`}
                            workOrderId={selectedWo.work_order.id}
                            brand={selectedWo.work_order.vehicle_brand}
                            model={selectedWo.work_order.vehicle_model}
                            realPhotoUrl={selectedWo.intake_inspection?.photo_front || undefined}
                            readOnly={true}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* ETAPA 3: CHECKLIST DE SAÍDA                                              */}
                  {/* ========================================================================= */}
                  {activeStep === "saida" && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            Checklist de Saída & Conferência Final
                          </h3>
                          <p className="text-sm text-slate-500">
                            Conferência obrigatória antes de liberar o veículo para retirada pelo cliente
                          </p>
                        </div>

                        {exitSuccessMsg && (
                          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-sm font-semibold border border-emerald-300">
                            ✓ {exitSuccessMsg}
                          </span>
                        )}
                      </div>

                      {whatsappDispatchMsg && (
                        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm flex items-center justify-between gap-2">
                          <span>📱 {whatsappDispatchMsg}</span>
                          <button
                            type="button"
                            onClick={() => setWhatsappDispatchMsg(null)}
                            className="text-slate-400 hover:text-slate-700 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Itens de Conferência de Saída */}
                      <div className="space-y-3">
                        <h4 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2.5">
                          Itens de Conferência Final
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {[
                            { key: "vehicle_cleaned", label: "Veículo limpo e higienizado internamente / externamente" },
                            { key: "warning_lights_cleared", label: "Luzes de advertência do painel apagadas (sem avarias ativas)" },
                            { key: "road_test_ok", label: "Teste de rodagem e funcionamento dinâmico aprovado" },
                            { key: "parts_returned", label: "Peças antigas substituídas separadas para devolução ao cliente" },
                            { key: "wheel_torque_checked", label: "Torque de aperto dos parafusos de roda conferido com torquímetro" }
                          ].map((item) => {
                            const val = (exitForm as any)[item.key];
                            return (
                              <div
                                key={item.key}
                                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                              >
                                <span className="text-sm font-semibold text-slate-900 leading-snug">{item.label}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setExitForm({ ...exitForm, [item.key]: true })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                      val === true
                                        ? "bg-emerald-600 text-white border-emerald-700"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    Sim ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExitForm({ ...exitForm, [item.key]: false })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                      val === false
                                        ? "bg-rose-600 text-white border-rose-700"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    Não ✗
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Observações e Recomendações */}
                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Recomendações Técnicas para o Cliente
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Ex: Verificar calibragem dos pneus a cada 15 dias. Próxima troca de óleo em 10.000 km ou 12 meses."
                            value={exitForm.recommendations}
                            onChange={(e) => setExitForm({ ...exitForm, recommendations: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-base text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Responsável pela Conferência de Saída *
                          </label>
                          <input
                            type="text"
                            required
                            value={exitForm.delivered_by}
                            onChange={(e) => setExitForm({ ...exitForm, delivered_by: e.target.value })}
                            className="w-full sm:w-80 min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-base text-slate-900 font-semibold"
                          />
                        </div>
                      </div>

                      {/* Ação de Liberação */}
                      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-xs text-slate-500 block">
                            Após a conclusão, o veículo passará para o estado <strong>Pronto para Retirada</strong>.
                          </span>
                          <span className="text-xs text-slate-400 block">
                            O cliente será notificado via WhatsApp com o resumo do laudo.
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={savingExit}
                          onClick={handleCompleteExitChecklist}
                          className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                        >
                          <span>✓</span>
                          <span>{savingExit ? "Salvando..." : "Concluir Saída & Marcar como Pronto para Retirada"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* ETAPA 4: RETIRADA FÍSICA                                                 */}
                  {/* ========================================================================= */}
                  {activeStep === "retirada" && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-xl font-bold text-slate-900">
                          Confirmação de Retirada Física do Veículo
                        </h3>
                        <p className="text-sm text-slate-500">
                          Registro de entrega definitiva do veículo ao cliente ou terceiro autorizado no balcão
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📋</span>
                          <strong className="text-sm text-slate-900">Estado Atual da Ordem de Serviço:</strong>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            selectedWo.work_order.status === "finalizada"
                              ? "bg-emerald-100 text-emerald-800"
                              : selectedWo.work_order.status === "entregue"
                              ? "bg-slate-200 text-slate-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {selectedWo.work_order.status === "finalizada" ? "Pronto para Retirada" : selectedWo.work_order.status === "entregue" ? "Entregue ao Cliente" : "Em Andamento (Saída pendente)"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {selectedWo.work_order.status === "finalizada"
                            ? "O checklist de saída já foi concluído. O cliente pode realizar a conferência física e retirar o veículo."
                            : selectedWo.work_order.status === "entregue"
                            ? `Veículo já foi entregue a "${selectedWo.exit_checklist?.delivered_to_name || selectedWo.work_order.customer_name}" em ${selectedWo.exit_checklist?.delivered_at ? new Date(selectedWo.exit_checklist.delivered_at).toLocaleDateString("pt-BR") : "data recente"}.`
                            : "Atenção: Conclua o Checklist de Saída na Etapa 3 antes de confirmar a entrega física."}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Nome de Quem Recebeu o Veículo *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Nome completo do cliente ou portador"
                            value={exitForm.delivered_to_name}
                            onChange={(e) => setExitForm({ ...exitForm, delivered_to_name: e.target.value })}
                            className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-base text-slate-900 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Documento (RG / CPF)
                          </label>
                          <input
                            type="text"
                            placeholder="000.000.000-00"
                            value={exitForm.delivered_to_document}
                            onChange={(e) => setExitForm({ ...exitForm, delivered_to_document: e.target.value })}
                            className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-base text-slate-900 font-mono"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          A confirmação altera permanentemente o status da OS para <strong>Entregue</strong>.
                        </span>

                        <button
                          type="button"
                          disabled={savingExit || selectedWo.work_order.status === "entregue"}
                          onClick={handleConfirmPickup}
                          className="min-h-[48px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                        >
                          <span>🤝</span>
                          <span>{selectedWo.work_order.status === "entregue" ? "Veículo Já Entregue" : "Confirmar Entrega ao Cliente"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MENU 3: CLIENTES E VEÍCULOS                                              */}
          {/* ========================================================================= */}
          {activeMenu === "clientes_veiculos" && (
            <div className="space-y-6">
              {/* Header with Sub-tabs & Action */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setClientVehiclesTab("veiculos")}
                    className={`min-h-[38px] px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                      clientVehiclesTab === "veiculos"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🚗 Carros da Frota ({vehiclesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientVehiclesTab("clientes")}
                    className={`min-h-[38px] px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                      clientVehiclesTab === "clientes"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    👤 Clientes Cadastrados ({customersList.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="🔍 Buscar..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-56"
                  />

                  {clientVehiclesTab === "veiculos" ? (
                    <button
                      type="button"
                      onClick={() => setShowNewVehicleModal(true)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition"
                    >
                      + Novo Veículo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewCustomerModal(true)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition"
                    >
                      + Novo Cliente
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-tab 1: Veículos */}
              {clientVehiclesTab === "veiculos" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vehiclesList.map((veh) => (
                    <div
                      key={veh.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5 flex flex-col justify-between hover:border-blue-400 transition"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded bg-white text-slate-950 font-black font-mono text-sm tracking-wider border-2 border-blue-900 shadow-xs">
                            {veh.plate}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono uppercase font-semibold">
                            {veh.body_type || "Hatch"}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-lg font-bold text-slate-900">
                            {veh.brand} {veh.model}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Ano {veh.year || "N/I"} • {veh.motor || "Motor padrão"} • {veh.color || "Prata"} • {veh.km ? veh.km.toLocaleString("pt-BR") + " km" : "0 km"}
                          </p>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Proprietário:</span>
                            <strong className="text-slate-900">{veh.customer_name || "Cliente Oficina"}</strong>
                          </div>
                          {veh.customer_phone && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Contato:</span>
                              <span className="text-blue-600 font-mono font-semibold">{veh.customer_phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">
                          {veh.total_work_orders || 0} vistorias realizadas
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setNewOsForm({
                              customer_name: veh.customer_name || "",
                              customer_phone: veh.customer_phone || "",
                              customer_document: veh.customer_document || "",
                              vehicle_brand: veh.brand,
                              vehicle_model: veh.model,
                              vehicle_plate: veh.plate,
                              vehicle_year: veh.year || "2023",
                              vehicle_km: veh.km ? String(veh.km) : "",
                              vehicle_body_type: veh.body_type || "hatch",
                              initial_scope: "Vistoria e revisão periódica",
                              customer_complaint: ""
                            });
                            setShowNewOsModal(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-semibold text-xs transition"
                        >
                          + Abrir Atendimento
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-tab 2: Clientes */}
              {clientVehiclesTab === "clientes" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customersList.map((cust) => (
                    <div
                      key={cust.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5 flex flex-col justify-between hover:border-blue-400 transition"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                            {cust.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900">{cust.name}</h4>
                            <span className="text-xs text-slate-400 font-mono">
                              CPF/CNPJ: {cust.document || "Não cadastrado"}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">WhatsApp:</span>
                            <a
                              href={`https://wa.me/55${(cust.phone || "").replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:underline font-mono font-bold flex items-center gap-1"
                            >
                              <span>💬</span>
                              <span>{cust.phone}</span>
                            </a>
                          </div>
                          {cust.email && (
                            <div className="flex items-center justify-between text-slate-600">
                              <span>E-mail:</span>
                              <span className="truncate max-w-[150px]">{cust.email}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-xs space-y-1">
                          <span className="text-slate-400 font-semibold block uppercase text-[11px]">
                            Veículos Cadastrados ({cust.total_vehicles || 0}):
                          </span>
                          {cust.vehicles_summary ? (
                            <span className="text-slate-700 block font-medium">
                              🚗 {cust.vehicles_summary}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic block">
                              Nenhum veículo vinculado
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {cust.total_work_orders || 0} ordens de serviço
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setNewOsForm({
                              customer_name: cust.name,
                              customer_phone: cust.phone,
                              customer_document: cust.document || "",
                              vehicle_brand: "Volkswagen",
                              vehicle_model: "",
                              vehicle_plate: "",
                              vehicle_year: "2023",
                              vehicle_km: "",
                              vehicle_body_type: "hatch",
                              initial_scope: "Vistoria técnica solicitada pelo cliente",
                              customer_complaint: ""
                            });
                            setShowNewOsModal(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-semibold transition"
                        >
                          Nova OS →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MENU 4: HISTÓRICO                                                         */}
          {/* ========================================================================= */}
          {activeMenu === "historico" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Histórico Completo de Vistorias e Atendimentos
                  </h3>
                  <p className="text-sm text-slate-500">
                    Auditoria permanente de atendimentos, laudos técnicos emitidos e registros de retirada
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="🔍 Buscar no histórico..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-64"
                />
              </div>

              <div className="space-y-3">
                {workOrders.map((wo) => (
                  <div
                    key={wo.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-white shadow-xs transition flex flex-wrap items-center justify-between gap-4 cursor-pointer"
                    onClick={() => {
                      loadWoDetails(wo.id);
                      setActiveMenu("atendimentos");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-base text-slate-900">
                        {wo.os_number}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-white border border-blue-900 font-mono font-black text-xs text-slate-950">
                        {wo.vehicle_plate}
                      </span>
                      <div>
                        <strong className="text-slate-900 text-sm block">
                          {wo.vehicle_brand} {wo.vehicle_model}
                        </strong>
                        <span className="text-xs text-slate-500">Cliente: {wo.customer_name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        wo.status === "finalizada"
                          ? "bg-emerald-100 text-emerald-800"
                          : wo.status === "entregue"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {wo.status === "finalizada" ? "Pronto p/ Retirada" : wo.status === "entregue" ? "Entregue" : wo.status}
                      </span>

                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(wo.created_at).toLocaleDateString("pt-BR")}
                      </span>

                      <button
                        type="button"
                        className="text-blue-600 hover:underline font-semibold text-sm"
                      >
                        Ver Laudo →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MENU 5: CONFIGURAÇÕES                                                     */}
          {/* ========================================================================= */}
          {activeMenu === "configuracoes" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xl font-bold text-slate-900">
                  Configurações Operacionais da G-Tech
                </h3>
                <p className="text-sm text-slate-500">
                  Parâmetros da oficina, responsáveis técnicos e integração segura de WhatsApp
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <h4 className="text-base font-bold text-slate-900">Unidade Paranaguá • PR</h4>
                  <p className="text-sm text-slate-600">
                    G-Tech Centro de Diagnóstico e Vistorias Automotivas<br />
                    Rua Maria da Conceição T. de Souza, 815 • Divinéia • Paranaguá–PR<br />
                    CNPJ: 00.000.000/0001-00 • Telefone: (41) 9652-2715
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <h4 className="text-base font-bold text-slate-900">Integração WhatsApp</h4>
                  <p className="text-sm text-slate-600">
                    Provedor: <strong>Ativo com Proteção contra Duplicidade</strong><br />
                    Chave de Liberação: <code>liberacao_retirada_v1</code> (Idempotente)<br />
                    Modo Seguro: Mensagens reais jamais são enviadas a números de teste.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <h4 className="text-base font-bold text-slate-900">Banco de Dados Operacional</h4>
                  <p className="text-sm text-slate-600">
                    Motor: <strong>SQLite 3 com WAL (Write-Ahead Logging)</strong><br />
                    Arquivo: <code>data/gtech.db</code> (Autoridade única dos dados)<br />
                    Backup Verificado com Hash SHA-256 ativo.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <h4 className="text-base font-bold text-slate-900">Desacoplamento de Serviços</h4>
                  <p className="text-sm text-slate-600">
                    • <strong>G-Tech Vistorias (Porta 3001)</strong>: Programa operacional independente.<br />
                    • <strong>Site Público (Porta 3000)</strong>: Servidor Express leve sem Three.js.<br />
                    • <strong>Worker IA/3D (Porta 3002)</strong>: Processamento assíncrono isolado.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: NOVA ORDEM DE SERVIÇO / ATENDIMENTO                                */}
      {/* ========================================================================= */}
      {showNewOsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleCreateNewOs}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span>📋</span>
                  <span>Iniciar Novo Atendimento & Vistoria</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cadastre o cliente e veículo para iniciar o fluxo de recepção
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewOsModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Mendes"
                    value={newOsForm.customer_name}
                    onChange={(e) => setNewOsForm({ ...newOsForm, customer_name: e.target.value })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="(41) 99123-4567"
                    value={newOsForm.customer_phone}
                    onChange={(e) => setNewOsForm({ ...newOsForm, customer_phone: e.target.value })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Placa do Veículo *</label>
                  <input
                    type="text"
                    required
                    placeholder="BRA2E19"
                    value={newOsForm.vehicle_plate}
                    onChange={(e) => setNewOsForm({ ...newOsForm, vehicle_plate: e.target.value.toUpperCase() })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-mono font-black uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Marca *</label>
                  <select
                    value={newOsForm.vehicle_brand}
                    onChange={(e) => setNewOsForm({ ...newOsForm, vehicle_brand: e.target.value })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-semibold"
                  >
                    <option value="Volkswagen">Volkswagen</option>
                    <option value="Chevrolet">Chevrolet</option>
                    <option value="Renault">Renault</option>
                    <option value="Fiat">Fiat</option>
                    <option value="Toyota">Toyota</option>
                    <option value="Honda">Honda</option>
                    <option value="Hyundai">Hyundai</option>
                    <option value="Ford">Ford</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Polo Hatch, Bora Sedã..."
                    value={newOsForm.vehicle_model}
                    onChange={(e) => setNewOsForm({ ...newOsForm, vehicle_model: e.target.value })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ano</label>
                  <input
                    type="text"
                    placeholder="2023"
                    value={newOsForm.vehicle_year}
                    onChange={(e) => setNewOsForm({ ...newOsForm, vehicle_year: e.target.value })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Quilometragem Inicial</label>
                  <input
                    type="number"
                    placeholder="45000"
                    value={newOsForm.vehicle_km}
                    onChange={(e) => setNewOsForm({ ...newOsForm, vehicle_km: e.target.value })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Carroceria</label>
                  <select
                    value={newOsForm.vehicle_body_type}
                    onChange={(e) => setNewOsForm({ ...newOsForm, vehicle_body_type: e.target.value })}
                    className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900"
                  >
                    <option value="hatch">Hatch</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="picape">Picape</option>
                    <option value="van">Van</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Escopo Inicial da Vistoria</label>
                <input
                  type="text"
                  value={newOsForm.initial_scope}
                  onChange={(e) => setNewOsForm({ ...newOsForm, initial_scope: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Relato / Reclamação do Cliente</label>
                <textarea
                  rows={2}
                  placeholder="Relato de ruído, revisão solicitada ou observações de entrada..."
                  value={newOsForm.customer_complaint}
                  onChange={(e) => setNewOsForm({ ...newOsForm, customer_complaint: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base text-slate-900 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowNewOsModal(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-base transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm transition"
              >
                Criar Atendimento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO VEÍCULO                                                       */}
      {/* ========================================================================= */}
      {showNewVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch("/api/work-orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "create_vehicle", ...newVehicleForm })
                });
                const data = await res.json();
                if (data.success) {
                  alert(`Veículo ${newVehicleForm.brand} ${newVehicleForm.model} (${newVehicleForm.plate}) cadastrado com sucesso!`);
                  setShowNewVehicleModal(false);
                  loadVehicles();
                } else {
                  alert(data.error || "Erro ao cadastrar veículo.");
                }
              } catch (err) {
                alert("Falha de conexão ao cadastrar veículo.");
              }
            }}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-900">Cadastrar Novo Veículo</h3>
              <button type="button" onClick={() => setShowNewVehicleModal(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Placa *</label>
                <input
                  type="text"
                  required
                  placeholder="BRA2E19"
                  value={newVehicleForm.plate}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, plate: e.target.value.toUpperCase() })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base font-mono font-black uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Marca *</label>
                <select
                  value={newVehicleForm.brand}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, brand: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base"
                >
                  <option value="Volkswagen">Volkswagen</option>
                  <option value="Chevrolet">Chevrolet</option>
                  <option value="Renault">Renault</option>
                  <option value="Fiat">Fiat</option>
                  <option value="Toyota">Toyota</option>
                  <option value="Honda">Honda</option>
                  <option value="Ford">Ford</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Modelo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Polo Hatch 1.0 TSI, Corsa Hatch, Bora Sedã..."
                  value={newVehicleForm.model}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, model: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ano</label>
                <input
                  type="text"
                  placeholder="2023"
                  value={newVehicleForm.year}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, year: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Quilometragem (KM)</label>
                <input
                  type="number"
                  placeholder="35000"
                  value={newVehicleForm.km}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, km: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowNewVehicleModal(false)} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm">Cadastrar Veículo</button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO CLIENTE                                                       */}
      {/* ========================================================================= */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch("/api/work-orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "create_customer", ...newCustomerForm })
                });
                const data = await res.json();
                if (data.success) {
                  alert(`Cliente ${newCustomerForm.name} cadastrado com sucesso!`);
                  setShowNewCustomerModal(false);
                  loadCustomers();
                } else {
                  alert(data.error || "Erro ao cadastrar cliente.");
                }
              } catch (err) {
                alert("Falha de conexão ao cadastrar cliente.");
              }
            }}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-900">Cadastrar Novo Cliente</h3>
              <button type="button" onClick={() => setShowNewCustomerModal(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Silveira"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="(41) 99876-5432"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CPF / CNPJ</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={newCustomerForm.document}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, document: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowNewCustomerModal(false)} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm">Cadastrar Cliente</button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVA AVARIA                                                        */}
      {/* ========================================================================= */}
      <NewAvariaModal
        isOpen={showAvariaModal}
        onClose={() => setShowAvariaModal(false)}
        initialRegion={selectedDamageRegion}
        onSave={handleSaveAvaria}
      />

      {/* ========================================================================= */}
      {/* MODAL: ZOOM EM ALTA RESOLUÇÃO                                             */}
      {/* ========================================================================= */}
      <PhotoZoomModal
        isOpen={Boolean(zoomImageUrl)}
        onClose={() => setZoomImageUrl(null)}
        imageUrl={zoomImageUrl}
        title={zoomImageTitle}
        subtitle={selectedWo ? `Veículo ${selectedWo.work_order.vehicle_plate} • OS ${selectedWo.work_order.os_number}` : undefined}
      />
    </div>
  );
}
