"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Vehicle3DViewer from "@/components/Vehicle3DViewer";

export default function ClientePortalPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Customer decisions map: { [itemId]: { decision: 'aprovado' | 'recusado' | 'esclarecimento', reason?: string } }
  const [decisions, setDecisions] = useState<Record<string, { decision: string; reason?: string }>>({});

  // Critical risk disclaimer modal
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [pendingRefusalItem, setPendingRefusalItem] = useState<any | null>(null);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);

  // Submission state
  const [clientName, setClientName] = useState("");
  const [clientDoc, setClientDoc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  const fetchQuote = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/portal/${token}`);
      const json = await res.json();
      if (json.success) {
        setData(json.quote);
        setClientName(json.quote.customer?.name || "");

        // Pre-fill decisions from existing or default to 'aprovado'
        const initial: Record<string, { decision: string; reason?: string }> = {};
        (json.quote.items || []).forEach((it: any) => {
          initial[it.id] = {
            decision: it.decision === "recusado" ? "recusado" : "aprovado",
            reason: it.refusal_reason || ""
          };
        });
        setDecisions(initial);

        if (json.quote.existing_decision) {
          setReceipt({
            protocol: json.quote.existing_decision.receipt_protocol,
            hash: json.quote.existing_decision.audit_hash,
            action: json.quote.existing_decision.action,
            authorized: json.quote.existing_decision.authorized_amount,
            refused: json.quote.existing_decision.refused_amount
          });
        }
      } else {
        setError(json.error || "Orçamento não encontrado.");
      }
    } catch (err: any) {
      setError("Erro ao carregar o orçamento. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [token]);

  // Handle decision change
  const handleSetDecision = (item: any, dec: "aprovado" | "recusado" | "esclarecimento") => {
    if (dec === "recusado" && item.safety_risk_warning) {
      // Trigger critical safety risk modal
      setPendingRefusalItem(item);
      setShowRiskModal(true);
      return;
    }

    setDecisions(prev => ({
      ...prev,
      [item.id]: { decision: dec, reason: "" }
    }));
  };

  const confirmCriticalRefusal = () => {
    if (!pendingRefusalItem) return;
    setDecisions(prev => ({
      ...prev,
      [pendingRefusalItem.id]: {
        decision: "recusado",
        reason: "Cliente ciente do risco operacional manifestou recusa do item de segurança."
      }
    }));
    setRiskAcknowledged(true);
    setShowRiskModal(false);
    setPendingRefusalItem(null);
  };

  // Calculations
  const items = data?.items || [];
  let totalApproved = 0;
  let totalRefused = 0;

  items.forEach((it: any) => {
    const dec = decisions[it.id]?.decision || "aprovado";
    if (dec === "aprovado") {
      totalApproved += Number(it.subtotal);
    } else if (dec === "recusado") {
      totalRefused += Number(it.subtotal);
    }
  });

  // Submit Final Decision
  const handleSubmitDecision = async () => {
    if (!clientName.trim()) {
      alert("Por favor, confirme seu nome para assinatura do protocolo.");
      return;
    }

    setSubmitting(true);
    try {
      const decisionList = items.map((it: any) => ({
        item_id: it.id,
        decision: decisions[it.id]?.decision || "aprovado",
        refusal_reason: decisions[it.id]?.reason || null
      }));

      const res = await fetch(`/api/portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_document: clientDoc.trim() || null,
          refusal_risk_acknowledged: riskAcknowledged,
          risk_acknowledgement_text: riskAcknowledged ? "Cliente declarou ciência explícita de risco sobre componentes críticos recusados." : null,
          decisions: decisionList
        })
      });

      const json = await res.json();
      if (json.success) {
        setReceipt({
          protocol: json.receipt_protocol,
          hash: json.audit_hash,
          action: json.overall_action,
          authorized: json.authorized_amount,
          refused: json.refused_amount
        });
      } else {
        alert(json.error || "Erro ao processar sua decisão.");
      }
    } catch (err) {
      alert("Erro ao conectar ao servidor da oficina.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04070d] flex flex-col items-center justify-center p-4 text-slate-200 font-sans">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold">Carregando vistoria e orçamento da G-Tech...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#04070d] flex flex-col items-center justify-center p-4 text-slate-200 font-sans">
        <div className="bg-[#0b1528] border border-red-500/30 p-6 rounded-xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-lg font-bold text-red-400">Orçamento não localizado</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || "O link acessado é inválido ou já foi encerrado. Entre em contato diretamente com a oficina."}
          </p>
          <a
            href="https://wa.me/554196522715"
            target="_blank"
            className="inline-block px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            Falar com Giovane no WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04070d] text-slate-100 flex flex-col font-sans pb-12">
      {/* Header with Official G-Tech identity */}
      <header className="border-b border-cyan-500/20 bg-[#060c18] px-4 py-3 sticky top-0 z-30 shadow-xl backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xl font-black text-white">
              G<span className="text-amber-400">-</span><span className="text-cyan-400">TECH</span>
            </span>
            <span className="block text-[10px] text-slate-400 font-medium">
              Serviços Automotivos • Paranaguá–PR
            </span>
          </div>

          <div className="text-right">
            <span className="font-mono text-xs font-bold text-cyan-400 block">{data.os_number}</span>
            <span className="text-[10px] text-slate-400">Orçamento Oficial</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto p-4 space-y-6">
        {/* Receipt confirmation seal if decision already submitted */}
        {receipt && (
          <div className="bg-emerald-950/40 border border-emerald-600/50 p-4 rounded-xl text-slate-200 space-y-2 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-xl font-bold">✅</span>
              <div>
                <h3 className="font-bold text-sm text-emerald-300">Decisão Gravada com Sucesso no Sistema</h3>
                <span className="font-mono text-xs text-slate-300">Protocolo de Confirmação: <strong>{receipt.protocol}</strong></span>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Valor Autorizado: <strong className="text-emerald-400 font-mono">R$ {Number(receipt.authorized).toFixed(2)}</strong> | 
              Recusado: <strong className="text-red-400 font-mono">R$ {Number(receipt.refused).toFixed(2)}</strong>
            </p>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-950/70 p-2 rounded border border-slate-800 break-all">
              🔒 <strong>Hash de Auditoria SHA-256:</strong> {receipt.hash}
            </div>
          </div>
        )}

        {/* Vehicle Header Card */}
        <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-2 shadow-xl">
          <div className="flex flex-wrap justify-between items-start gap-2">
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Veículo Avaliado</span>
              <h2 className="text-lg font-bold text-white">
                {data.vehicle?.brand} {data.vehicle?.model} {data.vehicle?.year ? `(${data.vehicle.year})` : ""}
              </h2>
              <span className="font-mono text-xs text-amber-400">
                Placa: {data.vehicle?.plate || "Sem placa declarada"} | Km: {data.vehicle?.km || "N/D"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Proprietário</span>
              <strong className="text-white text-sm">{data.customer?.name}</strong>
            </div>
          </div>
        </div>

        {/* 3D Vehicle Interactive Viewer & Inspection Findings */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Vistoria 3D & Achados Técnicos do Veículo
            </h3>
            <div className="flex items-center gap-2">
              {data.replaced_parts && data.replaced_parts.length > 0 && (
                <a
                  href="#pecas-trocadas"
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1 transition"
                >
                  🔍 Ver Peças Trocadas ({data.replaced_parts.length})
                </a>
              )}
              <span className="text-[11px] text-slate-400">Gire em 360° para inspecionar</span>
            </div>
          </div>

          <Vehicle3DViewer
            bodyType={data.vehicle?.body_type || "suv"}
            hotspots={data.hotspots || []}
            readOnly={true}
            vehicleLabel={`${data.vehicle?.brand} ${data.vehicle?.model}`}
            replacedComponentIds={data.replaced_parts?.map((r: any) => r.component_id) || []}
            workOrderId={data.work_order_id}
          />
        </div>

        {/* Section: Peças Substituídas com Selo Oficial ("PEÇA TROCADA") */}
        {data.replaced_parts && data.replaced_parts.length > 0 && (
          <div id="pecas-trocadas" className="bg-[#081122] p-5 rounded-xl border border-emerald-500/40 space-y-4 shadow-xl">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold uppercase">
                  Transparência Técnica G-Tech
                </span>
                <h3 className="font-bold text-sm text-white mt-1">
                  Peças Substituídas neste Veículo ("PEÇA TROCADA")
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comprovação técnica auditável com registro fotográfico antes e depois da execução.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.replaced_parts.map((r: any) => (
                <div key={r.id} className="p-4 rounded-xl bg-[#0b1528] border border-emerald-500/30 space-y-3 text-xs">
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
                      <span className="text-slate-400 font-semibold">Peça Retirada (Anterior): </span>
                      <span className="text-slate-300">{r.removed_part_desc}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Peça Nova Instalada: </span>
                      <span className="text-emerald-300 font-semibold">{r.installed_part_desc}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                      <span>Mecânico: <strong className="text-slate-200">{r.technician_name}</strong></span>
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
                          <span className="text-[9px] uppercase font-bold text-emerald-400 block mb-1">📸 Depois (Instalada)</span>
                          <img src={r.photo_after_url} alt="Depois" className="w-full h-24 object-cover rounded border border-emerald-950/60" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Item by Item Quote Breakdown */}
        <div className="bg-[#081122] p-5 rounded-xl border border-slate-800 space-y-4 shadow-xl">
          <div className="border-b border-slate-800 pb-3 flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                Itens do Orçamento Técnico (v{data.version})
              </h3>
              <p className="text-xs text-slate-400">
                Selecione aprovar ou recusar para cada serviço individualmente antes de confirmar.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Orçado</span>
              <span className="text-base font-bold font-mono text-cyan-400">
                R$ {Number(data.total_amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* List of Quote Items */}
          <div className="space-y-3">
            {items.map((it: any) => {
              const currentDec = decisions[it.id]?.decision || "aprovado";

              return (
                <div
                  key={it.id}
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    currentDec === "aprovado"
                      ? "bg-emerald-950/20 border-emerald-800/60"
                      : currentDec === "recusado"
                      ? "bg-red-950/20 border-red-800/60"
                      : "bg-slate-900 border-slate-800"
                  }`}
                >
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-100">{it.description}</h4>
                        {it.part_code && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-slate-400 border border-slate-800">
                            {it.part_code}
                          </span>
                        )}
                      </div>

                      {/* Safety warning tag */}
                      {it.safety_risk_warning && (
                        <div className="bg-red-950/60 border border-red-800/80 p-2 rounded text-[11px] text-red-200 font-medium">
                          ⚠️ <strong>RISCO CRÍTICO DE SEGURANÇA:</strong> {it.safety_risk_warning}
                        </div>
                      )}

                      {it.is_indivisible ? (
                        <span className="text-[10px] text-slate-400 block italic">
                          🔗 Item indivisível: {it.indivisible_justification || "Requer substituição em conjunto técnico."}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-base font-bold text-white block">
                        R$ {Number(it.subtotal).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Peça: R$ {Number(it.unit_price_part * it.quantity).toFixed(2)} | Mão de obra: R$ {Number(it.unit_price_service * it.quantity).toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Decision Actions */}
                  {!receipt && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                      <span className="text-xs font-semibold text-slate-400 mr-1">Sua Decisão:</span>
                      <button
                        type="button"
                        onClick={() => handleSetDecision(it, "aprovado")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          currentDec === "aprovado"
                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                        }`}
                      >
                        ✓ Aprovar Item
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetDecision(it, "recusado")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          currentDec === "recusado"
                            ? "bg-red-600 text-white shadow-lg shadow-red-900/50"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                        }`}
                      >
                        ✕ Recusar Item
                      </button>

                      <a
                        href={`https://wa.me/554196522715?text=${encodeURIComponent(
                          `Olá Giovane! Tenho uma dúvida sobre o item "${it.description}" da minha OS ${data.os_number}.`
                        )}`}
                        target="_blank"
                        className="ml-auto text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        💬 Tirar dúvida deste item
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Running Totals Bar */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Subtotal Recusado:</span>
              <span className="font-mono font-bold text-red-400">R$ {totalRefused.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-white pt-1 border-t border-slate-900">
              <span>TOTAL AUTORIZADO:</span>
              <span className="font-mono text-xl text-emerald-400 font-black">
                R$ {totalApproved.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Confirmation Form */}
          {!receipt && (
            <div className="bg-slate-900/70 p-4 rounded-xl border border-cyan-500/30 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-400">
                Assinatura & Confirmação Digital
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">Nome do Responsável *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">CPF / CNPJ (Opcional)</label>
                  <input
                    type="text"
                    value={clientDoc}
                    onChange={e => setClientDoc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    placeholder="Para emissão de nota fiscal"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitDecision}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-cyan-900/40 transition disabled:opacity-50"
              >
                {submitting ? "Gravando Decisão..." : "⚡ CONFIRMAR DECISÃO DO ORÇAMENTO"}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Critical Safety Risk Disclaimer Modal */}
      {showRiskModal && pendingRefusalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0b1528] border-2 border-red-500 rounded-xl p-5 max-w-md w-full shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center gap-3 border-b border-red-500/30 pb-3">
              <span className="text-3xl">🚨</span>
              <div>
                <h3 className="font-bold text-sm text-red-400 uppercase">Termo de Risco de Segurança Veicular</h3>
                <span className="text-[11px] text-slate-300">Atenção Técnica Obrigatória</span>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p className="text-slate-200">
                O item <strong className="text-white">"{pendingRefusalItem.description}"</strong> foi classificado pela direção técnica de Giovane Ribeiro como <strong>crítico para a segurança veicular</strong>.
              </p>

              <div className="bg-red-950/80 border border-red-700 p-3 rounded text-red-200 font-medium">
                {pendingRefusalItem.safety_risk_warning}
              </div>

              <p className="text-slate-400 text-[11px]">
                Ao recusar este componente, você assume expressamente a responsabilidade operacional por rodar com o veículo nestas condições, isentando a oficina de danos decorrentes da não substituição da peça defeituosa.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowRiskModal(false);
                  setPendingRefusalItem(null);
                }}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Voltar e Manter Aprovado
              </button>
              <button
                type="button"
                onClick={confirmCriticalRefusal}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950"
              >
                Estou Ciente e Confirmo Recusa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

