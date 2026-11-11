const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function findGlbs(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
      findGlbs(full, list);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".glb")) {
      list.push(full);
    }
  }
  return list;
}

function inspectGlbJson(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    // GLB header: magic(4), version(4), length(4), chunkLength(4), chunkType(4)
    const chunkLen = buf.readUInt32LE(12);
    const jsonStr = buf.slice(20, 20 + chunkLen).toString("utf8");
    const gltf = JSON.parse(jsonStr);
    const nodeNames = (gltf.nodes || []).map(n => n.name).filter(Boolean).slice(0, 12);
    const meshNames = (gltf.meshes || []).map(m => m.name).filter(Boolean).slice(0, 12);
    const generator = gltf.asset?.generator || "";
    const extras = gltf.asset?.extras || {};
    return {
      path: filePath,
      size: buf.length,
      sha256,
      generator,
      extras,
      nodeNames,
      meshNames
    };
  } catch (e) {
    return { path: filePath, error: e.message };
  }
}

const glbs = findGlbs(path.join(__dirname, ".."));
console.log(`Found ${glbs.length} GLB files:\n`);
for (const g of glbs) {
  console.log(JSON.stringify(inspectGlbJson(g), null, 2));
}

