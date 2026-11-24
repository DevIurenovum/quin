import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Stage } from '../three/stage';
import { applyRobotPose, robotPoseUniforms as pose } from './robot-shader';

type Action = 'idle' | 'wave' | 'jump';

const MODEL_URL = 'models/robot.glb';
const WAVE_SECONDS = 1.8;
const JUMP_SECONDS = 1.1;

@Component({
  selector: 'app-robot-viewer',
  templateUrl: './robot-viewer.html',
  styleUrl: '../three/viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RobotViewer {
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly progress = signal(0);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);

  private stage?: Stage;
  private action: Action = 'idle';
  private actionStart = 0;
  // Root moves the whole robot; its origin sits between the feet so squash/stretch stays grounded.
  private readonly root = new THREE.Group();
  private readonly look = new THREE.Vector2();

  constructor() {
    afterNextRender(() => {
      const stage = new Stage(
        this.host().nativeElement,
        { cameraPosition: [0.4, 0.6, 2.6], target: [0, 0.4, 0], shadowSize: 0.75 },
        (t, dt) => this.animate(t, dt),
      );
      this.stage = stage;
      stage.scene.add(this.root);
      stage.onClick(() => this.jump());
      this.destroyRef.onDestroy(() => stage.dispose());

      new GLTFLoader().load(
        MODEL_URL,
        (gltf) => {
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              applyRobotPose(o.material);
              o.frustumCulled = false;
            }
          });
          this.root.add(gltf.scene);
          this.loaded.set(true);
        },
        (e) => e.total && this.progress.set(Math.round((e.loaded / e.total) * 100)),
        () => this.error.set('No se pudo cargar el modelo 3D.'),
      );
    });
  }

  wave(): void {
    this.play('wave');
  }

  jump(): void {
    this.play('jump');
  }

  private play(action: Action): void {
    if (this.action !== 'idle' || !this.stage) return;
    this.action = action;
    this.actionStart = this.stage.elapsed;
  }

  /** Procedural animation: idle loop + cursor follow + one-shot actions. */
  private animate(t: number, dt: number): void {
    const look = this.look.lerp(this.stage!.pointer, 1 - Math.exp(-dt * 6));

    // --- idle: breathing, gentle sway, head bobbing, little "idea!" finger wag
    const breath = Math.sin(t * 2.2);
    let squash = breath * 0.008;
    let height = 0;
    let spin = 0;
    let headNod = look.y * 0.28 + Math.sin(t * 1.7) * 0.04;
    const headYaw = look.x * 0.45;
    let headTilt = Math.sin(t * 1.3) * 0.09 - look.x * 0.06;
    let arm = Math.sin(t * 3.2) * 0.1 + Math.max(0, Math.sin(t * 0.9)) * 0.08;
    const bodyYaw = look.x * 0.3 + Math.sin(t * 0.5) * 0.08;

    const u = t - this.actionStart;
    if (this.action === 'wave') {
      const k = u / WAVE_SECONDS;
      const env = Math.sin(Math.PI * Math.min(k, 1));
      arm += env * (0.15 + Math.sin(u * 15) * 0.38);
      headTilt += env * 0.18;
      if (k >= 1) this.action = 'idle';
    } else if (this.action === 'jump') {
      const k = u / JUMP_SECONDS;
      if (k < 0.18) {
        squash = -easeOut(k / 0.18) * 0.12; // crouch
        headNod += easeOut(k / 0.18) * 0.15;
      } else if (k < 0.82) {
        const a = (k - 0.18) / 0.64;
        height = Math.sin(Math.PI * a) * 0.28;
        squash = Math.sin(Math.PI * a) * 0.06 - 0.12 * (1 - Math.min(a * 4, 1)); // stretch in the air
        spin = easeInOut(a) * Math.PI * 2;
        arm += Math.sin(Math.PI * a) * 0.35;
        headNod -= Math.sin(Math.PI * a) * 0.2;
      } else {
        const a = (k - 0.82) / 0.18;
        squash = -Math.sin(Math.PI * Math.min(a, 1)) * 0.07; // landing
      }
      if (k >= 1) this.action = 'idle';
    }

    const root = this.root;
    root.position.y = height;
    root.rotation.y = bodyYaw + spin;
    root.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);

    pose.uHeadNod.value = headNod;
    pose.uHeadYaw.value = headYaw;
    pose.uHeadTilt.value = headTilt;
    pose.uArm.value = arm;

    this.stage!.setShadowHeight(height);
  }
}

function easeOut(x: number): number {
  return 1 - (1 - x) * (1 - x);
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
