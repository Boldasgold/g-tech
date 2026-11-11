/**
 * GERADOR LOCAL DE MODELO ILUSTRATIVO TEXTURIZADO (G-TECH V1)
 *
 * AUDITORIA TÉCNICA DE GEOMETRIA (Item 4):
 * - Como `photo_to_glb_builder.js` determina a geometria:
 *   A função `createBoxGeometryData(w, h, l, offsetX, offsetY, offsetZ)` instancia prismas retangulares
 *   paramétricos com coordenadas e dimensões fixas predefinidas (`lowerHull`, `upperCabin`, `frontHood`,
 *   `frontBumper`, `rearBumper`, 4 rodas e 4 faróis/lanternas), além de planos UV (`createPhotoPlaneGeometryData`)
 *   nas faces frontal (+Z), traseira (-Z), lateral esquerda (-X) e lateral direita (+X).
 * - Ele NÃO extrai nuvem de pontos (SfM/MVS), NÃO estima mapa de profundidade monocular e NÃO reconstrói
 *   a geometria específica ou curvas da carroceria a partir das fotografias.
 * - Ele aplica as fotografias reais da vistoria (`wo_visit_photos`) como texturas glTF (`images`/`textures`/`materials`)
 *   e calibra o material base (`sampleDominantColorFromBuffer`) sobre uma forma predefinida.
 * - Portanto, o artefato gerado é identificado estritamente como:
 *   "modelo ilustrativo texturizado" (forma predefinida com fotografias da vistoria),
 *   e NUNCA declarado como reconstrução 3D da geometria do carro.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KNOWN_VW_IDS = [
  "golf-variant-sportwagen", "golf-cabriolet", "golf-sportsvan", "golf-alltrack",
  "golf-plus", "golf-gti", "golf-r", "e-golf-2017", "e-golf",
  "golf-viii", "golf-vii", "golf-vi", "golf-v", "golf-iv", "golf-iii", "golf-ii", "golf-i",
  "polo-gti", "polo-track", "polo-seda", "polo-hatch",
  "virtus", "jetta-gli", "jetta", "passat-variant", "passat",
  "arteon", "bora", "vento", "santana", "phaeton",
  "t-cross", "nivus", "taos", "tiguan-allspace", "tiguan",
  "touareg", "t-roc", "tayron",
  "id-buzz", "id-7", "id-5", "id-4", "id-3", "e-up", "up",
  "scirocco", "corrado", "eos", "new-beetle", "fusca",
  "amarok", "saveiro", "transporter-t6", "caddy", "touran", "sharan", "tge-man"
];

/**
 * Normaliza de forma idêntica ao frontend/API o identificador canônico `vehicle_key`.
 */
function resolveCanonicalVehicleKey({ vehicleKey, brand, model }) {
  const rawKey = String(vehicleKey || "").toLowerCase().trim();
  const rawBrand = String(brand || "Volkswagen").trim();
  const rawModel = String(model || "").trim();

  const strippedKey = rawKey.replace(/^volkswagen_/, "").replace(/^vw_/, "");
  if (strippedKey.includes("arteon") || rawModel.toLowerCase().includes("arteon")) {
    return "volkswagen_arteon";
  }

  for (const id of KNOWN_VW_IDS) {
    if (strippedKey === id || rawKey === `volkswagen_${id}`) {
      return `volkswagen_${id}`;
    }
  }

  const searchStr = `${rawBrand} ${rawModel} ${strippedKey}`.toLowerCase();
  if (searchStr.includes("golf") && searchStr.includes("gti") && !searchStr.includes("golf iv") && !searchStr.includes("mk4")) {
    return "volkswagen_golf-gti";
  }
  if (searchStr.includes("jetta") && searchStr.includes("gli")) {
    return "volkswagen_jetta-gli";
  }
  if (searchStr.includes("polo") && searchStr.includes("gti")) {
    return "volkswagen_polo-gti";
  }

  for (const id of KNOWN_VW_IDS) {
    const idSpaced = id.replace(/-/g, " ");
    const idUnderscore = id.replace(/-/g, "_");
    const regex = new RegExp(`(^|[^a-z0-9])(${id}|${idSpaced}|${idUnderscore})($|[^a-z0-9])`, "i");
    if (regex.test(searchStr)) {
      return `volkswagen_${id}`;
    }
  }

  const cleanBrand = (rawBrand || "volkswagen")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cleanModel = (rawModel || strippedKey || "veiculo")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return rawKey
    ? rawKey.replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")
    : `${cleanBrand}_${cleanModel}`;
}

