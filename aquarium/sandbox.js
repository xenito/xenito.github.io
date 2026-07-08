// Phase-0 growth sandbox: a glass aquarium in which a structure grows from an
// editable rulebook. This is a *preview* of the growth rules described in
// PLAN.md — no hardware, no other projects. The rule engine lives in
// lsystem.js; here we build the tank and animate the accretion.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { grow } from './lsystem.js';
import { PRESETS, DEFAULT_PRESET } from './presets.js';

// ---------------------------------------------------------------------------
// renderer / scene / camera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05131a);
scene.fog = new THREE.FogExp2(0x061a24, 0.035);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(6.5, 4.2, 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3.5;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * 0.92;
controls.target.set(0, 2.2, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// tank dimensions (world units ~ decimetres, purely for looks)
const TANK = { w: 9, h: 6, d: 6, t: 0.16 };      // width, height, depth, glass thickness
const WATER_H = TANK.h - 0.5;

// ---------------------------------------------------------------------------
// lighting: soft room light + a bright "aquarium lamp" from above + caustic feel
scene.add(new THREE.HemisphereLight(0xbfe6f0, 0x0a1c22, 0.8));
scene.add(new THREE.AmbientLight(0x24424c, 0.6));

const lamp = new THREE.SpotLight(0xdff6ff, 3.2, 40, Math.PI * 0.5, 0.5, 1.0);
lamp.position.set(0, TANK.h + 5, 1.5);
lamp.target.position.set(0, 0, 0);
lamp.castShadow = true;
lamp.shadow.mapSize.set(2048, 2048);
lamp.shadow.camera.near = 1;
lamp.shadow.camera.far = 40;
scene.add(lamp, lamp.target);

const fill = new THREE.DirectionalLight(0x7fd6e6, 0.7);
fill.position.set(-6, 4, -8);
scene.add(fill);

// gentle moving "caustic" light on the substrate
const caustic = new THREE.PointLight(0x9becff, 0.0, 20, 2.0);
caustic.position.set(0, WATER_H, 0);
scene.add(caustic);

// ---------------------------------------------------------------------------
// the aquarium: glass box, water volume, substrate, back glow
function buildTank() {
  const grp = new THREE.Group();

  // glass walls (thin boxes, transmissive-ish look via low opacity + specular)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfeef6, metalness: 0, roughness: 0.05,
    transmission: 0.92, transparent: true, opacity: 0.28,
    thickness: 0.5, ior: 1.33, side: THREE.DoubleSide,
    clearcoat: 1.0, clearcoatRoughness: 0.06, depthWrite: false,
  });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x0a2730, metalness: 0.6, roughness: 0.4 });

  const { w, h, d, t } = TANK;
  const panes = [
    [w, h, t, 0, h / 2, -d / 2],   // back
    [w, h, t, 0, h / 2,  d / 2],   // front
    [t, h, d, -w / 2, h / 2, 0],   // left
    [t, h, d,  w / 2, h / 2, 0],   // right
    [w, t, d, 0, 0, 0],            // bottom
  ];
  for (const [pw, ph, pd, x, y, z] of panes) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), glassMat);
    pane.position.set(x, y, z);
    grp.add(pane);
  }

  // black silicone frame along the top rim
  const rimGeo = new THREE.BoxGeometry(w + t, 0.18, t * 1.4);
  for (const z of [-d / 2, d / 2]) {
    const r = new THREE.Mesh(rimGeo, edgeMat); r.position.set(0, h, z); grp.add(r);
  }
  const rimGeoS = new THREE.BoxGeometry(t * 1.4, 0.18, d + t);
  for (const x of [-w / 2, w / 2]) {
    const r = new THREE.Mesh(rimGeoS, edgeMat); r.position.set(x, h, 0); grp.add(r);
  }

  // water volume: a slightly-tinted box, top face just below the rim
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f8fb0, metalness: 0, roughness: 0.15,
    transmission: 0.86, transparent: true, opacity: 0.34,
    thickness: 3.0, ior: 1.33, side: THREE.DoubleSide, depthWrite: false,
  });
  const water = new THREE.Mesh(new THREE.BoxGeometry(w - t * 2.2, WATER_H, d - t * 2.2), waterMat);
  water.position.set(0, WATER_H / 2, 0);
  water.renderOrder = 2;
  grp.add(water);

  // rippling water surface
  const surfGeo = new THREE.PlaneGeometry(w - t * 2.2, d - t * 2.2, 40, 30);
  const surfMat = new THREE.MeshPhysicalMaterial({
    color: 0x6fd8ee, roughness: 0.12, metalness: 0, transmission: 0.6,
    transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const surf = new THREE.Mesh(surfGeo, surfMat);
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = WATER_H;
  grp.add(surf);
  surf.userData.base = surfGeo.attributes.position.array.slice();

  // substrate: sand mound with scattered gravel
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xcdb894, roughness: 1.0 });
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.46, 0.5, 40, 1), sandMat);
  sand.position.y = 0.15;
  sand.scale.z = (d - t * 2.2) / (w * 0.9);
  sand.receiveShadow = true;
  grp.add(sand);

  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 });
  const pebbleMat2 = new THREE.MeshStandardMaterial({ color: 0x6b5f4e, roughness: 0.95 });
  for (let i = 0; i < 60; i++) {
    const r = 0.06 + Math.random() * 0.12;
    const peb = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), Math.random() < 0.5 ? pebbleMat : pebbleMat2);
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * w * 0.36;
    peb.position.set(Math.cos(ang) * rad, 0.36 + Math.random() * 0.04, Math.sin(ang) * rad * (d / w));
    peb.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    peb.scale.y = 0.6;
    peb.receiveShadow = true; peb.castShadow = true;
    grp.add(peb);
  }

  // a faint glowing back panel for depth
  const backGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0x0a3a4a, transparent: true, opacity: 0.5 }));
  backGlow.position.set(0, h / 2, -d / 2 - 0.05);
  grp.add(backGlow);

  return { grp, surf };
}

