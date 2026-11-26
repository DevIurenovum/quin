import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Stage } from '../three/stage';
import { BirdPose, BirdRig } from './bird-rig';

const MODEL_URL = 'models/hummingbird.glb';
/** Wing beats per second while hovering (real hummingbirds: ~50; this reads as a buzz at 60 fps). */
const WINGBEAT_HZ = 13;
const HOVER_HEIGHT = 0.25;
/** Body leans back while hovering; the head compensates so the beak stays level. */
const HOVER_PITCH = 0.14;
const MAX_HEAD_YAW = 0.75;
/** Head position in model space, used to aim the head at the cursor. */
const HEAD = new THREE.Vector3(-0.05, 0.64, 0);

@Component({
  selector: 'app-bird-viewer',
  templateUrl: './bird-viewer.html',
  styleUrl: '../three/viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.embedded]': 'embedded()' },
})
export class BirdViewer {
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly destroyRef = inject(DestroyRef);
  /** Page mode: transparent, no orbit controls or hints, rim-lit for a dark background, hovering. */
  readonly embedded = input(false);
  /** Embedded only: stay perched (peeking over an edge) instead of hovering. */
  readonly perch = input(false);
  readonly cameraPosition = input<THREE.Vector3Tuple>([-1.5, 0.75, 1.8]);
  readonly target = input<THREE.Vector3Tuple>([0, 0.5, 0]);

  protected readonly progress = signal(0);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly flying = signal(false);

  private stage?: Stage;
  private rig?: BirdRig;
  private readonly root = new THREE.Group();

  // Animation state
  private flight = 0; // 0 perched .. 1 hovering
  private readonly head = { yaw: 0, pitch: 0, roll: 0 };
  private readonly headTarget = { yaw: 0, pitch: 0, roll: 0 };
  private nextGlance = 0;
  private nextRuffle = 3;
  private ruffleStart = -10;
  private lastPointer = new THREE.Vector2(9, 9);
  private lastPointerMove = -10;
  private readonly raycaster = new THREE.Raycaster();

  constructor() {
    afterNextRender(() => {
      const stage = new Stage(
        this.host().nativeElement,
        {
          cameraPosition: this.cameraPosition(),
          target: this.target(),
          shadowSize: 0.9,
          interactive: !this.embedded(),
        },
        (t, dt) => this.animate(t, dt),
      );
      this.stage = stage;
      stage.scene.add(this.root);
      if (this.embedded()) {
        // White rim from behind so the black feathers separate from the dark page.
        const rim = new THREE.DirectionalLight(0xffffff, 3);
        rim.position.set(2, 1.5, -2.5);
        stage.scene.add(rim);
        stage.shadow.visible = false;
      }
      stage.onClick(() => !this.perch() && this.toggleFlight());
      this.destroyRef.onDestroy(() => stage.dispose());

      new GLTFLoader().load(
        MODEL_URL,
        (gltf) => {
          try {
            this.rig = new BirdRig(gltf.scene);
          } catch (e) {
            this.error.set((e as Error).message);
            return;
          }
          this.root.add(gltf.scene);
          this.loaded.set(true);
          if (this.embedded() && !this.perch()) this.flying.set(true);
        },
        (e) => e.total && this.progress.set(Math.round((e.loaded / e.total) * 100)),
        () => this.error.set('No se pudo cargar el modelo 3D.'),
      );
    });
  }

  toggleFlight(): void {
    this.flying.update((f) => !f);
  }

