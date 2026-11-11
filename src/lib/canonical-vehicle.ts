import { VW_MODELS_CATALOG, VwModelData } from "./vw-recognition";

export interface CanonicalVehicleResolution {
  vehicle_key: string;
  catalog_id: string | null;
  brand: string;
  model_name: string;
  generation: string;
  body_type: string;
  catalog_photo_url: string | null;
  is_catalog_vw: boolean;
}

/**
 * Resolve de forma determinística e única o identificador canônico (vehicle_key)
 * usado no cadastro (vehicles / work_orders), no Worker IA/3D (Porta 3002),
 * na API (/api/models, /api/workshop/photo-to-3d) e nos visualizadores (/3D-360 e /oficina).
 */
export function resolveCanonicalVehicle(input: {
  vehicleKey?: string | null;
  brand?: string | null;
  model?: string | null;
}): CanonicalVehicleResolution {
  const rawKey = (input.vehicleKey || "").toLowerCase().trim();
  const rawBrand = (input.brand || "").trim();
  const rawModel = (input.model || "").trim();

  // 1. Se rawKey bate exatamente com um ID do catálogo VW (ex: "golf-v" ou "volkswagen_golf-v")
  const strippedKey = rawKey.replace(/^volkswagen_/, "").replace(/^vw_/, "").replace(/^chevrolet_/, "").replace(/^gm_/, "");
  if (strippedKey.includes("celta") || rawModel.toLowerCase().includes("celta")) {
    const celta = VW_MODELS_CATALOG.find(m => m.id === "celta") || {
      name: "Celta 1.0 VHC-E",
      generation: "Geração I & II (2000 - 2016)",
      bodyType: "hatch" as any,
      photoUrl: "/img/vehicles/chevrolet-celta.jpg"
    };
    return {
      vehicle_key: "chevrolet_celta",
      catalog_id: "celta",
      brand: "Chevrolet",
      model_name: celta.name,
      generation: celta.generation,
      body_type: celta.bodyType,
      catalog_photo_url: celta.photoUrl,
      is_catalog_vw: false
    };
  }
  if (strippedKey.includes("corsa") || rawModel.toLowerCase().includes("corsa")) {
    const corsa = VW_MODELS_CATALOG.find(m => m.id === "corsa-hatch") || {
      name: "Corsa Hatch 1.0 / 1.6",
      generation: "Geração B (1994 - 2002)",
      bodyType: "hatch" as any,
      photoUrl: "/img/vehicles/chevrolet-corsa.jpg"
    };
    return {
      vehicle_key: "chevrolet_corsa_hatch",
      catalog_id: "corsa-hatch",
      brand: "Chevrolet",
      model_name: corsa.name,
      generation: corsa.generation,
      body_type: corsa.bodyType,
      catalog_photo_url: corsa.photoUrl,
      is_catalog_vw: false
    };
  }
  if (strippedKey.includes("arteon")) {
    const arteon = VW_MODELS_CATALOG.find(m => m.id === "arteon") || VW_MODELS_CATALOG[0];
    return {
      vehicle_key: "volkswagen_arteon",
      catalog_id: "arteon",
      brand: "Volkswagen",
      model_name: arteon.name,
      generation: arteon.generation,
      body_type: arteon.bodyType,
      catalog_photo_url: arteon.photoUrl,
      is_catalog_vw: true
    };
  }

  let matchedVw: VwModelData | undefined = VW_MODELS_CATALOG.find(
    m => m.id.toLowerCase() === strippedKey || `volkswagen_${m.id.toLowerCase()}` === rawKey
  );

  // 2. Se não bateu direto pelo ID na chave, checar variantes específicas primeiro (evitando que "Golf VII GTI" case com "golf-vii")
  if (!matchedVw && (rawModel || strippedKey)) {
    const searchStr = `${rawBrand} ${rawModel} ${strippedKey}`.toLowerCase();

    if (searchStr.includes("golf") && searchStr.includes("gti") && !searchStr.includes("golf iv") && !searchStr.includes("mk4") && !searchStr.includes("golf 4")) {
      matchedVw = VW_MODELS_CATALOG.find(m => m.id === "golf-gti");
    } else if (searchStr.includes("jetta") && searchStr.includes("gli")) {
      matchedVw = VW_MODELS_CATALOG.find(m => m.id === "jetta-gli");
    } else if (searchStr.includes("polo") && searchStr.includes("gti")) {
      matchedVw = VW_MODELS_CATALOG.find(m => m.id === "polo-gti");
    }

    if (!matchedVw) {
      // Ordenar por nome mais longo primeiro para casar variantes específicas antes da família base
      const sortedCatalog = [...VW_MODELS_CATALOG].sort((a, b) => b.name.length - a.name.length || b.id.length - a.id.length);

      for (const item of sortedCatalog) {
        const idSlug = item.id.toLowerCase();
        const idSpaced = idSlug.replace(/-/g, " ");
        const idUnderscored = idSlug.replace(/-/g, "_");
        const nameLower = item.name.toLowerCase();

        const regexId = new RegExp(`(^|[^a-z0-9])(${idSlug}|${idSpaced}|${idUnderscored})($|[^a-z0-9])`, "i");
        if (
          searchStr.includes(nameLower) ||
          regexId.test(rawKey) ||
          regexId.test(rawModel.toLowerCase())
        ) {
          matchedVw = item;
          break;
        }
      }
    }
  }

  if (matchedVw) {
    const canonicalKey = matchedVw.id.includes("arteon")
      ? "volkswagen_arteon"
      : `volkswagen_${matchedVw.id.toLowerCase()}`;
    return {
      vehicle_key: canonicalKey,
      catalog_id: matchedVw.id,
      brand: "Volkswagen",
      model_name: matchedVw.name,
      generation: matchedVw.generation,
      body_type: matchedVw.bodyType,
      catalog_photo_url: matchedVw.photoUrl,
      is_catalog_vw: true
    };
  }

  // 3. Caso não seja um modelo do catálogo VW, normalizar marca_modelo de forma determinística
  const cleanBrand = (rawBrand || "veiculo")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cleanModel = (rawModel || strippedKey || "padrao")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const fallbackKey = rawKey
    ? rawKey.replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")
    : `${cleanBrand}_${cleanModel}`;

  return {
    vehicle_key: fallbackKey,
    catalog_id: null,
    brand: rawBrand || "Volkswagen",
    model_name: rawModel || fallbackKey,
    generation: "",
    body_type: "hatch",
    catalog_photo_url: null,
    is_catalog_vw: false
  };
}