const tank = buildTank();
scene.add(tank.grp);
const SUBSTRATE_Y = 0.4;   // where the structure's base sits

// ---------------------------------------------------------------------------
// rising bubbles (ambient life without any fish)
const BUBBLES = 90;
const bubbleGeo = new THREE.SphereGeometry(1, 8, 8);
const bubbleMat = new THREE.MeshPhysicalMaterial({
  color: 0xdffbff, roughness: 0.1, transmission: 0.7, transparent: true, opacity: 0.5 });
const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLES);
bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(bubbles);
const bubbleData = [];
for (let i = 0; i < BUBBLES; i++) {
  bubbleData.push({
    x: (Math.random() - 0.5) * (TANK.w - 1),
    z: (Math.random() - 0.5) * (TANK.d - 1),
    y: Math.random() * WATER_H,
    r: 0.02 + Math.random() * 0.05,
    speed: 0.4 + Math.random() * 0.9,
    wob: Math.random() * Math.PI * 2,
  });
}
const _m = new THREE.Matrix4();
function updateBubbles(t, dt) {
  for (let i = 0; i < BUBBLES; i++) {
    const b = bubbleData[i];
    b.y += b.speed * dt;
    if (b.y > WATER_H - 0.1) { b.y = 0.5; b.x = (Math.random() - 0.5) * (TANK.w - 1); b.z = (Math.random() - 0.5) * (TANK.d - 1); }
    const wx = Math.sin(t * 1.5 + b.wob) * 0.06;
    _m.makeScale(b.r, b.r, b.r);
    _m.setPosition(b.x + wx, b.y, b.z + Math.cos(t + b.wob) * 0.04);
    bubbles.setMatrixAt(i, _m);
  }
  bubbles.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// the growing structure
let structure = new THREE.Group();
scene.add(structure);
let growth = null;          // current grow() result
let growProgress = 0;       // 0..1 revealed fraction of maxDepth
let growSpeed = 0.35;       // depths revealed per second
let growing = false;

const growFill = document.getElementById('growfill');
const errEl = document.getElementById('err');
const metaEl = document.getElementById('meta');

function palette(hue) {
  // a coral/reef palette cycled by the ' symbol
  const colors = [0xff7a5c, 0xffc14d, 0xf25c9a, 0x9b6cff, 0x4dd6b0, 0xff9d6c];
  return new THREE.Color(colors[((hue % colors.length) + colors.length) % colors.length]);
}

// Build meshes from grow() data, storing per-instance depth so we can reveal
// the structure progressively (accretion from the base outward).
function buildStructure(data) {
  structure.clear();

  const { segments, polyps } = data;

  // scale the whole thing to comfortably fit the tank
  let maxR = 0.1, maxY = 0.1;
  for (const s of segments) {
    const ey = Math.max(s.start.y, s.start.y + s.dir.y * s.length);
    if (ey > maxY) maxY = ey;
    maxR = Math.max(maxR, Math.hypot(s.start.x, s.start.z));
  }
  const fitH = (TANK.h - 1.5) / Math.max(maxY, 1);
  const fitR = (Math.min(TANK.w, TANK.d) * 0.42) / Math.max(maxR, 1);
  const S = Math.min(fitH, fitR, 1.4);

  // branch segments as instanced tapered cylinders
  const branchGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
  const branchMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05, vertexColors: false });
  const branches = new THREE.InstancedMesh(branchGeo, branchMat, Math.max(segments.length, 1));
  branches.castShadow = true;
  branches.receiveShadow = true;
  const colorArr = new Float32Array(Math.max(segments.length, 1) * 3);
  const depthArr = new Float32Array(Math.max(segments.length, 1));

  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const mat = new THREE.Matrix4();
  const scaleV = new THREE.Vector3();
  const posV = new THREE.Vector3();
  const tmpC = new THREE.Color();

  segments.forEach((s, i) => {
    const len = s.length * S;
    const rTop = Math.max(0.015, s.radius * S * 0.82);
    const rBot = Math.max(0.02, s.radius * S);
    const avgR = (rTop + rBot) / 2;
    quat.setFromUnitVectors(up, s.dir);
    posV.copy(s.start).multiplyScalar(S);
    posV.y += SUBSTRATE_Y;
    posV.addScaledVector(s.dir, len / 2);
    scaleV.set(avgR, len, avgR);
    mat.compose(posV, quat, scaleV);
    branches.setMatrixAt(i, mat);
    tmpC.copy(palette(s.hue)).offsetHSL(0, 0, -0.05 + Math.min(0.2, s.depth * 0.01));
    tmpC.toArray(colorArr, i * 3);
    depthArr[i] = s.depth;
  });
  branches.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);
  branches.geometry.setAttribute('_depth', new THREE.InstancedBufferAttribute(depthArr, 1));
  structure.add(branches);

  // polyps / fronds as instanced spheres
  let polypMesh = null;
  if (polyps.length) {
    const pGeo = new THREE.IcosahedronGeometry(1, 1);
    const pMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.0,
      emissive: 0x000000, emissiveIntensity: 0.4 });
    polypMesh = new THREE.InstancedMesh(pGeo, pMat, polyps.length);
    polypMesh.castShadow = true;
    const pColor = new Float32Array(polyps.length * 3);
    const pDepth = new Float32Array(polyps.length);
    polyps.forEach((p, i) => {
      const r = Math.max(0.04, p.radius * S);
      posV.copy(p.pos).multiplyScalar(S); posV.y += SUBSTRATE_Y;
      scaleV.set(r, r * 0.8, r);
      mat.compose(posV, new THREE.Quaternion(), scaleV);
      polypMesh.setMatrixAt(i, mat);
      palette(p.hue + 3).toArray(pColor, i * 3);
      pDepth[i] = p.depth;
    });
    polypMesh.instanceColor = new THREE.InstancedBufferAttribute(pColor, 3);
    polypMesh.geometry.setAttribute('_depth', new THREE.InstancedBufferAttribute(pDepth, 1));
    structure.add(polypMesh);
  }

  structure.userData = { branches, polypMesh, S };
  applyReveal(0);
}

