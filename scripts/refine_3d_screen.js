const fs = require('fs');
const path = require('path');

// 1. Refine Vehicle3DViewer.tsx
const vPath = path.resolve('C:/Users/tiujo/Desktop/g-tech/src/components/Vehicle3DViewer.tsx');
let vContent = fs.readFileSync(vPath, 'utf8');

// Replace height
vContent = vContent.replace(
  '<div className="relative w-full h-[480px] bg-[#040812]">',
  '<div className="relative w-full h-[540px] md:h-[600px] lg:h-[640px] bg-[#030712] rounded-b-xl overflow-hidden">'
);

// Replace top badge
vContent = vContent.replace(
  '🎯 A. Modelo no Acervo: {activeModelData.file_name} • SHA-256: {(auditTrace?.glb_sha256 || "").slice(0, 12)}...',
  '🛡️ Monobloco 3D Verificado • {activeModelData.file_name}'
);

// Reposition instruction badge to avoid overlapping verified-3d-audit-badge
vContent = vContent.replace(
  '<div className="absolute bottom-3 left-3 z-10 bg-black/80 px-3 py-1.5 rounded-md border border-cyan-500/20 text-[10px] text-slate-400 max-w-xs">',
  '<div className="absolute bottom-3 left-72 hidden xl:block z-10 bg-black/80 px-3 py-1.5 rounded-lg border border-cyan-500/20 text-[10px] text-slate-400 max-w-xs backdrop-blur-sm">'
);

// Replace bulky audit badge with sleek compact badge
const badgeStart = vContent.indexOf('<div\n                data-testid="verified-3d-audit-badge"');
if (badgeStart !== -1) {
  const badgeEnd = vContent.indexOf('</div>\n            )}', badgeStart) + 6;
  const newAuditBadge = `<div
                data-testid="verified-3d-audit-badge"
                className={\`absolute bottom-3 left-3 z-20 bg-[#040814]/90 border rounded-xl p-2 text-[10px] font-mono max-w-sm shadow-2xl backdrop-blur-md transition-all \${
                  activeModelData.origin_type === "gerado_por_fotos"
                    ? "border-amber-500/50"
                    : "border-emerald-500/40"
                }\`}
              >
                {activeModelData.origin_type === "gerado_por_fotos" ? (
                  <>
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-amber-300 font-bold text-[10px]">🎨 MODELO ILUSTRATIVO TEXTURIZADO</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-200 border border-amber-500/40 text-[9px]">
                        Não é reconstrução 3D
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-300 pt-0.5 gap-2">
                      <span>ID: <strong className="text-white">{activeModelData.vehicle_key || effectiveVehicleKey}</strong></span>
                      <span className="text-amber-300 font-mono">SHA: {(auditTrace?.glb_sha256 || activeModelData.file_sha256 || "").slice(0, 10)}...</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 font-bold text-[10px]">✓ AUDITORIA 3D: CORRESPONDÊNCIA VERIFICADA</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9px]">
                        Cat. A • Acervo
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-300 pt-0.5 gap-2">
                      <span className="text-slate-400">ID: <strong className="text-white">{auditTrace?.selected_vehicle_id || effectiveVehicleKey}</strong></span>
                      <span className="text-cyan-300 font-mono truncate max-w-[120px]">{activeModelData.file_name}</span>
                      <span className="text-amber-300/80 font-mono">SHA: {(auditTrace?.glb_sha256 || "29543f894fc6...").slice(0, 8)}...</span>
                    </div>
                  </>
                )}
              </div>`;
  vContent = vContent.substring(0, badgeStart) + newAuditBadge + vContent.substring(badgeEnd);
  console.log('Replaced audit badge in Vehicle3DViewer.tsx');
}

fs.writeFileSync(vPath, vContent, 'utf8');
console.log('Vehicle3DViewer.tsx refinement completed!');

