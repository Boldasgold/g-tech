import { Vehicle3DScene, BodyType } from "./vehicle3d";
import { recognizeVehicle } from "./vw-recognition";

// Global GTech3D interface for public/script.js
(window as any).GTech3D = {
  instance: null as Vehicle3DScene | null,
  currentBodyType: "hatch" as BodyType,

  init(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      this.instance = new Vehicle3DScene(container);
      this.instance.setBodyType(this.currentBodyType);
    } catch (e) {
      console.warn("WebGL not supported or initialization failed, falling back to 2D view", e);
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          📐 <strong>Modo Diagrama Técnico 2D Ativo</strong><br>
          <span style="color: #00c6ff;">Representação Ilustrativa: ${this.currentBodyType.toUpperCase()}</span>
        </div>
      `;
    }
  },

  setBodyType(type: string) {
    this.currentBodyType = (type || "hatch").toLowerCase() as BodyType;
    if (this.instance) {
      this.instance.setBodyType(this.currentBodyType);
    }
    const label = document.getElementById("vehicle3DTypeLabel");
    if (label) {
      label.textContent = this.currentBodyType.toUpperCase();
    }
  },

  setCamera(view: "dianteira" | "traseira" | "esquerda" | "direita" | "teto" | "reset") {
    if (this.instance) {
      this.instance.setCameraView(view);
    }
  },

  detectBodyType(brand: string, model: string): BodyType {
    const rec = recognizeVehicle(brand, model);
    if (rec.isVolkswagen) {
      return rec.bodyType;
    }
    const text = `${brand} ${model}`.toLowerCase();
    if (text.includes("duster") || text.includes("suv") || text.includes("t-cross") || text.includes("tracker") || text.includes("compass") || text.includes("kicks") || text.includes("creta") || text.includes("renegade")) {
      return "suv";
    }
    if (text.includes("oroch") || text.includes("picape") || text.includes("saveiro") || text.includes("s10") || text.includes("montana") || text.includes("hilux") || text.includes("ranger") || text.includes("amarok") || text.includes("toro")) {
      return "picape";
    }
    if (text.includes("master") || text.includes("van") || text.includes("ducato") || text.includes("transit") || text.includes("fiorino") || text.includes("sprinter")) {
      return "van";
    }
    if (text.includes("logan") || text.includes("sedan") || text.includes("virtus") || text.includes("plus") || text.includes("civic") || text.includes("corolla") || text.includes("prisma") || text.includes("cronos") || text.includes("voyage") || text.includes("hb20s")) {
      return "sedan";
    }
    return "hatch";
  }
};

