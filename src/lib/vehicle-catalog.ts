import { BodyType } from "./vehicle3d";
import { VW_MODELS_CATALOG, VwModelData } from "./vw-recognition";

export type FidelityLevel = "especifico_verificado" | "representativo_carroceria" | "sem_recurso_3d";
export type FuelType = "gasolina" | "etanol" | "flex" | "diesel" | "hibrido" | "eletrico";

export interface CatalogVehicle {
  id: string;
  brand: string;
  model: string;
  generation: string;
  years: string;
  version: string;
  engine: string;
  fuel_type: FuelType;
  body_type: BodyType;
  photo_url: string;
  photo_author: string;
  photo_license: string;
  photo_license_url?: string;
  fidelity_level: FidelityLevel;
  fidelity_description: string;
  glb_url?: string;
  is_segmented_3d: boolean; // Indica se há malha 3D segmentada com peças internas separadas
  systems_supported: string[];
  specs: {
    oil_viscosity: string;
    oil_capacity_liters: number;
    oil_norm: string;
    tire_front_psi: number;
    tire_rear_psi: number;
    spark_gap_mm?: number;
    battery_type?: string;
  };
}

// Catálogo base unificado com níveis de fidelidade explícitos
export const VEHICLE_CATALOG: CatalogVehicle[] = [
  // 1. Volkswagen Golf VII GTI (Modelo de Referência Principal - Verificado)
  {
    id: "vw-golf-vii-gti",
    brand: "Volkswagen",
    model: "Golf VII GTI",
    generation: "Geração VII (MK7)",
    years: "2013-2020",
    version: "2.0 TSI Performance",
    engine: "2.0 TSI EA888 Gen 3 Turbo (220/230cv)",
    fuel_type: "gasolina",
    body_type: "hatch",
    photo_url: "/img/vehicles/volkswagen/fotos/golf-gti.jpg",
    photo_author: "Rutger van der Maar / G-Tech Acervo",
    photo_license: "CC BY 2.0 / Homologado G-Tech",
    fidelity_level: "especifico_verificado",
    fidelity_description: "Modelo específico com correspondência verificada: geometria dimensional de hatch esportivo, proporções de entreeixos e componentes segmentados.",
    glb_url: undefined,
    is_segmented_3d: true,
    systems_supported: ["motor", "lubrificacao", "arrefecimento", "ignicao", "freios", "direcao", "suspensao", "carroceria"],
    specs: {
      oil_viscosity: "5W40 100% Sintético",
      oil_capacity_liters: 5.7,
      oil_norm: "VW 502 00 / 508 88",
      tire_front_psi: 34,
      tire_rear_psi: 34,
      spark_gap_mm: 0.7,
      battery_type: "EFB / AGM 70Ah Start-Stop"
    }
  },

  // 2. Volkswagen Jetta GLI 350 TSI
  {
    id: "vw-jetta-gli",
    brand: "Volkswagen",
    model: "Jetta GLI",
    generation: "Geração VII (A7)",
    years: "2019-2024",
    version: "350 TSI DSG",
    engine: "2.0 TSI EA888 (231cv) DSG 7",
    fuel_type: "gasolina",
    body_type: "sedan",
    photo_url: "/img/vehicles/volkswagen/fotos/jetta-gli.jpg",
    photo_author: "Vander / Acervo G-Tech",
    photo_license: "CC BY-SA 4.0",
    fidelity_level: "especifico_verificado",
    fidelity_description: "Modelo específico com correspondência verificada: sedã médio com trem de força TSI e freios dianteiros ventilados.",
    is_segmented_3d: true,
    systems_supported: ["motor", "lubrificacao", "arrefecimento", "freios", "direcao", "suspensao"],
    specs: {
      oil_viscosity: "5W40 / 0W20 Sintético",
      oil_capacity_liters: 5.7,
      oil_norm: "VW 502 00 / 508 88",
      tire_front_psi: 35,
      tire_rear_psi: 35,
      spark_gap_mm: 0.7,
      battery_type: "EFB 70Ah"
    }
  },

  // 3. Volkswagen Amarok Extreme V6
  {
    id: "vw-amarok-v6",
    brand: "Volkswagen",
    model: "Amarok Extreme",
    generation: "Geração I Facelift",
    years: "2018-2024",
    version: "V6 3.0 TDI 4Motion",
    engine: "3.0 V6 TDI Turbo Diesel (258cv)",
    fuel_type: "diesel",
    body_type: "picape",
    photo_url: "/img/vehicles/volkswagen/fotos/amarok-v6.jpg",
    photo_author: "Wikimedia Commons / G-Tech",
    photo_license: "CC BY 3.0",
    fidelity_level: "especifico_verificado",
    fidelity_description: "Modelo específico com correspondência verificada: chassi sob longarinas, tração 4Motion e motor turbo diesel.",
    is_segmented_3d: true,
    systems_supported: ["motor", "lubrificacao", "arrefecimento", "freios", "suspensao", "tracao_4motion"],
    specs: {
      oil_viscosity: "5W30 100% Sintético DPF",
      oil_capacity_liters: 7.5,
      oil_norm: "VW 507 00 (ACEA C3)",
      tire_front_psi: 36,
      tire_rear_psi: 38,
      battery_type: "AGM 80Ah"
    }
  },

  // 4. Volkswagen ID.4 (100% Elétrico)
  {
    id: "vw-id4-eletrico",
    brand: "Volkswagen",
    model: "ID.4 Pro",
    generation: "ID Family (Plataforma MEB)",
    years: "2021-2024",
    version: "Pro Elétrico 204cv",
    engine: "Motor Elétrico Síncrono APP310 (204cv)",
    fuel_type: "eletrico",
    body_type: "suv",
    photo_url: "/img/vehicles/volkswagen/fotos/id-4.jpg",
    photo_author: "Alexander Migl / Wikimedia",
    photo_license: "CC BY-SA 4.0",
    fidelity_level: "especifico_verificado",
    fidelity_description: "Modelo específico com correspondência verificada: arquitetura 100% elétrica MEB com bateria de tração no assoalho e inversor de potência.",
    is_segmented_3d: true,
    systems_supported: ["alta_tensao", "motor_eletrico", "inversor", "arrefecimento_bateria", "freios", "suspensao"],
    specs: {
      oil_viscosity: "Não aplicável (100% Elétrico)",
      oil_capacity_liters: 0,
      oil_norm: "Redutor: Fluido G 055 549 A2",
      tire_front_psi: 36,
      tire_rear_psi: 42,
      battery_type: "Bateria de Tração 77 kWh (400V) + Auxiliar 12V 51Ah"
    }
  },

  // 5. Renault Duster (Especialidade da Oficina - Modelo Representativo)
  {
    id: "renault-duster-20",
    brand: "Renault",
    model: "Duster Dynamique",
    generation: "Geração II",
    years: "2015-2024",
    version: "2.0 16V Flex",
    engine: "2.0 16V F4R Flex (148cv)",
    fuel_type: "flex",
    body_type: "suv",
    photo_url: "/img/vehicles/renault-duster.jpg",
    photo_author: "Acervo G-Tech Oficina",
    photo_license: "Uso Técnico Autorizado",
    fidelity_level: "representativo_carroceria",
    fidelity_description: "Modelo representativo da carroceria SUV: geometria ilustrativa proporcional adaptada aos pontos de fixação e componentes mecânicos Renault.",
    is_segmented_3d: true,
    systems_supported: ["motor", "lubrificacao", "arrefecimento", "freios", "direcao", "suspensao"],
    specs: {
      oil_viscosity: "5W40 100% Sintético",
      oil_capacity_liters: 4.8,
      oil_norm: "Renault RN0700 / RN0710",
      tire_front_psi: 29,
      tire_rear_psi: 29,
      spark_gap_mm: 0.9,
      battery_type: "Convencional 60Ah"
    }
  },

  // 6. Chevrolet Onix (Hatch Popular - Representativo)
  {
    id: "gm-onix-turbo",
    brand: "Chevrolet",
    model: "Onix Premier",
    generation: "Geração II",
    years: "2020-2024",
    version: "1.0 Turbo Flex",
    engine: "1.0 12V Turbo Ecotec (116cv)",
    fuel_type: "flex",
    body_type: "hatch",
    photo_url: "/img/vehicles/chevrolet-onix.jpg",
    photo_author: "Acervo Técnico G-Tech",
    photo_license: "Referência Comercial",
    fidelity_level: "representativo_carroceria",
    fidelity_description: "Modelo representativo da carroceria Hatch: silhueta proporcional com motor 3 cilindros e correia banhada a óleo.",
    is_segmented_3d: true,
    systems_supported: ["motor", "lubrificacao", "arrefecimento", "freios", "suspensao"],
    specs: {
      oil_viscosity: "0W20 100% Sintético Dexos 1 Gen 3",
      oil_capacity_liters: 3.5,
      oil_norm: "Dexos 1 Gen 3 (Correia em Óleo)",
      tire_front_psi: 32,
      tire_rear_psi: 30,
      spark_gap_mm: 0.7,
      battery_type: "EFB 60Ah"
    }
  },

  // 7. Veículo Sem Recurso 3D (Exemplo de fallback 2D)
  {
    id: "universal-custom-2d",
    brand: "Multimarcas",
    model: "Outro Veículo / Clássico",
    generation: "Variável",
    years: "Variável",
    version: "Conforme entrada",
    engine: "Conforme inspeção",
    fuel_type: "flex",
    body_type: "sedan",
    photo_url: "/img/vehicles/sedan-real.jpg",
    photo_author: "Acervo G-Tech",
    photo_license: "Uso Interno",
    fidelity_level: "sem_recurso_3d",
    fidelity_description: "Veículo sem recurso 3D disponível. A inspeção, checklist e orçamento são realizados pelo esquema 2D e fotos de evidência.",
    is_segmented_3d: false,
    systems_supported: ["motor", "freios", "suspensao", "eletrica"],
    specs: {
      oil_viscosity: "Conforme montadora",
      oil_capacity_liters: 4.0,
      oil_norm: "Padrão OEM",
      tire_front_psi: 30,
      tire_rear_psi: 30
    }
  }
];

export function getCatalogVehicle(id: string): CatalogVehicle | undefined {
  return VEHICLE_CATALOG.find(v => v.id === id);
}

export function searchCatalogVehicles(query: string): CatalogVehicle[] {
  if (!query.trim()) return VEHICLE_CATALOG;
  const q = query.toLowerCase();
  return VEHICLE_CATALOG.filter(v =>
    v.brand.toLowerCase().includes(q) ||
    v.model.toLowerCase().includes(q) ||
    v.generation.toLowerCase().includes(q) ||
    v.engine.toLowerCase().includes(q) ||
    v.body_type.toLowerCase().includes(q)
  );
}
