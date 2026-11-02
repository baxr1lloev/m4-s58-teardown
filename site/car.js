// The car: loads the glTF, puts it on the floor at its real size and in one orientation (nose to +X), deepens the
// author's black paint, and dissolves into x-ray: a front that sweeps from the tail to the nose eats the solid car,
// a cyan edge glows where it passes, and the fresnel outline of every part stays behind it.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

// BMW M4 Competition Coupe (G82): the numbers the model is scaled to and the panels read.
export const SPEC = {length: 4.794, width: 1.887, height: 1.393, wheelbase: 2.857};

// The author's body paint: black, clear-coated, near mirror. Kept and deepened rather than replaced.
const PAINT = /^Material_692$/;
const XRAY = '#7fd4ff';

// Shared by the solid car and its x-ray twin: the dissolve field at a world point, and the front's position.
const FIELD = /* glsl */ `
  uniform float uDis;
  varying vec3 vDisW;
  float disHash(vec3 p) { return fract(sin(dot(floor(p * 36.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float disField() { return vDisW.x + vDisW.y * 0.3 + (disHash(vDisW) - 0.5) * 0.16; }
`;
const WORLD = /* glsl */ `vDisW = (modelMatrix * vec4(transformed, 1.0)).xyz;`;
const dis = {uDis: {value: -10}, uDisEdge: {value: new THREE.Color(XRAY)}};

/** Make a mesh material dissolve behind the front: discard behind it, glow just ahead of it. */
const dissolving = (m) => {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDis = dis.uDis;
    sh.uniforms.uDisEdge = dis.uDisEdge;
    sh.vertexShader = 'varying vec3 vDisW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${WORLD}`);
    sh.fragmentShader = `uniform vec3 uDisEdge;\n${FIELD}\n` + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float disF = disField();
        if (disF < uDis) discard;
        float disEdgeK = 1.0 - smoothstep(0.0, 0.06, disF - uDis);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uDisEdge * disEdgeK * 3.0;`);
  };
  m.customProgramCacheKey = () => 'dissolve';
};

// X-ray: a fresnel rim, bright where the surface turns away from the eye, only where the front has passed.
const xrayMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {uColor: {value: new THREE.Color(XRAY)}, uDis: dis.uDis},
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vDisW;
      void main() {
        vec3 transformed = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        ${WORLD}
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV;
      ${FIELD}
      void main() {
        float behind = 1.0 - smoothstep(-0.03, 0.0, disField() - uDis);
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        f = pow(clamp(f, 0.0, 1.0), 2.6);
        gl_FragColor = vec4(uColor * (0.08 + 0.9 * f), (0.04 + 0.7 * f) * behind);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

export async function loadCar(url, scene) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  // Orientation: the longest horizontal extent is the car's length; turn it onto X.
  let box = new THREE.Box3().setFromObject(model);
  let size = box.getSize(new THREE.Vector3());
  if (size.z > size.x) model.rotation.y = Math.PI / 2;
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(SPEC.length / size.x);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.x -= c.x;
  model.position.z -= c.z;
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);

  const root = new THREE.Group();
  root.add(model);
  scene.add(root);

  let paint = null;
  const xray = xrayMaterial();
  const ghosts = [];
  const solids = new Set();
  const parts = [];
  model.traverse((o) => o.isMesh && parts.push(o));
  parts.forEach((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      solids.add(m);
      if (PAINT.test(m.name || '') && !paint) {
        paint = m;
        // metallic black: a little colour in the base so the flake reads, a hard clear coat on top
        m.color.set('#0a0b0d');
        m.metalness = 0.6;
        m.roughness = 0.3;
        m.clearcoat = 1;
        m.clearcoatRoughness = 0.02;
      }
    }
    // the x-ray twin draws the same geometry, rim only
    const ghost = new THREE.Mesh(o.geometry, xray);
    ghost.visible = false;
    ghost.renderOrder = 10;
    o.add(ghost);
    ghosts.push(ghost);
  });
  solids.forEach(dissolving);

  // The car spans about x -2.4..2.4 plus the field's tilt and noise; the front runs a little past both ends.
  let last = -1;
  /** x 0..1: 0 the painted car, 1 all x-ray. */
  const setXray = (x) => {
    if (x === last) return;
    last = x;
    dis.uDis.value = x > 0 ? -3 + 6.6 * x : -10;
    for (const g of ghosts) g.visible = x > 0;
    // a dissolved body would still drop its shadow on the engine
    for (const o of parts) o.castShadow = x < 0.4;
  };

  // Axles from the wheels: a part belongs to a wheel when one of its ancestors is named tire*/Rim*.
  const owner = (o) => {
    for (let p = o; p; p = p.parent) if (/^(tire|rim)/i.test(p.name || '')) return p.name;
    return null;
  };
  const front = [];
  const rear = [];
  const b = new THREE.Box3();
  for (const o of parts) {
    if (!owner(o)) continue;
    b.setFromObject(o);
    const cc = b.getCenter(new THREE.Vector3());
    (cc.x > 0 ? front : rear).push({x: cc.x, r: (b.max.y - b.min.y) / 2});
  }
  const axle = (ws) => (ws.length ? {x: ws.reduce((s, w) => s + w.x, 0) / ws.length, r: Math.max(...ws.map((w) => w.r))} : null);
  const axles = {front: axle(front), rear: axle(rear)};

  const finalSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  return {root, model, paint, xray, parts, axles, setXray, size: finalSize};
}
