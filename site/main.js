// BMW M4 (G82) scroll teardown. The scroll position is the time t of one film: render(t) poses the camera, the
// captions and the x-ray from t alone, so the page, a captured video and the README gif are the same frames.
// window.SIM is the teardown kit's capture contract (sims/capture.mjs steps SIM.render(t)).
import * as THREE from 'three';
import {clamp01, prog, lerp} from 'teardown-kit/util.js';
import {createStudio} from './studio.js';
import {loadCar, SPEC} from './car.js';
import carUrl from './m4.glb';

const DURATION = 12;
const capture = !!window.__CAPTURE || new URLSearchParams(location.search).has('capture');

// Camera path: position, target and field of view at each key time; eased between keys.
const SHOTS = [
  {t: 0, pos: [5.4, 1.05, 4.4], at: [0.35, 0.62, 0], fov: 30},
  {t: 3.5, pos: [4.6, 0.95, 5.6], at: [0.1, 0.62, 0], fov: 30},
  {t: 6.5, pos: [0, 0.85, 9.2], at: [0, 0.62, 0], fov: 28},
  {t: 9.5, pos: [-4.2, 2.4, 5.6], at: [0, 0.55, 0], fov: 30},
  {t: 12, pos: [3.4, 2.9, 3.4], at: [1.15, 0.55, 0], fov: 32},
];

// Captions: each holds from `in` to `out`, fading 0.6 s at both ends.
const CAPTIONS = [
  {in: -1, out: 3.2, cls: 'hero', html: `<div class="kicker">G82 · Coupé · 2021</div><h1>BMW M4 Competition</h1><div class="specs">3.0 L twin-turbo inline-six · 510 PS · 650 Nm</div>`},
  {in: 3.6, out: 7.4, cls: 'side', html: `<div class="kicker">Proportions</div><div class="dims"><span><b>${Math.round(SPEC.length * 1000)}</b> mm long</span><span><b>${Math.round(SPEC.wheelbase * 1000)}</b> mm wheelbase</span><span><b>${Math.round(SPEC.height * 1000)}</b> mm tall</span></div>`},
  {in: 8.2, out: 99, cls: 'side', html: `<div class="kicker">Under the skin</div><h2>S58</h2><div class="specs">2993 cc · bore 84 × stroke 90 mm · firing order 1‑5‑3‑6‑2‑4</div>`},
];

const app = document.getElementById('app');
document.documentElement.classList.toggle('capture', capture);
const canvas = document.createElement('canvas');
canvas.id = 'gl';
app.appendChild(canvas);
const overlay = document.createElement('div');
overlay.className = 'overlay';
app.appendChild(overlay);
const caps = CAPTIONS.map((c) => {
  const el = document.createElement('div');
  el.className = `cap ${c.cls}`;
  el.innerHTML = c.html;
  overlay.appendChild(el);
  return {...c, el};
});
const hint = document.createElement('div');
hint.className = 'hint';
hint.textContent = 'Scroll';
overlay.appendChild(hint);
const credit = document.createElement('div');
credit.className = 'credit';
credit.textContent = 'Model: “2021 BMW M4 Competition” by Ricy (ngon_3d), CC BY‑NC 4.0. Fan project, not affiliated with BMW.';
overlay.appendChild(credit);

const studio = createStudio(canvas, {pr: capture ? 1 : undefined});
const {camera} = studio;
const car = await loadCar(carUrl.startsWith('url:') ? carUrl.slice(4) : carUrl, studio.scene);
studio.fitShadow(car.size.x, car.size.z);

const vPos = new THREE.Vector3();
const vAt = new THREE.Vector3();
const vTmp = new THREE.Vector3();
const shot = (t) => {
  let i = 0;
  while (i < SHOTS.length - 2 && t > SHOTS[i + 1].t) i++;
  const a = SHOTS[i];
  const b = SHOTS[i + 1];
  const k = prog(t, a.t, b.t);
  vPos.set(...a.pos).lerp(vTmp.set(...b.pos), k);
  vAt.set(...a.at).lerp(vTmp.set(...b.at), k);
  return lerp(a.fov, b.fov, k);
};

let cur = 0;
function render(t) {
  t = Math.min(Math.max(t, 0), DURATION);
  camera.fov = shot(t);
  // the shots are framed for 16:9; a narrower screen pulls the camera back along the same line so the car still fits
  const back = Math.min(2.4, Math.max(1, 1.7 / camera.aspect));
  camera.position.copy(vPos).sub(vAt).multiplyScalar(back).add(vAt);
  camera.updateProjectionMatrix();
  camera.lookAt(vAt);
  car.setXray(prog(t, 8, 10.5));
  for (const c of caps) {
    const o = clamp01(Math.min((t - c.in) / 0.6, (c.out - t) / 0.6));
    c.el.style.opacity = o.toFixed(3);
    c.el.style.transform = `translateY(${((1 - o) * 12).toFixed(1)}px)`;
  }
  hint.style.opacity = (1 - clamp01(t / 0.8)).toFixed(3);
  studio.render();
}

addEventListener('resize', () => {
  studio.resize();
  render(cur);
});
studio.resize();
await studio.renderer.compileAsync(studio.scene, camera);

window.SIM = {duration: DURATION, fps: 60, ready: true, render: (t) => ((cur = t), render(t))};
render(0);

if (!capture) {
  // The scroll sets the target time; the shown time follows it with a little inertia.
  const spacer = document.createElement('div');
  spacer.className = 'scroll-space';
  document.body.appendChild(spacer);
  const target = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? (scrollY / max) * DURATION : 0;
  };
  let last = performance.now();
  let shown = false;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const goal = target();
    const next = Math.abs(goal - cur) < 0.0005 ? goal : cur + (goal - cur) * (1 - Math.exp(-dt * 7));
    if (next !== cur || !shown) {
      cur = next;
      render(cur);
      shown = true;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else {
  render(0);
}
