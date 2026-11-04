import { NextRequest, NextResponse } from "next/server";
import { getDb, generateHash } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();

    const wo = db.prepare(`
      SELECT 
        wo.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.document as customer_document,
        c.email as customer_email,
        v.brand as vehicle_brand,
        v.model as vehicle_model,
        v.plate as vehicle_plate,
        v.year as vehicle_year,
        v.motor as vehicle_motor,
        v.color as vehicle_color,
        v.km as vehicle_km,
        v.fuel as vehicle_fuel,
        v.chassis as vehicle_chassis,
        v.body_type as vehicle_body_type,
        comp.name as company_name,
        comp.cnpj as company_cnpj,
        comp.phone as company_phone,
        comp.address as company_address,
        comp.city as company_city,
        comp.state as company_state,
        comp.postal_code as company_cep
      FROM work_orders wo
      JOIN customers c ON wo.customer_id = c.id
      JOIN vehicles v ON wo.vehicle_id = v.id
      JOIN companies comp ON wo.company_id = comp.id
      WHERE wo.id = ? OR wo.os_number = ?
    `).get(id, id) as any;

    if (!wo) {
      return new NextResponse("Ordem de serviço não encontrada.", { status: 404 });
    }

    const intake = db.prepare("SELECT * FROM wo_intake_inspection WHERE work_order_id = ?").get(wo.id) as any;
    const hotspots = db.prepare("SELECT * FROM wo_hotspots WHERE work_order_id = ?").all(wo.id) as any[];
    const checklistItems = db.prepare("SELECT * FROM wo_checklist_items WHERE work_order_id = ? ORDER BY group_name ASC").all(wo.id) as any[];
    
    // Latest quote & items
    const latestQuote = db.prepare("SELECT * FROM wo_quotes WHERE work_order_id = ? ORDER BY version_number DESC LIMIT 1").get(wo.id) as any;
    const quoteItems = latestQuote ? db.prepare("SELECT * FROM wo_quote_items WHERE quote_id = ?").all(latestQuote.id) as any[] : [];
    
    // Latest customer decision
    const decision = latestQuote ? db.prepare("SELECT * FROM wo_customer_decisions WHERE quote_id = ? ORDER BY created_at DESC LIMIT 1").get(latestQuote.id) as any : null;
    
    // Exit checklist
    const exitData = db.prepare("SELECT * FROM wo_exit_checklist WHERE work_order_id = ?").get(wo.id) as any;

    // Replaced parts ("PEÇA TROCADA")
    const replacedParts = db.prepare("SELECT * FROM wo_replaced_parts WHERE work_order_id = ? ORDER BY replaced_at DESC").all(wo.id) as any[];

    // Component inspections with precise measurements
    const compInspections = db.prepare(`
      SELECT i.*, c.component_name, c.assembly_name, c.system_group
      FROM wo_component_inspections i
      JOIN vehicle_components c ON i.component_id = c.id
      WHERE i.work_order_id = ?
      ORDER BY i.inspected_at DESC
    `).all(wo.id) as any[];

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>G-TECH - Ordem de Serviço ${wo.os_number}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #fff;
      font-size: 11pt;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0088ff;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 20pt;
      font-weight: 900;
      color: #0b1528;
      letter-spacing: -0.5px;
    }
    .brand-title span { color: #0088ff; }
    .brand-sub {
      font-size: 9pt;
      color: #64748b;
      margin-top: 2px;
    }
    .os-badge {
      text-align: right;
    }
    .os-badge .number {
      font-size: 16pt;
      font-weight: 800;
      color: #0088ff;
      font-family: monospace;
    }
    .os-badge .meta {
      font-size: 9pt;
      color: #475569;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #0b1528;
      background: #f1f5f9;
      padding: 5px 8px;
      border-left: 4px solid #0088ff;
      margin-top: 14px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .data-box {
      border: 1px solid #e2e8f0;
      padding: 8px;
      border-radius: 4px;
      font-size: 9.5pt;
    }
    .data-box .label {
      font-size: 7.5pt;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .data-box .val {
      font-weight: 600;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 6px;
    }
    th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid #cbd5e1;
      font-size: 8pt;
      text-transform: uppercase;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-warn { background: #fef3c7; color: #92400e; }
    .badge-crit { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #e0f2fe; color: #075985; }
    .alert-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 9pt;
      margin: 10px 0;
    }
    .alert-danger {
      background: #fef2f2;
      border-color: #fecaca;
      border-left-color: #ef4444;
    }
    .signatures {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      text-align: center;
      font-size: 9pt;
      color: #334155;
    }
    .audit-seal {
      margin-top: 20px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      padding: 8px;
      font-size: 7.5pt;
      color: #64748b;
      font-family: monospace;
      word-break: break-all;
    }
    .no-print {
      position: fixed;
      top: 12px;
      right: 12px;
      background: #0088ff;
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      text-decoration: none;
      box-shadow: 0 4px 12px rgba(0,136,255,0.3);
      cursor: pointer;
    }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <button class="no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

  <div class="header">
    <div>
      <div class="brand-title">G-TECH <span>AUTOMOTIVOS</span></div>
      <div class="brand-sub">
        ${wo.company_name} | CNPJ: ${wo.company_cnpj || "48.912.834/0001-90"}<br>
        ${wo.company_address} — ${wo.company_city}/${wo.company_state} — CEP: ${wo.company_cep}<br>
        WhatsApp Oficial: ${wo.company_phone} | Responsável Técnico: Giovane Ribeiro (Ex-Chefe de Oficina Renault)
      </div>
    </div>
    <div class="os-badge">
      <div class="number">${wo.os_number}</div>
      <div class="meta">Data Abertura: ${wo.created_at.slice(0, 10)}</div>
      <div class="meta">Status: <strong>${wo.status.toUpperCase()}</strong></div>
    </div>
  </div>

  <!-- DADOS DO CLIENTE E VEÍCULO -->
  <div class="section-title">1. Identificação do Cliente & Veículo</div>
  <div class="grid-4">
    <div class="data-box">
      <div class="label">Cliente</div>
      <div class="val">${wo.customer_name}</div>
    </div>
    <div class="data-box">
      <div class="label">WhatsApp / Telefone</div>
      <div class="val">${wo.customer_phone}</div>
    </div>
    <div class="data-box">
      <div class="label">Veículo</div>
      <div class="val">${wo.vehicle_brand} ${wo.vehicle_model} (${wo.vehicle_year || "N/D"})</div>
    </div>
    <div class="data-box">
      <div class="label">Placa / Carroceria</div>
      <div class="val">${wo.vehicle_plate || "SEM PLACA"} | ${wo.vehicle_body_type.toUpperCase()}</div>
    </div>
  </div>

  <div class="grid-4" style="margin-top: 6px;">
    <div class="data-box">
      <div class="label">Km de Entrada</div>
      <div class="val">${intake?.odometer_km ? `${intake.odometer_km} km` : "Não informado"}</div>
    </div>
    <div class="data-box">
      <div class="label">Nível de Combustível</div>
      <div class="val">${intake?.fuel_pct ? `${intake.fuel_pct}%` : "1/2 Tanque"}</div>
    </div>
    <div class="data-box">
      <div class="label">Chaves / Pertences</div>
      <div class="val">Chaves entregues: Sim | Declaração: ${wo.belongings_declared || "Sem pertences de valor"}</div>
    </div>
    <div class="data-box">
      <div class="label">Responsável Técnico</div>
      <div class="val">${wo.mechanic_name || "Giovane Ribeiro"}</div>
    </div>
  </div>

  <!-- RELATO E VISTORIA DE ENTRADA -->
  <div class="section-title">2. Relato do Cliente & Vistoria Inicial</div>
  <div class="data-box" style="margin-bottom: 6px;">
    <div class="label">Queixa / Sintoma Declarado</div>
    <div class="val" style="font-weight: normal;">${wo.customer_complaint}</div>
  </div>

  <div class="grid-2">
    <div class="data-box">
      <div class="label">Vistoria Fotográfica 360°</div>
      <div class="val">
        4 Vistas Externas: OK | Vista Interior: OK | Painel de Instrumentos: OK<br>
        Ciência do Cliente na Entrada: ${intake?.client_acknowledged ? "✅ Assinada Digitalmente" : intake?.client_refused_signature ? "⚠️ Recusada com registro de testemunha" : "Registrado pela recepção"}
      </div>
    </div>
    <div class="data-box">
      <div class="label">Avarias de Entrada Pré-Existentes</div>
      <div class="val">
        ${hotspots.filter(h => h.hotspot_type === 'avaria_entrada').length > 0 
          ? hotspots.filter(h => h.hotspot_type === 'avaria_entrada').map(h => `• ${h.region_name} (${h.orientation_side}): ${h.description}`).join('<br>')
          : "Nenhuma avaria grave externa assinalada na entrada."}
      </div>
    </div>
  </div>

  <!-- CHECKLIST TÉCNICO INTELIGENTE -->
  <div class="section-title">3. Diagnóstico e Checklist Técnico (10 Grupos)</div>
  <table>
    <thead>
      <tr>
        <th>Grupo</th>
        <th>Item Inspecionado</th>
        <th>Resultado / Teste</th>
        <th>Achado Técnico / Evidência</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${checklistItems.map(item => `
        <tr>
          <td style="font-weight: 600; text-transform: capitalize;">${item.group_name}</td>
          <td>${item.item_name}</td>
          <td>${item.test_performed || "Inspeção visual e funcional"}</td>
          <td>${item.finding_description || "Conforme especificação da montadora"}</td>
          <td>
            <span class="badge ${item.status === 'OK' ? 'badge-ok' : item.status === 'ATENCAO' ? 'badge-warn' : item.status === 'CRITICO' ? 'badge-crit' : 'badge-info'}">
              ${item.status}
            </span>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- ORÇAMENTO E DECISÃO DO CLIENTE -->
  <div class="section-title">4. Orçamento Técnico & Decisão Registrada</div>
  ${quoteItems.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Descrição do Item</th>
          <th>Qtd</th>
          <th>Peças (R$)</th>
          <th>Serviço (R$)</th>
          <th>Subtotal (R$)</th>
          <th>Decisão</th>
        </tr>
      </thead>
      <tbody>
        ${quoteItems.map(it => `
          <tr style="${it.decision === 'recusado' ? 'background: #fff1f2;' : it.decision === 'aprovado' ? 'background: #f0fdf4;' : ''}">
            <td style="font-family: monospace; font-size: 8pt;">${it.part_code || "---"}</td>
            <td>
              <strong>${it.description}</strong>
              ${it.safety_risk_warning ? `<br><small style="color: #b91c1c;">⚠️ ALERTA DE SEGURANÇA: ${it.safety_risk_warning}</small>` : ''}
              ${it.is_indivisible ? `<br><small style="color: #475569;">🔗 Item indivisível: ${it.indivisible_justification}</small>` : ''}
            </td>
            <td>${it.quantity}</td>
            <td>R$ ${(it.unit_price_part * it.quantity).toFixed(2)}</td>
            <td>R$ ${(it.unit_price_service * it.quantity).toFixed(2)}</td>
            <td><strong>R$ ${it.subtotal.toFixed(2)}</strong></td>
            <td>
              <span class="badge ${it.decision === 'aprovado' ? 'badge-ok' : it.decision === 'recusado' ? 'badge-crit' : 'badge-warn'}">
                ${it.decision.toUpperCase()}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div style="text-align: right; margin-top: 10px; font-size: 11pt;">
      <div>Subtotal Geral Orçado: <strong>R$ ${latestQuote.total_amount.toFixed(2)}</strong></div>
      <div style="font-size: 13pt; color: #166534; font-weight: 800; margin-top: 4px;">
        TOTAL AUTORIZADO PELO CLIENTE: R$ ${(decision?.authorized_amount !== undefined ? decision.authorized_amount : latestQuote.authorized_total).toFixed(2)}
      </div>
    </div>
  ` : `<p>Nenhum item de orçamento gerado até o momento.</p>`}

  ${decision && decision.hasRefusalOnCritical ? `
    <div class="alert-box alert-danger">
      <strong>⚠️ TERMO DE CIÊNCIA E RESPONSABILIDADE OPERACIONAL POR RECUSA:</strong><br>
      O cliente declarou expressamente ter recusado item(ns) classificados como risco crítico à segurança veicular. A oficina G-Tech notificou formalmente os riscos de instabilidade/acidente, ficando isenta de responsabilidade sobre falhas decorrentes do componente não substituído. Protocolo do Termo: <strong>${decision.receipt_protocol}</strong>.
    </div>
  ` : ''}

  <!-- REGISTRO DE PEÇAS SUBSTITUÍDAS (PEÇA TROCADA) -->
  ${replacedParts.length > 0 ? `
    <div class="section-title">5. Registro Oficial de Peças Substituídas ("PEÇA TROCADA")</div>
    <table>
      <thead>
        <tr>
          <th>Componente & Caminho</th>
          <th>Peça Retirada (Condição Anterior)</th>
          <th>Peça Instalada Nova (Aplicação)</th>
          <th>Técnico</th>
          <th>Garantia Legal</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${replacedParts.map(r => `
          <tr style="background: #f8fafc;">
            <td>
              <strong style="color: #0b1528;">${r.component_name}</strong><br>
              <small style="color: #64748b; font-family: monospace;">${r.assembly_path}</small>
            </td>
            <td style="font-size: 8.5pt; color: #475569;">${r.removed_part_desc}</td>
            <td style="font-size: 8.5pt; color: #0f172a; font-weight: 600;">${r.installed_part_desc}</td>
            <td style="font-size: 8.5pt;">${r.technician_name}</td>
            <td style="font-size: 8pt; color: #166534;">${r.warranty_terms}</td>
            <td>
              <span class="badge badge-ok" style="font-size: 7.5pt; letter-spacing: 0.5px;">
                ✅ ${r.seal_status}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- MEDIÇÕES TÉCNICAS E TOLERÂNCIAS POR COMPONENTE -->
  ${compInspections.length > 0 ? `
    <div class="section-title">6. Medições de Metrologia & Ensaios por Componente</div>
    <table>
      <thead>
        <tr>
          <th>Componente</th>
          <th>Conjunto / Sistema</th>
          <th>Ensaio / Teste Realizado</th>
          <th>Medição Obtida</th>
          <th>Tolerância da Montadora</th>
          <th>Condição</th>
        </tr>
      </thead>
      <tbody>
        ${compInspections.map(ci => `
          <tr>
            <td><strong>${ci.component_name}</strong></td>
            <td style="font-size: 8.5pt; color: #64748b;">${ci.assembly_name} (${ci.system_group})</td>
            <td style="font-size: 8.5pt;">${ci.test_performed || "Inspeção dimensional"}</td>
            <td style="font-size: 9pt; font-family: monospace; font-weight: bold; color: ${ci.status === 'critico' ? '#b91c1c' : ci.status === 'atencao' ? '#d97706' : '#15803d'};">
              ${ci.measurement_value || "Conforme"}
            </td>
            <td style="font-size: 8pt; color: #64748b;">${ci.tolerance_spec || "Padrão OEM"}</td>
            <td>
              <span class="badge ${ci.status === 'ok' ? 'badge-ok' : ci.status === 'atencao' ? 'badge-warn' : ci.status === 'critico' ? 'badge-crit' : 'badge-info'}">
                ${ci.status.toUpperCase()}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- CHECKLIST DE SAÍDA E ENTREGA -->
  <div class="section-title">7. Controle de Qualidade & Entrega</div>
  <div class="grid-4">
    <div class="data-box">
      <div class="label">Teste de Rodagem</div>
      <div class="val">${exitData?.road_test_ok ? "✅ Aprovado em rua/rodovia" : "Pendente"}</div>
    </div>
    <div class="data-box">
      <div class="label">Luzes do Painel</div>
      <div class="val">${exitData?.warning_lights_cleared ? "✅ Scanner zerado (Sem DTCs)" : "Pendente"}</div>
    </div>
    <div class="data-box">
      <div class="label">Torque das Rodas</div>
      <div class="val">${exitData?.wheel_torque_checked ? "✅ Verificado com Torquímetro" : "Pendente"}</div>
    </div>
    <div class="data-box">
      <div class="label">Peças Substituídas</div>
      <div class="val">${exitData?.parts_returned ? "Entregues ao cliente" : "Descartadas ecologicamente"}</div>
    </div>
  </div>

  <!-- ASSINATURAS -->
  <div class="signatures">
    <div>
      <div class="sig-line">
        <strong>G-TECH SERVIÇOS AUTOMOTIVOS</strong><br>
        Giovane Ribeiro — Direção Técnica & Diagnóstico<br>
        Especialista Linha Renault & Redes Multiplexadas
      </div>
    </div>
    <div>
      <div class="sig-line">
        <strong>${wo.customer_name}</strong><br>
        Cliente / Responsável Autorizado<br>
        Documento: ${wo.customer_document || "Assinatura via Token Seguro WhatsApp"}
      </div>
    </div>
  </div>

  <!-- TRILHA DE AUDITORIA CRIPTOGRÁFICA -->
  <div class="audit-seal">
    🔒 <strong>SELO DE AUDITORIA IMUTÁVEL G-TECH SHA-256:</strong><br>
    OS: ${wo.os_number} | PROTOCOLO DECISÃO: ${decision?.receipt_protocol || "N/A"}<br>
    HASH CRIPTOGRÁFICO: ${decision?.audit_hash || generateHash({ os: wo.os_number, customer: wo.customer_name, date: wo.created_at })}<br>
    EMISSÃO: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} | SISTEMA OPERACIONAL G-TECH PARANAGUÁ–PR
  </div>

</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  } catch (error: any) {
    return new NextResponse(`Erro ao gerar documento da OS: ${error.message}`, { status: 500 });
  }
}