// Reveal segments/polyps up to a growth depth by scaling hidden instances to 0.
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);
const _reMat = new THREE.Matrix4();
const _reQ = new THREE.Quaternion();
const _reP = new THREE.Vector3();
const _reS = new THREE.Vector3();
function applyReveal(revealDepth) {
  if (!growth) return;
  const { branches, polypMesh } = structure.userData;
  const up = new THREE.Vector3(0, 1, 0);
  const S = structure.userData.S;

  growth.segments.forEach((s, i) => {
    const grown = revealDepth - s.depth;              // how far this seg has emerged
    if (grown <= 0) { branches.setMatrixAt(i, _hide); return; }
    const f = Math.min(1, grown);                     // 0..1 emergence of this segment
    const len = s.length * S * f;
    const rTop = Math.max(0.015, s.radius * S * 0.82);
    const rBot = Math.max(0.02, s.radius * S);
    const avgR = (rTop + rBot) / 2;
    _reQ.setFromUnitVectors(up, s.dir);
    _reP.copy(s.start).multiplyScalar(S); _reP.y += SUBSTRATE_Y;
    _reP.addScaledVector(s.dir, len / 2);
    _reS.set(avgR, len, avgR);
    _reMat.compose(_reP, _reQ, _reS);
    branches.setMatrixAt(i, _reMat);
  });
  branches.instanceMatrix.needsUpdate = true;
  branches.count = growth.segments.length;

  if (polypMesh) {
    growth.polyps.forEach((p, i) => {
      const grown = revealDepth - p.depth;
      if (grown <= 0) { polypMesh.setMatrixAt(i, _hide); return; }
      const f = Math.min(1, grown);
      const r = Math.max(0.04, p.radius * S) * f;
      _reP.copy(p.pos).multiplyScalar(S); _reP.y += SUBSTRATE_Y;
      _reS.set(r, r * 0.8, r);
      _reMat.compose(_reP, new THREE.Quaternion(), _reS);
      polypMesh.setMatrixAt(i, _reMat);
    });
    polypMesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// wire up the rulebook + regrow
function regrow(restart = true) {
  const text = bookEl.value;
  try {
    growth = grow(text);
  } catch (e) {
    errEl.textContent = 'Rulebook error: ' + e.message;
    return;
  }
  errEl.textContent = '';
  buildStructure(growth);
  metaEl.innerHTML =
    `<b>${growth.segments.length}</b> segments · <b>${growth.polyps.length}</b> polyps · ` +
    `depth <b>${growth.maxDepth}</b> · rule string <b>${growth.stringLength.toLocaleString()}</b> chars`;
  if (restart) { growProgress = 0; growing = true; }
  else { applyReveal(growProgress); }
}

// ---------------------------------------------------------------------------
// UI
const presetEl = document.getElementById('preset');
const bookEl = document.getElementById('book');
for (const name of Object.keys(PRESETS)) {
  const opt = document.createElement('option');
  opt.value = name; opt.textContent = name;
  presetEl.appendChild(opt);
}
presetEl.value = DEFAULT_PRESET;
bookEl.value = PRESETS[DEFAULT_PRESET];

presetEl.addEventListener('change', () => {
  bookEl.value = PRESETS[presetEl.value];
  regrow(true);
});
document.getElementById('grow').addEventListener('click', () => regrow(true));
document.getElementById('replant').addEventListener('click', () => {
  // re-seed: nudge the seed line so stochastic rules grow a fresh variant
  const seed = Math.floor(Math.random() * 99999) + 1;
  if (/^\s*seed\s*[:=]/mi.test(bookEl.value)) {
    bookEl.value = bookEl.value.replace(/^(\s*seed\s*[:=]\s*).*$/mi, `$1${seed}`);
  } else {
    bookEl.value = `seed = ${seed}\n` + bookEl.value;
  }
  regrow(true);
});

regrow(true);

// ---------------------------------------------------------------------------
// animation loop
const clock = new THREE.Clock();
const surfBase = tank.surf.userData.base;
const surfPos = tank.surf.geometry.attributes.position;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (growing && growth) {
    growProgress += growSpeed * dt;
    if (growProgress >= growth.maxDepth + 1) { growProgress = growth.maxDepth + 1; growing = false; }
    applyReveal(growProgress);
  }
  growFill.style.width = growth ? `${Math.min(100, 100 * growProgress / (growth.maxDepth + 1))}%` : '0%';

  // ripple the water surface
  for (let i = 0; i < surfPos.count; i++) {
    const x = surfBase[i * 3], z = surfBase[i * 3 + 2];
    surfPos.setY(i, Math.sin(x * 1.2 + t * 1.8) * 0.05 + Math.cos(z * 1.5 + t * 1.3) * 0.05);
  }
  surfPos.needsUpdate = true;

  // gentle sway of the whole structure (water motion)
  structure.rotation.z = Math.sin(t * 0.6) * 0.015;
  structure.rotation.x = Math.cos(t * 0.5) * 0.012;

  caustic.intensity = 0.6 + Math.sin(t * 1.4) * 0.3;
  caustic.position.x = Math.sin(t * 0.4) * 2;

  updateBubbles(t, dt);
  controls.update();
  renderer.render(scene, camera);
}
frame();
