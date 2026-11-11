import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

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

export interface ComponentMeshInfo {
  id: string;
  name: string;
  system: string;
  assembly: string;
  axle: string;
  side: string;
  meshId: string;
  isReplaced?: boolean;
}

export class Vehicle3DScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private carGroup: THREE.Group;
  private proceduralBodyGroup: THREE.Group;
  private customMeshGroup: THREE.Group;
  public suspensionGroup: THREE.Group;
  public drivetrainGroup: THREE.Group;
  public hasSubsystems: boolean = false;
  public hasLoadedCustomModel: boolean = false;
  public loadedModelName: string | null = null;
  private currentLoadToken: number = 0;
  private internalGroup: THREE.Group;
  private hotspotGroup: THREE.Group;
  private currentBodyType: BodyType = "suv";
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Callbacks
  private onAddHotspotCallback?: (hit: { region_name: string; orientation_side: string; x: number; y: number; z: number }) => void;
  private onSelectHotspotCallback?: (hotspot: HotspotData) => void;
  private onSelectComponentCallback?: (comp: ComponentMeshInfo) => void;
  private onBreadcrumbChangeCallback?: (breadcrumbs: string[]) => void;

  private isAddMode = false;
  private isExploded = false;
  private isTransparentBody = false;
  private explosionFactor = 0; // 0 to 1
  private targetExplosionFactor = 0;
  private animationId: number | null = null;
  private hotspots: HotspotData[] = [];
  private replacedComponentIds: Set<string> = new Set();

  // Exploded parts registry for animation
  private explodedParts: {
    mesh: THREE.Object3D;
    origPos: THREE.Vector3;
    explodedOffset: THREE.Vector3;
  }[] = [];

  // Internal component meshes list
  private componentMeshes: { mesh: THREE.Object3D; info: ComponentMeshInfo }[] = [];

  // 10s Demo state
  private isDemoRunning = false;
  private demoStartTime = 0;
  private demoInitialTransparent = false;
  private onDemoPoseChangeCallback?: (poseIndex: number, label: string) => void;
  private onDemoCompleteCallback?: () => void;

  // Smooth Camera Transition state
  private targetCameraPos: THREE.Vector3 | null = null;
  private targetControlsTarget: THREE.Vector3 | null = null;

  // Holographic Laser Scanner state
  private isLaserScanning = false;
  private laserScanStartTime = 0;
  private laserScanDuration = 2200; // ms
  private laserMesh?: THREE.Mesh;
  private laserLineMesh?: THREE.Line;
  private onLaserProgressCallback?: (progress: number) => void;
  private onLaserCompleteCallback?: () => void;

  // Showroom Backdrop Screen (Real Vehicle Photo Billboard in 3D Space)
  private showroomBackdropGroup?: THREE.Group;
  private showroomScreenMesh?: THREE.Mesh;
  private textureLoader = new THREE.TextureLoader();
  private currentBackdropUrl?: string;
  private isBackdropVisible = true;

  // Current Paint Color (defaults to G-Tech Safira Blue)
  public currentPaintColor = 0x0a3c75;

  // Materials
  private bodyPaintMaterial!: THREE.MeshPhysicalMaterial;

  constructor(container: HTMLElement, options?: {
    onAddHotspot?: any;
    onSelectHotspot?: any;
    onSelectComponent?: (comp: ComponentMeshInfo) => void;
    onBreadcrumbChange?: (breadcrumbs: string[]) => void;
    replacedComponentIds?: string[];
  }) {
    this.container = container;
    this.onAddHotspotCallback = options?.onAddHotspot;
    this.onSelectHotspotCallback = options?.onSelectHotspot;
    this.onSelectComponentCallback = options?.onSelectComponent;
    this.onBreadcrumbChangeCallback = options?.onBreadcrumbChange;
    if (options?.replacedComponentIds) {
      this.replacedComponentIds = new Set(options.replacedComponentIds);
    }

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060c18); // Dark carbon slate

    // 2. Camera
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 380;
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(3.8, 2.2, 4.2);

    // 3. Renderer
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
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 10.0;
    this.controls.target.set(0, 0.6, 0);

    // 5. Lighting
    this.setupLighting();

    // 6. Ground grid
    this.setupGround();

    // 7. Groups
    this.carGroup = new THREE.Group();
    this.proceduralBodyGroup = new THREE.Group();
    this.proceduralBodyGroup.name = "procedural-body-group";
    this.customMeshGroup = new THREE.Group();
    this.customMeshGroup.name = "custom-mesh-group";
    this.customMeshGroup.visible = false;

    this.suspensionGroup = new THREE.Group();
    this.suspensionGroup.name = "suspension-group";
    this.suspensionGroup.visible = false;

    this.drivetrainGroup = new THREE.Group();
    this.drivetrainGroup.name = "drivetrain-group";
    this.drivetrainGroup.visible = false;

    this.carGroup.add(this.proceduralBodyGroup);
    this.carGroup.add(this.customMeshGroup);
    this.carGroup.add(this.suspensionGroup);
    this.carGroup.add(this.drivetrainGroup);
    this.scene.add(this.carGroup);

    this.internalGroup = new THREE.Group();
    this.scene.add(this.internalGroup);

    this.hotspotGroup = new THREE.Group();
    this.scene.add(this.hotspotGroup);

    // 8. Event listeners
    this.renderer.domElement.addEventListener("click", this.onClick.bind(this));
    window.addEventListener("resize", this.onWindowResize.bind(this));

    // 9. Initial vehicle & internals (ocultos até validação do GLB do veículo selecionado — nunca exibir carro substituto sem modelo correspondente)
    this.buildVehicle(this.currentBodyType);
    this.buildInternalComponents();
    this.proceduralBodyGroup.visible = false;
    this.internalGroup.visible = false;

    // 10. Start loop
    this.animate();
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xddeeff, 1.8);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    const cyanLight = new THREE.DirectionalLight(0x00c6ff, 1.2);
    cyanLight.position.set(-5, 4, -4);
    this.scene.add(cyanLight);

    const goldLight = new THREE.PointLight(0xffd000, 0.8, 15);
    goldLight.position.set(0, 3, 0);
    this.scene.add(goldLight);
  }

  private setupGround() {
    // 1. Base pedestal disk
    const groundGeo = new THREE.CircleGeometry(6, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x070e1b,
      roughness: 0.85,
      metalness: 0.3
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. High-tech LED perimeter glowing ring (Cyan G-Tech)
    const ringGeo = new THREE.RingGeometry(4.78, 4.88, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide
    });
    const ledRing = new THREE.Mesh(ringGeo, ringMat);
    ledRing.rotation.x = -Math.PI / 2;
    ledRing.position.y = 0.003;
    this.scene.add(ledRing);

    // Inner gold safety ring
    const goldRingGeo = new THREE.RingGeometry(2.38, 2.42, 48);
    const goldRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const goldRing = new THREE.Mesh(goldRingGeo, goldRingMat);
    goldRing.rotation.x = -Math.PI / 2;
    goldRing.position.y = 0.004;
    this.scene.add(goldRing);

    // 3. Grid Helper
    const grid = new THREE.GridHelper(9, 18, 0x0088ff, 0x0d2040);
    grid.position.y = 0.005;
    this.scene.add(grid);

    // 4. Setup Laser Scanner Plane
    this.setupLaserScanner();

    // 5. Setup Showroom 3D Real Photo Backdrop Screen
    this.setupShowroomBackdrop();
  }

  private setupShowroomBackdrop() {
    this.showroomBackdropGroup = new THREE.Group();
    this.showroomBackdropGroup.name = "showroom-backdrop-group";

    // 1. Sleek 16:9 Display Screen (4.6m width x 2.6m height)
    const screenGeo = new THREE.PlaneGeometry(4.6, 2.6);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x07111f,
      side: THREE.DoubleSide
    });
    this.showroomScreenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.showroomScreenMesh.position.set(0, 1.45, -3.2);
    this.showroomBackdropGroup.add(this.showroomScreenMesh);

    // 2. Bezel Frame with Carbon Finish
    const frameGeo = new THREE.BoxGeometry(4.75, 2.75, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x050a14,
      metalness: 0.85,
      roughness: 0.25
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 1.45, -3.25);
    this.showroomBackdropGroup.add(frame);

    // 3. Neon Cyan LED Edge Accent
    const edges = new THREE.EdgesGeometry(screenGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00d4ff });
    const edgeLines = new THREE.LineSegments(edges, lineMat);
    edgeLines.position.set(0, 1.45, -3.19);
    this.showroomBackdropGroup.add(edgeLines);

    // 4. Aluminum Stand Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.5, 16);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.2
    });
    const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
    pillarL.position.set(-1.8, 0.75, -3.25);
    const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
    pillarR.position.set(1.8, 0.75, -3.25);
    this.showroomBackdropGroup.add(pillarL);
    this.showroomBackdropGroup.add(pillarR);

    // Initial visibility
    this.showroomBackdropGroup.visible = false;
    this.scene.add(this.showroomBackdropGroup);
  }

  public setRealPhotoBackdrop(url?: string, visible: boolean = true) {
    this.isBackdropVisible = visible;
    if (!this.showroomBackdropGroup) {
      this.setupShowroomBackdrop();
    }
    if (!url || !visible) {
      if (this.showroomBackdropGroup) {
        this.showroomBackdropGroup.visible = false;
      }
      return;
    }

    this.currentBackdropUrl = url;
    this.showroomBackdropGroup!.visible = true;

    this.textureLoader.load(
      url,
      (tex) => {
        if (url !== this.currentBackdropUrl) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        if (this.showroomScreenMesh) {
          this.showroomScreenMesh.material = new THREE.MeshBasicMaterial({
            map: tex,
            side: THREE.DoubleSide
          });
        }
      },
      undefined,
      (err) => {
        console.warn("Não foi possível carregar textura 3D da foto real:", err);
      }
    );
  }

  public toggleShowroomBackdrop(): boolean {
    if (this.showroomBackdropGroup) {
      this.isBackdropVisible = !this.showroomBackdropGroup.visible;
      this.showroomBackdropGroup.visible = this.isBackdropVisible;
      return this.isBackdropVisible;
    }
    return false;
  }

  private setupLaserScanner() {
    const laserGeo = new THREE.PlaneGeometry(3.6, 2.0);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    this.laserMesh = new THREE.Mesh(laserGeo, laserMat);
    this.laserMesh.position.set(0, 1.0, 0);
    this.laserMesh.visible = false;
    this.scene.add(this.laserMesh);
  }

  public setPaintColor(hex: number) {
    this.currentPaintColor = hex;
    if (this.bodyPaintMaterial) {
      this.bodyPaintMaterial.color.setHex(hex);
      this.bodyPaintMaterial.needsUpdate = true;
    }
  }

  public triggerLaserScan(onProgress?: (progress: number) => void, onComplete?: () => void) {
    this.isLaserScanning = true;
    this.laserScanStartTime = performance.now();
    this.onLaserProgressCallback = onProgress;
    this.onLaserCompleteCallback = onComplete;
    if (this.laserMesh) {
      this.laserMesh.visible = true;
      this.laserMesh.position.z = 2.8;
    }
  }

  // Load Photorealistic 3D Model from Tripo3D or .GLB file
  public loadGLBModel(url: string, onProgress?: (pct: number) => void): Promise<boolean> {
    const token = ++this.currentLoadToken;
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("/draco/gltf/");
      loader.setDRACOLoader(dracoLoader);

      loader.load(
        url,
        (gltf) => {
          dracoLoader.dispose();
          // Descartar se uma requisição mais recente foi disparada durante o download
          if (token !== this.currentLoadToken) {
            console.log("Requisição de modelo GLB anterior descartada (concorrência prevenida).");
            return;
          }

          // Limpar apenas o grupo de malhas customizadas anteriores
          while (this.customMeshGroup.children.length > 0) {
            this.customMeshGroup.remove(this.customMeshGroup.children[0]);
          }

          const model = gltf.scene;

          // Defesa em profundidade no cliente: impedir que a malha da Ferrari (steering_red_lights) seja exibida
          let hasIncompatibleFerrariMesh = false;
          model.traverse((n) => {
            if (n.name === "steering_red_lights") {
              hasIncompatibleFerrariMesh = true;
            }
          });
          if (hasIncompatibleFerrariMesh) {
            this.unloadCustomModel();
            reject(new Error("Malha 3D incompatível bloqueada pela auditoria (Ferrari 458 Italia / cafe3f48...)."));
            return;
          }

          // Se for o Arteon Shooting Brake, alinhar a frente (-X original) para +Z (frente padrão da plataforma 3D) e usar escala real (4.86m)
          const isArteonGlb = url.toLowerCase().includes("arteon");
          const isBeetleGlb = url.toLowerCase().includes("beetle") || url.toLowerCase().includes("fusca");
          const isTiguanGlb = url.toLowerCase().includes("tiguan");
          const isBoraGlb = url.toLowerCase().includes("bora");
          const isCeltaGlb = url.toLowerCase().includes("celta");
          const isPoloGlb = url.toLowerCase().includes("polo");
          const isCorsaGlb = url.toLowerCase().includes("corsa");
          if (isArteonGlb) {
            model.rotation.y = Math.PI / 2;
            model.updateMatrixWorld(true);
          }

          // Normalização métrica com BoundingBox: 4.86m (Arteon), 4.54m (Tiguan), 4.38m (Bora), 4.28m (Beetle/Fusca), 4.07m (Polo), 3.79m (Celta), 3.73m (Corsa) ou 4.4m de referência
          const targetLengthM = isArteonGlb ? 4.86 : isTiguanGlb ? 4.54 : isBoraGlb ? 4.38 : isBeetleGlb ? 4.28 : isPoloGlb ? 4.07 : isCeltaGlb ? 3.79 : isCorsaGlb ? 3.73 : 4.4;
          const bbox = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetScale = targetLengthM / (maxDim || 1);
          model.scale.set(targetScale, targetScale, targetScale);
          model.updateMatrixWorld(true);

          // Recalcular BoundingBox após rotação e escala para centralização exata na plataforma
          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledCenter = new THREE.Vector3();
          scaledBox.getCenter(scaledCenter);
          model.position.x -= scaledCenter.x;
          model.position.y -= scaledBox.min.y; // Alinha os pneus perfeitamente com o piso (y = 0)
          model.position.z -= scaledCenter.z;

          // Habilitar sombras e materiais
          let hasInternalMeshes = false;
          model.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              (mesh as any).semanticRegion = "carroceria";

              const nName = (mesh.name || "").toLowerCase();
              if (nName.includes("engine") || nName.includes("motor") || nName.includes("brake") || nName.includes("freio") || nName.includes("suspensao")) {
                hasInternalMeshes = true;
              }

              if (mesh.material && (mesh.material as any).isMeshStandardMaterial) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.envMapIntensity = 1.2;
                mat.roughness = Math.min(mat.roughness, 0.45);
                mat.metalness = Math.max(mat.metalness, 0.4);
              }
            }
          });

          // Adicionar à cena e ocultar a carroceria procedural ilustrativa
          this.customMeshGroup.add(model);
          this.hasLoadedCustomModel = true;
          this.proceduralBodyGroup.visible = false;
          this.customMeshGroup.visible = true;
          this.isSegmentedModel = hasInternalMeshes;

          // Se o modelo for o Arteon, Beetle, Tiguan, Bora, Celta, Polo ou Corsa do acervo, carregar subsistemas dedicados (suspensão amarela e trem de força)
          if (isArteonGlb || isBeetleGlb || isTiguanGlb || isBoraGlb || isCeltaGlb || isPoloGlb || isCorsaGlb) {
            this.loadArteonSubsystems(targetLengthM);
          }

          // Enquadramento automático da câmera
          this.controls.target.set(0, 0.65, 0);
          this.camera.position.set(3.8, 2.2, 4.2);
          this.controls.update();

          this.rebuildHotspots();
          resolve(true);
        },
        (xhr) => {
          if (xhr.lengthComputable && onProgress) {
            onProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => {
          dracoLoader.dispose();
          if (token !== this.currentLoadToken) return;
          console.error("Erro ao carregar modelo GLB:", error);
          // Sem modelo correspondente, ocultar malha 3D (não substituir por outro carro)
          this.proceduralBodyGroup.visible = false;
          this.customMeshGroup.visible = false;
          this.hasLoadedCustomModel = false;
          reject(error);
        }
      );
    });
  }

  // Subsistemas dedicados (Suspensão e Trem de Força em GLBs separados, normalizados pelo comprimento real do veículo)
  private loadArteonSubsystems(targetLengthM: number) {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/gltf/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // 1. Suspensão (car_chassis.glb - amarelo) -> frente original em -X rotacionada por +PI/2
    loader.load(
      "/models/vehicles/car_chassis.glb",
      (gltf) => {
        const susp = gltf.scene;
        susp.rotation.y = Math.PI / 2;
        susp.updateMatrixWorld(true);

        const rawBox = new THREE.Box3().setFromObject(susp);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);
        const rawMaxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;

        const suspScale = (targetLengthM * 0.94) / rawMaxDim;
        susp.scale.set(suspScale, suspScale, suspScale);
        susp.updateMatrixWorld(true);

        const suspBox = new THREE.Box3().setFromObject(susp);
        const suspCenter = new THREE.Vector3();
        suspBox.getCenter(suspCenter);
        susp.position.x -= suspCenter.x;
        susp.position.y -= suspBox.min.y;
        susp.position.z -= suspCenter.z;

        this.suspensionGroup.clear();
        this.suspensionGroup.add(susp);
        this.suspensionGroup.visible = false;
        this.hasSubsystems = true;
      },
      undefined,
      (err) => console.warn("Aviso ao carregar suspensão secundária:", err)
    );

    // 2. Motor e Trem de Força (volkswagen_arteon_chassis.glb - cinza/preto)
    loader.load(
      "/models/vehicles/volkswagen_arteon_chassis.glb",
      (gltf) => {
        const drive = gltf.scene;
        drive.rotation.y = 0;
        drive.updateMatrixWorld(true);

        const rawBox = new THREE.Box3().setFromObject(drive);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);
        const rawMaxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;

        const driveScale = (targetLengthM * 0.94) / rawMaxDim;
        drive.scale.set(driveScale, driveScale, driveScale);
        drive.updateMatrixWorld(true);

        const driveBox = new THREE.Box3().setFromObject(drive);
        const driveCenter = new THREE.Vector3();
        driveBox.getCenter(driveCenter);
        drive.position.x -= driveCenter.x;
        drive.position.y -= driveBox.min.y;
        drive.position.z -= driveCenter.z;

        this.drivetrainGroup.clear();
        this.drivetrainGroup.add(drive);
        this.drivetrainGroup.visible = false;
        this.hasSubsystems = true;
      },
      undefined,
      (err) => console.warn("Aviso ao carregar trem de força secundário:", err)
    );
  }

  public setSubsystemLayer(layer: "all" | "body" | "suspension" | "drivetrain") {
    if (layer === "all") {
      this.customMeshGroup.visible = true;
      this.suspensionGroup.visible = true;
      this.drivetrainGroup.visible = false;
    } else if (layer === "body") {
      this.customMeshGroup.visible = true;
      this.suspensionGroup.visible = false;
      this.drivetrainGroup.visible = false;
      this.setTransparentBody(false);
    } else if (layer === "suspension") {
      this.customMeshGroup.visible = true;
      this.setTransparentBody(true);
      this.suspensionGroup.visible = true;
      this.drivetrainGroup.visible = false;
    } else if (layer === "drivetrain") {
      this.customMeshGroup.visible = true;
      this.setTransparentBody(true);
      this.suspensionGroup.visible = false;
      this.drivetrainGroup.visible = true;
    }
  }

  // Descarregar modelo anterior e invalidar downloads em andamento (Regra 3: sem modelo correspondente, não substituir por outro carro)
  public unloadCustomModel(): void {
    ++this.currentLoadToken;
    while (this.customMeshGroup.children.length > 0) {
      this.customMeshGroup.remove(this.customMeshGroup.children[0]);
    }
    this.suspensionGroup.clear();
    this.drivetrainGroup.clear();
    this.suspensionGroup.visible = false;
    this.drivetrainGroup.visible = false;
    this.hasSubsystems = false;
    this.hasLoadedCustomModel = false;
    this.loadedModelName = null;
    this.proceduralBodyGroup.visible = false;
    this.internalGroup.visible = false;
    this.customMeshGroup.visible = false;
    this.isSegmentedModel = true;
    this.rebuildHotspots();
  }

  public setBodyType(type: string) {
    const valid: BodyType = ["hatch", "sedan", "suv", "picape", "van"].includes(type?.toLowerCase())
      ? (type.toLowerCase() as BodyType)
      : "suv";
    if (valid !== this.currentBodyType) {
      this.currentBodyType = valid;
      this.buildVehicle(valid);
      this.buildInternalComponents();
      if (!this.hasLoadedCustomModel) {
        this.proceduralBodyGroup.visible = false;
        this.internalGroup.visible = false;
      }
      this.rebuildHotspots();
    }
  }

  public setReplacedComponentIds(ids: string[]) {
    this.replacedComponentIds = new Set(ids);
    this.buildInternalComponents();
  }

  public setAddMode(enabled: boolean) {
    this.isAddMode = enabled;
    this.renderer.domElement.style.cursor = enabled ? "crosshair" : "grab";
  }

  public setHotspots(hotspots: HotspotData[]) {
    this.hotspots = hotspots;
    this.rebuildHotspots();
  }

  public isSegmentedModel: boolean = true;
  private onSegmentedStatusCallback?: (isSegmented: boolean) => void;

  public toggleBodyTransparency(): boolean {
    return this.setTransparentBody(!this.isTransparentBody);
  }

  public setTransparentBody(transparent: boolean): boolean {
    this.isTransparentBody = transparent;
    if (this.bodyPaintMaterial) {
      this.bodyPaintMaterial.transparent = transparent;
      this.bodyPaintMaterial.opacity = transparent ? 0.22 : 1.0;
      this.bodyPaintMaterial.needsUpdate = true;
    }
    if (this.customMeshGroup) {
      this.customMeshGroup.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              m.transparent = transparent;
              m.opacity = transparent ? 0.25 : 1.0;
              m.depthWrite = !transparent;
              m.needsUpdate = true;
            });
          }
        }
      });
    }
    return this.isTransparentBody;
  }

  public setExploded(exploded: boolean) {
    this.isExploded = exploded;
    this.targetExplosionFactor = exploded ? 1.0 : 0.0;
    if (this.onBreadcrumbChangeCallback) {
      this.onBreadcrumbChangeCallback(
        exploded ? ["Veículo", "Mecânica", "Vista Explodida 3D"] : ["Veículo", "Montagem Completa"]
      );
    }
  }

  public getIsExploded(): boolean {
    return this.isExploded;
  }

  public getIsTransparent(): boolean {
    return this.isTransparentBody;
  }

  private buildVehicle(bodyType: BodyType) {
    while (this.proceduralBodyGroup.children.length > 0) {
      this.proceduralBodyGroup.remove(this.proceduralBodyGroup.children[0]);
    }

    this.bodyPaintMaterial = new THREE.MeshPhysicalMaterial({
      color: this.currentPaintColor,
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
      transparent: this.isTransparentBody,
      opacity: this.isTransparentBody ? 0.25 : 1.0
    });

    const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x151b23, roughness: 0.8, metalness: 0.1 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00b4d8, emissiveIntensity: 0.7 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff1e28, emissive: 0xcc0000, emissiveIntensity: 0.8 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });

    let bodyL = 4.35;
    let bodyW = 1.84;
    let bodyH = 0.8;
    let cabinL = 2.4;
    let cabinW = 1.56;
    let cabinH = 0.75;
    let cabinZ = -0.1;
    let groundClearance = 0.36;

    if (bodyType === "hatch") {
      bodyL = 3.8; bodyW = 1.74; bodyH = 0.68; cabinL = 2.1; cabinW = 1.48; cabinH = 0.65; cabinZ = -0.3; groundClearance = 0.26;
    } else if (bodyType === "sedan") {
      bodyL = 4.45; bodyW = 1.78; bodyH = 0.66; cabinL = 2.2; cabinW = 1.5; cabinH = 0.64; cabinZ = 0.05; groundClearance = 0.25;
    } else if (bodyType === "picape") {
      bodyL = 4.75; bodyW = 1.84; bodyH = 0.78; cabinL = 1.8; cabinW = 1.56; cabinH = 0.72; cabinZ = 0.45; groundClearance = 0.34;
    } else if (bodyType === "van") {
      bodyL = 4.9; bodyW = 1.95; bodyH = 1.4; cabinL = 3.6; cabinW = 1.8; cabinH = 0.95; cabinZ = -0.2; groundClearance = 0.3;
    }

    const baseY = groundClearance + bodyH / 2;

    // Lower Body
    const lowerBodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyL);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, this.bodyPaintMaterial);
    lowerBody.position.set(0, baseY, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    (lowerBody as any).semanticRegion = "carroceria";
    this.proceduralBodyGroup.add(lowerBody);

    // Bumpers
    const bumperGeo = new THREE.BoxGeometry(bodyW * 0.98, bodyH * 0.45, 0.4);
    const frontBumper = new THREE.Mesh(bumperGeo, darkPlastic);
    frontBumper.position.set(0, baseY - bodyH * 0.25, bodyL / 2 + 0.15);
    (frontBumper as any).semanticRegion = "dianteira";
    this.proceduralBodyGroup.add(frontBumper);

    const rearBumper = new THREE.Mesh(bumperGeo, darkPlastic);
    rearBumper.position.set(0, baseY - bodyH * 0.25, -bodyL / 2 - 0.15);
    (rearBumper as any).semanticRegion = "traseira";
    this.proceduralBodyGroup.add(rearBumper);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
    const cabin = new THREE.Mesh(cabinGeo, this.bodyPaintMaterial);
    cabin.position.set(0, baseY + bodyH / 2 + cabinH / 2 - 0.02, cabinZ);
    (cabin as any).semanticRegion = "teto";
    this.proceduralBodyGroup.add(cabin);

    // Windshield
    const windshieldGeo = new THREE.PlaneGeometry(cabinW * 0.9, cabinH * 0.85);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, baseY + bodyH / 2 + cabinH / 2, cabinZ + cabinL / 2 + 0.02);
    windshield.rotation.x = -Math.PI / 6;
    (windshield as any).semanticRegion = "dianteira";
    this.proceduralBodyGroup.add(windshield);

    // Headlights (3D Sculpted LED Matrix)
    const hlGeo = new THREE.BoxGeometry(0.35, 0.14, 0.12);
    const hlLeft = new THREE.Mesh(hlGeo, headlightMat);
    hlLeft.position.set(-bodyW * 0.38, baseY + bodyH * 0.2, bodyL / 2 + 0.05);
    hlLeft.rotation.y = 0.15;
    (hlLeft as any).semanticRegion = "dianteira";
    this.proceduralBodyGroup.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeo, headlightMat);
    hlRight.position.set(bodyW * 0.38, baseY + bodyH * 0.2, bodyL / 2 + 0.05);
    hlRight.rotation.y = -0.15;
    (hlRight as any).semanticRegion = "dianteira";
    this.proceduralBodyGroup.add(hlRight);

    // Front Grille & Air Dam
    const grilleGeo = new THREE.BoxGeometry(bodyW * 0.5, bodyH * 0.25, 0.08);
    const grille = new THREE.Mesh(grilleGeo, darkPlastic);
    grille.position.set(0, baseY + bodyH * 0.12, bodyL / 2 + 0.06);
    this.proceduralBodyGroup.add(grille);

    // Aerodynamic Hood Creases / Taper
    const hoodGeo = new THREE.BoxGeometry(bodyW * 0.9, 0.04, bodyL * 0.35);
    const hood = new THREE.Mesh(hoodGeo, this.bodyPaintMaterial);
    hood.position.set(0, baseY + bodyH * 0.5 + 0.02, bodyL * 0.25);
    hood.rotation.x = 0.08;
    this.proceduralBodyGroup.add(hood);

    // Side Mirrors (Aerodynamic Left & Right)
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.12);
    const mirrorLeft = new THREE.Mesh(mirrorGeo, darkPlastic);
    mirrorLeft.position.set(-cabinW * 0.56, baseY + bodyH * 0.45, cabinZ + cabinL * 0.35);
    this.proceduralBodyGroup.add(mirrorLeft);

    const mirrorRight = mirrorLeft.clone();
    mirrorRight.position.x = cabinW * 0.56;
    this.proceduralBodyGroup.add(mirrorRight);

    // Rear Taillight Lightbar
    const tlGeo = new THREE.BoxGeometry(bodyW * 0.88, 0.08, 0.06);
    const taillightBar = new THREE.Mesh(tlGeo, taillightMat);
    taillightBar.position.set(0, baseY + bodyH * 0.25, -bodyL / 2 - 0.05);
    (taillightBar as any).semanticRegion = "traseira";
    this.proceduralBodyGroup.add(taillightBar);

    // Dual Chrome Exhaust Tips
    const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12);
    const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.position.set(-bodyW * 0.32, baseY - bodyH * 0.3, -bodyL / 2 - 0.22);
    this.proceduralBodyGroup.add(exhaustL);

    const exhaustR = exhaustL.clone();
    exhaustR.position.x = bodyW * 0.32;
    this.proceduralBodyGroup.add(exhaustR);

    // Roof Styling: Roof Rails for SUV/Van or Sport Spoiler for Hatch/Sedan
    if (bodyType === "suv" || bodyType === "van") {
      const railGeo = new THREE.BoxGeometry(0.04, 0.05, cabinL * 0.85);
      const railL = new THREE.Mesh(railGeo, chromeMat);
      railL.position.set(-cabinW * 0.45, baseY + bodyH / 2 + cabinH + 0.02, cabinZ);
      this.proceduralBodyGroup.add(railL);

      const railR = railL.clone();
      railR.position.x = cabinW * 0.45;
      this.proceduralBodyGroup.add(railR);
    } else {
      const spoilerGeo = new THREE.BoxGeometry(cabinW * 0.9, 0.04, 0.2);
      const spoiler = new THREE.Mesh(spoilerGeo, darkPlastic);
      spoiler.position.set(0, baseY + bodyH * 0.48, -bodyL * 0.48);
      this.proceduralBodyGroup.add(spoiler);
    }

    // High-Detail Wheels with 5-Spoke Alloy Rims & Brembo Red Calipers
    const wheelRadius = groundClearance * 1.15;
    const wheelWidth = 0.26;
    const wheelTrack = bodyW * 0.52;
    const wheelBaseFront = bodyL * 0.32;
    const wheelBaseRear = -bodyL * 0.32;

    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 16);
    const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, 0.02, 16);
    const caliperGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8, roughness: 0.2 }); // Brembo Red

    const wheelPositions = [
      { x: -wheelTrack, z: wheelBaseFront, side: "lateral_esquerda", isFrontRight: false },
      { x: wheelTrack, z: wheelBaseFront, side: "lateral_direita", isFrontRight: true },
      { x: -wheelTrack, z: wheelBaseRear, side: "lateral_esquerda", isFrontRight: false },
      { x: wheelTrack, z: wheelBaseRear, side: "lateral_direita", isFrontRight: false }
    ];

    wheelPositions.forEach(pos => {
      const wheelGroup = new THREE.Group();

      // Rubber Tire
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      // Alloy Rim
      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      // 5-Spoke Star Design
      for (let s = 0; s < 5; s++) {
        const angle = (s * Math.PI * 2) / 5;
        const spokeGeo = new THREE.BoxGeometry(0.03, wheelRadius * 0.55, 0.04);
        const spoke = new THREE.Mesh(spokeGeo, chromeMat);
        spoke.position.set(pos.x > 0 ? wheelWidth * 0.38 : -wheelWidth * 0.38, Math.sin(angle) * wheelRadius * 0.26, Math.cos(angle) * wheelRadius * 0.26);
        spoke.rotation.x = angle;
        wheelGroup.add(spoke);
      }

      // Silver Brake Rotor Disc
      const rotor = new THREE.Mesh(rotorGeo, chromeMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = pos.x > 0 ? -0.04 : 0.04;
      wheelGroup.add(rotor);

      // Brembo Red Brake Caliper
      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(pos.x > 0 ? -0.04 : 0.04, wheelRadius * 0.35, 0);
      wheelGroup.add(caliper);

      wheelGroup.position.set(pos.x, wheelRadius, pos.z);
      (wheelGroup as any).semanticRegion = pos.side;
      this.proceduralBodyGroup.add(wheelGroup);

      // Register front-right wheel for axial explosion
      if (pos.isFrontRight) {
        this.explodedParts.push({
          mesh: wheelGroup,
          origPos: new THREE.Vector3(pos.x, wheelRadius, pos.z),
          explodedOffset: new THREE.Vector3(0.95, 0, 0)
        });
      }
    });

    // Se um modelo GLB customizado estiver carregado, a carroceria procedural fica oculta
    this.proceduralBodyGroup.visible = !this.hasLoadedCustomModel;
  }

  // Build Internal Assemblies (Engine Bay, Brakes, Transmission)
  private buildInternalComponents() {
    while (this.internalGroup.children.length > 0) {
      this.internalGroup.remove(this.internalGroup.children[0]);
    }
    this.componentMeshes = [];
    this.explodedParts = this.explodedParts.filter(p => !this.internalGroup.children.includes(p.mesh));

    // Internal Materials
    const castIronMat = new THREE.MeshStandardMaterial({ color: 0x2b3544, metalness: 0.9, roughness: 0.4 });
    const aluminumMat = new THREE.MeshStandardMaterial({ color: 0xa0aec0, metalness: 0.95, roughness: 0.2 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 1.0, roughness: 0.15 });
    const goldCaliperMat = new THREE.MeshStandardMaterial({ color: 0x00c6ff, metalness: 0.7, roughness: 0.3 });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.8, roughness: 0.3 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const replacedGlowMat = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Emerald green glow for REPLACED PARTS ("PEÇA TROCADA")
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2
    });

    const isReplaced = (id: string) => this.replacedComponentIds.has(id);

    // ==========================================
    // 1. ENGINE COMPARTMENT ASSEMBLY (Front Bay)
    // ==========================================
    const engineBayGroup = new THREE.Group();
    engineBayGroup.position.set(0, 0.65, 1.25);

    // 1.1 Bloco do Motor (Engine Block)
    const blockGeo = new THREE.BoxGeometry(0.7, 0.45, 0.55);
    const blockMesh = new THREE.Mesh(blockGeo, isReplaced("cmp-engine-block") ? replacedGlowMat : castIronMat);
    blockMesh.position.set(0, 0, 0);
    this.registerComponentMesh(blockMesh, {
      id: "cmp-engine-block",
      name: "Bloco do Motor & Pistões",
      system: "Propulsão e Alimentação",
      assembly: "Motor",
      axle: "dianteiro",
      side: "central",
      meshId: "mesh_engine_block",
      isReplaced: isReplaced("cmp-engine-block")
    });
    engineBayGroup.add(blockMesh);

    // 1.2 Cabeçote 16V (Cylinder Head)
    const headGeo = new THREE.BoxGeometry(0.68, 0.22, 0.52);
    const headMesh = new THREE.Mesh(headGeo, isReplaced("cmp-cylinder-head") ? replacedGlowMat : aluminumMat);
    headMesh.position.set(0, 0.33, 0);
    this.registerComponentMesh(headMesh, {
      id: "cmp-cylinder-head",
      name: "Cabeçote 16 Válvulas",
      system: "Propulsão e Alimentação",
      assembly: "Motor › Cabeçote",
      axle: "dianteiro",
      side: "central",
      meshId: "mesh_cylinder_head",
      isReplaced: isReplaced("cmp-cylinder-head")
    });
    this.explodedParts.push({
      mesh: headMesh,
      origPos: new THREE.Vector3(0, 0.33, 0),
      explodedOffset: new THREE.Vector3(0, 0.45, 0) // Lifts up along Y
    });
    engineBayGroup.add(headMesh);

    // 1.3 Comando de Válvulas (Camshaft)
    const camGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.58, 16);
    const camMesh = new THREE.Mesh(camGeo, isReplaced("cmp-camshaft") ? replacedGlowMat : steelMat);
    camMesh.rotation.x = Math.PI / 2;
    camMesh.position.set(0.12, 0.48, 0);
    this.registerComponentMesh(camMesh, {
      id: "cmp-camshaft",
      name: "Comando de Válvulas",
      system: "Propulsão e Alimentação",
      assembly: "Motor › Cabeçote",
      axle: "dianteiro",
      side: "central",
      meshId: "mesh_camshaft",
      isReplaced: isReplaced("cmp-camshaft")
    });
    this.explodedParts.push({
      mesh: camMesh,
      origPos: new THREE.Vector3(0.12, 0.48, 0),
      explodedOffset: new THREE.Vector3(0, 0.75, 0) // Lifts higher along Y
    });
    engineBayGroup.add(camMesh);

    // 1.4 Velas de Ignição (Spark Plugs)
    const plugGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8);
    for (let p = -0.18; p <= 0.18; p += 0.12) {
      const plug = new THREE.Mesh(plugGeo, isReplaced("cmp-spark-plugs") ? replacedGlowMat : copperMat);
      plug.position.set(-0.1, 0.52, p);
      engineBayGroup.add(plug);
      if (p === 0.06) {
        this.registerComponentMesh(plug, {
          id: "cmp-spark-plugs",
          name: "Velas de Ignição (Jogo 4)",
          system: "Propulsão e Alimentação",
          assembly: "Motor › Ignição",
          axle: "dianteiro",
          side: "central",
          meshId: "mesh_spark_plugs",
          isReplaced: isReplaced("cmp-spark-plugs")
        });
      }
    }

    // 1.5 Cárter de Óleo (Oil Pan)
    const panGeo = new THREE.BoxGeometry(0.62, 0.18, 0.48);
    const panMesh = new THREE.Mesh(panGeo, isReplaced("cmp-oil-pan") ? replacedGlowMat : castIronMat);
    panMesh.position.set(0, -0.32, 0);
    this.registerComponentMesh(panMesh, {
      id: "cmp-oil-pan",
      name: "Cárter de Óleo & Lubrificação",
      system: "Propulsão e Alimentação",
      assembly: "Motor › Lubrificação",
      axle: "dianteiro",
      side: "central",
      meshId: "mesh_oil_pan",
      isReplaced: isReplaced("cmp-oil-pan")
    });
    engineBayGroup.add(panMesh);

    // 1.6 Radiador de Arrefecimento
    const radGeo = new THREE.BoxGeometry(0.78, 0.45, 0.08);
    const radMesh = new THREE.Mesh(radGeo, isReplaced("cmp-radiator") ? replacedGlowMat : aluminumMat);
    radMesh.position.set(0, 0.05, 0.65);
    this.registerComponentMesh(radMesh, {
      id: "cmp-radiator",
      name: "Radiador & Eletroventilador",
      system: "Propulsão e Alimentação",
      assembly: "Arrefecimento",
      axle: "dianteiro",
      side: "central",
      meshId: "mesh_radiator",
      isReplaced: isReplaced("cmp-radiator")
    });
    engineBayGroup.add(radMesh);

    // 1.7 Bateria Auxiliar 12V
    const batGeo = new THREE.BoxGeometry(0.28, 0.22, 0.22);
    const batMesh = new THREE.Mesh(batGeo, isReplaced("cmp-battery-12v") ? replacedGlowMat : rubberMat);
    batMesh.position.set(-0.55, 0.15, 0.2);
    this.registerComponentMesh(batMesh, {
      id: "cmp-battery-12v",
      name: "Bateria Automotiva 12V 60Ah",
      system: "Elétrica e Eletrônica",
      assembly: "Alimentação 12V",
      axle: "dianteiro",
      side: "dianteira_esquerda",
      meshId: "mesh_battery",
      isReplaced: isReplaced("cmp-battery-12v")
    });
    engineBayGroup.add(batMesh);

    this.internalGroup.add(engineBayGroup);

    // ==========================================
    // 2. FRONT RIGHT WHEEL & BRAKE ASSEMBLY
    // ==========================================
    const brakeAssemblyGroup = new THREE.Group();
    const frX = 0.94;
    const frY = 0.38;
    const frZ = 1.38;
    brakeAssemblyGroup.position.set(frX, frY, frZ);

    // 2.1 Disco de Freio Ventilado (Brake Disc)
    const discGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 32);
    const discMesh = new THREE.Mesh(discGeo, isReplaced("cmp-brake-disc-front") ? replacedGlowMat : steelMat);
    discMesh.rotation.z = Math.PI / 2;
    discMesh.position.set(0, 0, 0);
    this.registerComponentMesh(discMesh, {
      id: "cmp-brake-disc-front",
      name: "Disco de Freio Ventilado Dianteiro",
      system: "Rodagem e Controle",
      assembly: "Freios Dianteiros",
      axle: "dianteiro",
      side: "dianteira_direita",
      meshId: "mesh_brake_disc_fr",
      isReplaced: isReplaced("cmp-brake-disc-front")
    });
    brakeAssemblyGroup.add(discMesh);

    // 2.2 Pinça de Freio (Brake Caliper)
    const caliperGeo = new THREE.BoxGeometry(0.12, 0.16, 0.18);
    const caliperMesh = new THREE.Mesh(caliperGeo, isReplaced("cmp-brake-caliper-front") ? replacedGlowMat : goldCaliperMat);
    caliperMesh.position.set(0.04, 0.12, 0.08);
    this.registerComponentMesh(caliperMesh, {
      id: "cmp-brake-caliper-front",
      name: "Pinça de Freio Hidráulica Dianteira",
      system: "Rodagem e Controle",
      assembly: "Freios Dianteiros",
      axle: "dianteiro",
      side: "dianteira_direita",
      meshId: "mesh_brake_caliper_fr",
      isReplaced: isReplaced("cmp-brake-caliper-front")
    });
    this.explodedParts.push({
      mesh: caliperMesh,
      origPos: new THREE.Vector3(0.04, 0.12, 0.08),
      explodedOffset: new THREE.Vector3(0.35, 0.05, 0.15) // Moves forward and outward
    });
    brakeAssemblyGroup.add(caliperMesh);

    // 2.3 Pastilhas de Freio Dianteiras (Brake Pads)
    const padGeo = new THREE.BoxGeometry(0.02, 0.08, 0.14);
    const padMesh = new THREE.Mesh(padGeo, isReplaced("cmp-brake-pads-front") ? replacedGlowMat : copperMat);
    padMesh.position.set(0.02, 0.12, 0.08);
    this.registerComponentMesh(padMesh, {
      id: "cmp-brake-pads-front",
      name: "Pastilhas de Freio Dianteiras (Jogo)",
      system: "Rodagem e Controle",
      assembly: "Freios Dianteiros",
      axle: "dianteiro",
      side: "dianteira_direita",
      meshId: "mesh_brake_pad_fr",
      isReplaced: isReplaced("cmp-brake-pads-front")
    });
    this.explodedParts.push({
      mesh: padMesh,
      origPos: new THREE.Vector3(0.02, 0.12, 0.08),
      explodedOffset: new THREE.Vector3(0.55, 0.1, 0.25) // Separates further outward
    });
    brakeAssemblyGroup.add(padMesh);

    // 2.4 Terminal de Direção Dianteiro Direito (Tie Rod)
    const tieRodGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 12);
    const tieRodMesh = new THREE.Mesh(tieRodGeo, isReplaced("cmp-tie-rod-front-r") ? replacedGlowMat : goldCaliperMat);
    tieRodMesh.rotation.z = Math.PI / 3;
    tieRodMesh.position.set(-0.16, 0.04, -0.14);
    this.registerComponentMesh(tieRodMesh, {
      id: "cmp-tie-rod-front-r",
      name: "Terminal de Direção Dianteiro Direito",
      system: "Rodagem e Controle",
      assembly: "Direção",
      axle: "dianteiro",
      side: "dianteira_direita",
      meshId: "mesh_tie_rod_r",
      isReplaced: isReplaced("cmp-tie-rod-front-r")
    });
    this.explodedParts.push({
      mesh: tieRodMesh,
      origPos: new THREE.Vector3(-0.16, 0.04, -0.14),
      explodedOffset: new THREE.Vector3(-0.15, 0, -0.2)
    });
    brakeAssemblyGroup.add(tieRodMesh);

    // 2.5 Amortecedor e Mola (Shock Absorber & Coil Spring)
    const strutGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.65, 12);
    const strutMesh = new THREE.Mesh(strutGeo, steelMat);
    strutMesh.position.set(-0.06, 0.38, 0);
    brakeAssemblyGroup.add(strutMesh);

    const springGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 24);
    for (let s = 0.2; s <= 0.55; s += 0.07) {
      const coil = new THREE.Mesh(springGeo, goldCaliperMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(-0.06, s, 0);
      brakeAssemblyGroup.add(coil);
    }

    this.internalGroup.add(brakeAssemblyGroup);

    // Add badge / glow indicator for Replaced Parts
    this.componentMeshes.forEach(cm => {
      if (cm.info.isReplaced) {
        const ringGeo = new THREE.RingGeometry(0.08, 0.16, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
        const badge = new THREE.Mesh(ringGeo, ringMat);
        badge.position.copy(cm.mesh.position);
        badge.position.y += 0.15;
        this.internalGroup.add(badge);
      }
    });
  }

  private registerComponentMesh(mesh: THREE.Object3D, info: ComponentMeshInfo) {
    (mesh as any).componentInfo = info;
    this.componentMeshes.push({ mesh, info });
  }

  private rebuildHotspots() {
    while (this.hotspotGroup.children.length > 0) {
      this.hotspotGroup.remove(this.hotspotGroup.children[0]);
    }

    this.hotspots.forEach(hs => {
      const color =
        hs.hotspot_type === "servico_concluido" ? 0x22c55e :
          hs.hotspot_type === "achado_tecnico" ? 0xef4444 : 0xf59e0b;

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

    // 1. Check if clicked an internal mechanical component
    const internalHits = this.raycaster.intersectObjects(this.internalGroup.children, true);
    if (internalHits.length > 0) {
      for (const hit of internalHits) {
        let cur: any = hit.object;
        while (cur && !cur.componentInfo && cur !== this.internalGroup) {
          cur = cur.parent;
        }
        if (cur && cur.componentInfo && this.onSelectComponentCallback) {
          this.onSelectComponentCallback(cur.componentInfo);
          if (this.onBreadcrumbChangeCallback) {
            this.onBreadcrumbChangeCallback([
              "Veículo",
              cur.componentInfo.system,
              cur.componentInfo.assembly,
              cur.componentInfo.name
            ]);
          }
          return;
        }
      }
    }

    // 2. Check if clicked an existing hotspot pin
    const hotspotHits = this.raycaster.intersectObjects(this.hotspotGroup.children);
    if (hotspotHits.length > 0) {
      const hitObj = hotspotHits[0].object as any;
      if (hitObj.hotspotData && this.onSelectHotspotCallback) {
        this.onSelectHotspotCallback(hitObj.hotspotData);
        return;
      }
    }

    // 3. Check hit on car body
    const carHits = this.raycaster.intersectObjects(this.carGroup.children, true);
    if (carHits.length > 0) {
      const hit = carHits[0];
      const pt = hit.point;

      // If in Add Mode, record damage hotspot
      if (this.isAddMode && this.onAddHotspotCallback) {
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
        return;
      }

      // If NOT in Add Mode, clicking motor or front right wheel drills down into internal system!
      if (pt.z > 0.6 && Math.abs(pt.x) < 0.6) {
        // Motor compartment drill-down
        this.zoomToSystem("motor");
      } else if (pt.x > 0.5 && pt.z > 0.6) {
        // Front right wheel & brake drill-down
        this.zoomToSystem("freios_diant_dir");
      }
    }
  }

  // Camera presets & drill-down zoom (Smooth Transition Lerp)
  public zoomToSystem(system: "motor" | "freios_diant_dir" | "suspensao" | "transmissao" | "reset") {
    switch (system) {
      case "motor":
        this.targetCameraPos = new THREE.Vector3(1.4, 1.8, 2.5);
        this.targetControlsTarget = new THREE.Vector3(0, 0.7, 1.25);
        this.setTransparentBody(true); // Desobstrui a visão da lataria para exibir peças internas
        if (this.onBreadcrumbChangeCallback) {
          this.onBreadcrumbChangeCallback(["Veículo", "Propulsão e Alimentação", "Motor"]);
        }
        break;
      case "freios_diant_dir":
        this.targetCameraPos = new THREE.Vector3(2.4, 0.6, 1.8);
        this.targetControlsTarget = new THREE.Vector3(0.94, 0.38, 1.38);
        if (this.onBreadcrumbChangeCallback) {
          this.onBreadcrumbChangeCallback(["Veículo", "Rodagem e Controle", "Freios Dianteiros"]);
        }
        break;
      case "suspensao":
        this.targetCameraPos = new THREE.Vector3(2.0, 0.8, 1.2);
        this.targetControlsTarget = new THREE.Vector3(0.9, 0.45, 1.3);
        if (this.onBreadcrumbChangeCallback) {
          this.onBreadcrumbChangeCallback(["Veículo", "Rodagem e Controle", "Suspensão Dianteira"]);
        }
        break;
      case "reset":
      default:
        this.targetCameraPos = new THREE.Vector3(3.8, 2.2, 4.2);
        this.targetControlsTarget = new THREE.Vector3(0, 0.6, 0);
        this.setTransparentBody(false); // Restaura a lataria opaca padrão
        if (this.onBreadcrumbChangeCallback) {
          this.onBreadcrumbChangeCallback(["Veículo", "Visão Geral"]);
        }
        break;
    }
  }

  public setCameraView(view: "dianteira" | "traseira" | "esquerda" | "direita" | "teto" | "reset") {
    switch (view) {
      case "dianteira":
        this.targetCameraPos = new THREE.Vector3(0, 1.4, 4.6);
        this.targetControlsTarget = new THREE.Vector3(0, 0.6, 0);
        break;
      case "traseira":
        this.targetCameraPos = new THREE.Vector3(0, 1.4, -4.6);
        this.targetControlsTarget = new THREE.Vector3(0, 0.6, 0);
        break;
      case "esquerda":
        this.targetCameraPos = new THREE.Vector3(-4.6, 1.2, 0);
        this.targetControlsTarget = new THREE.Vector3(0, 0.6, 0);
        break;
      case "direita":
        this.targetCameraPos = new THREE.Vector3(4.6, 1.2, 0);
        this.targetControlsTarget = new THREE.Vector3(0, 0.6, 0);
        break;
      case "teto":
        this.targetCameraPos = new THREE.Vector3(0.01, 5.2, 0.01);
        this.targetControlsTarget = new THREE.Vector3(0, 0.5, 0);
        break;
      case "reset":
      default:
        this.targetCameraPos = new THREE.Vector3(3.8, 2.2, 4.2);
        this.targetControlsTarget = new THREE.Vector3(0, 0.6, 0);
        break;
    }
  }

  // ==============================================================
  // 10-SECOND CINEMATIC EXPLORATION DEMO STORYBOARD
  // 0-2s:  Carro 3/4 -> Órbita suave -> Realce eixo dianteiro
  // 2-4s:  Destaque lado direito -> Afastamento axial da roda
  // 4-6s:  Freio visível -> Destaque pinça -> Separação pastilhas
  // 6-8s:  Pausa explodida -> Chamada ficha -> Retorno das peças
  // 8-10s: Roda recomposta -> Finalização órbita -> Ação "Inspecionar"
  // ==============================================================
  public startDemo10s(
    onPoseChange?: (poseIndex: number, label: string) => void,
    onComplete?: () => void
  ) {
    this.isDemoRunning = true;
    this.demoInitialTransparent = this.isTransparentBody;
    this.demoStartTime = performance.now();
    this.onDemoPoseChangeCallback = onPoseChange;
    this.onDemoCompleteCallback = onComplete;
  }

  public stopDemo10s() {
    this.isDemoRunning = false;
    this.targetExplosionFactor = 0;
    this.suspensionGroup.visible = false;
    this.drivetrainGroup.visible = false;
    this.setTransparentBody(this.demoInitialTransparent);
    this.zoomToSystem("reset");
  }

  private updateDemo10s(currentTime: number) {
    if (!this.isDemoRunning) return;

    const elapsedSec = (currentTime - this.demoStartTime) / 1000;
    const isArteon3Part = this.hasSubsystems && this.suspensionGroup.children.length > 0;
    const totalDuration = isArteon3Part ? 12.0 : 10.0;

    if (elapsedSec >= totalDuration) {
      this.isDemoRunning = false;
      this.targetExplosionFactor = 0;
      this.setTransparentBody(this.demoInitialTransparent);
      if (isArteon3Part) {
        this.suspensionGroup.visible = false;
        this.drivetrainGroup.visible = false;
      }
      this.zoomToSystem("reset");
      if (this.onDemoCompleteCallback) this.onDemoCompleteCallback();
      return;
    }

    // Storyboard de 12s para os 3 modelos combinados (Carroceria -> Suspensão -> Motor -> Conclusão)
    if (isArteon3Part) {
      const poseIndex = Math.floor(elapsedSec * 2) + 1;
      let poseLabel = "";

      // Órbita fluida da câmera em 360 graus
      const orbitAngle = (elapsedSec / totalDuration) * Math.PI * 2;
      const camDist = 4.6;
      const camHeight = 1.8 + Math.sin(orbitAngle * 2) * 0.25;
      this.camera.position.set(
        camDist * Math.cos(orbitAngle),
        camHeight,
        camDist * Math.sin(orbitAngle)
      );
      this.controls.target.set(0, 0.65, 0);

      if (elapsedSec < 3.0) {
        // 0-3s: Carroceria sólida girando 360°
        this.setTransparentBody(false);
        this.suspensionGroup.visible = false;
        this.drivetrainGroup.visible = false;
        poseLabel = "01-03s: Carroceria sólida • Giro 360° em volta do veículo";
      } else if (elapsedSec < 6.0) {
        // 3-6s: Carroceria fica transparente -> Suspensão (car_chassis.glb) aparece
        this.setTransparentBody(true);
        this.suspensionGroup.visible = true;
        this.drivetrainGroup.visible = false;
        poseLabel = "03-06s: Raio-X • Suspensão ativa & geometria de rodagem";
      } else if (elapsedSec < 9.0) {
        // 6-9s: Suspensão some enquanto motor/trem de força aparece (sem rodas duplicadas brigando)
        this.setTransparentBody(true);
        this.suspensionGroup.visible = false;
        this.drivetrainGroup.visible = true;
        poseLabel = "06-09s: Raio-X • Motor TSI, Câmbio DSG & Trem de Força 4Motion";
      } else {
        // 9-12s: Motor some e a carroceria volta ao acabamento original sólido
        this.suspensionGroup.visible = false;
        this.drivetrainGroup.visible = false;
        this.setTransparentBody(false);
        poseLabel = "09-12s: Recomposição Concluída • Veículo íntegro e verificado";
      }

      this.controls.update();

      if (this.onDemoPoseChangeCallback) {
        this.onDemoPoseChangeCallback(poseIndex, poseLabel);
      }
      return;
    }

    // Raio-X suave: torna lataria transparente dos 1.5s aos 8.0s para revelar mecânica interna
    if (elapsedSec >= 1.5 && elapsedSec < 8.0 && !this.isTransparentBody) {
      this.setTransparentBody(true);
    } else if ((elapsedSec < 1.5 || elapsedSec >= 8.0) && this.isTransparentBody !== this.demoInitialTransparent) {
      this.setTransparentBody(this.demoInitialTransparent);
    }

    // 20 Key Poses (0.5s each)
    const poseIndex = Math.floor(elapsedSec * 2) + 1;

    let poseLabel = "";

    if (elapsedSec < 2.0) {
      // 0–2s: Carro inteiro em 3/4, órbita suave, realce eixo dianteiro
      const t = elapsedSec / 2.0;
      this.camera.position.set(
        3.8 * Math.cos(t * 0.4) + 1.0 * Math.sin(t * 0.4),
        2.2,
        4.2 * Math.cos(t * 0.4)
      );
      this.controls.target.set(0, 0.6, 0);
      this.targetExplosionFactor = 0;
      poseLabel = "01-04: Carro inteiro 3/4 & Realce do eixo dianteiro";
    } else if (elapsedSec < 4.0) {
      // 2–4s: Foco lado direito, destaque da roda, início afastamento axial
      const t = (elapsedSec - 2.0) / 2.0;
      this.camera.position.set(2.8 - t * 0.4, 1.2 - t * 0.4, 2.8 - t * 0.8);
      this.controls.target.set(0.94, 0.38, 1.38);
      this.targetExplosionFactor = t * 0.8; // wheel detaches
      poseLabel = "05-08: Destaque lateral direito & Afastamento axial da roda";
    } else if (elapsedSec < 6.0) {
      // 4–6s: Conjunto de freio visível, pinça e separação das pastilhas
      const t = (elapsedSec - 4.0) / 2.0;
      this.camera.position.set(2.2, 0.6 + t * 0.1, 1.8);
      this.controls.target.set(0.94, 0.38, 1.38);
      this.targetExplosionFactor = 0.8 + t * 0.2; // full explosion
      poseLabel = "09-12: Freio visível, destaque da pinça & Separação das pastilhas";
    } else if (elapsedSec < 8.0) {
      // 6–8s: Pausa explodida, chamada da ficha, retorno das peças internas
      const t = (elapsedSec - 6.0) / 2.0;
      this.targetExplosionFactor = 1.0 - t * 0.7; // pieces start returning
      poseLabel = "13-16: Pausa na montagem explodida & Retorno guiado pelos eixos";
    } else {
      // 8–10s: Roda recomposta, finalização da órbita, pose inicial
      const t = (elapsedSec - 8.0) / 2.0;
      this.targetExplosionFactor = Math.max(0, 0.3 * (1.0 - t));
      this.camera.position.set(
        2.0 + t * 1.8,
        0.8 + t * 1.4,
        2.0 + t * 2.2
      );
      this.controls.target.set(0, 0.6, 0);
      poseLabel = "17-20: Roda alinhada, conjunto recomposto & Inspecionar Componente";
    }

    this.controls.update();

    if (this.onDemoPoseChangeCallback) {
      this.onDemoPoseChangeCallback(poseIndex, poseLabel);
    }
  }

  public onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // 1. Handle Smooth Camera & Controls Lerp
    if (this.targetCameraPos) {
      this.camera.position.lerp(this.targetCameraPos, 0.08);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.02) {
        this.camera.position.copy(this.targetCameraPos);
        this.targetCameraPos = null;
      }
    }
    if (this.targetControlsTarget) {
      this.controls.target.lerp(this.targetControlsTarget, 0.08);
      if (this.controls.target.distanceTo(this.targetControlsTarget) < 0.02) {
        this.controls.target.copy(this.targetControlsTarget);
        this.targetControlsTarget = null;
      }
    }

    // 2. Handle Holographic Laser Scanner Sweep
    if (this.isLaserScanning && this.laserMesh) {
      const elapsed = performance.now() - this.laserScanStartTime;
      const progress = Math.min(1.0, elapsed / this.laserScanDuration);
      // Move along Z from +2.8 to -2.8
      this.laserMesh.position.z = 2.8 - progress * 5.6;

      if (this.onLaserProgressCallback) {
        this.onLaserProgressCallback(Math.round(progress * 100));
      }

      if (progress >= 1.0) {
        this.isLaserScanning = false;
        this.laserMesh.visible = false;
        if (this.onLaserCompleteCallback) {
          this.onLaserCompleteCallback();
        }
      }
    }

    // 3. Handle 10s Demo playback
    if (this.isDemoRunning) {
      this.updateDemo10s(performance.now());
    }

    // 4. Smooth lerp for exploded view transition
    this.explosionFactor += (this.targetExplosionFactor - this.explosionFactor) * 0.1;
    this.explodedParts.forEach(ep => {
      ep.mesh.position.set(
        ep.origPos.x + ep.explodedOffset.x * this.explosionFactor,
        ep.origPos.y + ep.explodedOffset.y * this.explosionFactor,
        ep.origPos.z + ep.explodedOffset.z * this.explosionFactor
      );
    });

    this.controls.update();

    // 5. Pulse animation on hotspot rings
    const time = Date.now() * 0.003;
    this.hotspotGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) {
        const scale = 1.0 + Math.sin(time) * 0.15;
        child.scale.set(scale, scale, scale);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  public getTelemetry() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const azimuthRad = Math.atan2(dir.x, dir.z);
    const azimuthDeg = Math.round(((azimuthRad * 180) / Math.PI + 360) % 360);
    const elevationDeg = Math.round((Math.asin(-dir.y) * 180) / Math.PI);
    const distance = Number(this.camera.position.distanceTo(this.controls.target).toFixed(2));
    return {
      azimuthDeg,
      elevationDeg,
      distance,
      bodyType: this.currentBodyType,
      isExploded: this.isExploded,
      isTransparent: this.isTransparentBody,
      componentsCount: this.componentMeshes.length
    };
  }

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener("resize", this.onWindowResize.bind(this));
    this.renderer.dispose();
  }
}
