import * as THREE from 'three';

/**
 * Rig for public/models/hummingbird.glb (Tripo, exported in 12 parts, no skeleton).
 *
 * Wings, tail, beak and eyes are separate meshes, so they get rigid pivots.
 * The head is fused to the body (tripo_part_0), so it is bent in the vertex
 * shader with a mask; beak and eyes ride a pivot with the same rotation.
 * Coordinates are model space (metres): beak points to -X, feet at y = 0.
 */
const PARTS = {
  body: 'tripo_part_0',
  head: ['tripo_part_7', 'tripo_part_8', 'tripo_part_9'], // beak, eyes
  wingLeft: ['tripo_part_2', 'tripo_part_3'], // +Z side: upper wing, lower feathers
  wingRight: ['tripo_part_1', 'tripo_part_5'], // -Z side
  tail: ['tripo_part_6', 'tripo_part_11'],
};

const NECK = new THREE.Vector3(0.03, 0.5, 0);
const SHOULDER = new THREE.Vector3(0, 0.46, 0.12);
const TAIL_BASE = new THREE.Vector3(0.2, 0.17, 0);

export interface BirdPose {
  /** Turns the beak left/right (around Y). */
  headYaw: number;
  /** Beak up/down (around Z, - = up). */
  headPitch: number;
  /** Sideways head tilt (around X, the beak axis). */
  headRoll: number;
  /** Raises the folded wing to horizontal (radians, around Z). */
  wingLift: number;
  /** Swings the wing out from the body (radians). */
  wingSpread: number;
  /** Up/down stroke of the spread wing (radians, + = up). */
  wingFlap: number;
  tail: number;
}

const headUniforms = {
  uHeadRoll: { value: 0 },
  uHeadYaw: { value: 0 },
  uHeadPitch: { value: 0 },
  uNeck: { value: NECK.clone() },
};

const bodyShaderHeader = /* glsl */ `
uniform float uHeadRoll;
uniform float uHeadYaw;
uniform float uHeadPitch;
uniform vec3 uNeck;

mat3 rotX(float a) { float s = sin(a), c = cos(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float s = sin(a), c = cos(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float s = sin(a), c = cos(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

// Head ellipsoid + the beak core that lives inside the body mesh, cut below the neck.
float headMask(vec3 p) {
  // Wide falloffs spread the twist over the neck instead of creasing the throat.
  float head = smoothstep(1.2, 0.85, length((p - vec3(-0.03, 0.64, 0.0)) / vec3(0.16, 0.15, 0.135)));
  float beak = smoothstep(-0.1, -0.16, p.x) * smoothstep(0.56, 0.6, p.y);
  return max(head, beak) * smoothstep(0.46, 0.56, p.y);
}
// Same order as the head pivot's 'YXZ' Euler: Ry * Rx * Rz.
mat3 headRot(vec3 p) {
  float m = headMask(p);
  return rotY(uHeadYaw * m) * rotX(uHeadRoll * m) * rotZ(uHeadPitch * m);
}
`;

function bendHead(material: THREE.Material): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, headUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${bodyShaderHeader}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = headRot(position) * normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed = uNeck + headRot(position) * (position - uNeck);');
  };
  material.customProgramCacheKey = () => 'bird-head';
  material.needsUpdate = true;
}

export class BirdRig {
  private readonly headPivot = new THREE.Group();
  private readonly wingLeft = new THREE.Group();
  private readonly wingRight = new THREE.Group();
  private readonly tailPivot = new THREE.Group();

  constructor(model: THREE.Object3D) {
    model.updateMatrixWorld(true);
    const find = (name: string) => {
      const o = model.getObjectByName(name);
      if (!o) throw new Error(`hummingbird.glb: missing part ${name}`);
      return o;
    };
    const pivot = (group: THREE.Group, at: THREE.Vector3, names: string[], order: THREE.EulerOrder) => {
      group.position.copy(at);
      group.rotation.order = order;
      model.add(group);
      group.updateMatrixWorld(true);
      names.forEach((n) => group.attach(find(n)));
    };

    pivot(this.headPivot, NECK, PARTS.head, 'YXZ');
    pivot(this.wingLeft, SHOULDER, PARTS.wingLeft, 'XYZ');
    pivot(this.wingRight, SHOULDER.clone().setZ(-SHOULDER.z), PARTS.wingRight, 'XYZ');
    pivot(this.tailPivot, TAIL_BASE, PARTS.tail, 'XYZ');

    const body = find(PARTS.body) as THREE.Mesh;
    bendHead(body.material as THREE.Material);
    model.traverse((o) => (o.frustumCulled = false));
  }

  apply(p: BirdPose): void {
    headUniforms.uHeadYaw.value = p.headYaw;
    headUniforms.uHeadRoll.value = p.headRoll;
    headUniforms.uHeadPitch.value = p.headPitch;
    this.headPivot.rotation.set(p.headRoll, p.headYaw, p.headPitch);

    // Mirror the rotations for each side so both wings open outward and stroke together.
    this.wingLeft.rotation.set(-p.wingFlap, -p.wingSpread, p.wingLift);
    this.wingRight.rotation.set(p.wingFlap, p.wingSpread, p.wingLift);
    this.tailPivot.rotation.z = p.tail;
  }
}
