// The S58: a 3.0 L inline-six, built from its real numbers and posed from one input, the crank angle.
// Engine space, metres: X along the crank (cylinder 1 at +X, the front), Y up from the crank axis, Z across
// (+Z the exhaust side with both turbos, -Z the intake side).
import * as THREE from 'three';

export const S58 = {
  bore: 0.084,
  stroke: 0.09,
  rod: 0.1444, // centre to centre
  compressionHeight: 0.032, // wrist pin to crown
  pitch: 0.091, // bore spacing
  firing: [1, 5, 3, 6, 2, 4],
  displacement: 2993,
};
const R = S58.stroke / 2;
const L = S58.rod;
const DECK = R + L + S58.compressionHeight + 0.0012;

// Crank angle at which each cylinder fires (0..720°), from the firing order and 120° between firings.
const FIRE = [0, 0, 0, 0, 0, 0];
S58.firing.forEach((c, k) => (FIRE[c - 1] = k * 120));
const CYL_X = [0, 1, 2, 3, 4, 5].map((i) => (2.5 - i) * S58.pitch);
const DEG = Math.PI / 180;
const mod = (a, m) => ((a % m) + m) % m;

/** Wrist pin height above the crank axis at crank angle a (rad) from its TDC. Exact slider-crank. */
export const pinHeight = (a) => R * Math.cos(a) + Math.sqrt(L * L - (R * Math.sin(a)) ** 2);
/** Four-stroke angle of cylinder i (0..720°): 0 the firing TDC, 0-180 power, 180-360 exhaust, 360-540 intake, 540-720 compression. */
export const strokeAngle = (i, crankDeg) => mod(crankDeg - FIRE[i], 720);
const lift = (beta, centre, width) => {
  const d = mod(beta - centre + 360, 720) - 360;
  return Math.abs(d) > width / 2 ? 0 : Math.cos((Math.PI * d) / width) ** 2;
};
const INTAKE = {centre: 465, width: 250};
const EXHAUST = {centre: 255, width: 250};
const MAX_LIFT = 0.0115;

const mat = {
  block: new THREE.MeshPhysicalMaterial({color: '#25313d', transparent: true, opacity: 0.18, roughness: 0.15, metalness: 0, depthWrite: false, side: THREE.DoubleSide}),
  edge: new THREE.LineBasicMaterial({color: '#ff4a3d', transparent: true, opacity: 0.6}),
  ring: new THREE.MeshBasicMaterial({color: '#ff4a3d'}),
  steel: new THREE.MeshPhysicalMaterial({color: '#c9ced4', metalness: 1, roughness: 0.25}),
  forged: new THREE.MeshPhysicalMaterial({color: '#8d949c', metalness: 1, roughness: 0.38}),
  piston: new THREE.MeshPhysicalMaterial({color: '#dfe3e7', metalness: 1, roughness: 0.3}),
  cam: new THREE.MeshPhysicalMaterial({color: '#3a3f46', metalness: 1, roughness: 0.3}),
  valve: new THREE.MeshPhysicalMaterial({color: '#b5bcc4', metalness: 1, roughness: 0.2}),
  cover: new THREE.MeshPhysicalMaterial({color: '#0d0f12', transparent: true, opacity: 0.35, roughness: 0.25, metalness: 0.3, clearcoat: 1, depthWrite: false}),
  exhaust: new THREE.MeshPhysicalMaterial({color: '#6e5d52', metalness: 1, roughness: 0.42, emissive: '#ff3a10', emissiveIntensity: 0.18}),
  compressor: new THREE.MeshPhysicalMaterial({color: '#858c94', metalness: 1, roughness: 0.48}),
  turbine: new THREE.MeshPhysicalMaterial({color: '#4c4742', metalness: 1, roughness: 0.45}),
  intake: new THREE.MeshPhysicalMaterial({color: '#1a1c20', metalness: 0.2, roughness: 0.55}),
  glow: new THREE.MeshBasicMaterial({color: '#ff5a1a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}),
};

const cyl = (r, h, m, seg = 32) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
const box = (x, y, z, m) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), m);
/** A glass box with red edges, for the block, the head and the sump. */
const glassBox = (min, max) => {
  const size = new THREE.Vector3().subVectors(max, min);
  const g = new THREE.BoxGeometry(size.x, size.y, size.z);
  const m = new THREE.Mesh(g, mat.block);
  m.renderOrder = 2;
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), mat.edge));
  m.position.addVectors(min, max).multiplyScalar(0.5);
  return m;
};
const alongX = (m) => ((m.rotation.z = Math.PI / 2), m);
const tube = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 12), m);

