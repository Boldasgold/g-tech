"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Vehicle3DViewer from "@/components/Vehicle3DViewer";
import { BodyType, HotspotData } from "@/lib/vehicle3d";
import { recognizeVehicle } from "@/lib/vw-recognition";

export default function OficinaDashboardPage() {
  const [activeTab, setActiveTab] = useState<"quadro" | "detalhes" | "agendamentos" | "metricas">("quadro");
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null);
  const [selectedWo, setSelectedWo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchFilter, setSearchFilter] = useState("");

  // Appointments queue
  const [appointments, setAppointments] = useState<any[]>([]);

  // Active OS sub-tab
  const [osSubTab, setOsSubTab] = useState<"vistoria" | "inspecao3d" | "componentes" | "startmycar" | "checklist" | "orcamento" | "execucao" | "saida">("inspecao3d");
  const [techSpecs, setTechSpecs] = useState<any | null>(null);
  const [fuseSearch, setFuseSearch] = useState("");

  // Components inspection list & filter state
  const [componentsList, setComponentsList] = useState<any[]>([]);
  const [compSystemFilter, setCompSystemFilter] = useState("todos");
  const [compAxleFilter, setCompAxleFilter] = useState("todos");
  const [compStatusFilter, setCompStatusFilter] = useState("todos");
  const [compSearch, setCompSearch] = useState("");
  const [selectedCompModal, setSelectedCompModal] = useState<any | null>(null);

  // Replacement modal for quote items
  const [replacementModalItem, setReplacementModalItem] = useState<any | null>(null);
  const [modalReplRemoved, setModalReplRemoved] = useState("");
  const [modalReplInstalled, setModalReplInstalled] = useState("");
  const [modalReplBefore, setModalReplBefore] = useState("");
  const [modalReplAfter, setModalReplAfter] = useState("");

  // Metrics
  const [metrics, setMetrics] = useState<any | null>(null);

  // New OS Modal
  const [showNewOsModal, setShowNewOsModal] = useState(false);
  const [newOsForm, setNewOsForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_document: "",
    vehicle_brand: "Renault",
    vehicle_model: "",
    vehicle_plate: "",
    vehicle_year: "2021",
    vehicle_km: "45000",
    vehicle_body_type: "suv" as BodyType,
    initial_scope: "Diagnóstico eletrônico avançado e vistoria completa",
    customer_complaint: "",
    appointment_id: ""
  });

  // Quote builder state
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [newQuoteItem, setNewQuoteItem] = useState({
    description: "",
    part_code: "",
    quantity: 1,
    unit_price_part: 0,
    unit_price_service: 0,
    is_indivisible: false,
    indivisible_justification: "",
    safety_risk_warning: ""
  });

  // Load Work Orders
  const loadWorkOrders = async () => {
    try {
      const res = await fetch(`/api/work-orders?status=${statusFilter}&search=${encodeURIComponent(searchFilter)}`);
      const data = await res.json();
      if (data.success) {
        setWorkOrders(data.work_orders || []);
      }
    } catch (err) {
      console.error("Erro ao carregar ordens de serviço", err);
    }
  };

  // Load Appointments
  const loadAppointments = async () => {
    try {
      const res = await fetch("/api/appointments");
      const data = await res.json();
      if (data.success) {
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error("Erro ao carregar agendamentos", err);
    }
  };

  // Load Metrics
  const loadMetrics = async () => {
    try {
      const res = await fetch("/api/dashboard/metrics");
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Erro ao carregar métricas", err);
    }
  };

  // Load Specific Work Order Details
  const loadWoDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedWo(data);
        setSelectedWoId(data.work_order.id);
        setActiveTab("detalhes");

        // Fetch StartMyCar tech specs for vehicle
        fetch(`/api/tech-specs?work_order_id=${id}`)
          .then(r => r.json())
          .then(td => {
            if (td.success) setTechSpecs(td.spec);
          })
          .catch(console.error);

        // Fetch component inspection tree for this OS
        fetch(`/api/work-orders/${id}/components`)
          .then(r => r.json())
          .then(cd => {
            if (cd.success) setComponentsList(cd.components || []);
          })
          .catch(console.error);
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes da OS", err);
    } finally {
      setLoading(false);
    }
  };

  const reloadComponents = async () => {
    if (!selectedWoId) return;
    try {
      const url = new URL(`/api/work-orders/${selectedWoId}/components`, window.location.origin);
      if (compSystemFilter !== "todos") url.searchParams.set("system", compSystemFilter);
      if (compAxleFilter !== "todos") url.searchParams.set("axle", compAxleFilter);
      if (compStatusFilter !== "todos") url.searchParams.set("status", compStatusFilter);
      if (compSearch) url.searchParams.set("q", compSearch);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setComponentsList(data.components || []);
      }
    } catch (e) {
      console.error("Erro ao recarregar componentes", e);
    }
  };

  const handleExecuteReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacementModalItem || !selectedWoId) return;

    try {
      const res = await fetch(`/api/work-orders/${selectedWoId}/replacements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_item_id: replacementModalItem.id,
          component_name: replacementModalItem.description,
          assembly_path: "Veículo › Execução de Orçamento Autorizado",
          position_side: "central",
          removed_part_desc: modalReplRemoved.trim() || "Peça usada com desgaste operacional substituída conforme autorização do cliente.",
          installed_part_desc: modalReplInstalled.trim() || `${replacementModalItem.description} nova de primeira linha com nota fiscal e garantia.`,
          photo_before_url: modalReplBefore.trim() || "/img/vehicles/renault-duster.jpg",
          photo_after_url: modalReplAfter.trim() || "/img/vehicles/suv-real.jpg",
          technician_name: "Giovane Ribeiro",
          warranty_terms: "Garantia legal de 90 dias conforme CDC"
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Substituição registrada com sucesso! Selo oficial "PEÇA TROCADA" emitido.`);
        setReplacementModalItem(null);
        setModalReplRemoved("");
        setModalReplInstalled("");
        setModalReplBefore("");
        setModalReplAfter("");
        loadWoDetails(selectedWoId);
      } else {
        alert(data.error || "Erro ao registrar substituição.");
      }
    } catch (err: any) {
      alert("Falha de conexão ao registrar substituição.");
    }
  };

  const handleAddOilToQuote = () => {
    if (!techSpecs) return;
    const oilItem = {
      description: `Troca de Óleo ${techSpecs.oil_viscosity} (${techSpecs.oil_capacity_liters}L) + Filtro de Óleo`,
      part_code: `OIL-${techSpecs.oil_viscosity.split(" ")[0]}`,
      quantity: 1,
      unit_price_part: 220,
      unit_price_service: 90,
      is_indivisible: 0,
      safety_risk_warning: null
    };
    setQuoteItems(prev => [...prev, oilItem]);
    setOsSubTab("orcamento");
    alert(`Óleo homologado (${techSpecs.oil_viscosity}) adicionado ao rascunho do orçamento!`);
  };

  useEffect(() => {
    loadWorkOrders();
    loadAppointments();
    loadMetrics();
    setLoading(false);
  }, [statusFilter, searchFilter]);

  // Open demo case on first load if none selected
  useEffect(() => {
    if (workOrders.length > 0 && !selectedWoId) {
      loadWoDetails(workOrders[0].id);
    }
  }, [workOrders]);

  // Convert Appointment to OS
  const handleConvertAppointment = (apt: any) => {
    const rec = recognizeVehicle(apt.vehicle_brand, apt.vehicle_model);
    setNewOsForm({
      customer_name: apt.customer_name,
      customer_phone: apt.customer_phone,
      customer_document: "",
      vehicle_brand: apt.vehicle_brand,
      vehicle_model: apt.vehicle_model,
      vehicle_plate: apt.vehicle_plate || "",
      vehicle_year: "2021",
      vehicle_km: "50000",
      vehicle_body_type: rec.isVolkswagen ? rec.bodyType : "suv",
      initial_scope: "Atendimento iniciado a partir de agendamento web",
      customer_complaint: apt.issue_description + (apt.dashboard_alert ? ` [Alerta: ${apt.dashboard_alert}]` : ""),
      appointment_id: apt.id
    });
    setShowNewOsModal(true);
  };

  // Submit New OS
  const handleCreateOs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOsForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowNewOsModal(false);
        await loadWorkOrders();
        await loadAppointments();
        loadWoDetails(data.work_order_id);
      } else {
        alert(data.error || "Erro ao criar OS");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  // Add Hotspot to OS
  const handleAddHotspot = async (hit: any) => {
    if (!selectedWo) return;
    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/hotspots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hit)
      });
      const data = await res.json();
      if (data.success) {
        loadWoDetails(selectedWo.work_order.id);
      }
    } catch (err) {
      alert("Erro ao salvar marcador 3D.");
    }
  };

  // Delete Hotspot
  const handleDeleteHotspot = async (hotspotId: string) => {
    if (!selectedWo) return;
    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/hotspots?hotspot_id=${hotspotId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        loadWoDetails(selectedWo.work_order.id);
      }
    } catch (err) {
      alert("Erro ao remover marcador.");
    }
  };

  // Update Checklist Item Status
  const handleUpdateChecklistItem = async (item: any, newStatus: string) => {
    if (!selectedWo) return;
    let finding = item.finding_description || "";
    let test = item.test_performed || "";

    if ((newStatus === "ATENCAO" || newStatus === "CRITICO") && !finding) {
      const input = prompt(`Descreva a evidência ou achado técnico para "${item.item_name}" (${newStatus}):`, "");
      if (!input || input.trim().length === 0) {
        alert("A descrição da evidência é obrigatória para itens com Atenção ou Crítico.");
        return;
      }
      finding = input.trim();
    }

    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/checklist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          status: newStatus,
          finding_description: finding,
          test_performed: test,
          priority: newStatus === "CRITICO" ? "critica" : newStatus === "ATENCAO" ? "alta" : "baixa"
        })
      });
      const data = await res.json();
      if (data.success) {
        loadWoDetails(selectedWo.work_order.id);
      }
    } catch (err) {
      alert("Erro ao atualizar item do checklist.");
    }
  };

  // Publish Quote
  const handlePublishQuote = async () => {
    if (!selectedWo) return;
    const items = quoteItems.length > 0 ? quoteItems : [
      {
        description: "Revisão e Manutenção Geral Autorizada",
        part_code: "REV-GEN-01",
        quantity: 1,
        unit_price_part: 180,
        unit_price_service: 120,
        is_indivisible: 0,
        safety_risk_warning: null
      }
    ];

    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          publish_to_client: true,
          created_by: "Giovane Ribeiro"
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Orçamento publicado com sucesso! Link seguro do cliente: ${data.portal_url}`);
        loadWoDetails(selectedWo.work_order.id);
      }
    } catch (err) {
      alert("Erro ao publicar orçamento.");
    }
  };

  // Finish OS and Submit Exit Checklist
  const handleFinishExit = async () => {
    if (!selectedWo) return;
    try {
      const res = await fetch(`/api/work-orders/${selectedWo.work_order.id}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          road_test_ok: true,
          warning_lights_cleared: true,
          parts_returned: false,
          vehicle_cleaned: true,
          wheel_torque_checked: true,
          recommendations: "Reaperto de rodas após 50 km. Próxima troca de óleo em 10.000 km.",
          delivered_to_name: selectedWo.work_order.customer_name,
          final_status: "entregue"
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Checklist de saída aprovado e OS concluída com entrega registrada!");
        loadWoDetails(selectedWo.work_order.id);
        loadWorkOrders();
      }
    } catch (err) {
      alert("Erro ao finalizar OS.");
    }
  };

  return (
    <div className="min-h-screen bg-[#04070d] text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="border-b border-cyan-500/20 bg-[#060c18] px-4 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a href="/index.html" className="flex items-center gap-2 group">
            <span className="text-xl font-black tracking-tight text-white">
              G<span className="text-amber-400">-</span><span className="text-cyan-400">TECH</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              Oficina Paranaguá
            </span>
          </a>
          <span className="hidden sm:inline-block text-slate-600">|</span>
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-300">
            Painel Técnico & Gestão Operacional
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-[#0b1528] p-1 rounded-lg border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("quadro")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "quadro" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            📋 Ordens de Serviço ({workOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("agendamentos")}
            className={`px-3 py-1.5 rounded transition flex items-center gap-1.5 ${
              activeTab === "agendamentos" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            <span>⚡ Fila do Site</span>
            {appointments.filter(a => a.status === "pendente").length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                {appointments.filter(a => a.status === "pendente").length}
              </span>
            )}
          </button>
          {selectedWo && (
            <button
              type="button"
              onClick={() => setActiveTab("detalhes")}
              className={`px-3 py-1.5 rounded transition ${
                activeTab === "detalhes" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              🔧 OS {selectedWo.work_order.os_number}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("metricas")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "metricas" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            📊 Métricas & CSV
          </button>
        </div>

        {/* User profile badge & action */}
        <div className="flex items-center gap-2">
          <Link
            href="/3D-360"
            className="px-3 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 font-bold text-xs shadow transition flex items-center gap-1.5"
            target="_blank"
          >
            <span>🔍 Scanner 3D-360°</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setNewOsForm({
                customer_name: "",
                customer_phone: "",
                customer_document: "",
                vehicle_brand: "Renault",
                vehicle_model: "",
                vehicle_plate: "",
                vehicle_year: "2021",
                vehicle_km: "",
                vehicle_body_type: "suv",
                initial_scope: "Revisão geral e diagnóstico eletrônico",
                customer_complaint: "",
                appointment_id: ""
              });
              setShowNewOsModal(true);
            }}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/40 transition"
          >
            + Nova OS
          </button>
          <div className="hidden md:flex flex-col text-right text-[11px]">
            <span className="font-bold text-slate-200">Giovane Ribeiro</span>
            <span className="text-amber-400 text-[10px]">Diretor Técnico / Renault</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-7xl w-full mx-auto space-y-4">
        {/* TAB 1: QUADRO DE ORDENS DE SERVIÇO */}
        {activeTab === "quadro" && (
          <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#081122] p-3 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrar Status:</span>
                {[
                  { id: "todos", label: "Todos" },
                  { id: "aberta", label: "Abertas" },
                  { id: "inspecao", label: "Em Inspeção" },
                  { id: "aguardando_cliente", label: "Aguardando Cliente" },
                  { id: "aprovada", label: "Aprovadas" },
                  { id: "em_servico", label: "Em Serviço" },
                  { id: "entregue", label: "Entregues" }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                      statusFilter === f.id
                        ? "bg-cyan-500 text-slate-950 font-bold"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Buscar OS, cliente, placa..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Work Orders List Table */}
            <div className="bg-[#081122] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0b1528] text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">OS</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Veículo / Placa</th>
                      <th className="p-3">Carroceria</th>
                      <th className="p-3">Status Operacional</th>
                      <th className="p-3">Orçamento</th>
                      <th className="p-3">Mecânico</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {workOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          Nenhuma ordem de serviço encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      workOrders.map(wo => (
                        <tr
                          key={wo.id}
                          className="hover:bg-slate-900/50 transition cursor-pointer"
                          onClick={() => loadWoDetails(wo.id)}
                        >
                          <td className="p-3 font-mono font-bold text-cyan-400">{wo.os_number}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-200 block">{wo.customer_name}</span>
                            <span className="text-[11px] text-slate-400">{wo.customer_phone}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-200 block">{wo.vehicle_brand} {wo.vehicle_model}</span>
                            <span className="font-mono text-[11px] text-amber-400">{wo.vehicle_plate || "SEM PLACA"}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono uppercase text-slate-300">
                              {wo.vehicle_body_type}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              wo.status === "entregue" || wo.status === "finalizada"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : wo.status === "aprovada" || wo.status === "em_servico"
                                ? "bg-blue-950 text-blue-400 border border-blue-800"
                                : wo.status === "aguardando_cliente"
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}>
                              {wo.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-semibold">
                            {wo.quote_total > 0 ? (
                              <span className="text-slate-200">
                                R$ {Number(wo.quote_total).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Em elaboração</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">{wo.mechanic_name || "Giovane Ribeiro"}</td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadWoDetails(wo.id);
                              }}
                              className="px-2.5 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 text-xs font-semibold"
                            >
                              Abrir →
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FILA DE AGENDAMENTOS DO SITE */}
        {activeTab === "agendamentos" && (
          <div className="space-y-4">
            <div className="bg-[#081122] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  Agendamentos Recebidos pelo Site Oficial
                </h3>
                <p className="text-xs text-slate-400">
                  Solicitações de clientes com protocolo único gerado, aguardando recepção e conversão em OS.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAppointments}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                🔄 Atualizar Fila
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appointments.map(apt => (
                <div
                  key={apt.id}
                  className="bg-[#081122] p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-3 shadow-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-400">{apt.protocol}</span>
                      <h4 className="font-bold text-slate-100 text-sm mt-0.5">{apt.customer_name}</h4>
                      <span className="text-xs text-slate-400">{apt.customer_phone}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      apt.status === "convertido_os"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-amber-950 text-amber-400 border border-amber-800"
                    }`}>
                      {apt.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-xs space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Veículo:</span>
                      <strong className="text-white">{apt.vehicle_brand} {apt.vehicle_model} {apt.vehicle_plate ? `(${apt.vehicle_plate})` : ""}</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Agendado para:</span>
                      <strong className="text-amber-400">{apt.scheduled_date} às {apt.scheduled_time}</strong>
                    </div>
                    {apt.dashboard_alert && (
                      <div className="text-amber-300 font-medium text-[11px] pt-1">
                        ⚠️ Alerta no Painel: {apt.dashboard_alert}
                      </div>
                    )}
                    <div className="text-slate-400 text-[11px] pt-1 italic">
                      "{apt.issue_description}"
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {apt.status !== "convertido_os" ? (
                      <button
                        type="button"
                        onClick={() => handleConvertAppointment(apt)}
                        className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                      >
                        ⚡ Converter em OS na Oficina
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => apt.work_order_id && loadWoDetails(apt.work_order_id)}
                        className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        Ver Ordem de Serviço Vinculada →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DETALHES COMPLETOS DA OS SELECIONADA */}
        {activeTab === "detalhes" && selectedWo && (
          <div className="space-y-4">
            {/* Header of selected OS */}
            <div className="bg-[#081122] p-4 rounded-xl border border-cyan-500/30 flex flex-wrap justify-between items-center gap-4 shadow-xl">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xl font-black text-cyan-400">{selectedWo.work_order.os_number}</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                    selectedWo.work_order.status === "entregue"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-blue-950 text-cyan-300 border border-blue-800"
                  }`}>
                    {selectedWo.work_order.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-400">
                    Abertura: {selectedWo.work_order.created_at.slice(0, 16)}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-200 mt-1">
                  Cliente: <strong className="text-white">{selectedWo.work_order.customer_name}</strong> ({selectedWo.work_order.customer_phone}) | 
                  Veículo: <strong className="text-amber-400">{selectedWo.work_order.vehicle_brand} {selectedWo.work_order.vehicle_model} {selectedWo.work_order.vehicle_plate ? `(${selectedWo.work_order.vehicle_plate})` : ""}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/work-orders/${selectedWo.work_order.id}/pdf`}
                  target="_blank"
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 transition flex items-center gap-1.5"
                >
                  📄 Gerar PDF / Imprimir OS
                </a>
                {selectedWo.quotes && selectedWo.quotes.length > 0 && (
                  <a
                    href={`/cliente/${selectedWo.quotes[0].public_token}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
                  >
                    🔗 Portal do Cliente
                  </a>
                )}
              </div>
            </div>

            {/* Sub-Tabs for the Work Order Journey */}
            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2 text-xs font-semibold">
              {[
                { id: "inspecao3d", label: "🎯 Representação 3D & Avarias" },
                { id: "componentes", label: "🔧 Inspecionar Componentes & Peças Trocadas" },
                { id: "startmycar", label: "📖 Dados Técnicos & Fusíveis (StartMyCar)" },
                { id: "vistoria", label: "📸 Vistoria Fotográfica Entrada" },
                { id: "checklist", label: "📋 Checklist Técnico (10 Grupos)" },
                { id: "orcamento", label: "💰 Elaborador de Orçamento" },
                { id: "execucao", label: "⚙️ Execução Autorizada" },
                { id: "saida", label: "🏁 Saída & Controle de Qualidade" }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setOsSubTab(st.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    osSubTab === st.id
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "bg-[#0b1528] text-slate-400 hover:text-white"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab 1: 3D Vehicle Inspection */}
            {osSubTab === "inspecao3d" && (
              <div className="space-y-3">
                {/* Quick Model & Photo Switcher Toolbar */}
                <div className="bg-[#060c18] border border-cyan-500/30 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      <span>Veículo em Inspeção:</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-bold font-mono">
                      {selectedWo.work_order.vehicle_brand} {selectedWo.work_order.vehicle_model} ({selectedWo.work_order.vehicle_plate})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 text-[10px] font-mono">
                      📸 Foto Ref. 2D Ativa
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Alternar Ordem de Serviço:</span>
                    <select
                      value={selectedWo.work_order.id}
                      onChange={(e) => loadWoDetails(e.target.value)}
                      className="bg-[#0b1528] text-white border border-cyan-500/40 rounded-lg px-2.5 py-1 text-xs focus:border-cyan-400 focus:outline-none font-medium"
                    >
                      {workOrders.map((wo: any) => (
                        <option key={wo.id} value={wo.id}>
                          {wo.os_number} — {wo.vehicle_brand} {wo.vehicle_model} ({wo.vehicle_plate})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Vehicle3DViewer
                  bodyType={selectedWo.work_order.vehicle_body_type || "suv"}
                  hotspots={selectedWo.hotspots || []}
                  readOnly={false}
                  vehicleLabel={`${selectedWo.work_order.vehicle_brand} ${selectedWo.work_order.vehicle_model}`}
                  vehicleKey={`${selectedWo.work_order.vehicle_brand.toLowerCase()}_${selectedWo.work_order.vehicle_model.toLowerCase().replace(/[^a-z0-9_-]+/g, '_')}`}
                  brand={selectedWo.work_order.vehicle_brand}
                  model={selectedWo.work_order.vehicle_model}
                  generation={selectedWo.work_order.vehicle_generation || ""}
                  realPhotoUrl={techSpecs?.real_photo_url}
                  workOrderId={selectedWo.work_order.id}
                  replacedComponentIds={selectedWo.replaced_parts?.map((r: any) => r.component_id) || []}
                  onAddHotspot={handleAddHotspot}
                  onDeleteHotspot={handleDeleteHotspot}
                  onSaveInspection={async (payload) => {
                    await fetch(`/api/work-orders/${selectedWo.work_order.id}/components`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload)
                    });
                    loadWoDetails(selectedWo.work_order.id);
                  }}
                  onSaveReplacement={async (payload) => {
                    await fetch(`/api/work-orders/${selectedWo.work_order.id}/replacements`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload)
                    });
                    loadWoDetails(selectedWo.work_order.id);
                  }}
                />
              </div>
            )}

            {/* Sub-Tab: Inspeção de Componentes & Peças Trocadas */}
            {osSubTab === "componentes" && (
              <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-6">
                {/* Header with Metrics */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold uppercase">
                        Metrologia & Componentes
                      </span>
                      <h3 className="font-bold text-sm text-white">
                        Inspeção Dimensional & Registro de Peças Trocadas
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Controle individual de cada peça: medição com instrumentos, diagnóstico e comprovação de substituição com fotos antes/depois.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOsSubTab("inspecao3d")}
                      className="px-3 py-1.5 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
                    >
                      🎮 Abrir Visualizador 3D Explodido
                    </button>
                  </div>
                </div>

                {/* Section: Peças Trocadas com Selo Oficial ("PEÇA TROCADA") */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <span>✅ Peças Substituídas com Selo Oficial ("PEÇA TROCADA")</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                        {selectedWo.replaced_parts?.length || 0} registradas
                      </span>
                    </h4>
                  </div>

                  {selectedWo.replaced_parts && selectedWo.replaced_parts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedWo.replaced_parts.map((r: any) => (
                        <div key={r.id} className="p-4 rounded-xl bg-[#0b1528] border border-emerald-500/40 space-y-3 text-xs shadow-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <strong className="text-sm text-white block">{r.component_name}</strong>
                              <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">{r.assembly_path}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] tracking-wide shrink-0">
                              ✅ {r.seal_status}
                            </span>
                          </div>

                          <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded border border-slate-800 text-[11px]">
                            <div>
                              <span className="text-slate-400 font-semibold">Peça Retirada: </span>
                              <span className="text-slate-300">{r.removed_part_desc}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold">Peça Nova Instalada: </span>
                              <span className="text-emerald-300 font-semibold">{r.installed_part_desc}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                              <span>Técnico: <strong className="text-slate-200">{r.technician_name}</strong></span>
                              <span className="text-emerald-400 font-semibold">{r.warranty_terms}</span>
                            </div>
                          </div>

                          {(r.photo_before_url || r.photo_after_url) && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {r.photo_before_url && (
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-red-400 block mb-1">📸 Antes (Retirada)</span>
                                  <img src={r.photo_before_url} alt="Antes" className="w-full h-24 object-cover rounded border border-red-950/60" />
                                </div>
                              )}
                              {r.photo_after_url && (
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-emerald-400 block mb-1">📸 Depois (Nova)</span>
                                  <img src={r.photo_after_url} alt="Depois" className="w-full h-24 object-cover rounded border border-emerald-950/60" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
                      Nenhuma peça trocada registrada ainda nesta OS. Na aba <strong>"Execução Autorizada"</strong>, clique em <strong>"Registrar Substituição"</strong> ao concluir o serviço.
                    </div>
                  )}
                </div>

                {/* Section: Árvore & Tabela de Componentes com Filtros */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <h4 className="font-bold text-xs text-cyan-400 uppercase tracking-wider">
                      📋 Catálogo & Árvore de Componentes Inspecionáveis
                    </h4>

                    {/* Filter controls */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <select
                        value={compSystemFilter}
                        onChange={e => {
                          setCompSystemFilter(e.target.value);
                          setTimeout(reloadComponents, 50);
                        }}
                        className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
                      >
                        <option value="todos">Todos os Sistemas</option>
                        <option value="propulsao">Propulsão e Motor</option>
                        <option value="transmissao">Transmissão e Tração</option>
                        <option value="rodagem">Rodagem, Freios & Direção</option>
                        <option value="eletrica">Elétrica e Eletrônica</option>
                        <option value="carroceria">Carroceria e Conforto</option>
                        <option value="hibrido">Elétricos e Híbridos</option>
                      </select>

                      <select
                        value={compStatusFilter}
                        onChange={e => {
                          setCompStatusFilter(e.target.value);
                          setTimeout(reloadComponents, 50);
                        }}
                        className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
                      >
                        <option value="todos">Todos os Status</option>
                        <option value="ok">Apenas OK</option>
                        <option value="atencao">Apenas Atenção</option>
                        <option value="critico">Apenas Crítico</option>
                        <option value="nao_inspecionado">Não Inspecionados</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Buscar componente ou código OEM..."
                        value={compSearch}
                        onChange={e => {
                          setCompSearch(e.target.value);
                          setTimeout(reloadComponents, 100);
                        }}
                        className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs w-52"
                      />
                    </div>
                  </div>

                  {/* Components Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0b1528] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="p-3">Componente / Conjunto</th>
                          <th className="p-3">Sistema / Eixo</th>
                          <th className="p-3">Medição & Ensaio</th>
                          <th className="p-3">Status da Inspeção</th>
                          <th className="p-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                        {componentsList.length > 0 ? (
                          componentsList.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-900/50 transition">
                              <td className="p-3">
                                <strong className="text-white block">{c.component_name}</strong>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {c.assembly_name} {c.oem_code ? `(OEM: ${c.oem_code})` : ""}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="capitalize block text-slate-300">{c.system_group}</span>
                                <span className="text-[10px] text-slate-500 capitalize">{c.position_side} • {c.axle}</span>
                              </td>
                              <td className="p-3">
                                {c.measurement_value ? (
                                  <div>
                                    <span className="font-mono text-cyan-300 font-semibold block">{c.measurement_value}</span>
                                    <span className="text-[10px] text-slate-500">{c.tolerance_spec || c.test_performed}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-[11px] italic">Pendente de medição</span>
                                )}
                              </td>
                              <td className="p-3">
                                {c.seal_status ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px]">
                                    ✅ PEÇA TROCADA
                                  </span>
                                ) : c.inspection_status === "critico" ? (
                                  <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold text-[10px]">
                                    ⛔ CRÍTICO
                                  </span>
                                ) : c.inspection_status === "atencao" ? (
                                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold text-[10px]">
                                    ⚠️ ATENÇÃO
                                  </span>
                                ) : c.inspection_status === "ok" ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">
                                    ✅ OK
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-bold text-[10px]">
                                    ⏳ PENDENTE
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCompModal(c)}
                                  className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[11px] font-semibold transition"
                                >
                                  Inspecionar / Editar
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-500">
                              Nenhum componente encontrado para os filtros selecionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab: Dados Técnicos, Fusíveis & StartMyCar */}
            {osSubTab === "startmycar" && (
              <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-5">
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold uppercase">
                        StartMyCar Tech Intelligence
                      </span>
                      <h3 className="font-bold text-sm text-white">
                        {techSpecs?.brand || selectedWo.work_order.vehicle_brand} {techSpecs?.model || selectedWo.work_order.vehicle_model}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Motor: <strong className="text-amber-400">{techSpecs?.engine || "Padrão de Fábrica"}</strong> | Anos de Referência: {techSpecs?.years || "2015-2024"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddOilToQuote}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
                  >
                    <span>➕ Importar Óleo Recomendado p/ Orçamento</span>
                  </button>
                </div>

                {/* Foto Real de Referência e Capacidades de Fluidos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Card Foto Real */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">
                      📸 Fotografia Real do Veículo
                    </span>
                    <img
                      src={techSpecs?.real_photo_url || "/img/vehicles/suv-real.jpg"}
                      alt="Foto Real"
                      className="max-h-40 w-auto object-contain rounded-lg border border-slate-800 shadow-md"
                    />
                    <span className="text-xs font-semibold text-slate-300 mt-2">
                      {selectedWo.work_order.vehicle_brand} {selectedWo.work_order.vehicle_model}
                    </span>
                  </div>

                  {/* 4 Cards de Especificação Técnica */}
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Óleo do Motor Homologado</span>
                      <span className="text-sm font-bold text-amber-400 font-mono block">
                        {techSpecs?.oil_viscosity || "5W40 100% Sintético"}
                      </span>
                      <span className="text-slate-300 block">
                        Volume: <strong>{techSpecs?.oil_capacity_liters || 4.8} Litros</strong> (com filtro)
                      </span>
                      <span className="text-[11px] text-slate-500 block">Norma: {techSpecs?.oil_norm || "RN0710"}</span>
                    </div>

                    <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Sistema de Arrefecimento</span>
                      <span className="text-sm font-bold text-cyan-400 font-mono block">
                        {techSpecs?.coolant_type || "Aditivo Orgânico Tipo D"}
                      </span>
                      <span className="text-slate-300 block">
                        Volume Total: <strong>{techSpecs?.coolant_capacity_liters || 6.0} Litros</strong>
                      </span>
                      <span className="text-[11px] text-slate-500 block">Fluido de Freio: {techSpecs?.brake_fluid || "DOT 4"}</span>
                    </div>

                    <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Pressão dos Pneus (PSI)</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono block">
                        {techSpecs?.tire_pressure_front_psi || 29} Dianteiro / {techSpecs?.tire_pressure_rear_psi || 29} Traseiro
                      </span>
                      <span className="text-slate-300 block">
                        Com Carga Total: <strong>{techSpecs?.tire_pressure_loaded_psi || 32} PSI</strong>
                      </span>
                      <span className="text-[11px] text-slate-500 block">Gap das Velas: {techSpecs?.spark_plugs_gap_mm || 0.9} mm</span>
                    </div>

                    <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Diagnóstico Elétrico</span>
                      <span className="text-sm font-bold text-slate-200 font-mono block">
                        Rede CAN / LIN Multiplexada
                      </span>
                      <span className="text-slate-300 block">
                        Caixas de Fusíveis Mapeadas: <strong>Motor & Cabine</strong>
                      </span>
                      <span className="text-[11px] text-slate-500 block">Padrão Concessionária Renault</span>
                    </div>
                  </div>
                </div>

                {/* Diagrama Interativo de Caixa de Fusíveis (StartMyCar) */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-400">
                        ⚡ Diagrama de Caixas de Fusíveis & Relés (StartMyCar)
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Localize o fusível exato por circuito, amperagem e localização.
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder="Buscar circuito (ex: bomba, ventoinha, freio, injeção)..."
                      value={fuseSearch}
                      onChange={e => setFuseSearch(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none w-full sm:w-64"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Fusíveis do Cofre do Motor */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide block">
                        Cofre do Motor (Under-hood Panel)
                      </span>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {(techSpecs?.fuse_box_engine || [])
                          .filter((f: any) =>
                            !fuseSearch ||
                            f.desc.toLowerCase().includes(fuseSearch.toLowerCase()) ||
                            f.fuse.toLowerCase().includes(fuseSearch.toLowerCase())
                          )
                          .map((f: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded text-slate-950"
                                  style={{ backgroundColor: f.color || "#00c6ff" }}
                                >
                                  {f.fuse} ({f.amp})
                                </span>
                                <span className="text-slate-200">{f.desc}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Fusíveis da Cabine / Painel */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide block">
                        Cabine / Painel (Interior Fuse Box)
                      </span>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {(techSpecs?.fuse_box_cabin || [])
                          .filter((f: any) =>
                            !fuseSearch ||
                            f.desc.toLowerCase().includes(fuseSearch.toLowerCase()) ||
                            f.fuse.toLowerCase().includes(fuseSearch.toLowerCase())
                          )
                          .map((f: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded text-slate-950"
                                  style={{ backgroundColor: f.color || "#00c6ff" }}
                                >
                                  {f.fuse} ({f.amp})
                                </span>
                                <span className="text-slate-200">{f.desc}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Base de Problemas Comuns (StartMyCar) */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    🔍 Problemas Crônicos Recorrentes & Procedimento de Bancada
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(techSpecs?.common_issues || []).map((ci: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                        <span className="font-bold text-amber-300 block">Sintoma: {ci.symptom}</span>
                        <p className="text-slate-400 text-[11px]">
                          <strong>Causa:</strong> {ci.cause}
                        </p>
                        <p className="text-emerald-400 text-[11px]">
                          <strong>Procedimento:</strong> {ci.procedure}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Vistoria Fotográfica de Entrada */}
            {osSubTab === "vistoria" && (
              <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">
                  Vistoria Fotográfica Padronizada de Entrada
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                    <span className="text-xs font-semibold text-slate-300 block mb-2">Vista Dianteira</span>
                    <div className="h-28 bg-slate-950 rounded flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-700">
                      {selectedWo.intake?.photo_front ? "Foto Anexada" : "Frente OK"}
                    </div>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                    <span className="text-xs font-semibold text-slate-300 block mb-2">Vista Traseira</span>
                    <div className="h-28 bg-slate-950 rounded flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-700">
                      {selectedWo.intake?.photo_rear ? "Foto Anexada" : "Traseira OK"}
                    </div>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                    <span className="text-xs font-semibold text-slate-300 block mb-2">Lateral Esquerda</span>
                    <div className="h-28 bg-slate-950 rounded flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-700">
                      {selectedWo.intake?.photo_left ? "Foto Anexada" : "Lateral Esq. OK"}
                    </div>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                    <span className="text-xs font-semibold text-slate-300 block mb-2">Lateral Direita</span>
                    <div className="h-28 bg-slate-950 rounded flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-700">
                      {selectedWo.intake?.photo_right ? "Foto Anexada" : "Lateral Dir. OK"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block font-semibold">Odômetro de Entrada</span>
                    <span className="text-lg font-mono font-bold text-white">
                      {selectedWo.intake?.odometer_km ? `${selectedWo.intake.odometer_km} km` : "Não registrado"}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block font-semibold">Nível de Combustível</span>
                    <span className="text-lg font-mono font-bold text-amber-400">
                      {selectedWo.intake?.fuel_pct || 50}% do Tanque
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block font-semibold">Ciência do Cliente</span>
                    <span className="text-sm font-semibold text-emerald-400 block mt-1">
                      {selectedWo.intake?.client_acknowledged ? "✅ Termo Aceito no Agendamento" : "⚠️ Registro pela Recepção"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Checklist Inteligente de 10 Grupos */}
            {osSubTab === "checklist" && (
              <div className="space-y-4">
                <div className="bg-[#081122] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">
                      Checklist Técnico Padronizado (10 Grupos)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Classificação técnica com obrigatoriedade de evidência para não conformidades.
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">● OK</span>
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">● ATENÇÃO</span>
                    <span className="flex items-center gap-1 text-red-400 font-semibold">● CRÍTICO</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedWo.checklist_groups || {}).map(([group, items]: [string, any]) => (
                    <div key={group} className="bg-[#081122] p-4 rounded-xl border border-slate-800 space-y-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                        <span>{group}</span>
                        <span className="text-[10px] text-slate-500 font-normal">{items.length} itens</span>
                      </h4>

                      <div className="space-y-2">
                        {items.map((item: any) => (
                          <div key={item.id} className="p-2 rounded bg-slate-900/60 border border-slate-800/80 text-xs space-y-1.5">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-medium text-slate-200">{item.item_name}</span>
                              <div className="flex gap-1 shrink-0">
                                {["OK", "ATENCAO", "CRITICO", "NA"].map(st => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleUpdateChecklistItem(item, st)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                                      item.status === st
                                        ? st === "OK" ? "bg-emerald-600 text-white" :
                                          st === "ATENCAO" ? "bg-amber-500 text-slate-950 font-bold" :
                                          st === "CRITICO" ? "bg-red-600 text-white font-bold" : "bg-slate-700 text-slate-200"
                                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {item.finding_description && (
                              <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-[11px] text-amber-300">
                                <strong>Achado:</strong> {item.finding_description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Tab 4: Elaborador de Orçamento */}
            {osSubTab === "orcamento" && (
              <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">
                      Orçamentos & Itens Técnicos
                    </h3>
                    <p className="text-xs text-slate-400">
                      Separação transparente de peças e mão de obra, alertas de segurança e links auditáveis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePublishQuote}
                    className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                  >
                    🚀 Publicar Orçamento e Enviar Link
                  </button>
                </div>

                {/* Existing Quotes */}
                {selectedWo.quotes && selectedWo.quotes.length > 0 && (
                  <div className="space-y-3">
                    {selectedWo.quotes.map((q: any) => (
                      <div key={q.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-200">Versão v{q.version_number}</span>
                            <span className="ml-2 text-slate-500">Status: <strong className="text-cyan-400">{q.status.toUpperCase()}</strong></span>
                          </div>
                          <span className="font-mono font-bold text-sm text-emerald-400">
                            Total: R$ {Number(q.total_amount).toFixed(2)}
                          </span>
                        </div>

                        <div className="divide-y divide-slate-800 text-xs">
                          {(q.items || []).map((it: any) => (
                            <div key={it.id} className="py-2 flex justify-between items-center gap-3">
                              <div>
                                <span className="font-semibold text-slate-200 block">{it.description}</span>
                                {it.safety_risk_warning && (
                                  <span className="text-[11px] text-red-400 font-medium">⚠️ Risco de Segurança: {it.safety_risk_warning}</span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono text-slate-300 block">R$ {Number(it.subtotal).toFixed(2)}</span>
                                <span className={`text-[10px] uppercase font-bold ${
                                  it.decision === "aprovado" ? "text-emerald-400" : it.decision === "recusado" ? "text-red-400" : "text-amber-400"
                                }`}>
                                  {it.decision}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 5: Execução Autorizada */}
            {osSubTab === "execucao" && (
              <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">
                  Controle de Execução & Itens Autorizados pelo Cliente
                </h3>
                <p className="text-xs text-slate-400">
                  Bloqueio operacional: O mecânico só deve aplicar peças e executar serviços explicitamente autorizados no portal.
                </p>

                {selectedWo.quotes && selectedWo.quotes[0] ? (
                  <div className="space-y-3">
                    {(selectedWo.quotes[0].items || []).map((it: any) => (
                      <div
                        key={it.id}
                        className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                          it.decision === "aprovado"
                            ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-200"
                            : it.decision === "recusado"
                            ? "bg-red-950/40 border-red-800/80 text-red-300"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{it.description}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40">
                              {it.part_code || "MÃO DE OBRA"}
                            </span>
                          </div>
                          {it.decision === "recusado" && (
                            <span className="text-[11px] text-red-400 block mt-1">
                              ⛔ SERVIÇO RECUSADO PELO CLIENTE — NÃO EXECUTAR.
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase px-2 py-1 rounded bg-black/50">
                            {it.decision === "aprovado" ? "✅ AUTORIZADO" : it.decision === "recusado" ? "❌ RECUSADO" : "⏳ PENDENTE"}
                          </span>
                          {it.decision === "aprovado" && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplacementModalItem(it);
                                setModalReplRemoved(`Peça original desgastada referente ao item "${it.description}".`);
                                setModalReplInstalled(`${it.description} nova de primeira linha com nota fiscal e garantia.`);
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition flex items-center gap-1"
                            >
                              🛠️ Registrar Substituição
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Nenhum orçamento emitido para esta OS.</p>
                )}

                {/* Modal de Registro de Substituição em Item Autorizado */}
                {replacementModalItem && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
                    <form
                      onSubmit={handleExecuteReplacement}
                      className="bg-[#0b1528] border border-emerald-500/50 rounded-xl p-5 max-w-md w-full shadow-2xl text-slate-200 space-y-4"
                    >
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                            Selo Oficial de Execução
                          </span>
                          <h3 className="font-bold text-sm text-white">
                            Substituição: {replacementModalItem.description}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplacementModalItem(null)}
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
                            value={modalReplRemoved}
                            onChange={e => setModalReplRemoved(e.target.value)}
                            placeholder="Descreva a condição da peça retirada..."
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Peça Instalada Nova (Aplicação e Marca) *</label>
                          <textarea
                            required
                            rows={2}
                            value={modalReplInstalled}
                            onChange={e => setModalReplInstalled(e.target.value)}
                            placeholder="Descreva a peça nova, marca, código e garantia..."
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Foto Antes (Retirada)</label>
                            <input
                              type="text"
                              value={modalReplBefore}
                              onChange={e => setModalReplBefore(e.target.value)}
                              placeholder="/img/... ou link"
                              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Foto Depois (Instalada)</label>
                            <input
                              type="text"
                              value={modalReplAfter}
                              onChange={e => setModalReplAfter(e.target.value)}
                              placeholder="/img/... ou link"
                              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setReplacementModalItem(null)}
                          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                        >
                          Cancelar
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
              </div>
            )}

            {/* Sub-Tab 6: Saída & Controle de Qualidade */}
            {osSubTab === "saida" && (
              <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">
                      Checklist de Saída & Entrega Técnica
                    </h3>
                    <p className="text-xs text-slate-400">
                      Garantia técnica de qualidade antes da liberação das chaves ao proprietário.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFinishExit}
                    className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                  >
                    🏁 Concluir e Entregar Veículo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2.5 p-3 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-cyan-400" />
                    <span>Teste de Rodagem Concluído com Sucesso</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-cyan-400" />
                    <span>Luzes de Advertência Apagadas / Scanner Zerado</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-cyan-400" />
                    <span>Torque das Rodas Verificado com Torquímetro</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-cyan-400" />
                    <span>Higienização e Limpeza Básica Concluída</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MÉTRICAS & EXPORTAÇÃO CSV */}
        {activeTab === "metricas" && (
          <div className="space-y-4">
            <div className="bg-[#081122] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-white">Indicadores da Oficina G-Tech</h3>
                <p className="text-xs text-slate-400">Acompanhamento de conversão, orçamentos e volume de serviços.</p>
              </div>
              <a
                href="/api/dashboard/metrics?export=csv"
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition"
              >
                📥 Exportar Ordens de Serviço em CSV
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#081122] p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total de Ordens de Serviço</span>
                <span className="text-2xl font-bold font-mono text-cyan-400 block mt-1">
                  {metrics?.total_work_orders || 0}
                </span>
                <span className="text-[11px] text-slate-500">{metrics?.active_work_orders || 0} em andamento</span>
              </div>
              <div className="bg-[#081122] p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold uppercase">Conversão de Agendamentos</span>
                <span className="text-2xl font-bold font-mono text-amber-400 block mt-1">
                  {metrics?.conversion_rate_pct || "0.0"}%
                </span>
                <span className="text-[11px] text-slate-500">{metrics?.converted_appointments || 0} de {metrics?.total_appointments || 0} agendamentos</span>
              </div>
              <div className="bg-[#081122] p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold uppercase">Faturamento Autorizado</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 block mt-1">
                  R$ {Number(metrics?.quotes?.total_authorized_brl || 0).toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-500">De R$ {Number(metrics?.quotes?.total_budgeted_brl || 0).toFixed(2)} orçados</span>
              </div>
              <div className="bg-[#081122] p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold uppercase">Cobertura 3D do Catálogo</span>
                <span className="text-2xl font-bold font-mono text-cyan-300 block mt-1">
                  100%
                </span>
                <span className="text-[11px] text-slate-500">5 carrocerias / 52 modelos homologados</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL NOVA OS */}
      {showNewOsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateOs}
            className="bg-[#0b1528] border border-cyan-500/30 rounded-xl p-5 max-w-lg w-full shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-cyan-400">Abertura de Ordem de Serviço</h3>
              <button
                type="button"
                onClick={() => setShowNewOsModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nome do Cliente *</label>
                  <input
                    required
                    type="text"
                    value={newOsForm.customer_name}
                    onChange={e => setNewOsForm({ ...newOsForm, customer_name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">WhatsApp / Telefone *</label>
                  <input
                    required
                    type="text"
                    value={newOsForm.customer_phone}
                    onChange={e => setNewOsForm({ ...newOsForm, customer_phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Marca *</label>
                  <select
                    value={newOsForm.vehicle_brand}
                    onChange={e => {
                      const brand = e.target.value;
                      const rec = recognizeVehicle(brand, newOsForm.vehicle_model);
                      setNewOsForm({
                        ...newOsForm,
                        vehicle_brand: brand,
                        vehicle_body_type: rec.isVolkswagen ? rec.bodyType : newOsForm.vehicle_body_type
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="Renault">Renault</option>
                    <option value="Volkswagen">Volkswagen (51 Modelos)</option>
                    <option value="Chevrolet">Chevrolet</option>
                    <option value="Fiat">Fiat</option>
                    <option value="Ford">Ford</option>
                    <option value="Hyundai">Hyundai</option>
                    <option value="Toyota">Toyota</option>
                    <option value="Honda">Honda</option>
                    <option value="Jeep">Jeep</option>
                    <option value="Peugeot">Peugeot</option>
                    <option value="Citroën">Citroën</option>
                    <option value="Nissan">Nissan</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Modelo *</label>
                  <input
                    required
                    type="text"
                    value={newOsForm.vehicle_model}
                    onChange={e => {
                      const model = e.target.value;
                      const rec = recognizeVehicle(newOsForm.vehicle_brand, model);
                      setNewOsForm({
                        ...newOsForm,
                        vehicle_model: model,
                        vehicle_body_type: rec.isVolkswagen ? rec.bodyType : newOsForm.vehicle_body_type
                      });
                    }}
                    placeholder="Ex: Golf GTI, Jetta, Duster..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Carroceria 3D *</label>
                  <select
                    value={newOsForm.vehicle_body_type}
                    onChange={e => setNewOsForm({ ...newOsForm, vehicle_body_type: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="hatch">Hatch</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="picape">Picape</option>
                    <option value="van">Van</option>
                  </select>
                </div>
              </div>

              {/* Indicador de Reconhecimento Inteligente VW */}
              {(() => {
                const rec = recognizeVehicle(newOsForm.vehicle_brand, newOsForm.vehicle_model);
                if (rec.isVolkswagen && rec.matchedModel) {
                  return (
                    <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-between gap-2 text-emerald-300">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚗</span>
                        <div>
                          <strong className="block text-white text-[11px]">
                            Veículo Reconhecido pela Oficina: {rec.matchedModel.name}
                          </strong>
                          <span className="text-[10px] text-emerald-400">
                            {rec.matchedModel.generation} • Carroceria: {rec.bodyType.toUpperCase()} • Foto Real Vinculada
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/3D-360`}
                        target="_blank"
                        className="text-[10px] text-cyan-300 underline font-bold hover:text-white"
                      >
                        Abrir no 3D-360° ↗
                      </Link>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Placa do Veículo</label>
                  <input
                    type="text"
                    value={newOsForm.vehicle_plate}
                    onChange={e => setNewOsForm({ ...newOsForm, vehicle_plate: e.target.value.toUpperCase() })}
                    placeholder="ABC-1D23"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Km de Entrada</label>
                  <input
                    type="number"
                    value={newOsForm.vehicle_km}
                    onChange={e => setNewOsForm({ ...newOsForm, vehicle_km: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Queixa / Sintoma do Cliente *</label>
                <textarea
                  required
                  rows={3}
                  value={newOsForm.customer_complaint}
                  onChange={e => setNewOsForm({ ...newOsForm, customer_complaint: e.target.value })}
                  placeholder="Relato do cliente, barulhos, luzes de painel ou revisão preventiva..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewOsModal(false)}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
              >
                Abrir Ordem de Serviço
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDIÇÃO DE COMPONENTE NA TABELA */}
      {selectedCompModal && selectedWoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              const payload = {
                component_id: selectedCompModal.id,
                status: form.status.value,
                test_performed: form.test_performed.value,
                measurement_value: form.measurement_value.value,
                tolerance_spec: form.tolerance_spec.value,
                finding_description: form.finding_description.value,
                priority: form.priority.value,
                photo_url: form.photo_url.value || null,
                suggested_repair: form.suggested_repair.value || null,
                suggested_part_price: Number(form.suggested_part_price.value) || 0,
                suggested_service_price: Number(form.suggested_service_price.value) || 0,
                inspected_by: "Giovane Ribeiro"
              };

              await fetch(`/api/work-orders/${selectedWoId}/components`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });

              alert(`Inspeção de "${selectedCompModal.component_name}" salva com sucesso!`);
              setSelectedCompModal(null);
              loadWoDetails(selectedWoId);
            }}
            className="bg-[#0b1528] border border-cyan-500/40 rounded-xl p-5 max-w-lg w-full shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-cyan-400">{selectedCompModal.component_name}</h3>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {selectedCompModal.assembly_name} ({selectedCompModal.system_group})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCompModal(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={selectedCompModal.inspection_status || "ok"}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-semibold"
                  >
                    <option value="ok">✅ OK (Conforme)</option>
                    <option value="atencao">⚠️ Atenção (Desgaste)</option>
                    <option value="critico">⛔ Crítico (Risco Segurança)</option>
                    <option value="nao_inspecionado">⏳ Não Inspecionado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Prioridade</label>
                  <select
                    name="priority"
                    defaultValue={selectedCompModal.priority || "normal"}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
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
                    name="measurement_value"
                    defaultValue={selectedCompModal.measurement_value || ""}
                    placeholder="Ex: 2.8 mm de folga"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tolerância da Montadora</label>
                  <input
                    name="tolerance_spec"
                    defaultValue={selectedCompModal.tolerance_spec || ""}
                    placeholder="Ex: Máx 1.0 mm"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Ensaio / Teste Realizado</label>
                <input
                  name="test_performed"
                  defaultValue={selectedCompModal.test_performed || "Inspeção dimensional com relógio comparador"}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Achado Técnico</label>
                <textarea
                  name="finding_description"
                  rows={2}
                  defaultValue={selectedCompModal.finding_description || ""}
                  placeholder="Descreva o achado técnico detalhado..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="p-3 bg-[#060c18] rounded-lg border border-slate-800 space-y-2">
                <span className="font-bold text-cyan-400 block">💡 Sugerir Reparo p/ Orçamento</span>
                <input
                  name="suggested_repair"
                  defaultValue={selectedCompModal.suggested_repair || ""}
                  placeholder="Descrição da peça ou serviço sugerido..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[10px]">Preço Peça (R$)</label>
                    <input
                      name="suggested_part_price"
                      type="number"
                      defaultValue={selectedCompModal.suggested_part_price || 0}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px]">Preço Mão de Obra (R$)</label>
                    <input
                      name="suggested_service_price"
                      type="number"
                      defaultValue={selectedCompModal.suggested_service_price || 0}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Foto da Inspeção (URL)</label>
                <input
                  name="photo_url"
                  defaultValue={selectedCompModal.inspection_photo || ""}
                  placeholder="/img/... ou link"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCompModal(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-lg transition"
              >
                Salvar Inspeção do Componente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

