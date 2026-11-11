const fs = require('fs');
const path = require('path');

const pagePath = path.resolve('C:/Users/tiujo/Desktop/g-tech/src/app/oficina/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Update activeTab type and add new state declarations
const oldStateTab = `const [activeTab, setActiveTab] = useState<"quadro" | "detalhes" | "agendamentos" | "metricas">("quadro");`;
const newStateTab = `const [activeTab, setActiveTab] = useState<"quadro" | "veiculos" | "clientes" | "manutencoes" | "detalhes" | "agendamentos" | "metricas">("quadro");

  // Módulos ERP Integrados: Carros, Clientes e Manutenções
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [maintenancesList, setMaintenancesList] = useState<any[]>([]);
  const [maintStatusFilter, setMaintStatusFilter] = useState("todos");
  const [vehicleFilter3dOnly, setVehicleFilter3dOnly] = useState(false);

  // Modais de Criação Rápida
  const [showNewVehicleModal, setShowNewVehicleModal] = useState(false);
  const [newVehicleForm, setNewVehicleForm] = useState({
    plate: "",
    brand: "Volkswagen",
    model: "",
    year: "2023",
    motor: "1.0 TSI TotalFlex",
    color: "Prata",
    km: "35000",
    fuel: "flex",
    body_type: "hatch" as BodyType,
    customer_id: "",
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
  });`;

content = content.replace(oldStateTab, newStateTab);
console.log('1. Updated activeTab state');

// 2. Add loader functions
const oldLoaders = `  // Load Appointments
  const loadAppointments = async () => {`;

const newLoaders = `  // Load Vehicles
  const loadVehicles = async () => {
    try {
      const res = await fetch(\`/api/work-orders?view=vehicles&search=\${encodeURIComponent(searchFilter)}\`);
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
      const res = await fetch(\`/api/work-orders?view=customers&search=\${encodeURIComponent(searchFilter)}\`);
      const data = await res.json();
      if (data.success) {
        setCustomersList(data.customers || []);
      }
    } catch (err) {
      console.error("Erro ao carregar clientes", err);
    }
  };

  // Load Maintenances History
  const loadMaintenances = async () => {
    try {
      const res = await fetch(\`/api/work-orders?view=maintenances&status=\${maintStatusFilter}&search=\${encodeURIComponent(searchFilter)}\`);
      const data = await res.json();
      if (data.success) {
        setMaintenancesList(data.maintenances || []);
      }
    } catch (err) {
      console.error("Erro ao carregar manutenções", err);
    }
  };

  const handleCreateVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_vehicle",
          ...newVehicleForm
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(\`Veículo \${newVehicleForm.brand} \${newVehicleForm.model} (\${newVehicleForm.plate}) cadastrado com sucesso!\`);
        setShowNewVehicleModal(false);
        setNewVehicleForm({
          plate: "",
          brand: "Volkswagen",
          model: "",
          year: "2023",
          motor: "1.0 TSI TotalFlex",
          color: "Prata",
          km: "35000",
          fuel: "flex",
          body_type: "hatch",
          customer_id: "",
          customer_name: "",
          customer_phone: ""
        });
        loadVehicles();
      } else {
        alert(data.error || "Erro ao cadastrar veículo.");
      }
    } catch (err) {
      alert("Falha de conexão ao cadastrar veículo.");
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_customer",
          ...newCustomerForm
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(\`Cliente \${newCustomerForm.name} cadastrado com sucesso!\`);
        setShowNewCustomerModal(false);
        setNewCustomerForm({
          name: "",
          phone: "",
          email: "",
          document: "",
          notes: ""
        });
        loadCustomers();
      } else {
        alert(data.error || "Erro ao cadastrar cliente.");
      }
    } catch (err) {
      alert("Falha de conexão ao cadastrar cliente.");
    }
  };

  // Load Appointments
  const loadAppointments = async () => {`;

content = content.replace(oldLoaders, newLoaders);
console.log('2. Added loader functions');

// 3. Update main useEffect dependencies and URL param check
content = content.replace(
  `  useEffect(() => {
    loadWorkOrders();
    loadAppointments();
    loadMetrics();
    setLoading(false);
  }, [statusFilter, searchFilter]);`,
  `  useEffect(() => {
    loadWorkOrders();
    loadAppointments();
    loadMetrics();
    loadVehicles();
    loadCustomers();
    loadMaintenances();
    setLoading(false);
  }, [statusFilter, searchFilter, maintStatusFilter]);`
);

content = content.replace(
  `      if (osParam) {
        loadWoDetails(osParam);
        setActiveTab("detalhes");
      }
      if (tabParam === "inspecao3d" || tabParam === "componentes") {
        setOsSubTab(tabParam as any);
      }`,
  `      if (osParam) {
        loadWoDetails(osParam);
        setActiveTab("detalhes");
      }
      if (tabParam === "veiculos" || tabParam === "clientes" || tabParam === "manutencoes" || tabParam === "quadro" || tabParam === "agendamentos" || tabParam === "metricas") {
        setActiveTab(tabParam as any);
      }
      if (tabParam === "inspecao3d" || tabParam === "componentes") {
        setOsSubTab(tabParam as any);
      }`
);
console.log('3. Updated useEffects for URL tabs');

// 4. Update Header Tabs
const oldNavTabs = `<div className="flex items-center gap-1 bg-[#0b1528] p-1 rounded-lg border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("quadro")}
            className={\`px-3 py-1.5 rounded transition \${
              activeTab === "quadro" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }\`}
          >
            📋 Ordens de Serviço ({workOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("agendamentos")}
            className={\`px-3 py-1.5 rounded transition flex items-center gap-1.5 \${
              activeTab === "agendamentos" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }\`}
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
              className={\`px-3 py-1.5 rounded transition \${
                activeTab === "detalhes" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }\`}
            >
              🔧 OS {selectedWo.work_order.os_number}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("metricas")}
            className={\`px-3 py-1.5 rounded transition \${
              activeTab === "metricas" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }\`}
          >
            📊 Métricas & CSV
          </button>
        </div>`;

const newNavTabs = `<div className="flex flex-wrap items-center gap-1 bg-[#091222]/90 backdrop-blur-md p-1.5 rounded-xl border border-cyan-500/30 text-xs font-semibold shadow-xl">
          <button
            type="button"
            data-testid="tab-btn-quadro"
            onClick={() => setActiveTab("quadro")}
            className={\`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 \${
              activeTab === "quadro"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }\`}
          >
            <span>📋</span>
            <span>Ordens ({workOrders.length})</span>
          </button>

          <button
            type="button"
            data-testid="tab-btn-veiculos"
            onClick={() => {
              setActiveTab("veiculos");
              loadVehicles();
            }}
            className={\`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 \${
              activeTab === "veiculos"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }\`}
          >
            <span>🚗</span>
            <span>Carros ({vehiclesList.length})</span>
          </button>

          <button
            type="button"
            data-testid="tab-btn-clientes"
            onClick={() => {
              setActiveTab("clientes");
              loadCustomers();
            }}
            className={\`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 \${
              activeTab === "clientes"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }\`}
          >
            <span>👤</span>
            <span>Clientes ({customersList.length})</span>
          </button>

          <button
            type="button"
            data-testid="tab-btn-manutencoes"
            onClick={() => {
              setActiveTab("manutencoes");
              loadMaintenances();
            }}
            className={\`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 \${
              activeTab === "manutencoes"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }\`}
          >
            <span>🔧</span>
            <span>Manutenções Feitas ({maintenancesList.length})</span>
          </button>

          <button
            type="button"
            data-testid="tab-btn-agendamentos"
            onClick={() => setActiveTab("agendamentos")}
            className={\`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 \${
              activeTab === "agendamentos"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }\`}
          >
            <span>⚡ Fila</span>
            {appointments.filter(a => a.status === "pendente").length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                {appointments.filter(a => a.status === "pendente").length}
              </span>
            )}
          </button>

          {selectedWo && (
            <button
              type="button"
              data-testid="tab-btn-os-ativa"
              onClick={() => setActiveTab("detalhes")}
              className={\`px-3 py-1.5 rounded-lg transition flex items-center gap-1 \${
                activeTab === "detalhes"
                  ? "bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-bold shadow-md"
                  : "text-amber-300 hover:text-white hover:bg-amber-950/40 border border-amber-500/30"
              }\`}
            >
              <span>⚙️</span>
              <span>OS {selectedWo.work_order.os_number}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="tab-btn-metricas"
            onClick={() => setActiveTab("metricas")}
            className={\`px-3 py-1.5 rounded-lg transition \${
              activeTab === "metricas"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }\`}
          >
            📊 Métricas
          </button>
        </div>`;

content = content.replace(oldNavTabs, newNavTabs);
console.log('4. Updated header navigation tabs');

fs.writeFileSync(pagePath, content, 'utf8');
console.log('First pass of oficina page update applied!');