  private animate(t: number, dt: number): void {
    const stage = this.stage!;
    this.flight += ((this.flying() ? 1 : 0) - this.flight) * (1 - Math.exp(-dt * 2.2));
    const flight = this.flight;
    const open = smoothstep(0, 0.35, flight); // wings open early on take-off, fold late on landing

    // --- body: hover with a lazy figure-eight, pitched up like a real hummingbird
    const root = this.root;
    root.position.set(
      Math.sin(t * 0.9) * 0.07 * flight,
      easeInOut(flight) * HOVER_HEIGHT + Math.sin(t * 4) * 0.02 * flight,
      Math.sin(t * 1.8) * 0.05 * flight,
    );
    root.rotation.set(Math.sin(t * 0.9) * 0.08 * flight, Math.sin(t * 0.6) * 0.15 * flight, -HOVER_PITCH * flight);
    stage.controls.target.y = this.target()[1] + 0.18 * flight; // keep the bird framed while it hovers
    const breath = Math.sin(t * 3) * 0.012 * (1 - flight);
    root.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
    root.updateMatrixWorld();

    // --- head: birds move their head in quick snaps, not smoothly
    this.updateHeadTarget(t);
    const k = 1 - Math.exp(-dt * 22);
    this.head.yaw += (this.headTarget.yaw - this.head.yaw) * k;
    this.head.pitch += (this.headTarget.pitch - this.head.pitch) * k;
    this.head.roll += (this.headTarget.roll - this.head.roll) * k;

    // --- wings: folded with an occasional ruffle while perched; spread and buzzing in flight
    if (t > this.nextRuffle && flight < 0.05) {
      this.ruffleStart = t;
      this.nextRuffle = t + 4 + Math.random() * 4;
    }
    const ruffle = Math.sin(Math.PI * Math.min(Math.max((t - this.ruffleStart) / 0.5, 0), 1));
    const beat = Math.sin(t * Math.PI * 2 * WINGBEAT_HZ);

    const pose: BirdPose = {
      headYaw: this.head.yaw,
      headPitch: this.head.pitch + HOVER_PITCH * flight,
      headRoll: this.head.roll,
      wingLift: 0.7 * open + 0.15 * ruffle,
      wingSpread: 1.2 * open + 0.1 * ruffle,
      wingFlap: open * (0.15 + 0.6 * beat) + ruffle * 0.12 * Math.sin(t * 40),
      tail: Math.sin(t * 2) * 0.04 * (1 - flight) + (-0.12 + Math.sin(t * 7) * 0.06) * flight,
    };
    this.rig?.apply(pose);
    stage.setShadowHeight(root.position.y);
  }

  /** Every so often, snap the head toward the cursor, or glance around if the cursor is idle. */
  private updateHeadTarget(t: number): void {
    const stage = this.stage!;
    if (!stage.pointer.equals(this.lastPointer)) {
      this.lastPointer.copy(stage.pointer);
      this.lastPointerMove = t;
    }
    if (t < this.nextGlance) return;
    const followMouse = t - this.lastPointerMove < 2;
    this.nextGlance = t + (followMouse ? 0.2 + Math.random() * 0.3 : 0.5 + Math.random() * 1.4);

    const target = this.headTarget;
    if (followMouse) {
      // Point on the ray under the cursor, at the bird's distance, in the bird's own space.
      const headWorld = this.root.localToWorld(HEAD.clone());
      this.raycaster.setFromCamera(new THREE.Vector2(stage.pointer.x, -stage.pointer.y), stage.camera);
      const p = this.raycaster.ray.at(stage.camera.position.distanceTo(headWorld), new THREE.Vector3());
      const d = this.root.worldToLocal(p).sub(HEAD);
      // The beak points to -X: yaw turns it toward +Z, negative pitch raises it.
      target.yaw = clamp(Math.atan2(d.z, -d.x), -MAX_HEAD_YAW, MAX_HEAD_YAW);
      target.pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.5, 0.4);
      target.roll = clamp(target.roll + (Math.random() - 0.5) * 0.1, -0.2, 0.2);
    } else {
      target.yaw = (Math.random() - 0.5) * 2 * MAX_HEAD_YAW * 0.8;
      target.pitch = (Math.random() - 0.6) * 0.5;
      target.roll = Math.random() < 0.35 ? (Math.random() - 0.5) * 0.7 : 0; // curious head tilt
    }
  }
}

function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
