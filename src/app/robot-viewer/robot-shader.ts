import { Material, Vector3 } from 'three';

/**
 * The GLB has no skeleton, so the head and the pointing arm are bent in the
 * vertex shader. Masks pick the vertices of each part by their rest position
 * (model space, metres) and blend smoothly so the joints don't tear.
 *
 * Measured from the mesh:
 *   head  – ellipsoid around (-0.075, 0.785, -0.013), pivots at the neck
 *   arm   – raised forearm + hand (x > 0.15, y > 0.5), pivots at the elbow
 */
export const robotPoseUniforms = {
  uHeadNod: { value: 0 },
  uHeadYaw: { value: 0 },
  uHeadTilt: { value: 0 },
  uArm: { value: 0 },
  uHeadCenter: { value: new Vector3(-0.075, 0.785, -0.013) },
  uHeadRadius: { value: new Vector3(0.25, 0.215, 0.245) },
  uNeck: { value: new Vector3(-0.05, 0.585, 0.0) },
  uElbow: { value: new Vector3(0.2, 0.53, 0.0) },
};

const shaderHeader = /* glsl */ `
uniform float uHeadNod;
uniform float uHeadYaw;
uniform float uHeadTilt;
uniform float uArm;
uniform vec3 uHeadCenter;
uniform vec3 uHeadRadius;
uniform vec3 uNeck;
uniform vec3 uElbow;

mat3 rotX(float a) { float s = sin(a), c = cos(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float s = sin(a), c = cos(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float s = sin(a), c = cos(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

float headMask(vec3 p) {
  float d = length((p - uHeadCenter) / uHeadRadius);
  return smoothstep(1.08, 0.92, d) * smoothstep(0.55, 0.6, p.y);
}
float armMask(vec3 p) {
  return smoothstep(0.15, 0.2, p.x) * smoothstep(0.5, 0.56, p.y) * (1.0 - headMask(p));
}
mat3 armRot(vec3 p) { return rotZ(uArm * armMask(p)); }
mat3 headRot(vec3 p) {
  float m = headMask(p);
  return rotY(uHeadYaw * m) * rotX(uHeadNod * m) * rotZ(uHeadTilt * m);
}
`;

/** Patches a glTF PBR material so it deforms with `robotPoseUniforms`. */
export function applyRobotPose(material: Material): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, robotPoseUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${shaderHeader}`)
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal = headRot(position) * armRot(position) * normal;
#ifdef USE_TANGENT
  vec3 objectTangent = headRot(position) * armRot(position) * tangent.xyz;
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = uElbow + armRot(position) * (position - uElbow);
transformed = uNeck + headRot(position) * (transformed - uNeck);`,
      );
  };
  material.customProgramCacheKey = () => 'robot-pose';
  material.needsUpdate = true;
}
