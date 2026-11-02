// BMW M4 (G82) scroll teardown. The scroll position is the time t of one film: render(t) poses the camera, the
// captions, the dissolve and the engine's lift and explode from t alone, so the page, a captured video and the
// README gif are the same frames. The crank turns on its own clock (wall) so the engine runs while the page rests;
// a capture passes wall = t. window.SIM is the teardown kit's capture contract (sims/capture.mjs steps SIM.render(t)).
import * as THREE from 'three';
import {clamp01, prog, lerp} from 'teardown-kit/util.js';
import {createStudio} from './studio.js';
import {loadCar, SPEC} from './car.js';
import {createEngine, S58} from './engine.js';
import carUrl from './m4.glb';

const DURATION = 20;
const RPM = 900;
const SLOW = 30; // the crank shown at 1/30 of its speed so the eye can follow it
const capture = !!window.__CAPTURE || new URLSearchParams(location.search).has('capture');

// Engine bay: the block sits between the firewall (pedals end near x = 1.0) and the front axle, crank 0.37 m up.
const BAY = {x: 1.4, y: 0.37};
const LIFT = 0.85;

// Camera path: position, target and field of view at each key time; eased between keys.
const SHOTS = [
  {t: 0, pos: [5.4, 1.05, 4.4], at: [0.35, 0.62, 0], fov: 30},
  {t: 3.5, pos: [4.6, 0.95, 5.6], at: [0.1, 0.62, 0], fov: 30},
  {t: 6.5, pos: [0, 0.85, 9.2], at: [0, 0.62, 0], fov: 28},
  {t: 9.5, pos: [-4.2, 2.4, 5.6], at: [0, 0.55, 0], fov: 30},
  {t: 12.5, pos: [3.3, 1.65, 2.6], at: [1.35, 0.6, 0], fov: 30},
  {t: 15, pos: [3.0, 1.45, 2.3], at: [1.4, 0.65, 0], fov: 30},
  {t: 17.5, pos: [3.6, 2.2, 2.8], at: [1.4, 1.38, 0], fov: 30},
  {t: 20, pos: [0.4, 2.45, 3.1], at: [1.4, 1.45, 0], fov: 32},
];

// Captions: each holds from `in` to `out`, fading 0.6 s at both ends.
const mm = (m) => Math.round(m * 1000);
const CAPTIONS = [
  {in: -1, out: 3.2, cls: 'hero', html: `<div class="kicker">G82 · Coupé · 2021</div><h1>BMW M4 Competition</h1><div class="specs">3.0 L twin-turbo inline-six · 510 PS · 650 Nm</div>`},
  {in: 3.6, out: 7.4, cls: 'low', html: `<div class="kicker">Proportions</div><div class="dims"><span><b>${mm(SPEC.length)}</b> mm long</span><span><b>${mm(SPEC.wheelbase)}</b> mm wheelbase</span><span><b>${mm(SPEC.height)}</b> mm tall</span></div>`},
  {in: 11.2, out: 15.2, cls: 'low', html: `<div class="kicker">Under the skin</div><h2>S58</h2><div class="specs">${S58.displacement} cc · bore ${mm(S58.bore)} × stroke ${mm(S58.stroke)} mm · 6 in line</div>`},
  {in: 16.8, out: 99, cls: 'low long', html: `<div class="kicker">Exploded</div><h2>Two turbos, six cylinders</h2><div class="specs">One mono-scroll turbo per three cylinders · up to 1.7 bar</div>`},
];