/**
 * Extrai cor média aproximada de um buffer JPEG/PNG real para calibrar o material base da forma predefinida.
 */
function sampleDominantColorFromBuffer(buf) {
  if (!buf || buf.length < 256) return [0.18, 0.24, 0.34, 1.0];
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const start = Math.min(512, Math.floor(buf.length * 0.2));
  const end = Math.min(buf.length - 4, start + 4096);
  for (let i = start; i < end; i += 17) {
    rSum += buf[i];
    gSum += buf[i + 1];
    bSum += buf[i + 2];
    count++;
  }
  if (count === 0) return [0.18, 0.24, 0.34, 1.0];
  const r = Math.min(0.75, Math.max(0.12, (rSum / count) / 255));
  const g = Math.min(0.75, Math.max(0.14, (gSum / count) / 255));
  const b = Math.min(0.80, Math.max(0.18, (bSum / count) / 255));
  return [Number(r.toFixed(4)), Number(g.toFixed(4)), Number(b.toFixed(4)), 1.0];
}

/**
 * Constrói uma geometria de caixa paramétrica predefinida com normais e UVs para glTF 2.0.
 * (Forma predefinida — não reconstrói silhueta nem geometria a partir das fotos).
 */
function createBoxGeometryData(w, h, l, offsetX = 0, offsetY = 0, offsetZ = 0) {
  const hw = w / 2;
  const hh = h / 2;
  const hl = l / 2;

  const positions = [
    // Front (+Z)
    -hw, -hh,  hl,   hw, -hh,  hl,   hw,  hh,  hl,  -hw,  hh,  hl,
    // Rear (-Z)
     hw, -hh, -hl,  -hw, -hh, -hl,  -hw,  hh, -hl,   hw,  hh, -hl,
    // Top (+Y)
    -hw,  hh,  hl,   hw,  hh,  hl,   hw,  hh, -hl,  -hw,  hh, -hl,
    // Bottom (-Y)
    -hw, -hh, -hl,   hw, -hh, -hl,   hw, -hh,  hl,  -hw, -hh,  hl,
    // Right (+X)
     hw, -hh,  hl,   hw, -hh, -hl,   hw,  hh, -hl,   hw,  hh,  hl,
    // Left (-X)
    -hw, -hh, -hl,  -hw, -hh,  hl,  -hw,  hh,  hl,  -hw,  hh, -hl,
  ];

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += offsetX;
    positions[i + 1] += offsetY;
    positions[i + 2] += offsetZ;
  }

  const normals = [
    // Front
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Rear
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];

  const uvs = [];
  for (let f = 0; f < 6; f++) {
    uvs.push(0, 1,  1, 1,  1, 0,  0, 0);
  }

  const indices = [];
  for (let f = 0; f < 6; f++) {
    const base = f * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

/**
 * Constrói um plano UV para projetar a fotografia real (frente, traseira, lateral esquerda, lateral direita)
 * sobre as faces da forma predefinida ("modelo ilustrativo texturizado").
 */
function createPhotoPlaneGeometryData(faceType, w, h, posX, posY, posZ) {
  const hw = w / 2;
  const hh = h / 2;
  let positions, normals;

  if (faceType === "front") {
    positions = [
      posX - hw, posY - hh, posZ,
      posX + hw, posY - hh, posZ,
      posX + hw, posY + hh, posZ,
      posX - hw, posY + hh, posZ
    ];
    normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  } else if (faceType === "rear") {
    positions = [
      posX + hw, posY - hh, posZ,
      posX - hw, posY - hh, posZ,
      posX - hw, posY + hh, posZ,
      posX + hw, posY + hh, posZ
    ];
    normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
  } else if (faceType === "left") {
    positions = [
      posX, posY - hh, posZ - hw,
      posX, posY - hh, posZ + hw,
      posX, posY + hh, posZ + hw,
      posX, posY + hh, posZ - hw
    ];
    normals = [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0];
  } else {
    // right
    positions = [
      posX, posY - hh, posZ + hw,
      posX, posY - hh, posZ - hw,
      posX, posY + hh, posZ - hw,
      posX, posY + hh, posZ + hw
    ];
    normals = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
  }

  const uvs = [0, 1, 1, 1, 1, 0, 0, 0];
  const indices = [0, 1, 2, 0, 2, 3];

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

function computeMinMaxVec3(float32Pos) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < float32Pos.length; i += 3) {
    if (float32Pos[i] < min[0]) min[0] = float32Pos[i];
    if (float32Pos[i + 1] < min[1]) min[1] = float32Pos[i + 1];
    if (float32Pos[i + 2] < min[2]) min[2] = float32Pos[i + 2];
    if (float32Pos[i] > max[0]) max[0] = float32Pos[i];
    if (float32Pos[i + 1] > max[1]) max[1] = float32Pos[i + 1];
    if (float32Pos[i + 2] > max[2]) max[2] = float32Pos[i + 2];
  }
  return {
    min: min.map(n => Number(n.toFixed(5))),
    max: max.map(n => Number(n.toFixed(5)))
  };
}

