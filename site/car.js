// The car: loads the glTF, puts it on the floor at its real size and in one orientation (nose to +X), finds the body
// paint and gives it a black metallic with a clear coat, and prepares the x-ray look the scroll fades into.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

// BMW M4 Competition Coupe (G82): the numbers the model is scaled to and the panels read.
export const SPEC = {length: 4.794, width: 1.887, height: 1.393, wheelbase: 2.857};

// The author's body paint: black, clear-coated, near mirror. Kept and deepened rather than replaced.
const PAINT = /^Material_692$/;

// X-ray: a fresnel rim, bright where the surface turns away from the eye, nearly clear where it faces it.
const xrayMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {uColor: {value: new THREE.Color('#7fd4ff')}, uK: {value: 0}},
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uK;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        f = pow(clamp(f, 0.0, 1.0), 2.6);
        gl_FragColor = vec4(uColor * (0.08 + 0.9 * f), (0.04 + 0.7 * f) * uK);
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

  const root = new THREE.Group();
  root.add(model);
  scene.add(root);

  let paint = null;
  const xray = xrayMaterial();
  const meshes = [];
  const names = new Set();
  const parts = [];
  model.traverse((o) => o.isMesh && parts.push(o));
  parts.forEach((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      names.add(m.name);
      if (PAINT.test(m.name || '') && !paint) {
        paint = m;
        // metallic black: a little colour in the base so the flake reads, a hard clear coat on top
        m.color.set('#0a0b0d');
        m.metalness = 0.6;
        m.roughness = 0.3;
        m.clearcoat = 1;
        m.clearcoatRoughness = 0.02;
      }
    });
    // the x-ray twin draws the same geometry, rim only
    const ghost = new THREE.Mesh(o.geometry, xray);
    ghost.visible = false;
    ghost.renderOrder = 10;
    o.add(ghost);
    meshes.push({mesh: o, ghost});
  });

  // Fading the solid car: a material goes transparent only while it fades, so the solid car keeps sorting right.
  const solids = new Set();
  meshes.forEach(({mesh}) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => solids.add(m)));
  const base = new Map([...solids].map((m) => [m, {opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite}]));

  let last = -1;
  /** x 0..1: 0 the painted car, 1 the x-ray. */
  const setXray = (x) => {
    if (x === last) return;
    const flip = (x > 0.001) !== (last > 0.001);
    last = x;
    xray.uniforms.uK.value = x;
    const fading = x > 0.001;
    for (const [m, b] of base) {
      m.transparent = fading || b.transparent;
      m.opacity = b.opacity * (1 - x);
      m.depthWrite = fading ? x < 0.5 : b.depthWrite;
      if (flip) m.needsUpdate = true;
    }
    for (const it of meshes) it.ghost.visible = fading;
  };

  console.log('[car] materials:', [...names].join(', '));
  const finalSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  return {root, model, paint, xray, meshes, setXray, size: finalSize};
}