export function createEngine() {
  const root = new THREE.Group();
  root.name = 'S58';
  // groups that separate in the exploded view
  const bottom = new THREE.Group(); // block, crank, rods, pistons, flywheel, pulley
  const head = new THREE.Group();
  const cams = new THREE.Group();
  const cover = new THREE.Group();
  const sump = new THREE.Group();
  const hot = new THREE.Group(); // turbos and exhaust manifolds
  const cold = new THREE.Group(); // intake plenum and runners
  root.add(bottom, head, sump, hot, cold);
  head.add(cams, cover);

  // Block, head, sump: glass, so the moving parts read through them.
  bottom.add(glassBox(new THREE.Vector3(-0.3, -0.06, -0.13), new THREE.Vector3(0.3, DECK, 0.13)));
  head.add(glassBox(new THREE.Vector3(-0.3, DECK, -0.13), new THREE.Vector3(0.3, DECK + 0.13, 0.13)));
  sump.add(glassBox(new THREE.Vector3(-0.28, -0.21, -0.12), new THREE.Vector3(0.28, -0.06, 0.12)));
  const coverMesh = box(0.6, 0.045, 0.24, mat.cover);
  coverMesh.position.y = DECK + 0.155;
  coverMesh.renderOrder = 3;
  cover.add(coverMesh);

  // Crankshaft: main journal, and per cylinder a throw (two webs, the pin, a counterweight) at its own phase.
  const crank = new THREE.Group();
  bottom.add(crank);
  crank.add(alongX(cyl(0.028, 0.68, mat.forged)));
  const pulley = alongX(cyl(0.075, 0.03, mat.steel, 48));
  pulley.position.x = 0.355;
  const flywheel = alongX(cyl(0.165, 0.025, mat.steel, 64));
  flywheel.position.x = -0.355;
  crank.add(pulley, flywheel);
  const throwGeo = {
    web: new THREE.BoxGeometry(0.014, R + 0.05, 0.06),
    pin: new THREE.CylinderGeometry(0.024, 0.024, 0.04, 24),
    weight: new THREE.CylinderGeometry(0.068, 0.068, 0.014, 32, 1, false, Math.PI / 2, Math.PI),
  };
  CYL_X.forEach((x, i) => {
    const t = new THREE.Group();
    t.position.x = x;
    t.rotation.x = -FIRE[i] * DEG; // the pin points to +Y at this cylinder's TDC
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(throwGeo.web, mat.forged);
      w.position.set(s * 0.027, R / 2, 0);
      const cw = new THREE.Mesh(throwGeo.weight, mat.forged);
      cw.rotation.z = Math.PI / 2;
      cw.position.x = s * 0.027;
      t.add(w, cw);
    }
    const pin = new THREE.Mesh(throwGeo.pin, mat.steel);
    pin.rotation.z = Math.PI / 2;
    pin.position.y = R;
    t.add(pin);
    crank.add(t);
  });

  // Pistons, rods, the combustion glow above each crown, a red ring at each bore's top.
  const rodGeo = new THREE.BoxGeometry(0.016, L, 0.022);
  const bigEnd = new THREE.TorusGeometry(0.03, 0.009, 12, 24);
  const pistonGeo = new THREE.CylinderGeometry(S58.bore / 2 - 0.0008, S58.bore / 2 - 0.0008, 0.05, 40);
  const glowGeo = new THREE.CylinderGeometry(S58.bore / 2 - 0.002, S58.bore / 2 - 0.002, 1, 32, 1, true);
  const ringGeo = new THREE.TorusGeometry(S58.bore / 2 + 0.002, 0.0025, 8, 48);
  const pistons = CYL_X.map((x) => {
    const piston = new THREE.Mesh(pistonGeo, mat.piston);
    const rod = new THREE.Group();
    const beam = new THREE.Mesh(rodGeo, mat.forged);
    beam.position.y = L / 2;
    const be = new THREE.Mesh(bigEnd, mat.forged);
    be.rotation.y = Math.PI / 2;
    rod.add(beam, be);
    const glow = new THREE.Mesh(glowGeo, mat.glow.clone());
    glow.renderOrder = 4;
    const ring = new THREE.Mesh(ringGeo, mat.ring);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, DECK, 0);
    bottom.add(piston, rod, glow, ring);
    return {x, piston, rod, glow};
  });

  // Valves (4 per cylinder) and two camshafts turning at half crank speed.
  const stemGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.085, 8);
  const headGeo = new THREE.CylinderGeometry(0.0145, 0.004, 0.004, 24);
  const valves = [];
  const camGroups = {intake: new THREE.Group(), exhaust: new THREE.Group()};
  camGroups.intake.position.set(0, DECK + 0.1, -0.045);
  camGroups.exhaust.position.set(0, DECK + 0.1, 0.045);
  cams.add(camGroups.intake, camGroups.exhaust);
  for (const g of Object.values(camGroups)) g.add(alongX(cyl(0.012, 0.62, mat.cam, 16)));
  // a cam lobe: base circle with a nose towards -Y
  const lobeShape = new THREE.Shape();
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const rr = 0.017 + Math.max(0, Math.cos(a)) ** 3 * 0.011;
    const px = Math.sin(a) * rr;
    const py = -Math.cos(a) * rr;
    if (k) lobeShape.lineTo(px, py);
    else lobeShape.moveTo(px, py);
  }
  const lobeGeo = new THREE.ExtrudeGeometry(lobeShape, {depth: 0.012, bevelEnabled: false});
  lobeGeo.translate(0, 0, -0.006);
  lobeGeo.rotateY(Math.PI / 2);
  CYL_X.forEach((x, i) => {
    for (const [side, valve] of [['intake', INTAKE], ['exhaust', EXHAUST]]) {
      const z = side === 'intake' ? -0.045 : 0.045;
      for (const dx of [-0.017, 0.017]) {
        const v = new THREE.Group();
        const stem = new THREE.Mesh(stemGeo, mat.valve);
        stem.position.y = 0.0425;
        v.add(stem, new THREE.Mesh(headGeo, mat.valve));
        v.position.set(x + dx, DECK, z * 0.55);
        head.add(v);
        valves.push({v, i, valve});
        const lobe = new THREE.Mesh(lobeGeo, mat.cam);
        lobe.position.x = x + dx;
        // nose straight down when this valve's lift peaks: on a half-speed cam the lobe sits at -(fire + centre) / 2
        lobe.rotation.x = (-(FIRE[i] + valve.centre) / 2) * DEG;
        camGroups[side].add(lobe);
      }
    }
  });

  // Turbos: two mono-scroll units on the exhaust side, the front one fed by cylinders 1-3, the rear by 4-6.
  const turbos = [0.15, -0.15].map((tx) => {
    const t = new THREE.Group();
    t.position.set(tx, DECK - 0.03, 0.3);
    const housingC = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.03, 16, 40), mat.compressor);
    housingC.rotation.y = Math.PI / 2;
    housingC.position.x = 0.05;
    const housingT = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.032, 16, 40), mat.turbine);
    housingT.rotation.y = Math.PI / 2;
    housingT.position.x = -0.05;
    const core = alongX(cyl(0.028, 0.07, mat.steel, 24));
    const wheel = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const arm = new THREE.Group();
      arm.rotation.x = (k / 9) * Math.PI * 2;
      const blade = box(0.012, 0.042, 0.004, mat.steel);
      blade.position.y = 0.021;
      blade.rotation.y = 0.5;
      arm.add(blade);
      wheel.add(arm);
    }
    wheel.position.x = 0.05;
    const inlet = alongX(cyl(0.03, 0.06, mat.compressor, 24));
    inlet.position.x = 0.1;
    t.add(housingC, housingT, core, wheel, inlet);
    hot.add(t);
    return {t, wheel};
  });
  // exhaust manifolds: each port to its turbo
  CYL_X.forEach((x, i) => {
    const tx = i < 3 ? 0.15 : -0.15;
    hot.add(tube([[x, DECK + 0.045, 0.13], [x, DECK + 0.03, 0.2], [(x + tx) / 2, DECK - 0.01, 0.25], [tx - 0.05, DECK - 0.03, 0.27]], 0.0145, mat.exhaust));
  });

  // Intake: plenum along the cold side, six runners into the head.
  const plenum = box(0.56, 0.09, 0.09, mat.intake);
  plenum.position.set(0, DECK + 0.06, -0.27);
  cold.add(plenum);
  CYL_X.forEach((x) => cold.add(tube([[x, DECK + 0.06, -0.225], [x, DECK + 0.08, -0.18], [x, DECK + 0.05, -0.13]], 0.016, mat.intake)));

  root.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.castShadow = o.receiveShadow = true;
  });

  const parts = {head, cams, cover, sump, hot, cold};
  const base = Object.fromEntries(Object.entries(parts).map(([k, g]) => [k, g.position.clone()]));

  /** Pose everything from the crank angle (degrees); spin is the turbo shaft angle (rad). */
  const update = (crankDeg, spin = 0) => {
    const th = crankDeg * DEG;
    crank.rotation.x = th;
    camGroups.intake.rotation.x = th / 2;
    camGroups.exhaust.rotation.x = th / 2;
    pistons.forEach(({x, piston, rod, glow}, i) => {
      const a = th - FIRE[i] * DEG;
      const py = R * Math.cos(a);
      const pz = R * Math.sin(a);
      const wy = pinHeight(a);
      piston.position.set(x, wy + S58.compressionHeight - 0.025, 0);
      rod.position.set(x, py, pz);
      rod.rotation.x = Math.atan2(pz, wy - py);
      const crown = wy + S58.compressionHeight;
      glow.position.set(x, (crown + DECK) / 2, 0);
      glow.scale.y = Math.max(0.0005, DECK - crown);
      const beta = strokeAngle(i, crankDeg);
      glow.material.opacity = beta < 160 ? 0.5 * Math.exp(-beta / 45) : 0;
    });
    for (const {v, i, valve} of valves) v.position.y = DECK - 0.002 - lift(strokeAngle(i, crankDeg), valve.centre, valve.width) * MAX_LIFT;
    for (const {wheel} of turbos) wheel.rotation.x = spin;
  };

  /** e 0..1: the head, cams and cover rise, the sump drops, the hot and cold sides pull out. */
  const explode = (e) => {
    head.position.y = base.head.y + 0.2 * e;
    cams.position.y = base.cams.y + 0.07 * e;
    cover.position.y = base.cover.y + 0.12 * e;
    sump.position.y = base.sump.y - 0.14 * e;
    hot.position.z = base.hot.z + 0.2 * e;
    cold.position.z = base.cold.z - 0.16 * e;
  };

  /** What the panel shows at this crank angle: the angle in the 720° cycle and the cylinder that fired last. */
  const info = (crankDeg) => {
    let fired = 1;
    for (let i = 0; i < 6; i++) if (strokeAngle(i, crankDeg) < 120) fired = i + 1;
    return {crank: Math.round(mod(crankDeg, 720)), fired};
  };

  update(0);
  return {root, update, explode, info, deck: DECK};
}
