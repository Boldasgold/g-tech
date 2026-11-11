const fs = require('fs');
const path = require('path');

const pagePath = path.resolve('C:/Users/tiujo/Desktop/g-tech/src/app/oficina/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Inject the 3 views right after `{activeTab === "quadro" && (\n          <div className="space-y-4">`
// Let's locate the end of `{activeTab === "quadro" && (`
const quadroStart = content.indexOf('{activeTab === "quadro" && (');
const agendamentosStart = content.indexOf('{activeTab === "agendamentos" && (');

if (quadroStart !== -1 && agendamentosStart !== -1) {
  const viewsToInject = `

        {/* TAB: CADASTRO E GESTÃO DE VEÍCULOS */}
        {activeTab === "veiculos" && (
          <div className="space-y-4">
            {/* Header Toolbar */}
            <div className="bg-[#081122] p-4 rounded-2xl border border-cyan-500/30 flex flex-wrap justify-between items-center gap-3 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase font-bold text-cyan-400">
                    Módulo de Gestão da Frota
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Cadastro de Carros & Veículos da Oficina
                </h2>
                <p className="text-xs text-slate-400">
                  Total de {vehiclesList.length} veículos cadastrados • {vehiclesList.filter(v => v.glb_file_name).length} com monobloco 3D verificado
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="🔍 Buscar placa, modelo, marca..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-[#040814] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />

                <button
                  type="button"
                  data-testid="btn-novo-veiculo"
                  onClick={() => setShowNewVehicleModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Cadastrar Novo Carro</span>
                </button>
              </div>
            </div>

            {/* Grid of Vehicles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehiclesList.map((veh) => (
                <div
                  key={veh.id}
                  className="bg-[#060e1d]/90 rounded-2xl border border-slate-800 hover:border-cyan-500/40 p-4 space-y-3.5 transition-all shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Plate & Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="px-3 py-1 rounded bg-white text-slate-950 font-black font-mono text-xs tracking-wider border-2 border-blue-900 shadow flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-700" />
                        <span>{veh.plate}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono uppercase text-slate-300">
                          {veh.body_type || "Hatch"}
                        </span>
                        {veh.glb_file_name ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-[10px] font-bold text-emerald-300 flex items-center gap-1" title={veh.glb_file_name}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>3D Ativo</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                            Fotos
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Model Title */}
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        {veh.brand} {veh.model}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Ano {veh.year || "N/I"} • {veh.motor || "Motor padrão"} • {veh.color || "Prata"} • {veh.km ? veh.km.toLocaleString("pt-BR") + " km" : "0 km"}
                      </p>
                    </div>

                    {/* Customer Info */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span>Proprietário:</span>
                        <strong className="text-white">{veh.customer_name || "Cliente Oficina"}</strong>
                      </div>
                      {veh.customer_phone && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">WhatsApp:</span>
                          <a
                            href={\`https://wa.me/55\${veh.customer_phone.replace(/\\D/g, "")}\`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:underline font-mono font-bold flex items-center gap-1"
                          >
                            <span>💬</span>
                            <span>{veh.customer_phone}</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Maintenance Summary */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>Total de Manutenções:</span>
                      <strong className="text-cyan-300 font-mono">{veh.total_work_orders || 0} OS</strong>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <Link
                      href={\`/3D-360?vehicle=\${veh.vehicle_key || veh.model.toLowerCase()}\`}
                      className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition flex items-center gap-1"
                      target="_blank"
                    >
                      <span>🧊</span>
                      <span>Ver no 3D</span>
                    </Link>

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
                          vehicle_year: veh.year || "2022",
                          vehicle_km: veh.km ? String(veh.km) : "",
                          vehicle_body_type: (veh.body_type as BodyType) || "hatch",
                          initial_scope: "Revisão periódica preventiva e inspeção geral",
                          customer_complaint: "",
                          appointment_id: ""
                        });
                        setShowNewOsModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition flex items-center gap-1"
                    >
                      <span>📋</span>
                      <span>Nova OS</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: CADASTRO E GESTÃO DE CLIENTES */}
        {activeTab === "clientes" && (
          <div className="space-y-4">
            {/* Header Toolbar */}
            <div className="bg-[#081122] p-4 rounded-2xl border border-cyan-500/30 flex flex-wrap justify-between items-center gap-3 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase font-bold text-emerald-400">
                    Módulo de Clientes
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Cadastro de Clientes da G-Tech
                </h2>
                <p className="text-xs text-slate-400">
                  Total de {customersList.length} clientes com cadastro ativo e contato WhatsApp
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="🔍 Buscar nome, telefone, CPF..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-[#040814] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />

                <button
                  type="button"
                  data-testid="btn-novo-cliente"
                  onClick={() => setShowNewCustomerModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Cadastrar Novo Cliente</span>
                </button>
              </div>
            </div>

            {/* Grid of Customers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customersList.map((cust) => (
                <div
                  key={cust.id}
                  className="bg-[#060e1d]/90 rounded-2xl border border-slate-800 hover:border-emerald-500/40 p-4 space-y-3.5 transition-all shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Customer Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white text-sm shadow">
                        {cust.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{cust.name}</h3>
                        <span className="text-[10px] text-slate-400 font-mono">
                          CPF/CNPJ: {cust.document || "Não cadastrado"}
                        </span>
                      </div>
                    </div>

                    {/* WhatsApp Direct Action */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">WhatsApp Direto:</span>
                        <a
                          href={\`https://wa.me/55\${(cust.phone || "").replace(/\\D/g, "")}\`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline font-mono font-bold flex items-center gap-1"
                        >
                          <span>💬</span>
                          <span>{cust.phone}</span>
                        </a>
                      </div>
                      {cust.email && (
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>E-mail:</span>
                          <span className="text-slate-300 truncate max-w-[160px]">{cust.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Associated Vehicles */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                        Veículos Vinculados ({cust.total_vehicles || 0}):
                      </span>
                      {cust.vehicles_summary ? (
                        <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/30 text-xs text-cyan-300 font-medium">
                          🚗 {cust.vehicles_summary}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">
                          Nenhum veículo vinculado ainda
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 border-t border-slate-800/60">
                      <span>Manutenções Realizadas:</span>
                      <strong className="text-emerald-400 font-mono">{cust.total_work_orders || 0} OS</strong>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewVehicleForm(prev => ({
                          ...prev,
                          customer_id: cust.id,
                          customer_name: cust.name,
                          customer_phone: cust.phone
                        }));
                        setShowNewVehicleModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
                    >
                      🚗 + Vincular Carro
                    </button>

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
                          initial_scope: "Revisão e manutenção solicitada pelo cliente",
                          customer_complaint: "",
                          appointment_id: ""
                        });
                        setShowNewOsModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition flex items-center gap-1"
                    >
                      <span>📋</span>
                      <span>Nova OS</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: HISTÓRICO DE MANUTENÇÕES FEITAS */}
        {activeTab === "manutencoes" && (
          <div className="space-y-4">
            {/* Header Toolbar */}
            <div className="bg-[#081122] p-4 rounded-2xl border border-cyan-500/30 flex flex-wrap justify-between items-center gap-3 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase font-bold text-amber-400">
                    Histórico & Laudos Técnicos
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Manutenções Realizadas & Ordens de Serviço
                </h2>
                <p className="text-xs text-slate-400">
                  Registro de manutenções com peças substituídas, selo oficial de garantia CDC + fábrica e valores
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="🔍 Buscar OS, placa, cliente..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-[#040814] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />

                <select
                  value={maintStatusFilter}
                  onChange={(e) => setMaintStatusFilter(e.target.value)}
                  className="bg-[#040814] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="concluida">Concluídas</option>
                  <option value="execucao">Em Execução</option>
                  <option value="orcamento_aprovado">Orçamento Aprovado</option>
                  <option value="aberta">Abertas</option>
                </select>
              </div>
            </div>

            {/* List of Maintenance Orders */}
            <div className="space-y-3">
              {maintenancesList.map((maint) => (
                <div
                  key={maint.work_order_id}
                  className="bg-[#060e1d]/90 rounded-2xl border border-slate-800 hover:border-cyan-500/40 p-4 space-y-3 transition-all shadow-xl"
                >
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 font-mono font-bold text-xs border border-cyan-700/50">
                          {maint.os_number}
                        </span>
                        <span className={\`px-2 py-0.5 rounded-full text-[10px] font-bold \${
                          maint.status === "concluida"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50"
                            : maint.status === "execucao"
                            ? "bg-blue-950 text-blue-300 border border-blue-500/50"
                            : "bg-amber-950 text-amber-300 border border-amber-500/50"
                        }\`}>
                          {maint.status === "concluida" ? "✓ Concluída" : maint.status === "execucao" ? "⚙️ Em Execução" : "📋 " + maint.status}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(maint.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <strong className="text-white text-sm">
                          🚗 {maint.vehicle_brand} {maint.vehicle_model}
                        </strong>
                        <span className="px-2 py-0.5 rounded bg-white text-slate-950 font-black font-mono text-[11px] border border-blue-900">
                          {maint.vehicle_plate}
                        </span>
                        <span className="text-slate-400 text-xs">
                          • Cliente: <strong className="text-slate-200">{maint.customer_name}</strong> ({maint.customer_phone})
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Valor da Manutenção</span>
                      <strong className="text-emerald-400 text-base font-mono">
                        {maint.quote_total
                          ? "R$ " + Number(maint.quote_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                          : "Aguardando aprovação"}
                      </strong>
                    </div>
                  </div>

                  {/* Scope & Complaint */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                    <div><span className="text-slate-400">Escopo Técnico:</span> <span className="text-slate-200">{maint.initial_scope}</span></div>
                    {maint.customer_complaint && (
                      <div><span className="text-slate-400">Relato do Cliente:</span> <span className="text-amber-200">{maint.customer_complaint}</span></div>
                    )}
                  </div>

                  {/* Replaced Parts with CDC Warranty Seal */}
                  {maint.parts_summary && (
                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs flex items-center gap-2 text-amber-200">
                      <span className="text-base">🛡️</span>
                      <div>
                        <strong>Peças Substituídas com Selo Oficial:</strong> {maint.parts_summary}
                      </div>
                    </div>
                  )}

                  {/* Footer & Action Buttons */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Checklist: <strong className="text-cyan-300">{maint.checklist_items_count} itens inspecionados</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={\`/3D-360?vehicle=\${maint.vehicle_key || maint.vehicle_model.toLowerCase()}\`}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
                        target="_blank"
                      >
                        🧊 Ver no 3D
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          loadWoDetails(maint.work_order_id);
                          setActiveTab("detalhes");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow transition flex items-center gap-1.5"
                      >
                        <span>👁️</span>
                        <span>Abrir Detalhes da OS</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
`;

  content = content.substring(0, agendamentosStart) + viewsToInject + '\n\n        ' + content.substring(agendamentosStart);
  console.log('Successfully injected Veiculos, Clientes and Manutencoes views!');
}

// 2. Inject Modals alongside showNewOsModal
const modalOsPos = content.indexOf('{/* MODAL NOVA OS */}');
if (modalOsPos !== -1) {
  const modalsToInject = `{/* MODAL CADASTRAR NOVO VEÍCULO */}
      {showNewVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateVehicleSubmit}
            className="bg-[#071122] border border-cyan-500/40 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>🚗</span>
                <span>Cadastrar Novo Veículo na Frota</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewVehicleModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Placa (Mercosul) *</label>
                <input
                  type="text"
                  required
                  placeholder="BRA2E19"
                  value={newVehicleForm.plate}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, plate: e.target.value.toUpperCase() })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 font-mono font-bold text-cyan-300 uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Marca *</label>
                <select
                  value={newVehicleForm.brand}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, brand: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
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

              <div className="col-span-2">
                <label className="block text-slate-400 text-[11px] mb-1">Modelo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Polo Hatch 1.0 TSI, Corsa Hatch, Bora Sedã..."
                  value={newVehicleForm.model}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, model: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Ano</label>
                <input
                  type="text"
                  placeholder="2023"
                  value={newVehicleForm.year}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, year: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Quilometragem (KM)</label>
                <input
                  type="number"
                  placeholder="35000"
                  value={newVehicleForm.km}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, km: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Carroceria</label>
                <select
                  value={newVehicleForm.body_type}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, body_type: e.target.value as BodyType })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                >
                  <option value="hatch">Hatch</option>
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="picape">Picape</option>
                  <option value="van">Van</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Cor</label>
                <input
                  type="text"
                  placeholder="Prata"
                  value={newVehicleForm.color}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, color: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="font-bold text-cyan-300 block text-[11px]">Vincular Proprietário / Cliente:</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    placeholder="Nome do Cliente"
                    value={newVehicleForm.customer_name}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, customer_name: e.target.value })}
                    className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="WhatsApp (41) 9xxxx-xxxx"
                    value={newVehicleForm.customer_phone}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, customer_phone: e.target.value })}
                    className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewVehicleModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/25"
              >
                Cadastrar Veículo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CADASTRAR NOVO CLIENTE */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateCustomerSubmit}
            className="bg-[#071122] border border-emerald-500/40 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>👤</span>
                <span>Cadastrar Novo Cliente</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Silveira"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Telefone WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="(41) 99876-5432"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-emerald-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">CPF / CNPJ</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={newCustomerForm.document}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, document: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">E-mail</label>
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Observações do Cliente</label>
                <textarea
                  placeholder="Preferências de atendimento, endereço ou observações técnicas..."
                  value={newCustomerForm.notes}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                  className="w-full bg-[#030712] border border-slate-700 rounded-xl p-2 text-white h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/25"
              >
                Cadastrar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      `;

  content = content.substring(0, modalOsPos) + modalsToInject + content.substring(modalOsPos);
  console.log('Successfully injected Vehicle and Customer Modals!');
}

fs.writeFileSync(pagePath, content, 'utf8');
console.log('oficina page.tsx fully enhanced with all views and modals!');