const app = document.getElementById('app');
document.documentElement.classList.toggle('capture', capture);
document.title = 'BMW M4 (G82) · scroll teardown';
const canvas = document.createElement('canvas');
canvas.id = 'gl';
app.appendChild(canvas);
const overlay = document.createElement('div');
overlay.className = 'overlay';
app.appendChild(overlay);
const caps = CAPTIONS.map((c) => {
  const el = document.createElement('div');
  el.className = `tc ${c.cls}`;
  el.innerHTML = c.html;
  overlay.appendChild(el);
  return {...c, el};
});
const readout = document.createElement('div');
readout.className = 'readout';
readout.innerHTML = `
  <div class="row"><span class="k">Crank</span><span class="v" data-crank>0°</span></div>
  <div class="row"><span class="k">Firing order</span><span class="order">${S58.firing.map((c) => `<i data-cyl="${c}">${c}</i>`).join('')}</span></div>
  <div class="row"><span class="k">Engine</span><span class="v">${RPM} rpm · 1/${SLOW} speed</span></div>`;
overlay.appendChild(readout);
const crankEl = readout.querySelector('[data-crank]');
const cylEls = Object.fromEntries([...readout.querySelectorAll('[data-cyl]')].map((el) => [el.dataset.cyl, el]));
const hint = document.createElement('div');
hint.className = 'hint';
hint.textContent = 'Scroll';
overlay.appendChild(hint);
const credit = document.createElement('div');
credit.className = 'credit';
credit.textContent = 'Model: “2021 BMW M4 Competition” by Ricy (ngon_3d), CC BY‑NC 4.0. Engine built from S58 dimensions. Fan project, not affiliated with BMW.';
overlay.appendChild(credit);

const studio = createStudio(canvas, {pr: capture ? 1 : undefined});
const {camera} = studio;
// the page loads the model as a file next to it; the film build inlines it (base64) so a capture opens from file://
const car = await loadCar(carUrl.startsWith('url:') ? carUrl.slice(4) : `data:model/gltf-binary;base64,${carUrl}`, studio.scene);
studio.fitShadow(car.size.x, car.size.z);
const engine = createEngine();
engine.root.position.set(BAY.x, BAY.y, 0);
studio.scene.add(engine.root);

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
let lastFired = 0;
function render(t, wall = t) {
  t = Math.min(Math.max(t, 0), DURATION);
  camera.fov = shot(t);
  // the shots are framed for 16:9; a narrower screen pulls the camera back along the same line so the car still fits
  const back = Math.min(2.4, Math.max(1, 1.7 / camera.aspect));
  camera.position.copy(vPos).sub(vAt).multiplyScalar(back).add(vAt);
  camera.updateProjectionMatrix();
  camera.lookAt(vAt);

  car.setXray(prog(t, 8, 11.5, (x) => x));
  const crankDeg = (wall * RPM * 6) / SLOW;
  engine.root.position.y = BAY.y + LIFT * prog(t, 15, 17.2);
  engine.explode(prog(t, 16.4, 19));
  engine.update(crankDeg, wall * 14);

  for (const c of caps) {
    const o = clamp01(Math.min((t - c.in) / 0.6, (c.out - t) / 0.6));
    c.el.style.opacity = o.toFixed(3);
    c.el.style.transform = `translateY(${((1 - o) * 12).toFixed(1)}px)`;
  }
  readout.style.opacity = clamp01((t - 11.2) / 0.6).toFixed(3);
  const info = engine.info(crankDeg);
  crankEl.textContent = `${info.crank}°`;
  if (info.fired !== lastFired) {
    cylEls[lastFired]?.classList.remove('on');
    cylEls[info.fired].classList.add('on');
    lastFired = info.fired;
  }
  hint.style.opacity = (1 - clamp01(t / 0.8)).toFixed(3);
  studio.render();
}

addEventListener('resize', () => {
  studio.resize();
  render(cur, performance.now() / 1000);
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
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const goal = target();
    const next = Math.abs(goal - cur) < 0.0005 ? goal : cur + (goal - cur) * (1 - Math.exp(-dt * 7));
    // once the engine shows it runs on its own, so the frame redraws even when the scroll rests
    if (next !== cur || cur > 10.5) {
      cur = next;
      render(cur, now / 1000);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