function padBuffer4(buf, padByte = 0x00) {
  const rem = buf.length % 4;
  if (rem === 0) return buf;
  const pad = Buffer.alloc(4 - rem, padByte);
  return Buffer.concat([buf, pad]);
}

/**
 * Gera um arquivo binário glTF 2.0 (.GLB) identificado explicitamente como
 * "modelo ilustrativo texturizado" (forma predefinida com fotografias da vistoria).
 * NÃO declara reconstrução 3D da geometria do carro.
 */
function buildApproximateGlbFromVisitPhotos({
  rootDir,
  workOrderId,
  visitId,
  visitNumber,
  vehicleId,
  vehicleKey,
  brand,
  model,
  photoRecords
}) {
  if (!Array.isArray(photoRecords) || photoRecords.length === 0) {
    throw new Error("Nenhuma fotografia real de vistoria encontrada para gerar o modelo ilustrativo texturizado.");
  }

  const canonicalKey = resolveCanonicalVehicleKey({ vehicleKey, brand, model });

  // Ler os arquivos binários reais de cada foto do disco
  const loadedPhotos = [];
  for (const rec of photoRecords) {
    let relPath = (rec.stored_path || rec.public_url || "").replace(/^\//, "");
    if (relPath.startsWith("public/")) {
      relPath = relPath.slice("public/".length);
    } else if (relPath.startsWith("api/uploads/visits/")) {
      relPath = path.join("uploads", "visits", path.basename(relPath));
    }
    const absPath = path.join(rootDir, "public", relPath);
    if (fs.existsSync(absPath)) {
      const bin = fs.readFileSync(absPath);
      const actualSha256 = crypto.createHash("sha256").update(bin).digest("hex");
      loadedPhotos.push({
        photo_id: rec.photo_id,
        slot_name: rec.slot_name,
        original_filename: rec.original_filename,
        public_url: rec.public_url,
        mime_type: rec.mime_type || "image/jpeg",
        file_size_bytes: bin.length,
        file_sha256: actualSha256,
        buffer: bin
      });
    }
  }

  if (loadedPhotos.length < 2) {
    throw new Error(`Fotos reais insuficientes no disco (${loadedPhotos.length} encontradas). Anexe pelo menos 2 fotografias distintas na vistoria do veículo.`);
  }

  // Amostrar cores reais a partir das fotografias anexadas
  const frontColor = sampleDominantColorFromBuffer(loadedPhotos[0].buffer);
  const sideColor = sampleDominantColorFromBuffer(loadedPhotos[Math.min(1, loadedPhotos.length - 1)].buffer);

  // Construir forma geométrica predefinida (prismas retangulares fixos)
  const lowerHull = createBoxGeometryData(1.78, 0.56, 4.18, 0, 0.54, 0);
  const upperCabin = createBoxGeometryData(1.48, 0.52, 2.05, 0, 1.06, -0.22);
  const frontHood = createBoxGeometryData(1.68, 0.16, 1.05, 0, 0.84, 1.42);
  const frontBumper = createBoxGeometryData(1.80, 0.32, 0.28, 0, 0.42, 2.12);
  const rearBumper = createBoxGeometryData(1.80, 0.34, 0.28, 0, 0.43, -2.12);
  const wheelFL = createBoxGeometryData(0.26, 0.64, 0.64, -0.88, 0.32, 1.32);
  const wheelFR = createBoxGeometryData(0.26, 0.64, 0.64,  0.88, 0.32, 1.32);
  const wheelRL = createBoxGeometryData(0.26, 0.64, 0.64, -0.88, 0.32, -1.32);
  const wheelRR = createBoxGeometryData(0.26, 0.64, 0.64,  0.88, 0.32, -1.32);
  const headlightL = createBoxGeometryData(0.36, 0.14, 0.10, -0.62, 0.72, 2.12);
  const headlightR = createBoxGeometryData(0.36, 0.14, 0.10,  0.62, 0.72, 2.12);
  const taillightL = createBoxGeometryData(0.36, 0.16, 0.10, -0.62, 0.74, -2.12);
  const taillightR = createBoxGeometryData(0.36, 0.16, 0.10,  0.62, 0.74, -2.12);

  const parts = [
    { name: "predefined_lower_hull", geo: lowerHull, materialIndex: 0 },
    { name: "predefined_upper_cabin", geo: upperCabin, materialIndex: 1 },
    { name: "predefined_front_hood", geo: frontHood, materialIndex: 0 },
    { name: "predefined_front_bumper", geo: frontBumper, materialIndex: 2 },
    { name: "predefined_rear_bumper", geo: rearBumper, materialIndex: 2 },
    { name: "predefined_wheel_fl", geo: wheelFL, materialIndex: 2 },
    { name: "predefined_wheel_fr", geo: wheelFR, materialIndex: 2 },
    { name: "predefined_wheel_rl", geo: wheelRL, materialIndex: 2 },
    { name: "predefined_wheel_rr", geo: wheelRR, materialIndex: 2 },
    { name: "predefined_headlight_l", geo: headlightL, materialIndex: 3 },
    { name: "predefined_headlight_r", geo: headlightR, materialIndex: 3 },
    { name: "predefined_taillight_l", geo: taillightL, materialIndex: 4 },
    { name: "predefined_taillight_r", geo: taillightR, materialIndex: 4 }
  ];

  const bufferViews = [];
  const accessors = [];
  const images = [];
  const textures = [];
  const materials = [
    {
      name: "Pintura_Ilustrativa_Foto_Frontal",
      pbrMetallicRoughness: {
        baseColorFactor: frontColor,
        metallicFactor: 0.65,
        roughnessFactor: 0.25
      },
      doubleSided: true
    },
    {
      name: "Cabine_Ilustrativa_Foto_Lateral",
      pbrMetallicRoughness: {
        baseColorFactor: sideColor,
        metallicFactor: 0.45,
        roughnessFactor: 0.20
      },
      doubleSided: true
    },
    {
      name: "Rodas_e_Parachoques_Escuros",
      pbrMetallicRoughness: {
        baseColorFactor: [0.12, 0.14, 0.18, 1.0],
        metallicFactor: 0.30,
        roughnessFactor: 0.75
      },
      doubleSided: true
    },
    {
      name: "Farois_Dianteiros_LED",
      pbrMetallicRoughness: {
        baseColorFactor: [0.75, 0.95, 1.0, 1.0],
        metallicFactor: 0.10,
        roughnessFactor: 0.10
      },
      emissiveFactor: [0.2, 0.7, 0.9],
      doubleSided: true
    },
    {
      name: "Lanternas_Traseiras",
      pbrMetallicRoughness: {
        baseColorFactor: [0.95, 0.15, 0.15, 1.0],
        metallicFactor: 0.10,
        roughnessFactor: 0.20
      },
      emissiveFactor: [0.8, 0.05, 0.05],
      doubleSided: true
    }
  ];

  const binChunks = [];
  let currentByteOffset = 0;

  function appendBinaryChunk(rawBuf, target) {
    const padded = padBuffer4(rawBuf, 0x00);
    const viewIndex = bufferViews.length;
    const viewObj = {
      buffer: 0,
      byteOffset: currentByteOffset,
      byteLength: rawBuf.length
    };
    if (target) viewObj.target = target;
    bufferViews.push(viewObj);
    binChunks.push(padded);
    currentByteOffset += padded.length;
    return viewIndex;
  }

  // Embutir os buffers binários reais das fotografias da vistoria nos bufferViews/images/textures
  // e aplicar os planos texturizados nas faces correspondentes da forma predefinida
  for (let i = 0; i < loadedPhotos.length; i++) {
    const pho = loadedPhotos[i];
    const imgViewIdx = appendBinaryChunk(pho.buffer, undefined);
    const imgIdx = images.length;
    images.push({
      name: `${pho.slot_name}_${pho.photo_id}`,
      bufferView: imgViewIdx,
      mimeType: pho.mime_type === "image/png" ? "image/png" : "image/jpeg"
    });
    const texIdx = textures.length;
    textures.push({
      source: imgIdx
    });
    const matIdx = materials.length;
    materials.push({
      name: `Textura_Foto_${pho.slot_name}`,
      pbrMetallicRoughness: {
        baseColorTexture: { index: texIdx },
        metallicFactor: 0.1,
        roughnessFactor: 0.8
      },
      doubleSided: true
    });

    // Mapear cada foto como plano texturizado na face correspondente da forma predefinida
    if (pho.slot_name === "photo_front") {
      parts.push({
        name: "textured_plane_front",
        geo: createPhotoPlaneGeometryData("front", 1.36, 0.44, 0, 0.62, 2.27),
        materialIndex: matIdx
      });
    } else if (pho.slot_name === "photo_rear") {
      parts.push({
        name: "textured_plane_rear",
        geo: createPhotoPlaneGeometryData("rear", 1.36, 0.44, 0, 0.62, -2.27),
        materialIndex: matIdx
      });
    } else if (pho.slot_name === "photo_left") {
      parts.push({
        name: "textured_plane_left",
        geo: createPhotoPlaneGeometryData("left", 2.40, 0.48, -0.905, 0.60, 0),
        materialIndex: matIdx
      });
    } else if (pho.slot_name === "photo_right") {
      parts.push({
        name: "textured_plane_right",
        geo: createPhotoPlaneGeometryData("right", 2.40, 0.48, 0.905, 0.60, 0),
        materialIndex: matIdx
      });
    }
  }

  const primitives = [];

  for (const part of parts) {
    const posBuf = Buffer.from(part.geo.positions.buffer, part.geo.positions.byteOffset, part.geo.positions.byteLength);
    const normBuf = Buffer.from(part.geo.normals.buffer, part.geo.normals.byteOffset, part.geo.normals.byteLength);
    const uvBuf = Buffer.from(part.geo.uvs.buffer, part.geo.uvs.byteOffset, part.geo.uvs.byteLength);
    const idxBuf = Buffer.from(part.geo.indices.buffer, part.geo.indices.byteOffset, part.geo.indices.byteLength);

    const posView = appendBinaryChunk(posBuf, 34962);
    const normView = appendBinaryChunk(normBuf, 34962);
    const uvView = appendBinaryChunk(uvBuf, 34962);
    const idxView = appendBinaryChunk(idxBuf, 34963);

    const { min, max } = computeMinMaxVec3(part.geo.positions);
    const vertexCount = part.geo.positions.length / 3;
    const indexCount = part.geo.indices.length;

    const posAcc = accessors.length;
    accessors.push({
      bufferView: posView,
      byteOffset: 0,
      componentType: 5126,
      count: vertexCount,
      type: "VEC3",
      min,
      max
    });

    const normAcc = accessors.length;
    accessors.push({
      bufferView: normView,
      byteOffset: 0,
      componentType: 5126,
      count: vertexCount,
      type: "VEC3"
    });

    const uvAcc = accessors.length;
    accessors.push({
      bufferView: uvView,
      byteOffset: 0,
      componentType: 5126,
      count: vertexCount,
      type: "VEC2"
    });

    const idxAcc = accessors.length;
    accessors.push({
      bufferView: idxView,
      byteOffset: 0,
      componentType: 5123,
      count: indexCount,
      type: "SCALAR"
    });

    primitives.push({
      attributes: {
        POSITION: posAcc,
        NORMAL: normAcc,
        TEXCOORD_0: uvAcc
      },
      indices: idxAcc,
      material: part.materialIndex
    });
  }

  const binPayload = Buffer.concat(binChunks);

  const gltfJson = {
    asset: {
      version: "2.0",
      generator: "G-Tech-V1-Local-Textured-Illustrative-Model-Builder",
      extras: {
        classification: "modelo ilustrativo texturizado",
        geometry_method: "forma predefinida com fotografias (createBoxGeometryData + createPhotoPlaneGeometryData)",
        is_car_geometry_reconstruction: false,
        is_approximate_representation: true,
        origin_category: "B. Modelo ilustrativo texturizado (forma predefinida com fotografias da vistoria — NÃO reconstrói a geometria do carro)",
        work_order_id: workOrderId,
        visit_id: visitId,
        visit_number: visitNumber,
        vehicle_id: vehicleId || null,
        vehicle_key: canonicalKey,
        brand,
        model,
        source_photos: loadedPhotos.map(p => ({
          photo_id: p.photo_id,
          slot_name: p.slot_name,
          public_url: p.public_url,
          file_sha256: p.file_sha256,
          file_size_bytes: p.file_size_bytes
        })),
        generated_at: new Date().toISOString()
      }
    },
    scene: 0,
    scenes: [
      {
        name: `Modelo_Ilustrativo_Texturizado_${canonicalKey}_${workOrderId}`,
        nodes: [0]
      }
    ],
    nodes: [
      {
        name: `modelo_ilustrativo_texturizado_${canonicalKey}`,
        mesh: 0
      }
    ],
    meshes: [
      {
        name: `forma_predefinida_texturizada_${workOrderId}`,
        primitives
      }
    ],
    materials,
    textures,
    images,
    accessors,
    bufferViews,
    buffers: [
      {
        byteLength: binPayload.length
      }
    ]
  };

  const jsonRaw = Buffer.from(JSON.stringify(gltfJson), "utf8");
  const jsonPadded = padBuffer4(jsonRaw, 0x20);

  const totalLength = 12 + 8 + jsonPadded.length + 8 + binPayload.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);          // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binPayload.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  const glbBuffer = Buffer.concat([
    header,
    jsonChunkHeader,
    jsonPadded,
    binChunkHeader,
    binPayload
  ]);

  const modelsDir = path.join(rootDir, "public", "models", "vehicles");
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  const sanitizedKey = String(canonicalKey || "veiculo").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const fileName = `ilustrativo_tex_${sanitizedKey}_${workOrderId}_v${visitNumber}_${Date.now()}.glb`;
  const fullPath = path.join(modelsDir, fileName);
  fs.writeFileSync(fullPath, glbBuffer);

  const glbSha256 = crypto.createHash("sha256").update(glbBuffer).digest("hex");

  return {
    canonical_vehicle_key: canonicalKey,
    classification: "modelo ilustrativo texturizado",
    geometry_audit: "Forma predefinida (prismas retangulares fixos createBoxGeometryData + planos UV createPhotoPlaneGeometryData) com aplicação de fotografias reais da vistoria. Não reconstrói características geométricas 3D das fotos.",
    file_name: fileName,
    file_url: `/api/models/file/${fileName}`,
    full_path: fullPath,
    file_size_bytes: glbBuffer.length,
    file_sha256: glbSha256,
    source_photos_used: loadedPhotos.map(p => ({
      photo_id: p.photo_id,
      slot_name: p.slot_name,
      original_filename: p.original_filename,
      public_url: p.public_url,
      file_size_bytes: p.file_size_bytes,
      file_sha256: p.file_sha256
    }))
  };
}

