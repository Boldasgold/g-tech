import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type BodyType = "hatch" | "sedan" | "suv" | "picape" | "van" | "outro";

export interface HotspotData {
  id: string;
  hotspot_type: "avaria_entrada" | "achado_tecnico" | "servico_concluido";
  region_name: string;
  orientation_side: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  severity: "baixa" | "media" | "alta" | "critica";
  damage_type?: string;
  description: string;
  photo_url?: string | null;
  author_name?: string;
}

export class Vehicle3DScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private carGroup: THREE.Group;
  private hotspotGroup: THREE.Group;
  private currentBodyType: BodyType = "suv";
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private onAddHotspotCallback?: (hit: { region_name: string; orientation_side: string; x: number; y: number; z: number }) => void;
  private onSelectHotspotCallback?: (hotspot: HotspotData) => void;
  private isAddMode = false;
  private animationId: number | null = null;
  private hotspots: HotspotData[] = [];

  constructor(container: HTMLElement, options?: { onAddHotspot?: any; onSelectHotspot?: any }) {
    this.container = container;
    this.onAddHotspotCallback = options?.onAddHotspot;
    this.onSelectHotspotCallback = options?.onSelectHotspot;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060c18); // Dark carbon slate

    // 2. Camera setup
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 380;
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(3.8, 2.2, 4.2);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 9.0;
    this.controls.target.set(0, 0.6, 0);

    // 5. Lighting
    this.setupLighting();

    // 6. Ground grid & shadow
    this.setupGround();

    // 7. Groups
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    this.hotspotGroup = new THREE.Group();
    this.scene.add(this.hotspotGroup);

    // 8. Event listeners
    this.renderer.domElement.addEventListener("click", this.onClick.bind(this));
    window.addEventListener("resize", this.onWindowResize.bind(this));

    // 9. Initial vehicle build
    this.buildVehicle(this.currentBodyType);

    // 10. Start loop
    this.animate();
  }

  private setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    // Key directional light with shadow
    const dirLight = new THREE.DirectionalLight(0xddeeff, 1.8);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -4;
    dirLight.shadow.camera.right = 4;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -4;
    this.scene.add(dirLight);

    // Fill cyan rim light (G-Tech brand identity)
    const cyanLight = new THREE.DirectionalLight(0x00c6ff, 1.2);
    cyanLight.position.set(-5, 4, -4);
    this.scene.add(cyanLight);

    // Warm gold accent light
    const goldLight = new THREE.PointLight(0xffd000, 0.8, 15);
    goldLight.position.set(0, 3, 0);
    this.scene.add(goldLight);
  }

  private setupGround() {
    // Ground circle
    const groundGeo = new THREE.CircleGeometry(6, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x081122,
      roughness: 0.85,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(9, 18, 0x0088ff, 0x14284d);
    grid.position.y = 0.005;
    this.scene.add(grid);
  }

  public setBodyType(type: string) {
    const valid: BodyType = ["hatch", "sedan", "suv", "picape", "van"].includes(type?.toLowerCase())
      ? (type.toLowerCase() as BodyType)
      : "suv";
    if (valid !== this.currentBodyType) {
      this.currentBodyType = valid;
      this.buildVehicle(valid);
      this.rebuildHotspots();
    }
  }

  public getBodyType(): BodyType {
    return this.currentBodyType;
  }

  public setAddMode(enabled: boolean) {
    this.isAddMode = enabled;
    this.renderer.domElement.style.cursor = enabled ? "crosshair" : "grab";
  }

  public setHotspots(hotspots: HotspotData[]) {
    this.hotspots = hotspots;
    this.rebuildHotspots();
  }

  private buildVehicle(bodyType: BodyType) {
    // Clear previous car geometry
    while (this.carGroup.children.length > 0) {
      const obj = this.carGroup.children[0];
      this.carGroup.remove(obj);
    }

    // Material definitions
    const bodyPaint = new THREE.MeshPhysicalMaterial({
      color: 0x0a3c75, // Deep Metallic Sapphire Cyan
      metalness: 0.85,
      roughness: 0.25,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1
    });

    const darkPlastic = new THREE.MeshStandardMaterial({
      color: 0x151b23,
      roughness: 0.8,
      metalness: 0.1
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.7
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff1e28,
      emissive: 0xcc0000,
      emissiveIntensity: 0.8
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e22,
      roughness: 0.9
    });

    // Dimensions based on body type
    let bodyL = 4.0;
    let bodyW = 1.8;
    let bodyH = 0.7;
    let cabinL = 2.0;
    let cabinW = 1.5;
    let cabinH = 0.65;
    let cabinZ = -0.15;
    let groundClearance = 0.28;

    if (bodyType === "hatch") {
      bodyL = 3.8;
      bodyW = 1.74;
      bodyH = 0.68;
      cabinL = 2.1;
      cabinW = 1.48;
      cabinH = 0.65;
      cabinZ = -0.3;
      groundClearance = 0.26;
    } else if (bodyType === "sedan") {
      bodyL = 4.45;
      bodyW = 1.78;
      bodyH = 0.66;
      cabinL = 2.2;
      cabinW = 1.5;
      cabinH = 0.64;
      cabinZ = 0.05;
      groundClearance = 0.25;
    } else if (bodyType === "suv") {
      bodyL = 4.35;
      bodyW = 1.84;
      bodyH = 0.8;
      cabinL = 2.4;
      cabinW = 1.56;
      cabinH = 0.75;
      cabinZ = -0.1;
      groundClearance = 0.36; // Elevated ground clearance
    } else if (bodyType === "picape") {
      bodyL = 4.75;
      bodyW = 1.84;
      bodyH = 0.78;
      cabinL = 1.8;
      cabinW = 1.56;
      cabinH = 0.72;
      cabinZ = 0.45; // Forward cabin, rear open bed
      groundClearance = 0.34;
    } else if (bodyType === "van") {
      bodyL = 4.9;
      bodyW = 1.95;
      bodyH = 1.4;
      cabinL = 3.6;
      cabinW = 1.8;
      cabinH = 0.95;
      cabinZ = -0.2;
      groundClearance = 0.3;
    }

    const baseY = groundClearance + bodyH / 2;

    // 1. Lower Body Chassis
    const lowerBodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyL);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyPaint);
    lowerBody.position.set(0, baseY, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    (lowerBody as any).semanticRegion = "carroceria";
    this.carGroup.add(lowerBody);

    // Front Bumper Wedge
    const bumperGeo = new THREE.BoxGeometry(bodyW * 0.98, bodyH * 0.45, 0.4);
    const frontBumper = new THREE.Mesh(bumperGeo, darkPlastic);
    frontBumper.position.set(0, baseY - bodyH * 0.25, bodyL / 2 + 0.15);
    frontBumper.castShadow = true;
    (frontBumper as any).semanticRegion = "dianteira";
    this.carGroup.add(frontBumper);

    // Rear Bumper
    const rearBumper = new THREE.Mesh(bumperGeo, darkPlastic);
    rearBumper.position.set(0, baseY - bodyH * 0.25, -bodyL / 2 - 0.15);
    rearBumper.castShadow = true;
    (rearBumper as any).semanticRegion = "traseira";
    this.carGroup.add(rearBumper);

    // 2. Cabin / Greenhouse
    if (bodyType === "picape") {
      // Cabine dupla dianteira
      const cabGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
      const cabin = new THREE.Mesh(cabGeo, glassMat);
      cabin.position.set(0, baseY + bodyH / 2 + cabinH / 2 - 0.05, cabinZ);
      cabin.castShadow = true;
      (cabin as any).semanticRegion = "teto";
      this.carGroup.add(cabin);

      // Caçamba traseira
      const bedWallGeo = new THREE.BoxGeometry(bodyW, cabinH * 0.6, 0.08);
      const bedFrontWall = new THREE.Mesh(bedWallGeo, bodyPaint);
      bedFrontWall.position.set(0, baseY + cabinH * 0.3, cabinZ - cabinL / 2);
      this.carGroup.add(bedFrontWall);

      const tailgate = new THREE.Mesh(bedWallGeo, bodyPaint);
      tailgate.position.set(0, baseY + cabinH * 0.3, -bodyL / 2 + 0.05);
      (tailgate as any).semanticRegion = "traseira";
      this.carGroup.add(tailgate);
    } else if (bodyType === "van") {
      // Cabine e baú altos unificados
      const vanGeo = new THREE.BoxGeometry(cabinW, cabinH + 0.3, cabinL);
      const vanTop = new THREE.Mesh(vanGeo, bodyPaint);
      vanTop.position.set(0, baseY + bodyH / 2 + (cabinH + 0.3) / 2 - 0.05, cabinZ);
      vanTop.castShadow = true;
      (vanTop as any).semanticRegion = "teto";
      this.carGroup.add(vanTop);

      // Parabrisa da Van
      const windshieldGeo = new THREE.BoxGeometry(cabinW * 0.95, 0.6, 0.05);
      const windshield = new THREE.Mesh(windshieldGeo, glassMat);
      windshield.position.set(0, baseY + bodyH / 2 + 0.45, bodyL / 2 - 0.6);
      windshield.rotation.x = -0.25;
      this.carGroup.add(windshield);
    } else {
      // Hatch, Sedan, SUV
      const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, baseY + bodyH / 2 + cabinH / 2 - 0.05, cabinZ);
      cabin.castShadow = true;
      (cabin as any).semanticRegion = "teto";
      this.carGroup.add(cabin);

      // Teto Metálico
      const roofGeo = new THREE.BoxGeometry(cabinW * 0.96, 0.05, cabinL * 0.9);
      const roof = new THREE.Mesh(roofGeo, bodyPaint);
      roof.position.set(0, baseY + bodyH / 2 + cabinH - 0.02, cabinZ);
      (roof as any).semanticRegion = "teto";
      this.carGroup.add(roof);

      // Roof Rails para SUV
      if (bodyType === "suv") {
        const railGeo = new THREE.CylinderGeometry(0.025, 0.025, cabinL * 0.85);
        const railL = new THREE.Mesh(railGeo, chromeMat);
        railL.rotation.x = Math.PI / 2;
        railL.position.set(-cabinW * 0.45, baseY + bodyH / 2 + cabinH + 0.04, cabinZ);
        this.carGroup.add(railL);

        const railR = railL.clone();
        railR.position.x = cabinW * 0.45;
        this.carGroup.add(railR);
      }
    }

    // 3. Headlights (LED Cyan/White)
    const hlGeo = new THREE.BoxGeometry(0.35, 0.16, 0.1);
    const hlLeft = new THREE.Mesh(hlGeo, headlightMat);
    hlLeft.position.set(-bodyW * 0.35, baseY + 0.1, bodyL / 2 + 0.02);
    (hlLeft as any).semanticRegion = "dianteira";
    this.carGroup.add(hlLeft);

    const hlRight = hlLeft.clone();
    hlRight.position.x = bodyW * 0.35;
    (hlRight as any).semanticRegion = "dianteira";
    this.carGroup.add(hlRight);

    // 4. Taillights (Ruby Red)
    const tlGeo = new THREE.BoxGeometry(0.32, 0.18, 0.08);
    const tlLeft = new THREE.Mesh(tlGeo, taillightMat);
    tlLeft.position.set(-bodyW * 0.36, baseY + 0.12, -bodyL / 2 - 0.02);
    (tlLeft as any).semanticRegion = "traseira";
    this.carGroup.add(tlLeft);

    const tlRight = tlLeft.clone();
    tlRight.position.x = bodyW * 0.36;
    (tlRight as any).semanticRegion = "traseira";
    this.carGroup.add(tlRight);

    // 5. Wheels & Tires (4 wheels)
    const wheelRadius = groundClearance * 0.9;
    const wheelWidth = 0.24;
    const wheelTrack = bodyW * 0.48;
    const wheelBaseFront = bodyL * 0.32;
    const wheelBaseRear = -bodyL * 0.32;

    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelWidth + 0.02, 16);

    const wheelPositions = [
      { x: -wheelTrack, z: wheelBaseFront, side: "lateral_esquerda" },
      { x: wheelTrack, z: wheelBaseFront, side: "lateral_direita" },
      { x: -wheelTrack, z: wheelBaseRear, side: "lateral_esquerda" },
      { x: wheelTrack, z: wheelBaseRear, side: "lateral_direita" }
    ];

    wheelPositions.forEach(pos => {
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      wheelGroup.position.set(pos.x, wheelRadius, pos.z);
      (wheelGroup as any).semanticRegion = pos.side;
      this.carGroup.add(wheelGroup);
    });

    // 6. Side Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.12, 0.1);
    const mirrorL = new THREE.Mesh(mirrorGeo, darkPlastic);
    mirrorL.position.set(-cabinW * 0.55, baseY + bodyH * 0.35, cabinZ + cabinL * 0.45);
    (mirrorL as any).semanticRegion = "lateral_esquerda";
    this.carGroup.add(mirrorL);

    const mirrorR = mirrorL.clone();
    mirrorR.position.x = cabinW * 0.55;
    (mirrorR as any).semanticRegion = "lateral_direita";
    this.carGroup.add(mirrorR);
  }

  private rebuildHotspots() {
    // Clear existing hotspot meshes
    while (this.hotspotGroup.children.length > 0) {
      this.hotspotGroup.remove(this.hotspotGroup.children[0]);
    }

    this.hotspots.forEach(hs => {
      const color =
        hs.hotspot_type === "servico_concluido" ? 0x22c55e :
        hs.hotspot_type === "achado_tecnico" ? 0xef4444 : 0xf59e0b;

      // 3D Pin / Marker sphere
      const sphereGeo = new THREE.SphereGeometry(0.1, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.3
      });
      const marker = new THREE.Mesh(sphereGeo, mat);
      marker.position.set(hs.pos_x, hs.pos_y + 0.08, hs.pos_z);
      (marker as any).hotspotData = hs;

      // Pulse ring underneath
      const ringGeo = new THREE.RingGeometry(0.06, 0.14, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(hs.pos_x, hs.pos_y + 0.01, hs.pos_z);

      this.hotspotGroup.add(marker);
      this.hotspotGroup.add(ring);
    });
  }

  private onClick(event: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Check if clicked an existing hotspot
    const hotspotHits = this.raycaster.intersectObjects(this.hotspotGroup.children);
    if (hotspotHits.length > 0) {
      const hitObj = hotspotHits[0].object as any;
      if (hitObj.hotspotData && this.onSelectHotspotCallback) {
        this.onSelectHotspotCallback(hitObj.hotspotData);
        return;
      }
    }

    // 2. If in Add Mode, check hit on car body
    if (this.isAddMode && this.onAddHotspotCallback) {
      const carHits = this.raycaster.intersectObjects(this.carGroup.children, true);
      if (carHits.length > 0) {
        const hit = carHits[0];
        const pt = hit.point;

        // Determine semantic region & side based on coordinates
        let side = "dianteira";
        let region = "Capô / Dianteira";

        if (pt.z > 1.2) {
          side = "dianteira";
          region = pt.x > 0.4 ? "Dianteira Direita" : pt.x < -0.4 ? "Dianteira Esquerda" : "Para-choque Dianteiro / Capô";
        } else if (pt.z < -1.2) {
          side = "traseira";
          region = pt.x > 0.4 ? "Traseira Direita" : pt.x < -0.4 ? "Traseira Esquerda" : "Tampa Traseira / Para-choque";
        } else if (pt.x > 0.6) {
          side = "lateral_direita";
          region = pt.z > 0 ? "Porta / Para-lama Dianteiro Direito" : "Porta / Lateral Traseira Direita";
        } else if (pt.x < -0.6) {
          side = "lateral_esquerda";
          region = pt.z > 0 ? "Porta / Para-lama Dianteiro Esquerdo" : "Porta / Lateral Traseira Esquerda";
        } else if (pt.y > 1.2) {
          side = "teto";
          region = "Teto / Teto Solar";
        } else {
          side = "motor";
          region = "Compartimento do Motor / Cofre";
        }

        this.onAddHotspotCallback({
          region_name: region,
          orientation_side: side,
          x: Number(pt.x.toFixed(2)),
          y: Number(pt.y.toFixed(2)),
          z: Number(pt.z.toFixed(2))
        });
      }
    }
  }

  // Camera preset views
  public setCameraView(view: "dianteira" | "traseira" | "esquerda" | "direita" | "teto" | "reset") {
    switch (view) {
      case "dianteira":
        this.camera.position.set(0, 1.4, 4.6);
        this.controls.target.set(0, 0.6, 0);
        break;
      case "traseira":
        this.camera.position.set(0, 1.4, -4.6);
        this.controls.target.set(0, 0.6, 0);
        break;
      case "esquerda":
        this.camera.position.set(-4.6, 1.2, 0);
        this.controls.target.set(0, 0.6, 0);
        break;
      case "direita":
        this.camera.position.set(4.6, 1.2, 0);
        this.controls.target.set(0, 0.6, 0);
        break;
      case "teto":
        this.camera.position.set(0.01, 5.2, 0.01);
        this.controls.target.set(0, 0.5, 0);
        break;
      case "reset":
      default:
        this.camera.position.set(3.8, 2.2, 4.2);
        this.controls.target.set(0, 0.6, 0);
        break;
    }
    this.controls.update();
  }

  private onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    this.controls.update();

    // Pulse animation on hotspot rings
    const time = Date.now() * 0.003;
    this.hotspotGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) {
        const scale = 1.0 + Math.sin(time) * 0.15;
        child.scale.set(scale, scale, scale);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener("resize", this.onWindowResize.bind(this));
    this.renderer.dispose();
  }
}

