// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "gtech.db");

// Singleton connection
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function generateHash(data: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    -- 1. Empresa / Unidade
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cnpj TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 2. Usuários / Perfis (mecânico, administrativo, gestor)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('mecanico', 'adm', 'gestor')),
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- 3. Catálogo de Veículos e Carrocerias 3D
    CREATE TABLE IF NOT EXISTS vehicle_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      body_type TEXT NOT NULL CHECK(body_type IN ('hatch', 'sedan', 'suv', 'picape', 'van', 'outro')),
      is_quick_brand INTEGER NOT NULL DEFAULT 0,
      representation_type TEXT NOT NULL DEFAULT '3D representativo',
      source_license TEXT NOT NULL DEFAULT 'G-Tech Procedural/WebGL Engine',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 4. Clientes
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      document TEXT,
      preferred_contact_channel TEXT NOT NULL DEFAULT 'whatsapp',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- 5. Veículos
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      plate TEXT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year TEXT,
      motor TEXT,
      color TEXT,
      km INTEGER,
      fuel TEXT,
      chassis TEXT,
      body_type TEXT NOT NULL DEFAULT 'hatch',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    -- 6. Reservas de Agendamento (Site Público)
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      protocol TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      vehicle_brand TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      vehicle_plate TEXT,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      period TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      dashboard_alert TEXT,
      mobility TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'confirmado', 'cancelado', 'convertido_os')),
      work_order_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- 7. Ordens de Serviço (OS)
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      os_number TEXT NOT NULL UNIQUE,
      appointment_id TEXT,
      customer_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      assigned_mechanic_id TEXT,
      initial_scope TEXT NOT NULL,
      customer_complaint TEXT NOT NULL,
      diagnostic_authorized INTEGER NOT NULL DEFAULT 1,
      diagnostic_fee REAL NOT NULL DEFAULT 0.0,
      diagnostic_notes TEXT,
      fuel_level_entry TEXT NOT NULL DEFAULT '1/2',
      km_entry INTEGER,
      belongings_declared TEXT,
      keys_received INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'aberta' CHECK(status IN (
        'aberta', 'vistoria', 'inspecao', 'orcamento', 'aguardando_cliente', 
        'aprovada', 'em_servico', 'controle_qualidade', 'finalizada', 'entregue'
      )),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('baixa', 'normal', 'alta', 'critica')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (assigned_mechanic_id) REFERENCES users(id)
    );

    -- 8. Vistoria Fotográfica de Entrada
    CREATE TABLE IF NOT EXISTS wo_intake_inspection (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL UNIQUE,
      photo_front TEXT,
      photo_rear TEXT,
      photo_left TEXT,
      photo_right TEXT,
      photo_interior TEXT,
      photo_dashboard TEXT,
      video_url TEXT,
      odometer_km INTEGER,
      fuel_pct INTEGER DEFAULT 50,
      panel_alerts_found TEXT,
      observations TEXT,
      client_acknowledged INTEGER NOT NULL DEFAULT 0,
      client_refused_signature INTEGER NOT NULL DEFAULT 0,
      refusal_reason TEXT,
      witness_info TEXT,
      responsible_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    -- 9. Marcadores 3D e 2D de Avarias e Achados
    CREATE TABLE IF NOT EXISTS wo_hotspots (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      hotspot_type TEXT NOT NULL CHECK(hotspot_type IN ('avaria_entrada', 'achado_tecnico', 'servico_concluido')),
      region_name TEXT NOT NULL,
      orientation_side TEXT NOT NULL CHECK(orientation_side IN ('dianteira', 'traseira', 'lateral_esquerda', 'lateral_direita', 'teto', 'assoalho', 'interior', 'motor')),
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      pos_z REAL NOT NULL DEFAULT 0,
      severity TEXT NOT NULL DEFAULT 'baixa' CHECK(severity IN ('baixa', 'media', 'alta', 'critica')),
      damage_type TEXT NOT NULL DEFAULT 'risco',
      description TEXT NOT NULL,
      photo_url TEXT,
      author_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    -- 10. Checklist Técnico Inteligente (10 Grupos Padronizados)
    CREATE TABLE IF NOT EXISTS wo_checklist_items (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      group_name TEXT NOT NULL CHECK(group_name IN (
        'freios', 'arrefecimento', 'eletrica', 'lubrificacao', 'pneus',
        'direcao', 'suspensao', 'carroceria', 'motor', 'diagnostico'
      )),
      item_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NAO_INSPECIONADO' CHECK(status IN ('OK', 'ATENCAO', 'CRITICO', 'NAO_INSPECIONADO', 'NA')),
      finding_description TEXT,
      test_performed TEXT,
      recommendation TEXT,
      priority TEXT CHECK(priority IN ('baixa', 'media', 'alta', 'critica')),
      suggested_part TEXT,
      suggested_service TEXT,
      suggested_qty REAL DEFAULT 1,
      photo_url TEXT,
      mechanic_name TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    -- 11. Orçamentos e Versões (Rascunho -> Revisão -> Enviado -> Decidido)
    CREATE TABLE IF NOT EXISTS wo_quotes (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho', 'em_revisao', 'enviado', 'decidido')),
      subtotal_parts REAL NOT NULL DEFAULT 0,
      subtotal_services REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      authorized_total REAL NOT NULL DEFAULT 0,
      valid_until TEXT,
      estimated_deadline TEXT,
      warranty_terms TEXT,
      notes TEXT,
      public_token TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      sent_at TEXT,
      decided_at TEXT,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    -- 12. Itens do Orçamento
    CREATE TABLE IF NOT EXISTS wo_quote_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      checklist_item_id TEXT,
      description TEXT NOT NULL,
      part_code TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price_part REAL NOT NULL DEFAULT 0,
      unit_price_service REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      is_indivisible INTEGER NOT NULL DEFAULT 0,
      indivisible_justification TEXT,
      decision TEXT NOT NULL DEFAULT 'pendente' CHECK(decision IN ('pendente', 'aprovado', 'recusado', 'esclarecimento')),
      decision_notes TEXT,
      refusal_reason TEXT,
      safety_risk_warning TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (quote_id) REFERENCES wo_quotes(id)
    );

    -- 13. Decisão Auditável do Cliente
    CREATE TABLE IF NOT EXISTS wo_customer_decisions (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      quote_id TEXT NOT NULL,
      decision_token TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('aprovado_total', 'aprovado_parcial', 'recusado_total')),
      authorized_amount REAL NOT NULL,
      refused_amount REAL NOT NULL,
      client_name TEXT NOT NULL,
      client_document TEXT,
      ip_address TEXT,
      user_agent TEXT,
      audit_hash TEXT NOT NULL,
      refusal_risk_acknowledged INTEGER DEFAULT 0,
      risk_acknowledgement_text TEXT,
      receipt_protocol TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
      FOREIGN KEY (quote_id) REFERENCES wo_quotes(id)
    );

    -- 14. Checklist de Saída & Entrega
    CREATE TABLE IF NOT EXISTS wo_exit_checklist (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL UNIQUE,
      road_test_ok INTEGER NOT NULL DEFAULT 1,
      warning_lights_cleared INTEGER NOT NULL DEFAULT 1,
      parts_returned INTEGER NOT NULL DEFAULT 0,
      vehicle_cleaned INTEGER NOT NULL DEFAULT 1,
      wheel_torque_checked INTEGER NOT NULL DEFAULT 1,
      recommendations TEXT,
      delivered_to_name TEXT,
      delivered_by TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    -- 15. Linha do Tempo e Eventos da OS
    CREATE TABLE IF NOT EXISTS wo_timeline_events (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    -- 16. Trilha de Auditoria Imutável (Audit Log)
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      payload TEXT,
      hash_sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 17. Dados Técnicos e Manuais (StartMyCar Intelligence)
    CREATE TABLE IF NOT EXISTS vehicle_tech_specs (
      id TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      years TEXT NOT NULL,
      engine TEXT NOT NULL,
      body_type TEXT NOT NULL,
      real_photo_url TEXT NOT NULL,
      oil_viscosity TEXT NOT NULL,
      oil_capacity_liters REAL NOT NULL,
      oil_norm TEXT NOT NULL,
      coolant_type TEXT NOT NULL,
      coolant_capacity_liters REAL NOT NULL,
      brake_fluid TEXT NOT NULL DEFAULT 'DOT 4',
      tire_pressure_front_psi INTEGER NOT NULL DEFAULT 30,
      tire_pressure_rear_psi INTEGER NOT NULL DEFAULT 30,
      tire_pressure_loaded_psi INTEGER NOT NULL DEFAULT 34,
      spark_plugs_gap_mm REAL DEFAULT 0.9,
      fuse_box_engine TEXT,
      fuse_box_cabin TEXT,
      common_issues TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 18. Catálogo Expansível de Componentes Automotivos
    CREATE TABLE IF NOT EXISTS vehicle_components (
      id TEXT PRIMARY KEY,
      system_group TEXT NOT NULL,
      assembly_name TEXT NOT NULL,
      component_name TEXT NOT NULL,
      position_side TEXT NOT NULL DEFAULT 'central',
      axle TEXT NOT NULL DEFAULT 'dianteiro',
      mesh_id TEXT,
      applicability TEXT NOT NULL DEFAULT 'confirmada',
      oem_code TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 19. Inspeções Técnicas por Componente na OS
    CREATE TABLE IF NOT EXISTS wo_component_inspections (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      component_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ok', 'atencao', 'critico', 'nao_inspecionado', 'nao_aplicavel')),
      test_performed TEXT,
      measurement_value TEXT,
      tolerance_spec TEXT,
      finding_description TEXT,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('baixa', 'normal', 'alta', 'critica')),
      photo_url TEXT,
      suggested_repair TEXT,
      suggested_part_price REAL DEFAULT 0,
      suggested_service_price REAL DEFAULT 0,
      is_quoted INTEGER DEFAULT 0,
      inspected_by TEXT NOT NULL,
      inspected_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
      FOREIGN KEY (component_id) REFERENCES vehicle_components(id)
    );

    -- 20. Registro Oficial de Peças Substituídas ("PEÇA TROCADA")
    CREATE TABLE IF NOT EXISTS wo_replaced_parts (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      quote_item_id TEXT,
      component_id TEXT,
      component_name TEXT NOT NULL,
      assembly_path TEXT NOT NULL,
      position_side TEXT,
      removed_part_desc TEXT NOT NULL,
      installed_part_desc TEXT NOT NULL,
      photo_before_url TEXT,
      photo_after_url TEXT,
      technician_name TEXT NOT NULL,
      seal_status TEXT NOT NULL DEFAULT 'PEÇA TROCADA',
      warranty_terms TEXT DEFAULT '90 dias conforme CDC',
      replaced_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );
  `);

  seedInitialData(db);
  seedTechSpecs(db);
  seedComponentsAndReplacements(db);
  seedVolkswagenModels(db);
}

function seedInitialData(db: DatabaseSync) {
  // 1. Empresa G-Tech
  const companyCheck = db.prepare("SELECT id FROM companies WHERE id = ?").get("gtech-paranagua");
  if (!companyCheck) {
    db.prepare(`
      INSERT INTO companies (id, name, cnpj, phone, email, address, city, state, postal_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "gtech-paranagua",
      "G-TECH Serviços Automotivos",
      "48.912.834/0001-90",
      "+55 41 9652-2715",
      "contato@gtech.pgua.br",
      "Rua Maria da Conceição Teixeira de Souza, 815, Oficina, Divinéia",
      "Paranaguá",
      "PR",
      "83212-440"
    );
  }

  // 2. Usuários padrão
  const usersCheck = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
  if (usersCheck.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, company_id, name, email, role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run("user-giovane", "gtech-paranagua", "Giovane Ribeiro", "giovane@gtech.pgua.br", "gestor", "(41) 9652-2715");
    insertUser.run("user-mecanico", "gtech-paranagua", "Carlos Mecânico (Bancada)", "carlos@gtech.pgua.br", "mecanico", "(41) 98888-1111");
    insertUser.run("user-adm", "gtech-paranagua", "Recepção / ADM G-Tech", "atendimento@gtech.pgua.br", "adm", "(41) 9652-2715");
  }

  // 3. Catálogo de Veículos e Carrocerias
  const catCheck = db.prepare("SELECT count(*) as count FROM vehicle_catalog").get() as { count: number };
  if (catCheck.count === 0) {
    const insertCat = db.prepare(`
      INSERT INTO vehicle_catalog (brand, model, body_type, is_quick_brand, representation_type)
      VALUES (?, ?, ?, ?, ?)
    `);

    // 12 marcas de atalho rápido e seus modelos comuns
    const catalogEntries = [
      // Renault (Especialidade)
      { b: "Renault", m: "Sandero", t: "hatch", q: 1 },
      { b: "Renault", m: "Logan", t: "sedan", q: 1 },
      { b: "Renault", m: "Duster", t: "suv", q: 1 },
      { b: "Renault", m: "Kwid", t: "hatch", q: 1 },
      { b: "Renault", m: "Oroch", t: "picape", q: 1 },
      { b: "Renault", m: "Master", t: "van", q: 1 },
      // Volkswagen
      { b: "Volkswagen", m: "Gol", t: "hatch", q: 1 },
      { b: "Volkswagen", m: "Polo", t: "hatch", q: 1 },
      { b: "Volkswagen", m: "Virtus", t: "sedan", q: 1 },
      { b: "Volkswagen", m: "T-Cross", t: "suv", q: 1 },
      { b: "Volkswagen", m: "Saveiro", t: "picape", q: 1 },
      { b: "Volkswagen", m: "Amarok", t: "picape", q: 1 },
      // Chevrolet
      { b: "Chevrolet", m: "Onix", t: "hatch", q: 1 },
      { b: "Chevrolet", m: "Onix Plus", t: "sedan", q: 1 },
      { b: "Chevrolet", m: "Tracker", t: "suv", q: 1 },
      { b: "Chevrolet", m: "S10", t: "picape", q: 1 },
      { b: "Chevrolet", m: "Montana", t: "picape", q: 1 },
      // Fiat
      { b: "Fiat", m: "Argo", t: "hatch", q: 1 },
      { b: "Fiat", m: "Cronos", t: "sedan", q: 1 },
      { b: "Fiat", m: "Pulse", t: "suv", q: 1 },
      { b: "Fiat", m: "Strada", t: "picape", q: 1 },
      { b: "Fiat", m: "Toro", t: "picape", q: 1 },
      { b: "Fiat", m: "Fiorino", t: "van", q: 1 },
      // Ford
      { b: "Ford", m: "Ka", t: "hatch", q: 1 },
      { b: "Ford", m: "Ka Sedan", t: "sedan", q: 1 },
      { b: "Ford", m: "EcoSport", t: "suv", q: 1 },
      { b: "Ford", m: "Ranger", t: "picape", q: 1 },
      // Hyundai
      { b: "Hyundai", m: "HB20", t: "hatch", q: 1 },
      { b: "Hyundai", m: "HB20S", t: "sedan", q: 1 },
      { b: "Hyundai", m: "Creta", t: "suv", q: 1 },
      // Toyota
      { b: "Toyota", m: "Yaris", t: "hatch", q: 1 },
      { b: "Toyota", m: "Corolla", t: "sedan", q: 1 },
      { b: "Toyota", m: "Corolla Cross", t: "suv", q: 1 },
      { b: "Toyota", m: "Hilux", t: "picape", q: 1 },
      // Honda
      { b: "Honda", m: "Fit", t: "hatch", q: 1 },
      { b: "Honda", m: "City", t: "sedan", q: 1 },
      { b: "Honda", m: "Civic", t: "sedan", q: 1 },
      { b: "Honda", m: "HR-V", t: "suv", q: 1 },
      // Jeep
      { b: "Jeep", m: "Renegade", t: "suv", q: 1 },
      { b: "Jeep", m: "Compass", t: "suv", q: 1 },
      { b: "Jeep", m: "Commander", t: "suv", q: 1 },
      // Peugeot
      { b: "Peugeot", m: "208", t: "hatch", q: 1 },
      { b: "Peugeot", m: "2008", t: "suv", q: 1 },
      { b: "Peugeot", m: "Expert", t: "van", q: 1 },
      // Citroën
      { b: "Citroën", m: "C3", t: "hatch", q: 1 },
      { b: "Citroën", m: "C4 Cactus", t: "suv", q: 1 },
      { b: "Citroën", m: "Jumpy", t: "van", q: 1 },
      // Nissan
      { b: "Nissan", m: "March", t: "hatch", q: 1 },
      { b: "Nissan", m: "Versa", t: "sedan", q: 1 },
      { b: "Nissan", m: "Kicks", t: "suv", q: 1 },
      { b: "Nissan", m: "Frontier", t: "picape", q: 1 },
    ];

    for (const item of catalogEntries) {
      insertCat.run(item.b, item.m, item.t, item.q, "3D representativo");
    }
  }

  // 4. Seed de uma OS de demonstração ponta a ponta (Caso real: Renault Duster do Caso Prático)
  seedDemoCase(db);

  // 5. Seed de Ordens de Serviço Volkswagen com Reconhecimento Automático e 51 Fotos Reais
  seedVolkswagenWorkOrders(db);
}

function seedDemoCase(db: DatabaseSync) {
  const osCheck = db.prepare("SELECT id FROM work_orders WHERE os_number = ?").get("GT-OS-000127");
  if (osCheck) return;

  const now = new Date().toISOString();

  // Cliente
  const custId = "cust-demo-rodrigo";
  db.prepare(`
    INSERT INTO customers (id, company_id, name, phone, email, document, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    custId,
    "gtech-paranagua",
    "Rodrigo Camargo",
    "(41) 99123-4567",
    "rodrigo.camargo@email.com",
    "042.891.239-12",
    "Cliente recorrente, preza por transparência e fotos dos testes."
  );

  // Veículo
  const vehId = "veh-demo-duster";
  db.prepare(`
    INSERT INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    vehId,
    custId,
    "BCR-4E28",
    "Renault",
    "Duster Dynamique 2.0 16V",
    "2021",
    "2.0 Flex F4R",
    "Prata Metálico",
    58420,
    "Flex",
    "suv"
  );

  // Reserva prévia vinculada
  const apptId = "appt-demo-001";
  db.prepare(`
    INSERT INTO appointments (
      id, company_id, protocol, customer_name, customer_phone,
      vehicle_brand, vehicle_model, vehicle_plate, scheduled_date, scheduled_time,
      period, issue_description, dashboard_alert, mobility, status, work_order_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    apptId,
    "gtech-paranagua",
    "GT-2026-4823",
    "Rodrigo Camargo",
    "(41) 99123-4567",
    "Renault",
    "Duster 2.0 2021",
    "BCR-4E28",
    new Date().toISOString().split("T")[0],
    "09:00",
    "Manhã (08h às 12h)",
    "Luz de injeção acesa no painel e barulho metálico na suspensão dianteira ao manobrar.",
    "Luz de Injeção Eletrônica (Check Engine) acesa no painel",
    "Vou levar o veículo até a oficina",
    "convertido_os",
    "wo-demo-00127"
  );

  // Ordem de Serviço
  const woId = "wo-demo-00127";
  db.prepare(`
    INSERT INTO work_orders (
      id, company_id, os_number, appointment_id, customer_id, vehicle_id,
      assigned_mechanic_id, initial_scope, customer_complaint, diagnostic_authorized,
      diagnostic_fee, fuel_level_entry, km_entry, belongings_declared, status, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    woId,
    "gtech-paranagua",
    "GT-OS-000127",
    apptId,
    custId,
    vehId,
    "user-giovane",
    "Diagnóstico Eletrônico Avançado de Injeção & Revisão do Sistema de Direção / Suspensão",
    "Luz de injeção acendeu na BR-277; estalos metálicos na roda dianteira direita ao girar volante.",
    1,
    180.0,
    "3/4",
    58420,
    "Tag pedágio, estepe e ferramentas de bordo",
    "aguardando_cliente",
    "alta"
  );

  // Vistoria de Entrada (4 vistas)
  db.prepare(`
    INSERT INTO wo_intake_inspection (
      id, work_order_id, photo_front, photo_rear, photo_left, photo_right,
      photo_interior, photo_dashboard, odometer_km, fuel_pct, panel_alerts_found,
      observations, client_acknowledged, responsible_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "intake-demo-127",
    woId,
    "/img/demo/duster_front.jpg",
    "/img/demo/duster_rear.jpg",
    "/img/demo/duster_left.jpg",
    "/img/demo/duster_right.jpg",
    "/img/demo/duster_interior.jpg",
    "/img/demo/duster_dash.jpg",
    58420,
    75,
    "Luz de Injeção (Check Engine) ativa",
    "Pequeno risco no para-choque dianteiro direito registrado e preservado.",
    1,
    "Giovane Ribeiro"
  );

  // Hotspots 3D (Avaria de Entrada + Achados Técnicos)
  const insertHotspot = db.prepare(`
    INSERT INTO wo_hotspots (
      id, work_order_id, hotspot_type, region_name, orientation_side,
      pos_x, pos_y, pos_z, severity, damage_type, description, author_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHotspot.run(
    "hs-demo-1",
    woId,
    "avaria_entrada",
    "Para-choque Dianteiro Direito",
    "dianteira",
    0.85, 0.45, 1.95,
    "baixa",
    "risco superficial",
    "Risco superficial de 4cm no canto do para-choque dianteiro direito (avaria pré-existente documentada na entrada).",
    "Giovane Ribeiro"
  );

  insertHotspot.run(
    "hs-demo-2",
    woId,
    "achado_tecnico",
    "Terminal de Direção Dianteiro Direito",
    "dianteira",
    0.72, 0.35, 1.10,
    "critica",
    "folga excessiva",
    "Folga excessiva constatada no pivô do terminal de direção direito. Risco de desalinhamento e perda de controle direcional.",
    "Giovane Ribeiro"
  );

  insertHotspot.run(
    "hs-demo-3",
    woId,
    "achado_tecnico",
    "Sensor de Oxigênio (Sonda Lambda 1)",
    "motor",
    0.15, 0.65, 1.40,
    "media",
    "defeito elétrico",
    "Código DTC P0130 gravado na ECU. Sinal travado em mistura rica no osciloscópio.",
    "Giovane Ribeiro"
  );

  // Itens do Checklist Técnico Inteligente (10 Grupos)
  const insertCheck = db.prepare(`
    INSERT INTO wo_checklist_items (
      id, work_order_id, group_name, item_name, status,
      finding_description, test_performed, recommendation, priority,
      suggested_part, suggested_service, suggested_qty, mechanic_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCheck.run(
    "chk-demo-1", woId, "direcao", "Terminal de Direção Direito", "CRITICO",
    "Folga axial acentuada no terminal de direção dianteiro direito com coifa rasgada.",
    "Teste de alavanca e medição com relógio comparador na bancada.",
    "Substituição imediata do terminal e alinhamento computadorizado.",
    "critica", "Terminal de Direção Nakata/Renault", "Substituição e alinhamento de geometria", 1, "Giovane Ribeiro"
  );

  insertCheck.run(
    "chk-demo-2", woId, "diagnostico", "Injeção Eletrônica & DTCs", "ATENCAO",
    "DTC P0130 ativo na memória da ECU. Sonda lambda pré-catalisador com resposta lenta.",
    "Leitura com scanner e teste de tempo de resposta no osciloscópio.",
    "Substituição da sonda lambda pré-catalisador e limpeza do corpo de borboleta.",
    "media", "Sonda Lambda Bosch Planar", "Diagnóstico, troca e reset de parâmetros auto-adaptativos", 1, "Giovane Ribeiro"
  );

  insertCheck.run(
    "chk-demo-3", woId, "freios", "Pastilhas e Discos Dianteiros", "OK",
    "Espessura das pastilhas em 8mm (ótimo estado). Fluido DOT4 com ponto de ebulição conforme.",
    "Medição com paquímetro técnico e teste térmico de fluido.",
    "Nenhuma intervenção necessária no momento.",
    null, null, null, 0, "Giovane Ribeiro"
  );

  insertCheck.run(
    "chk-demo-4", woId, "lubrificacao", "Óleo do Motor e Filtros", "ATENCAO",
    "Óleo próximo do limite de 10.000 km / 1 ano de uso.",
    "Inspeção visual de viscosidade e etiqueta de troca anterior.",
    "Troca preventiva de óleo 5W40 100% sintético e filtro de óleo.",
    "baixa", "Óleo 5W40 Sintético (5L) + Filtro Mann", "Troca de óleo e filtro com descarte ecológico", 1, "Giovane Ribeiro"
  );

  insertCheck.run("chk-demo-5", woId, "arrefecimento", "Líquido de Arrefecimento e Mangueiras", "OK", "Aditivo orgânico 50/50 em nível adequado e estanque.", "Teste de pressurização do sistema a 1.2 bar.", "OK", null, null, null, 0, "Giovane Ribeiro");
  insertCheck.run("chk-demo-6", woId, "eletrica", "Bateria e Tensão do Alternador", "OK", "Bateria 60Ah com CCA de 480A; alternador gerando 14.2V sob carga.", "Teste de condutância e teste de ondulação de retificador.", "OK", null, null, null, 0, "Giovane Ribeiro");
  insertCheck.run("chk-demo-7", woId, "pneus", "Estado dos Pneus e Calibração", "OK", "Sulcos acima de 4.2mm em todos os eixos; sem bolhas.", "Medição com profundímetro digital.", "OK", null, null, null, 0, "Giovane Ribeiro");
  insertCheck.run("chk-demo-8", woId, "suspensao", "Amortecedores e Buchas", "OK", "Batentes íntegros, sem vazamento hidráulico nas hastes.", "Inspeção visual e teste dinâmico.", "OK", null, null, null, 0, "Giovane Ribeiro");
  insertCheck.run("chk-demo-9", woId, "carroceria", "Fixações e Protetor de Cárter", "OK", "Protetor fixado corretamente sem trincas.", "Inspeção de torque.", "OK", null, null, null, 0, "Giovane Ribeiro");
  insertCheck.run("chk-demo-10", woId, "motor", "Correia Dentada e Acessórios", "OK", "Correia trocada recentemente conforme histórico.", "Inspeção visual da tampa de sincronismo.", "OK", null, null, null, 0, "Giovane Ribeiro");

  // Orçamento v1
  const quoteId = "quote-demo-127-v1";
  const publicToken = "gt-tok-rodrigo-127";
  db.prepare(`
    INSERT INTO wo_quotes (
      id, work_order_id, version_number, status, subtotal_parts,
      subtotal_services, total_amount, authorized_total, valid_until,
      estimated_deadline, warranty_terms, notes, public_token, created_by, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quoteId,
    woId,
    1,
    "enviado",
    640.0,
    370.0,
    1010.0,
    0.0,
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    "1 dia útil após aprovação",
    "90 dias para peças e serviços conforme CDC Art. 26",
    "Orçamento detalhado por item para aprovação transparente do cliente.",
    publicToken,
    "Giovane Ribeiro (ADM)",
    now
  );

  // Itens do Orçamento
  const insertQuoteItem = db.prepare(`
    INSERT INTO wo_quote_items (
      id, quote_id, checklist_item_id, description, part_code, quantity,
      unit_price_part, unit_price_service, subtotal, is_indivisible,
      safety_risk_warning, decision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Item 1: Terminal de Direção (Crítico de Segurança!)
  insertQuoteItem.run(
    "qitem-1",
    quoteId,
    "chk-demo-1",
    "Terminal de Direção Dianteiro Direito + Alinhamento Computadorizado",
    "TERM-NK-7412",
    1,
    160.0,
    120.0,
    280.0,
    0,
    "ITEM CRÍTICO DE SEGURANÇA: A folga excessiva no terminal de direção pode causar instabilidade direcional grave e desgaste prematuro de pneus.",
    "pendente"
  );

  // Item 2: Sonda Lambda
  insertQuoteItem.run(
    "qitem-2",
    quoteId,
    "chk-demo-2",
    "Sonda Lambda Pré-Catalisador Planar + Reset de Parâmetros da ECU",
    "SOND-BOSCH-0258",
    1,
    260.0,
    130.0,
    390.0,
    0,
    "A sonda defeituosa causa aumento de consumo de combustível e acendimento da luz de injeção.",
    "pendente"
  );

  // Item 3: Troca de Óleo e Filtro (Preventiva)
  insertQuoteItem.run(
    "qitem-3",
    quoteId,
    "chk-demo-4",
    "Óleo 5W40 Sintético Homologado Renault (5L) + Filtro de Óleo Mann",
    "OIL-5W40-MANN",
    1,
    220.0,
    120.0,
    340.0,
    0,
    null,
    "pendente"
  );

  // Evento na Linha do Tempo
  db.prepare(`
    INSERT INTO wo_timeline_events (
      id, work_order_id, event_type, title, description, actor_name, actor_role
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "tl-demo-1",
    woId,
    "ORCAMENTO_ENVIADO",
    "Orçamento v1 publicado e link enviado",
    "Orçamento no valor de R$ 1.010,00 publicado por Giovane Ribeiro e disponibilizado no portal do cliente.",
    "Giovane Ribeiro",
    "adm"
  );

  // Registro de Auditoria
  db.prepare(`
    INSERT INTO audit_log (
      id, company_id, entity_type, entity_id, action, actor_name, actor_role, payload, hash_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "aud-demo-1",
    "gtech-paranagua",
    "work_orders",
    woId,
    "CREATE_WO",
    "Giovane Ribeiro",
    "gestor",
    JSON.stringify({ os_number: "GT-OS-000127", customer: "Rodrigo Camargo", vehicle: "BCR-4E28" }),
    generateHash({ os_number: "GT-OS-000127", customer: "Rodrigo Camargo" })
  );

  seedTechSpecs(db);
}

function seedTechSpecs(db: DatabaseSync) {
  const check = db.prepare("SELECT count(*) as count FROM vehicle_tech_specs").get() as { count: number };
  if (check && check.count > 0) return;

  const insertSpec = db.prepare(`
    INSERT INTO vehicle_tech_specs (
      id, brand, model, years, engine, body_type, real_photo_url,
      oil_viscosity, oil_capacity_liters, oil_norm,
      coolant_type, coolant_capacity_liters, brake_fluid,
      tire_pressure_front_psi, tire_pressure_rear_psi, tire_pressure_loaded_psi,
      spark_plugs_gap_mm, fuse_box_engine, fuse_box_cabin, common_issues
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Renault Duster (Especialidade da Oficina)
  insertSpec.run(
    "spec-renault-duster",
    "Renault",
    "Duster",
    "2015-2024",
    "2.0 16V F4R / 1.6 16V SCe",
    "suv",
    "/img/vehicles/renault-duster.jpg",
    "5W40 100% Sintético",
    4.8,
    "Renault RN0700 / RN0710 (API SN / ACEA A3/B4)",
    "Aditivo Orgânico Tipo D (Glacelf / Motrio)",
    6.0,
    "DOT 4 Sintético",
    29,
    29,
    32,
    0.9,
    JSON.stringify([
      { fuse: "F1", amp: "30A", color: "#22c55e", desc: "Eletroventilador de Arrefecimento (Velocidade 2)" },
      { fuse: "F2", amp: "25A", color: "#ffffff", desc: "Bomba de Combustível e Bicos Injetores" },
      { fuse: "F3", amp: "50A", color: "#ef4444", desc: "Módulo ABS e Controle Eletrônico de Estabilidade (ESP)" },
      { fuse: "F4", amp: "30A", color: "#22c55e", desc: "Motor de Partida e Solenoide" },
      { fuse: "F5", amp: "15A", color: "#3b82f6", desc: "Módulo da Injeção Eletrônica (ECU Principal)" },
      { fuse: "R1", amp: "Relé", color: "#00c6ff", desc: "Relé Principal de Alimentação da Injeção" },
      { fuse: "R2", amp: "Relé", color: "#00c6ff", desc: "Relé da Bomba de Combustível" },
      { fuse: "R3", amp: "Relé", color: "#ffd000", desc: "Relé do Compressor de Ar-Condicionado" }
    ]),
    JSON.stringify([
      { fuse: "F10", amp: "15A", color: "#3b82f6", desc: "Luzes de Freio e Lanternas Traseiras" },
      { fuse: "F11", amp: "20A", color: "#eab308", desc: "Vidros Elétricos Dianteiros" },
      { fuse: "F12", amp: "10A", color: "#ef4444", desc: "Painel de Instrumentos e Tomada OBD2" },
      { fuse: "F13", amp: "15A", color: "#3b82f6", desc: "Tomada 12V Auxiliar e Acendedor" },
      { fuse: "F14", amp: "20A", color: "#eab308", desc: "Limpadores e Lavador de Para-brisa" },
      { fuse: "F15", amp: "10A", color: "#ef4444", desc: "Airbags e Pré-tensionadores de Cinto" }
    ]),
    JSON.stringify([
      {
        symptom: "Estalo ou folga na roda dianteira em manobras",
        cause: "Desgaste acelerado no terminal de direção ou buchas da barra estabilizadora.",
        procedure: "Inspecionar terminal com relógio comparador; folga > 1.0mm exige troca imediata e alinhamento."
      },
      {
        symptom: "Luz multifunção (chave de serviço) ou injeção acesa",
        cause: "Falha na sonda lambda pré-catalisador ou carbonização no corpo de borboleta (TBI).",
        procedure: "Medir oscilação da sonda com osciloscópio (0.1V a 0.9V); limpeza ultrassônica do corpo e reset de parâmetros."
      },
      {
        symptom: "Dificuldade na partida com motor frio",
        cause: "Válvula termostática travada aberta ou oxidação no relé de partida.",
        procedure: "Monitorar temperatura no scanner e testar queda de tensão na linha 30."
      }
    ])
  );

  // 2. Renault Sandero
  insertSpec.run(
    "spec-renault-sandero",
    "Renault",
    "Sandero",
    "2014-2024",
    "1.0 12V B4D / 1.6 16V SCe",
    "hatch",
    "/img/vehicles/renault-sandero.jpg",
    "5W40 100% Sintético",
    4.5,
    "Renault RN0710 (API SN)",
    "Aditivo Orgânico Tipo D",
    5.5,
    "DOT 4 Sintético",
    32,
    29,
    34,
    0.9,
    JSON.stringify([
      { fuse: "F1", amp: "30A", color: "#22c55e", desc: "Ventoinha do Radiador" },
      { fuse: "F2", amp: "20A", color: "#eab308", desc: "Bomba de Combustível" },
      { fuse: "F3", amp: "15A", color: "#3b82f6", desc: "Bobinas de Ignição e Injetores" }
    ]),
    JSON.stringify([
      { fuse: "F10", amp: "15A", color: "#3b82f6", desc: "Faróis de Neblina e Painel" },
      { fuse: "F11", amp: "10A", color: "#ef4444", desc: "Conector de Diagnóstico OBD2" }
    ]),
    JSON.stringify([
      {
        symptom: "Marcha lenta oscilando",
        cause: "Sujeira no corpo de borboleta e entrada falsa de ar nos anéis do coletor.",
        procedure: "Trocar guarnições do coletor e programar TPS via scanner."
      }
    ])
  );

  // 3. Renault Logan
  insertSpec.run(
    "spec-renault-logan",
    "Renault",
    "Logan",
    "2014-2024",
    "1.0 12V / 1.6 16V SCe",
    "sedan",
    "/img/vehicles/renault-logan.jpg",
    "5W40 100% Sintético",
    4.5,
    "Renault RN0710 (API SN)",
    "Aditivo Orgânico Tipo D",
    5.5,
    "DOT 4 Sintético",
    32,
    30,
    35,
    0.9,
    JSON.stringify([
      { fuse: "F1", amp: "30A", color: "#22c55e", desc: "Ventoinha de Arrefecimento" },
      { fuse: "F2", amp: "20A", color: "#eab308", desc: "Bomba de Combustível" }
    ]),
    JSON.stringify([
      { fuse: "F12", amp: "10A", color: "#ef4444", desc: "Painel de Instrumentos e OBD2" }
    ]),
    JSON.stringify([
      {
        symptom: "Ruído metálico na suspensão dianteira",
        cause: "Folga em pivô de bandeja ou batente de amortecedor estourado.",
        procedure: "Substituir buchas e amortecedores em pares."
      }
    ])
  );

  // 4. Renault Oroch
  insertSpec.run(
    "spec-renault-oroch",
    "Renault",
    "Oroch",
    "2016-2024",
    "1.6 16V SCe / 2.0 16V / 1.3 Turbo TCe",
    "picape",
    "/img/vehicles/renault-oroch.jpg",
    "5W40 100% Sintético (1.6/2.0) / 0W20 RN17 (1.3 TCe)",
    4.8,
    "Renault RN0710 / RN17",
    "Aditivo Orgânico Tipo D",
    6.5,
    "DOT 4 Sintético",
    32,
    36,
    41,
    0.85,
    JSON.stringify([
      { fuse: "F1", amp: "40A", color: "#f97316", desc: "Eletroventilador Duplo" },
      { fuse: "F2", amp: "30A", color: "#22c55e", desc: "Módulo Tração 4x4 / ABS" }
    ]),
    JSON.stringify([
      { fuse: "F14", amp: "20A", color: "#eab308", desc: "Tomada da Caçamba e Iluminação" }
    ]),
    JSON.stringify([
      {
        symptom: "Ruído na caçamba e suspensão traseira sob carga",
        cause: "Buchas dos braços multilink traseiros ressecadas.",
        procedure: "Substituir buchas do eixo multilink e conferir cambagem."
      }
    ])
  );

  // 5. Renault Master
  insertSpec.run(
    "spec-renault-master",
    "Renault",
    "Master",
    "2013-2024",
    "2.3 dCi 16V Turbo Diesel",
    "van",
    "/img/vehicles/renault-master.jpg",
    "5W30 100% Sintético DPF (Low SAPS)",
    7.5,
    "Renault RN0720 (ACEA C4)",
    "Aditivo Orgânico Tipo D Reforçado",
    10.5,
    "DOT 4 Super",
    44,
    48,
    52,
    0.8,
    JSON.stringify([
      { fuse: "F1", amp: "60A", color: "#e11d48", desc: "Velas Aquecedoras Diesel" },
      { fuse: "F2", amp: "40A", color: "#f97316", desc: "Bomba de Alta Pressão Common Rail" }
    ]),
    JSON.stringify([
      { fuse: "F15", amp: "15A", color: "#3b82f6", desc: "Tacógrafo e Rede Multiplexada" }
    ]),
    JSON.stringify([
      {
        symptom: "Fumaça branca ou perda de potência em subidas",
        cause: "Saturação do filtro de partículas DPF ou válvula EGR travada.",
        procedure: "Limpeza química de DPF e regeneração forçada via scanner."
      }
    ])
  );

  // 6. Chevrolet Onix
  insertSpec.run(
    "spec-chevrolet-onix",
    "Chevrolet",
    "Onix",
    "2019-2024",
    "1.0 12V CSS Prime / 1.0 Turbo",
    "hatch",
    "/img/vehicles/chevrolet-onix.jpg",
    "5W30 / 0W20 100% Sintético Dexos1 Gen 2/3 (Correia Banhada a Óleo)",
    3.5,
    "GM Dexos1 Gen 2 / Gen 3",
    "Aditivo Dex-Cool Laranja Orgânico",
    5.0,
    "DOT 4 LV (Baixa Viscosidade)",
    32,
    30,
    35,
    0.8,
    JSON.stringify([
      { fuse: "F1", amp: "30A", color: "#22c55e", desc: "Eletroventilador PWM" },
      { fuse: "F2", amp: "15A", color: "#3b82f6", desc: "Módulo ECM / Injeção Direta" }
    ]),
    JSON.stringify([
      { fuse: "F11", amp: "10A", color: "#ef4444", desc: "Painel Digital e Central Multimídia" }
    ]),
    JSON.stringify([
      {
        symptom: "Luz de pressão de óleo acendendo intermitente",
        cause: "Degradação da correia dentada banhada a óleo por uso de óleo incorreto, entupindo pescador.",
        procedure: "Desmontar cárter, inspecionar pescador e substituir correia com ferramenta de sincronismo."
      }
    ])
  );

  // 7. Volkswagen Gol / Polo
  insertSpec.run(
    "spec-vw-gol-polo",
    "Volkswagen",
    "Gol / Polo",
    "2018-2024",
    "1.0 12V MPI / 1.6 16V MSI",
    "hatch",
    "/img/vehicles/volkswagen-gol.jpg",
    "5W40 100% Sintético Maxi Performance",
    4.0,
    "VW 502 00 / 505 00",
    "Aditivo G12 / G13 Rosa",
    5.5,
    "DOT 4",
    32,
    30,
    34,
    0.9,
    JSON.stringify([
      { fuse: "F1", amp: "30A", color: "#22c55e", desc: "Ventoinha do Radiador" },
      { fuse: "F2", amp: "15A", color: "#3b82f6", desc: "Bobinas de Ignição Individuais" }
    ]),
    JSON.stringify([
      { fuse: "F12", amp: "10A", color: "#ef4444", desc: "Painel e Tomada OBD2" }
    ]),
    JSON.stringify([
      {
        symptom: "Falha de cilindro em acelerações",
        cause: "Fissura na carcaça da bobina de ignição ou desgaste prematuro de velas.",
        procedure: "Testar secundário da bobina com ponta indutiva no osciloscópio."
      }
    ])
  );
}

function seedComponentsAndReplacements(db: DatabaseSync) {
  const checkComp = db.prepare("SELECT count(*) as count FROM vehicle_components").get() as { count: number };
  if (checkComp && checkComp.count > 0) return;

  const insertComp = db.prepare(`
    INSERT INTO vehicle_components (
      id, system_group, assembly_name, component_name, position_side, axle, mesh_id, applicability, oem_code, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const components = [
    // 1. Propulsão e Alimentação
    { id: "cmp-engine-block", sys: "propulsao", ass: "Motor", name: "Bloco do Motor & Pistões", side: "central", axle: "dianteiro", mesh: "mesh_engine_block", oem: "F4R-2001", notes: "Bloco em ferro fundido de 4 cilindros em linha." },
    { id: "cmp-cylinder-head", sys: "propulsao", ass: "Motor › Cabeçote", name: "Cabeçote 16 Válvulas", side: "central", axle: "dianteiro", mesh: "mesh_cylinder_head", oem: "7701471378", notes: "Cabeçote de alumínio com comando duplo DOHC." },
    { id: "cmp-camshaft", sys: "propulsao", ass: "Motor › Cabeçote", name: "Comando de Válvulas", side: "central", axle: "dianteiro", mesh: "mesh_camshaft", oem: "8200100527", notes: "Eixo comando de admissão e escape com cames tratados." },
    { id: "cmp-spark-plugs", sys: "propulsao", ass: "Motor › Ignição", name: "Velas de Ignição (Jogo 4)", side: "central", axle: "dianteiro", mesh: "mesh_spark_plugs", oem: "7700500168", notes: "Velas de níquel/irídio gap calibrado em 0.9mm." },
    { id: "cmp-ignition-coils", sys: "propulsao", ass: "Motor › Ignição", name: "Bobinas de Ignição Individuais", side: "central", axle: "dianteiro", mesh: "mesh_ignition_coils", oem: "8200765882", notes: "Bobinas tipo caneta para cada vela." },
    { id: "cmp-fuel-injectors", sys: "propulsao", ass: "Motor › Injeção", name: "Bicos Injetores Multiponto", side: "central", axle: "dianteiro", mesh: "mesh_fuel_injectors", oem: "H0280158", notes: "Válvulas injetoras de 4 furos de alta vazão." },
    { id: "cmp-throttle-body", sys: "propulsao", ass: "Motor › Admissão", name: "Corpo de Borboleta Eletrônico (TBI)", side: "central", axle: "dianteiro", mesh: "mesh_tbi", oem: "8200123061", notes: "Acionamento drive-by-wire com sensor TPS duplo." },
    { id: "cmp-turbocharger", sys: "propulsao", ass: "Motor › Sobrealimentação", name: "Turbocompressor & Válvula Wastegate", side: "central", axle: "dianteiro", mesh: "mesh_turbo", oem: "14411-4822R", notes: "Turbina refrigerada a óleo e água com rotor cerâmico." },
    { id: "cmp-radiator", sys: "propulsao", ass: "Arrefecimento", name: "Radiador de Arrefecimento & Ventoinha", side: "central", axle: "dianteiro", mesh: "mesh_radiator", oem: "21410-0062R", notes: "Colmeia de alumínio brasado com eletroventilador 2 velocidades." },
    { id: "cmp-water-pump", sys: "propulsao", ass: "Arrefecimento", name: "Bomba d'Água do Motor", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_water_pump", oem: "7701479043", notes: "Rotor metálico acionado pela correia dentada." },
    { id: "cmp-thermostat", sys: "propulsao", ass: "Arrefecimento", name: "Válvula Termostática com Carcaça", side: "central", axle: "dianteiro", mesh: "mesh_thermostat", oem: "8200772985", notes: "Abertura calibrada a 89°C." },
    { id: "cmp-oil-pan", sys: "propulsao", ass: "Lubrificação", name: "Cárter de Óleo & Bujão Magnético", side: "central", axle: "dianteiro", mesh: "mesh_oil_pan", oem: "8200728383", notes: "Reservatório de 4.8L com junta de vedação e bujão M16." },
    { id: "cmp-timing-belt", sys: "propulsao", ass: "Motor › Sincronismo", name: "Kit Correia Dentada & Tensores", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_timing_belt", oem: "130C13191R", notes: "Correia de 128 dentes HNBR com polia tensora e guia." },

    // 2. Transmissão e Tração
    { id: "cmp-gearbox", sys: "transmissao", ass: "Câmbio", name: "Caixa de Câmbio Manual / CVT", side: "central", axle: "dianteiro", mesh: "mesh_gearbox", oem: "TL4-041", notes: "Caixa sincronizada de 6 marchas à frente e ré." },
    { id: "cmp-clutch-kit", sys: "transmissao", ass: "Embreagem", name: "Kit de Embreagem (Platô e Disco)", side: "central", axle: "dianteiro", mesh: "mesh_clutch", oem: "7701476622", notes: "Disco orgânico de 215mm com molas amortecedoras." },
    { id: "cmp-clutch-actuator", sys: "transmissao", ass: "Embreagem", name: "Atuador Hidráulico de Embreagem", side: "central", axle: "dianteiro", mesh: "mesh_clutch_actuator", oem: "306206822R", notes: "Atuador central concêntrico integrado à moringa." },
    { id: "cmp-driveshaft-r", sys: "transmissao", ass: "Semieixo", name: "Semieixo Dianteiro Direito Completo", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_driveshaft_r", oem: "39100-2442R", notes: "Eixo homocinético com trizeta e coifas termoplásticas." },
    { id: "cmp-driveshaft-l", sys: "transmissao", ass: "Semieixo", name: "Semieixo Dianteiro Esquerdo Completo", side: "dianteira_esquerda", axle: "dianteiro", mesh: "mesh_driveshaft_l", oem: "39101-2442R", notes: "Eixo homocinético lado motorista." },
    { id: "cmp-cv-joint", sys: "transmissao", ass: "Semieixo", name: "Junta Homocinética Fixa Lado Roda", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_cv_joint", oem: "NJH-048", notes: "Com pista de 6 esferas temperadas e anel de ABS." },

    // 3. Rodagem e Controle
    { id: "cmp-brake-pads-front", sys: "rodagem", ass: "Freios Dianteiros", name: "Pastilhas de Freio Dianteiras (Jogo)", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_brake_pad_fr", oem: "41060-2192R", notes: "Composto cerâmico de baixo ruído e sensor acústico." },
    { id: "cmp-brake-disc-front", sys: "rodagem", ass: "Freios Dianteiros", name: "Discos de Freio Dianteiros Ventilados", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_brake_disc_fr", oem: "40206-0010R", notes: "Diâmetro 280mm, espessura nova 24mm (mínima 21.8mm)." },
    { id: "cmp-brake-caliper-front", sys: "rodagem", ass: "Freios Dianteiros", name: "Pinça de Freio Dianteira Direita", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_brake_caliper_fr", oem: "41001-3844R", notes: "Pinça flutuante com êmbolo de 54mm e sangrador M10." },
    { id: "cmp-tie-rod-front-r", sys: "rodagem", ass: "Direção", name: "Terminal de Direção Dianteiro Direito", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_tie_rod_r", oem: "48520-2854R", notes: "Pivô esférico temperado com rosca M14 e coifa de borracha nitrílica." },
    { id: "cmp-tie-rod-front-l", sys: "rodagem", ass: "Direção", name: "Terminal de Direção Dianteiro Esquerdo", side: "dianteira_esquerda", axle: "dianteiro", mesh: "mesh_tie_rod_l", oem: "48521-2854R", notes: "Terminal lado esquerdo." },
    { id: "cmp-steering-rack", sys: "rodagem", ass: "Direção", name: "Caixa de Direção Eletro-Hidráulica", side: "central", axle: "dianteiro", mesh: "mesh_steering_rack", oem: "49001-4471R", notes: "Cremalheira com assistência elétrica variável." },
    { id: "cmp-shock-front-r", sys: "rodagem", ass: "Suspensão Dianteira", name: "Amortecedor Dianteiro Direito Pressurizado", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_shock_fr", oem: "54302-8411R", notes: "Amortecedor tipo McPherson com batente e coifa." },
    { id: "cmp-shock-front-l", sys: "rodagem", ass: "Suspensão Dianteira", name: "Amortecedor Dianteiro Esquerdo Pressurizado", side: "dianteira_esquerda", axle: "dianteiro", mesh: "mesh_shock_fl", oem: "54303-8411R", notes: "Amortecedor lado esquerdo." },
    { id: "cmp-sway-bar", sys: "rodagem", ass: "Suspensão Dianteira", name: "Barra Estabilizadora Dianteira & Bieletas", side: "central", axle: "dianteiro", mesh: "mesh_sway_bar", oem: "54611-0021R", notes: "Barra de torção de 22mm com buchas de poliuretano e bieletas esféricas." },
    { id: "cmp-control-arm", sys: "rodagem", ass: "Suspensão Dianteira", name: "Bandeja de Suspensão com Buchas e Pivô", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_control_arm", oem: "54500-9207R", notes: "Braço oscilante triangular em aço estampado com pivô rebitado." },
    { id: "cmp-wheel-bearing", sys: "rodagem", ass: "Rodas e Rolamentos", name: "Rolamento de Roda Dianteira com Pista ABS", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_wheel_bearing", oem: "7701207677", notes: "Rolamento de esferas de carreira dupla com codificador magnético." },
    { id: "cmp-tires-front", sys: "rodagem", ass: "Pneus", name: "Pneus Dianteiros 215/65 R16", side: "ambos", axle: "dianteiro", mesh: "mesh_tires_f", oem: "TIRE-215-65-16", notes: "Pneus radiais calibragem nominal 29 PSI." },

    // 4. Elétrica e Eletrônica
    { id: "cmp-battery-12v", sys: "eletrica", ass: "Alimentação 12V", name: "Bateria Automotiva 12V 60Ah 540A", side: "dianteira_esquerda", axle: "dianteiro", mesh: "mesh_battery", oem: "BAT-60AH-EFB", notes: "Bateria selada livre de manutenção com tecnologia EFB." },
    { id: "cmp-alternator", sys: "eletrica", ass: "Alimentação 12V", name: "Alternador 120A com Regulador Inteligente", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_alternator", oem: "23100-7633R", notes: "Alternador Valeo com polia de roda livre." },
    { id: "cmp-starter", sys: "eletrica", ass: "Partida", name: "Motor de Partida 1.2kW", side: "central", axle: "dianteiro", mesh: "mesh_starter", oem: "23300-3329R", notes: "Motor com redução planetária e relé magnético." },
    { id: "cmp-ecu-engine", sys: "eletrica", ass: "Módulos & Redes", name: "Módulo Eletrônico da Injeção (ECU)", side: "dianteira_esquerda", axle: "dianteiro", mesh: "mesh_ecu", oem: "Continental EMS3125", notes: "Gerenciador do motor com interface CAN Bus High-Speed." },
    { id: "cmp-o2-sensor-1", sys: "eletrica", ass: "Sensores", name: "Sensor de Oxigênio (Sonda Lambda 1)", side: "central", axle: "dianteiro", mesh: "mesh_o2_sensor_1", oem: "22690-1841R", notes: "Sonda planar de 4 fios pré-catalisador." },
    { id: "cmp-abs-module", sys: "eletrica", ass: "Módulos & Redes", name: "Módulo Hidráulico do ABS / ESP", side: "dianteira_esquerda", axle: "dianteiro", mesh: "mesh_abs_mod", oem: "47660-8484R", notes: "Bloco hidráulico Bosch 9.0 com 8 válvulas e bomba de retorno." },
    { id: "cmp-fuse-box-engine", sys: "eletrica", ass: "Fusíveis e Relés", name: "Caixa de Fusíveis e Relés do Cofre", side: "dianteira_esquerda", axle: "dianteiro", mesh: "mesh_fuses_engine", oem: "284B7-3129R", notes: "Módulo de distribuição de energia UPC / USM." },

    // 5. Carroceria, Cabine e Conforto
    { id: "cmp-ac-compressor", sys: "carroceria", ass: "Climatização", name: "Compressor do Ar-Condicionado", side: "dianteira_direita", axle: "dianteiro", mesh: "mesh_ac_comp", oem: "92600-4712R", notes: "Compressor rotativo de 6 pistões para gás R134a." },
    { id: "cmp-cabin-filter", sys: "carroceria", ass: "Climatização", name: "Filtro de Cabine / Antipólen", side: "central", axle: "central", mesh: "mesh_cabin_filter", oem: "27277-2100R", notes: "Filtro com carvão ativado contra odores e micropartículas." },
    { id: "cmp-bumper-front", sys: "carroceria", ass: "Estrutura Externa", name: "Para-choque Dianteiro com Grade", side: "central", axle: "dianteiro", mesh: "mesh_bumper_f", oem: "62022-8321R", notes: "Polipropileno injetado com defletor inferior e faróis de neblina." },
    { id: "cmp-windshield", sys: "carroceria", ass: "Vidros e Visibilidade", name: "Para-brisa Dianteiro Laminado Degradê", side: "central", axle: "dianteiro", mesh: "mesh_windshield", oem: "72700-4822R", notes: "Vidro acústico laminado com serigrafia para sensor de chuva." },

    // 6. Elétricos e Híbridos
    { id: "cmp-traction-battery", sys: "hibrido", ass: "Sistema de Alta Tensão", name: "Bateria de Tração Íon-Lítio 400V", side: "central", axle: "central", mesh: "mesh_traction_bat", oem: "EV-BAT-400V-52KW", notes: "Módulo de alta densidade energética com células prismáticas." },
    { id: "cmp-traction-inverter", sys: "hibrido", ass: "Eletrônica de Potência", name: "Inversor de Potência & Conversor DC/DC", side: "central", axle: "dianteiro", mesh: "mesh_inverter", oem: "INV-400V-100KW", notes: "Módulo de transistores SiC MOSFET com arrefecimento líquido dedicado." },
    { id: "cmp-electric-motor", sys: "hibrido", ass: "Propulsão Elétrica", name: "Motor Elétrico de Tração Síncrono ímã permanente", side: "central", axle: "dianteiro", mesh: "mesh_emotor", oem: "EMOT-100KW-RENAULT", notes: "Motor síncrono de rotor enrolado de alta eficiência 96%." },
    { id: "cmp-charge-port", sys: "hibrido", ass: "Recarga", name: "Conector de Recarga CCS2 / Tipo 2", side: "traseira_direita", axle: "traseiro", mesh: "mesh_charge_port", oem: "CHG-CCS2-80KW", notes: "Porta de recarga combinada AC (22kW) e DC (80kW) com trava mecânica." }
  ];

  for (const c of components) {
    insertComp.run(c.id, c.sys, c.ass, c.name, c.side, c.axle, c.mesh, "confirmada", c.oem, c.notes);
  }

  // Seed demo case inspections on GT-OS-000127
  const woId = "wo-demo-00127";
  const checkInsp = db.prepare("SELECT count(*) as count FROM wo_component_inspections WHERE work_order_id = ?").get(woId) as { count: number };
  if (checkInsp && checkInsp.count === 0) {
    const insertInsp = db.prepare(`
      INSERT INTO wo_component_inspections (
        id, work_order_id, component_id, status, test_performed, measurement_value,
        tolerance_spec, finding_description, priority, photo_url,
        suggested_repair, suggested_part_price, suggested_service_price, is_quoted, inspected_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Terminal de Direção Dianteiro Direito (CRÍTICO)
    insertInsp.run(
      "cinsp-1",
      woId,
      "cmp-tie-rod-front-r",
      "critico",
      "Medição de folga axial e radial com relógio comparador centesimal Mitutoyo",
      "2.8 mm de folga",
      "Folga máxima permitida: 1.0 mm",
      "Folga severa detectada no pivô esférico. Risco iminente de desengate, desgaste acelerado do pneu e perda de estabilidade.",
      "critica",
      "/img/vehicles/renault-duster.jpg",
      "Substituição imediata do Terminal de Direção Dianteiro Direito + Alinhamento Computadorizado de Geometria 3D",
      160.0,
      120.0,
      1,
      "Giovane Ribeiro"
    );

    // 2. Pastilhas de Freio Dianteiras (ATENÇÃO)
    insertInsp.run(
      "cinsp-2",
      woId,
      "cmp-brake-pads-front",
      "atencao",
      "Medição de espessura do material de atrito com paquímetro digital",
      "2.5 mm",
      "Espessura mínima de segurança: 3.0 mm (Pastilha nova: 12.0 mm)",
      "Pastilhas de freio dianteiras atingiram o limite mínimo de segurança, próximas de entrar em contato aço com aço no disco.",
      "alta",
      "/img/vehicles/suv-real.jpg",
      "Substituição do Jogo de Pastilhas de Freio Dianteiras Cerâmica Fras-le + Limpeza das Guias de Pinça",
      240.0,
      140.0,
      1,
      "Giovane Ribeiro"
    );

    // 3. Sonda Lambda 1 Pré-Catalisador (ATENÇÃO)
    insertInsp.run(
      "cinsp-3",
      woId,
      "cmp-o2-sensor-1",
      "atencao",
      "Análise da forma de onda de tensão no osciloscópio automotivo Hantek",
      "Sinal travado em 0.85V (Mistura Rica)",
      "Oscilação senoidal contínua entre 0.1V e 0.9V a cada 1 a 2 segundos",
      "Código de falha DTC P0130 gravado na ECU. Sonda lenta, provocando aumento de consumo de combustível e acendimento da luz de injeção.",
      "normal",
      "/img/vehicles/renault-duster.jpg",
      "Substituição da Sonda Lambda Planar Bosch + Reset de parâmetros autoadaptativos da ECU",
      260.0,
      130.0,
      1,
      "Giovane Ribeiro"
    );

    // 4. Comando de Válvulas (OK)
    insertInsp.run(
      "cinsp-4",
      woId,
      "cmp-camshaft",
      "ok",
      "Inspeção visual dos cames com videoscópio e verificação de folga de tuchos",
      "Superfície íntegra / 0.25 mm",
      "Tolerância Renault: 0.20 mm a 0.30 mm",
      "Eixo comando de válvulas sem desgastes, riscos ou formação de verniz/borra. Lubrificação adequada.",
      "baixa",
      null,
      null,
      0,
      0,
      0,
      "Giovane Ribeiro"
    );

    // 5. Velas de Ignição (OK)
    insertInsp.run(
      "cinsp-5",
      woId,
      "cmp-spark-plugs",
      "ok",
      "Inspeção e medição do gap de eletrodos com cálibre de lâminas",
      "0.90 mm",
      "Especificação: 0.90 mm ± 0.05 mm",
      "Eletrodos sem carbonização úmida, coloração cinza clara indicando queima estequiométrica correta.",
      "baixa",
      null,
      null,
      0,
      0,
      0,
      "Giovane Ribeiro"
    );
  }

  // Seed Replaced Parts on GT-OS-000127 ("PEÇA TROCADA")
  const checkRepl = db.prepare("SELECT count(*) as count FROM wo_replaced_parts WHERE work_order_id = ?").get(woId) as { count: number };
  if (checkRepl && checkRepl.count === 0) {
    const insertRepl = db.prepare(`
      INSERT INTO wo_replaced_parts (
        id, work_order_id, quote_item_id, component_id, component_name, assembly_path,
        position_side, removed_part_desc, installed_part_desc, photo_before_url,
        photo_after_url, technician_name, seal_status, warranty_terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRepl.run(
      "repl-1",
      woId,
      "qitem-1",
      "cmp-tie-rod-front-r",
      "Terminal de Direção Dianteiro Direito",
      "Veículo › Rodagem e Controle › Direção › Terminal Dianteiro Direito",
      "dianteira_direita",
      "Terminal original de fábrica com 48.720 km apresentando folga radial excessiva de 2.8 mm e coifa rasgada.",
      "Terminal de Direção Nakata Blindado N-99042 Novo, com porca autotravante nova e alinhamento a laser executado.",
      "/img/vehicles/renault-duster.jpg",
      "/img/vehicles/suv-real.jpg",
      "Giovane Ribeiro",
      "PEÇA TROCADA",
      "Garantia legal de 90 dias conforme Código de Defesa do Consumidor (CDC) + 1 ano do fabricante Nakata."
    );

    insertRepl.run(
      "repl-2",
      woId,
      "qitem-3",
      "cmp-oil-pan",
      "Óleo 5W40 Sintético Homologado Renault (5L) + Filtro de Óleo",
      "Veículo › Propulsão e Alimentação › Motor › Lubrificação",
      "central",
      "Óleo lubrificante com alta viscosidade residual e filtro saturado.",
      "4.8 Litros de Óleo 100% Sintético 5W40 Homologado Renault RN0710 + Filtro de Óleo Mann Filter W75/3 Novo.",
      "/img/vehicles/renault-duster.jpg",
      "/img/vehicles/suv-real.jpg",
      "Giovane Ribeiro",
      "PEÇA TROCADA",
      "Garantia de 90 dias / 10.000 km para o pacote de troca de óleo e filtro."
    );
  }
}

function seedVolkswagenModels(db: DatabaseSync) {
  const insertSpec = db.prepare(`
    INSERT OR REPLACE INTO vehicle_tech_specs (
      id, brand, model, years, engine, body_type, real_photo_url,
      oil_viscosity, oil_capacity_liters, oil_norm,
      coolant_type, coolant_capacity_liters, brake_fluid,
      tire_pressure_front_psi, tire_pressure_rear_psi, tire_pressure_loaded_psi,
      spark_plugs_gap_mm, fuse_box_engine, fuse_box_cabin, common_issues
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const vwModels = [
    {
      id: "spec-vw-golf-gti",
      brand: "Volkswagen",
      model: "Golf VII GTI",
      years: "2013-2020",
      engine: "2.0 TSI EA888 Gen 3 Turbo (220/230cv)",
      body_type: "hatch",
      real_photo_url: "/img/vehicles/volkswagen/fotos/golf-gti.jpg",
      oil_viscosity: "5W40 100% Sintético",
      oil_capacity_liters: 5.7,
      oil_norm: "VW 502 00 / 508 88",
      coolant_type: "Aditivo G12 / G13 Rosa",
      coolant_capacity_liters: 6.5,
      brake_fluid: "DOT 4 Sintético",
      tire_front: 34,
      tire_rear: 34,
      tire_loaded: 38,
      gap: 0.7,
      common: [
        { symptom: "Falha de cilindro em alta carga", cause: "Carbonização de válvulas de admissão ou vela gasta.", procedure: "Descarbonização química e teste de compressão." },
        { symptom: "Alerta de nível de líquido de arrefecimento", cause: "Vazamento na bomba d'água mecânica.", procedure: "Substituir conjunto de carcaça e termostática." }
      ]
    },
    {
      id: "spec-vw-jetta-gli",
      brand: "Volkswagen",
      model: "Jetta GLI",
      years: "2019-2024",
      engine: "2.0 TSI 350 TSI (230cv) DSG 7",
      body_type: "sedan",
      real_photo_url: "/img/vehicles/volkswagen/fotos/jetta-gli.jpg",
      oil_viscosity: "5W40 / 0W20 Sintético",
      oil_capacity_liters: 5.7,
      oil_norm: "VW 502 00 / 508 88",
      coolant_type: "Aditivo G12 / G13 Rosa",
      coolant_capacity_liters: 6.5,
      brake_fluid: "DOT 4",
      tire_front: 35,
      tire_rear: 35,
      tire_loaded: 39,
      gap: 0.7,
      common: [
        { symptom: "Tranco leve na troca de marcha em frio", cause: "Degradação do fluido DSG DQ381.", procedure: "Trocar fluido e filtro DSG com calibração básica via scanner." }
      ]
    },
    {
      id: "spec-vw-tiguan",
      brand: "Volkswagen",
      model: "Tiguan",
      years: "2016-2024",
      engine: "1.4 TSI / 2.0 TSI 350 TSI 4Motion",
      body_type: "suv",
      real_photo_url: "/img/vehicles/volkswagen/fotos/tiguan.jpg",
      oil_viscosity: "5W40 Sintético Maxi Performance",
      oil_capacity_liters: 5.7,
      oil_norm: "VW 502 00 / 508 88",
      coolant_type: "Aditivo G12 / G13 Rosa",
      coolant_capacity_liters: 7.0,
      brake_fluid: "DOT 4",
      tire_front: 35,
      tire_rear: 35,
      tire_loaded: 41,
      gap: 0.75,
      common: [
        { symptom: "Ruído na suspensão em piso irregular", cause: "Folga em buchas da bandeja dianteira.", procedure: "Substituição das buchas de poliuretano / OEM." }
      ]
    },
    {
      id: "spec-vw-polo-hatch",
      brand: "Volkswagen",
      model: "Polo",
      years: "2018-2024",
      engine: "1.0 MPI / 1.0 200 TSI / 1.4 GTS",
      body_type: "hatch",
      real_photo_url: "/img/vehicles/volkswagen/fotos/polo-hatch.jpg",
      oil_viscosity: "5W40 / 0W20 Maxi Performance",
      oil_capacity_liters: 4.0,
      oilNorm: "VW 502 00 / 508 88",
      coolant_type: "Aditivo G12 / G13 Rosa",
      coolant_capacity_liters: 5.5,
      brake_fluid: "DOT 4",
      tire_front: 32,
      tire_rear: 30,
      tire_loaded: 34,
      gap: 0.8,
      common: [
        { symptom: "Ruído de partida a frio", cause: "Batida momentânea de tucho hidráulico até pressão de óleo.", procedure: "Verificar viscosidade do óleo e filtro com válvula antirretorno." }
      ]
    },
    {
      id: "spec-vw-up",
      brand: "Volkswagen",
      model: "Up!",
      years: "2014-2021",
      engine: "1.0 12V EA211 (MPI / TSI Turbo)",
      body_type: "hatch",
      real_photo_url: "/img/vehicles/volkswagen/fotos/up.jpg",
      oil_viscosity: "5W40 100% Sintético",
      oil_capacity_liters: 3.3,
      oilNorm: "VW 502 00 / 508 88",
      coolant_type: "Aditivo G12 / G13 Rosa",
      coolant_capacity_liters: 4.5,
      brake_fluid: "DOT 4",
      tire_front: 32,
      tire_rear: 29,
      tire_loaded: 34,
      gap: 0.8,
      common: [
        { symptom: "Vazamento na junta da bomba d'água", cause: "Empenamento leve na carcaça plástica.", procedure: "Trocar carcaça e anéis de vedação." }
      ]
    }
  ];

  for (const m of vwModels) {
    insertSpec.run(
      m.id,
      m.brand,
      m.model,
      m.years,
      m.engine,
      m.body_type,
      m.real_photo_url,
      m.oil_viscosity,
      m.oil_capacity_liters,
      m.oil_norm || "VW 502 00 / 508 88",
      m.coolant_type,
      m.coolant_capacity_liters,
      m.brake_fluid,
      m.tire_front,
      m.tire_rear,
      m.tire_loaded,
      m.gap,
      JSON.stringify([
        { fuse: "F1", amp: "30A", color: "#22c55e", desc: "Ventoinha do Radiador" },
        { fuse: "F2", amp: "20A", color: "#eab308", desc: "Bomba de Combustível Alta Pressão" },
        { fuse: "F3", amp: "15A", color: "#3b82f6", desc: "Bobinas de Ignição e Injetores" }
      ]),
      JSON.stringify([
        { fuse: "F10", amp: "15A", color: "#3b82f6", desc: "Tomada OBD2 e Painel" },
        { fuse: "F11", amp: "20A", color: "#eab308", desc: "Vidros e Travas" }
      ]),
      JSON.stringify(m.common)
    );
  }
}

function seedVolkswagenWorkOrders(db: DatabaseSync) {
  const osCheck = db.prepare("SELECT id FROM work_orders WHERE os_number = ?").get("GT-OS-000128");
  if (osCheck) return;

  // 1. VW Golf VII GTI 2.0 TSI (GT-OS-000128)
  const custGolf = "cust-demo-marcos-vw";
  db.prepare(`
    INSERT OR IGNORE INTO customers (id, company_id, name, phone, email, document, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    custGolf,
    "gtech-paranagua",
    "Marcos Vinicius Silveira",
    "(41) 99876-5432",
    "marcos.silveira@email.com",
    "055.123.987-44",
    "Entusiasta de Golf GTI, cliente rigoroso com manutenção preventiva e tolerância metrológica."
  );

  const vehGolf = "veh-demo-golf-gti";
  db.prepare(`
    INSERT OR IGNORE INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    vehGolf,
    custGolf,
    "MK7-2026",
    "Volkswagen",
    "Golf VII GTI 2.0 TSI",
    "2019",
    "2.0 TSI EA888 Gen 3 Turbo (230cv)",
    "Azul Safira G-Tech",
    52400,
    "Gasolina Podium / Premium",
    "hatch"
  );

  const apptGolf = "appt-demo-golf-gti";
  db.prepare(`
    INSERT OR IGNORE INTO appointments (
      id, company_id, protocol, customer_name, customer_phone,
      vehicle_brand, vehicle_model, vehicle_plate, scheduled_date, scheduled_time,
      period, issue_description, dashboard_alert, mobility, status, work_order_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    apptGolf,
    "gtech-paranagua",
    "GT-2026-9901",
    "Marcos Vinicius Silveira",
    "(41) 99876-5432",
    "Volkswagen",
    "Golf VII GTI 2.0 TSI",
    "MK7-2026",
    new Date().toISOString().split("T")[0],
    "10:00",
    "Manhã (08h às 12h)",
    "Revisão dos 50.000 km, descarbonização de válvulas e checagem de freios cerâmica.",
    "Luz de Injeção Eletrônica (Check Engine)",
    "Aguarda na recepção",
    "em_atendimento",
    "wo-demo-128"
  );

  db.prepare(`
    INSERT INTO work_orders (
      id, company_id, os_number, appointment_id, customer_id, vehicle_id,
      assigned_mechanic_id, initial_scope, customer_complaint, diagnostic_authorized,
      diagnostic_fee, fuel_level_entry, km_entry, belongings_declared, status, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "wo-demo-128",
    "gtech-paranagua",
    "GT-OS-000128",
    apptGolf,
    custGolf,
    vehGolf,
    "user-giovane",
    "Inspeção 3D de Geometria, Descarbonização da Injeção Direta TSI e Avaliação Metrológica de Freios",
    "Luz de injeção acendendo esporadicamente em aceleração forte; pedal de freio com curso um pouco longo.",
    1,
    220.0,
    "Cheio",
    52400,
    "Óculos de sol, cabo de dados e chave reserva",
    "em_servico",
    "alta"
  );

  // Vistoria de Entrada Golf GTI
  db.prepare(`
    INSERT INTO wo_intake_inspection (
      id, work_order_id, photo_front, photo_rear, photo_left, photo_right,
      photo_interior, photo_dashboard, odometer_km, fuel_pct, panel_alerts_found,
      observations, client_acknowledged, responsible_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "intake-demo-128",
    "wo-demo-128",
    "/img/vehicles/volkswagen/fotos/golf-gti.jpg",
    "/img/vehicles/volkswagen/fotos/golf-r.jpg",
    "/img/vehicles/volkswagen/fotos/golf-vii.jpg",
    "/img/vehicles/volkswagen/fotos/golf-alltrack.jpg",
    "/img/demo/duster_interior.jpg",
    "/img/demo/duster_dash.jpg",
    52400,
    95,
    "DTC P0303 - Falha de Ignição Cilindro 3 gravada",
    "Veículo impecável. Pintura Azul Safira original com vitrificação recente. Rodas sem ralados.",
    1,
    "Giovane Ribeiro"
  );

  // Hotspots 3D Golf GTI
  const insertHotspot = db.prepare(`
    INSERT INTO wo_hotspots (
      id, work_order_id, hotspot_type, region_name, orientation_side,
      pos_x, pos_y, pos_z, severity, damage_type, description, author_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHotspot.run(
    "hs-vw-1",
    "wo-demo-128",
    "achado_tecnico",
    "Freios Dianteiros Brembo / Discos Ventilados",
    "dianteira",
    0.88, 0.38, 1.35,
    "alta",
    "desgaste de pastilha",
    "Pastilhas de freio com 2.5 mm de material de fricção (abaixo da cota OEM de segurança).",
    "Giovane Ribeiro"
  );

  insertHotspot.run(
    "hs-vw-2",
    "wo-demo-128",
    "achado_tecnico",
    "Bobina de Ignição & Vela - Cilindro 3",
    "motor",
    0.10, 0.70, 1.30,
    "critica",
    "falha de ignição",
    "Bobina de ignição com fuga de centelha e vela com eletrodo desgastado (gap 1.1 mm vs 0.7 mm especificado).",
    "Giovane Ribeiro"
  );

  // Peça trocada com selo oficial
  const insertRepl = db.prepare(`
    INSERT INTO wo_replaced_parts (
      id, work_order_id, quote_item_id, component_id, component_name,
      assembly_path, position_side, removed_part_desc, installed_part_desc,
      photo_before_url, photo_after_url, technician_name, seal_status, warranty_terms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRepl.run(
    "repl-vw-1",
    "wo-demo-128",
    "qitem-vw-1",
    "cmp-brake-pads-front",
    "Jogo de Pastilhas de Freio Dianteiras Cerâmica",
    "Veículo › Rodagem e Controle › Freios Dianteiros",
    "dianteira_direita",
    "Pastilhas originais desgastadas atingindo 2.5 mm com sensor de desgaste próximo ao contato.",
    "Jogo de Pastilhas Cerâmica Brembo Racing Padrão Golf GTI Novo com sensores embutidos.",
    "/img/vehicles/volkswagen/fotos/golf-gti.jpg",
    "/img/vehicles/volkswagen/fotos/golf-r.jpg",
    "Giovane Ribeiro",
    "PEÇA TROCADA",
    "Garantia legal de 90 dias conforme CDC + 1 ano de fábrica Brembo."
  );

  // 2. VW Jetta GLI 350 TSI (GT-OS-000129)
  const custJetta = "cust-demo-camila-vw";
  db.prepare(`
    INSERT OR IGNORE INTO customers (id, company_id, name, phone, email, document, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    custJetta,
    "gtech-paranagua",
    "Camila Becker Ferreira",
    "(41) 98765-4321",
    "camila.ferreira@email.com",
    "029.384.756-11",
    "Atendimento corporativo, necessita de relatório técnico detalhado e orçamento antes da execução."
  );

  const vehJetta = "veh-demo-jetta-gli";
  db.prepare(`
    INSERT OR IGNORE INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    vehJetta,
    custJetta,
    "GLI-3500",
    "Volkswagen",
    "Jetta GLI 350 TSI",
    "2022",
    "2.0 TSI 350 TSI (231cv) DSG 7",
    "Cinza Nardo",
    38100,
    "Gasolina Aditivada",
    "sedan"
  );

  db.prepare(`
    INSERT INTO work_orders (
      id, company_id, os_number, appointment_id, customer_id, vehicle_id,
      assigned_mechanic_id, initial_scope, customer_complaint, diagnostic_authorized,
      diagnostic_fee, fuel_level_entry, km_entry, belongings_declared, status, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "wo-demo-129",
    "gtech-paranagua",
    "GT-OS-000129",
    null,
    custJetta,
    vehJetta,
    "user-giovane",
    "Alinhamento 3D Computadorizado, Calibração de Sensores ADAS e Geometria de Direção",
    "Veículo puxando para a direita na BR-277 após cair em desnível de pista.",
    1,
    190.0,
    "1/2",
    38100,
    "Cadeirinha infantil, cabo de carregamento rápido",
    "aguardando_cliente",
    "normal"
  );

  // 3. VW Amarok Extreme V6 3.0 TDI (GT-OS-000130)
  const custAmarok = "cust-demo-carlos-vw";
  db.prepare(`
    INSERT OR IGNORE INTO customers (id, company_id, name, phone, email, document, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    custAmarok,
    "gtech-paranagua",
    "Carlos Eduardo Santos",
    "(41) 99111-2233",
    "carlos.santos@porto.com.br",
    "018.493.827-99",
    "Transportador do Porto de Paranaguá, utiliza o veículo em rodovias e trecho portuário."
  );

  const vehAmarok = "veh-demo-amarok-v6";
  db.prepare(`
    INSERT OR IGNORE INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    vehAmarok,
    custAmarok,
    "AMK-0006",
    "Volkswagen",
    "Amarok Extreme V6 3.0 TDI",
    "2023",
    "3.0 V6 TDI Turbo Diesel (258cv) 4Motion",
    "Preto Ninja Carbon",
    42000,
    "Diesel S10",
    "picape"
  );

  db.prepare(`
    INSERT INTO work_orders (
      id, company_id, os_number, appointment_id, customer_id, vehicle_id,
      assigned_mechanic_id, initial_scope, customer_complaint, diagnostic_authorized,
      diagnostic_fee, fuel_level_entry, km_entry, belongings_declared, status, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "wo-demo-130",
    "gtech-paranagua",
    "GT-OS-000130",
    null,
    custAmarok,
    vehAmarok,
    "user-giovane",
    "Revisão Periódica dos 40.000 km, Troca de Óleo Homologado VW 507 00 e Filtros DPF",
    "Revisão de rotina; conferir nível do sistema de arrefecimento e lubrificação da caixa 4Motion.",
    1,
    250.0,
    "Full",
    42000,
    "Equipamentos portuários na caçamba com capota marítima travada",
    "aprovada",
    "alta"
  );

  // 4. VW T-Cross Highline 250 TSI (GT-OS-000131)
  const custTcross = "cust-demo-beatriz-vw";
  db.prepare(`
    INSERT OR IGNORE INTO customers (id, company_id, name, phone, email, document, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    custTcross,
    "gtech-paranagua",
    "Beatriz Oliveira Souza",
    "(41) 99222-3344",
    "beatriz.souza@educacao.pr.gov.br",
    "044.832.190-67",
    "Professora da rede pública, agenda aos sábados ou início da manhã."
  );

  const vehTcross = "veh-demo-tcross-vw";
  db.prepare(`
    INSERT OR IGNORE INTO vehicles (id, customer_id, plate, brand, model, year, motor, color, km, fuel, body_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    vehTcross,
    custTcross,
    "TCR-2501",
    "Volkswagen",
    "T-Cross Highline 250 TSI",
    "2021",
    "1.4 TSI EA211 250 TSI (150cv)",
    "Branco Puro",
    49800,
    "Flex",
    "suv"
  );

  db.prepare(`
    INSERT INTO work_orders (
      id, company_id, os_number, appointment_id, customer_id, vehicle_id,
      assigned_mechanic_id, initial_scope, customer_complaint, diagnostic_authorized,
      diagnostic_fee, fuel_level_entry, km_entry, belongings_declared, status, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "wo-demo-131",
    "gtech-paranagua",
    "GT-OS-000131",
    null,
    custTcross,
    vehTcross,
    "user-giovane",
    "Diagnóstico do Sistema de Arrefecimento & Checkup de Freios",
    "Aviso luminoso no painel de temperatura oscilou na subida da serra.",
    1,
    180.0,
    "1/4",
    49800,
    "Material escolar no porta-malas",
    "aberta",
    "normal"
  );
}


