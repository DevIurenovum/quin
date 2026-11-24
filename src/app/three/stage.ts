import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface StageOptions {
  cameraPosition: THREE.Vector3Tuple;
  target: THREE.Vector3Tuple;
  shadowSize: number;
}

/**
 * Renderer + lights + orbit camera + blob shadow mounted in `el`.
 * `onFrame(t, dt)` runs every frame; `dispose()` tears everything down.
 */
export class Stage {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  readonly controls: OrbitControls;
  readonly shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Pointer over the page in [-1, 1], +y down. */
  readonly pointer = new THREE.Vector2();

  private readonly timer = new THREE.Timer();
  private readonly observer: ResizeObserver;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly onPointerMove = (e: PointerEvent) => {
    const r = this.el.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };

  constructor(
    private readonly el: HTMLElement,
    opts: StageOptions,
    onFrame: (t: number, dt: number) => void,
  ) {
    const { renderer, scene, camera } = this;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 2.5, 2);
    scene.add(key, new THREE.HemisphereLight(0xdfe8ff, 0x3a3040, 0.6));

    camera.position.set(...opts.cameraPosition);
    this.controls = new OrbitControls(camera, renderer.domElement);
    this.controls.target.set(...opts.target);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 4;
    this.controls.maxPolarAngle = Math.PI * 0.55;

    // Soft blob shadow: cheaper than shadow-mapping and reads well for a single character.
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.shadowSize, opts.shadowSize),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.001;
    scene.add(this.shadow);

    window.addEventListener('pointermove', this.onPointerMove);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(el);
    this.resize();

    renderer.setAnimationLoop((now) => {
      this.timer.update(now);
      onFrame(this.timer.getElapsed(), Math.min(this.timer.getDelta(), 0.05));
      this.controls.update();
      renderer.render(scene, camera);
    });
  }

  get elapsed(): number {
    return this.timer.getElapsed();
  }

  /** Calls `fn` on a click on the canvas that wasn't an orbit drag. */
  onClick(fn: () => void): void {
    let x = 0;
    let y = 0;
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => ([x, y] = [e.clientX, e.clientY]));
    canvas.addEventListener('pointerup', (e) => Math.hypot(e.clientX - x, e.clientY - y) < 5 && fn());
  }

  /** Shrinks and fades the blob shadow as the character rises. */
  setShadowHeight(height: number): void {
    const s = Math.max(0.3, 1 - height * 1.6);
    this.shadow.scale.setScalar(s);
    this.shadow.material.opacity = 0.35 + s * 0.4;
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    window.removeEventListener('pointermove', this.onPointerMove);
    this.controls.dispose();
    this.timer.dispose();
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v instanceof THREE.Texture && v.dispose());
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.el;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
