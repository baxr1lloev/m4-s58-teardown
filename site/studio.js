// The studio: dark graphite room, long strip softboxes for the reflections a black car is read by, a floor that
// catches a soft pool of light and the car's contact shadow. Nothing here moves; the camera does.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

export const BG = '#0b0c0e';

// Environment for reflections only: a black box with emissive strips, prefiltered once. A black car shows its shape
// through the lines these strips draw along the body, so they sit long and thin, above and to the sides.
function stripEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#050506');
  const strip = (w, h, pos, rot, k) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({color: new THREE.Color(k, k, k), side: THREE.DoubleSide}),
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
  };
  // overhead: three long strips along the car
  strip(14, 0.9, [0, 6, -1.6], [Math.PI / 2, 0, 0], 6);
  strip(14, 0.9, [0, 6, 0], [Math.PI / 2, 0, 0], 8);
  strip(14, 0.9, [0, 6, 1.6], [Math.PI / 2, 0, 0], 6);
  // sides: tall strips that draw the shoulder line and the door
  strip(10, 1.4, [0, 2.2, 7], [0, 0, 0], 3.5);
  strip(10, 1.4, [0, 2.2, -7], [0, 0, 0], 2.2);
  // front and rear: a softbox each, for the grille and the tail
  strip(4, 2.5, [8, 2.5, 0], [0, Math.PI / 2, 0], 2.5);
  strip(4, 2.5, [-8, 2.5, 0], [0, Math.PI / 2, 0], 1.6);
  // faint floor bounce so the sills are not pitch black
  strip(16, 16, [0, -0.5, 0], [Math.PI / 2, 0, 0], 0.08);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

// Floor: a radial pool of light that falls off into the room colour, so there is no visible edge.
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grad.addColorStop(0, '#2a2c31');
  grad.addColorStop(0.45, '#17181b');
  grad.addColorStop(1, BG);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Contact shadow: a blurred dark rounded rectangle the size of the car's footprint.
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.filter = 'blur(18px)';
  g.fillStyle = 'rgba(0,0,0,0.85)';
  g.beginPath();
  g.roundRect(60, 60, 392, 136, 60);
  g.fill();
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.beginPath();
  g.roundRect(84, 84, 344, 88, 30);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStudio(canvas, {pr} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 14, 30);
  scene.environment = stripEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({map: floorTexture()}));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({map: shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  scene.add(shadow);

  // A key light from above for the soft shadow the car drops on its own wheels and sills.
  const key = new THREE.DirectionalLight('#ffffff', 1.2);
  key.position.set(2, 8, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4});
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(new THREE.HemisphereLight('#c8d2e0', '#0b0c0e', 0.35));

  const target = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.35, 0.4, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    const ratio = pr ?? Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  /** Size the contact shadow to the car's footprint (x length, z width). */
  const fitShadow = (length, width) => shadow.scale.set(length * 1.18, width * 1.5, 1);

  return {THREE, renderer, scene, camera, composer, bloom, key, resize, fitShadow, render: () => composer.render()};
}