function getPhotoTo3DIntegrationProposal() {
  const allowExternal = process.env.ALLOW_EXTERNAL_PHOTO_TRANSMISSION === "true";
  const hasTripoKey = Boolean(process.env.TRIPO3D_API_KEY);
  const hasMeshyKey = Boolean(process.env.MESHY_API_KEY);

  return {
    hardware_inspected: {
      cpu: "Intel(R) Core(TM) i5-6400 CPU @ 2.70GHz (4 núcleos físicos / 4 threads)",
      gpu: "Intel(R) HD Graphics 530 (1 GB VRAM compartilhada — SEM GPU dedicada NVIDIA / SEM suporte a CUDA)",
      ram: "16.0 GB DDR4 (17.062.273.024 bytes)",
      os: "Windows 10/11 x64"
    },
    local_generator_audit: {
      script: "services/worker-ai-3d/photo_to_glb_builder.js",
      classification: "modelo ilustrativo texturizado",
      reconstructs_car_geometry_from_photos: false,
      how_geometry_is_determined:
        "Usa formas geométricas predefinidas (caixas paramétricas fixas em createBoxGeometryData para carroceria inferior, cabine, capô, para-choques, rodas e faróis + planos 2D em createPhotoPlaneGeometryData) e aplica as fotografias da vistoria como texturas glTF e cor média. Não reconstrói a malha 3D real do carro."
    },
    active_local_engine: {
      name: "Gerador Local de Modelo Ilustrativo Texturizado (CPU)",
      status: "ATIVO_LOCALMENTE_SEM_CUSTO",
      fidelidade: "Modelo ilustrativo texturizado (forma predefinida com fotografias da vistoria — NÃO é reconstrução 3D do carro)",
      image_destination: "100% Local (public/uploads/visits/ -> public/models/vehicles/ no servidor da oficina, sem transmissão externa)",
      cost: "R$ 0,00 / $0.00 USD"
    },
    external_cloud_options_for_approval: [
      {
        recommended: true,
        provider: "Tripo3D API v2 (Multiview-to-3D)",
        official_endpoint: "https://api.tripo3d.ai/v2/openapi/task (type: multiview_to_model)",
        consent_gate_status: allowExternal && hasTripoKey
          ? "AUTORIZADO_E_CONFIGURADO"
          : "BLOQUEADO_AGUARDANDO_APROVACAO_DO_USUARIO"
      },
      {
        recommended: false,
        provider: "Meshy API v1 (Multi-Image to 3D)",
        official_endpoint: "https://api.meshy.ai/openapi/v1/multi-image-to-3d",
        consent_gate_status: allowExternal && hasMeshyKey
          ? "AUTORIZADO_E_CONFIGURADO"
          : "BLOQUEADO_AGUARDANDO_APROVACAO_DO_USUARIO"
      }
    ]
  };
}

module.exports = {
  buildApproximateGlbFromVisitPhotos,
  getPhotoTo3DIntegrationProposal,
  resolveCanonicalVehicleKey
};
