// Music-driven 3D animation of a Mitsubishi EDiA EM FB20N2T 3-wheel electric
// forklift. The truck drives a circuit around a warehouse floor; choreography
// (fork lifts, 360-degree pirouettes, light pulses, camera cuts) is driven by
// the beat clock, and body/lighting motion reacts to live frequency bands.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildForklift } from './forklift.js';
import { AudioEngine, sectionAt } from './audio.js';

// ---------------------------------------------------------------------------
// renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e11);
scene.fog = new THREE.Fog(0x0b0e11, 18, 46);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(7, 3.4, 9);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.7, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// environment: concrete floor with aisle markings, racking, pallets
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#3c4046';
  g.fillRect(0, 0, 1024, 1024);
  // concrete mottle
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${20 + Math.random() * 40},${22 + Math.random() * 40},${26 + Math.random() * 40},0.08)`;
    g.fillRect(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  // expansion joints
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i * 256); g.lineTo(1024, i * 256); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9, metalness: 0.05 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// yellow aisle ring around the driving circuit
const PATH_R = 5.2;
for (const r of [PATH_R - 1.7, PATH_R + 1.7]) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.06, r + 0.06, 96),
    new THREE.MeshBasicMaterial({ color: 0xd9a514, transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);
}

function pallet(x, z, layers) {
  const grp = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x9b7f57, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.0), wood);
  base.position.y = 0.07;
  base.castShadow = true;
  grp.add(base);
  for (let i = 0; i < layers; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.06 - i * 0.05, 0.42, 0.9 - i * 0.04), boxMat);
    b.position.y = 0.35 + i * 0.43;
    b.rotation.y = (i % 2) * 0.06;
    b.castShadow = true;
    b.receiveShadow = true;
    grp.add(b);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = Math.random() * Math.PI;
  scene.add(grp);
}
pallet(9.5, 3, 3); pallet(10.5, -2, 2); pallet(-9, 5, 2); pallet(-10, -4, 3);
pallet(3, -10, 2); pallet(-3.5, 10.5, 3);

function rack(x, z, ry) {
  const grp = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2e6ea8, roughness: 0.55, metalness: 0.4 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xc27b12, roughness: 0.6, metalness: 0.4 });
  for (const dx of [-3, 0, 3]) {
    for (const dz of [-0.55, 0.55]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.4, 0.12), steel);
      post.position.set(dx, 2.7, dz);
      post.castShadow = true;
      grp.add(post);
    }
  }
  for (const y of [1.6, 3.2, 4.8]) {
    for (const dz of [-0.55, 0.55]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6, 0.14, 0.1), beamMat);
      beam.position.set(0, y, dz);
      grp.add(beam);
    }
    for (const dx of [-1.5, 1.5]) {
      const load = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x757a80, roughness: 0.85 }));
      load.position.set(dx, y + 0.46, 0);
      load.castShadow = true;
      grp.add(load);
    }
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = ry;
  scene.add(grp);
}
rack(0, -13, 0); rack(-13.5, 0, Math.PI / 2); rack(13.5, 1, Math.PI / 2); rack(1, 13.5, 0);

// ---------------------------------------------------------------------------
// lighting
scene.add(new THREE.HemisphereLight(0x9fb4c8, 0x22262b, 1.35));
scene.add(new THREE.AmbientLight(0x404650, 0.5));
const sun = new THREE.DirectionalLight(0xf2ede0, 2.3);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
scene.add(sun);

// beat-reactive rig: teal + amber point lights on opposite sides
const tealLight = new THREE.PointLight(0x18e0b0, 0, 40, 1.6);
tealLight.position.set(-8, 5.5, -6);
scene.add(tealLight);
const amberLight = new THREE.PointLight(0xffa028, 0, 40, 1.6);
amberLight.position.set(8, 5, 6);
scene.add(amberLight);

// ---------------------------------------------------------------------------
// the truck + its safety-zone red floor lights (a real EDiA option)
const lift = buildForklift();
scene.add(lift.truck);

const safetyMat = new THREE.MeshBasicMaterial({
  color: 0xff2222, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
for (const side of [-1, 1]) {
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), safetyMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(side * 1.15, 0.01, -0.7);
  lift.truck.add(glow);
}

// headlight: a real spotlight thrown ahead of the truck from the guard lights
const headlight = new THREE.SpotLight(0xfff2c4, 0, 14, 0.5, 0.45, 1.2);
headlight.position.set(0, 1.9, 0.2);
const headlightTarget = new THREE.Object3D();
headlightTarget.position.set(0, 0, 5);
lift.truck.add(headlight, headlightTarget);
headlight.target = headlightTarget;

// ---------------------------------------------------------------------------
// choreography state
const audio = new AudioEngine();
const state = {
  dist: 0,             // metres along the circuit
  speed: 0,            // m/s (smoothed)
  spinOffset: 0,       // extra heading during pirouettes (radians)
  liftF: 0,            // fork lift fraction 0..1 (smoothed)
  tilt: 0,             // mast tilt target
  bounce: 0,           // bass-driven body squash (smoothed)
  lastBeat: -1,
  beatFlash: 0,
  shotIndex: 0,
  lastShotBar: -1,
};

const clock = new THREE.Clock();
const CIRCUIT_LEN = 2 * Math.PI * PATH_R;

function poseOnCircuit(dist) {
  const a = dist / PATH_R;
  return {
    pos: new THREE.Vector3(Math.sin(a) * PATH_R, 0, Math.cos(a) * PATH_R),
    heading: a + Math.PI / 2, // tangent, +Z forward convention
  };
}

// target driving speed per section (m/s); lift target; pirouette flag
function sectionPlan(section) {
  switch (section) {
    case 'intro': return { speed: 0.0, lift: 0.06, pirouette: false };
    case 'groove1': return { speed: 2.4, lift: 0.1, pirouette: false };
    case 'drop': return { speed: 0.0, lift: 1.0, pirouette: false };
    case 'break': return { speed: 0.0, lift: 0.25, pirouette: true };
    case 'groove2': return { speed: 3.0, lift: 0.18, pirouette: false };
    default: return { speed: 1.5, lift: 0.1, pirouette: false };
  }
}

const easeInOut = (t) => t * t * (3 - 2 * t);

// camera shots: functions of (truck pose, time-in-shot) -> {eye, look}
const shots = [
  (p, t) => ({ // wide orbit
    eye: new THREE.Vector3(Math.sin(t * 0.12) * 11, 4.5 + Math.sin(t * 0.3) * 0.4, Math.cos(t * 0.12) * 11),
    look: p.pos.clone().setY(1.2),
  }),
  (p, t) => { // low front three-quarter, tracking
    const fwd = new THREE.Vector3(Math.sin(p.heading + state.spinOffset), 0, Math.cos(p.heading + state.spinOffset));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const eye = p.pos.clone().add(fwd.clone().multiplyScalar(4.4)).add(side.multiplyScalar(2.2 * Math.sin(t * 0.4 + 1)));
    eye.y = 0.9;
    return { eye, look: p.pos.clone().setY(1.1) };
  },
  (p, t) => { // fork close-up, offset to the side so the mast doesn't fill the frame
    const fwd = new THREE.Vector3(Math.sin(p.heading + state.spinOffset), 0, Math.cos(p.heading + state.spinOffset));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const eye = p.pos.clone().add(fwd.clone().multiplyScalar(4.2)).add(side.multiplyScalar(1.8));
    eye.y = 0.9 + state.liftF * 2.2;
    const look = p.pos.clone().add(fwd.clone().multiplyScalar(0.9));
    look.y = 0.5 + state.liftF * 2.8;
    return { eye, look };
  },
  (p, t) => { // high crane shot
    const eye = p.pos.clone().add(new THREE.Vector3(Math.sin(t * 0.2) * 3.5, 8.5, Math.cos(t * 0.2) * 3.5));
    return { eye, look: p.pos.clone().setY(0.8) };
  },
  (p, t) => { // side dolly
    const fwd = new THREE.Vector3(Math.sin(p.heading + state.spinOffset), 0, Math.cos(p.heading + state.spinOffset));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const eye = p.pos.clone().add(side.multiplyScalar(5.2)).add(fwd.clone().multiplyScalar(t * 0.25 - 0.8));
    eye.y = 1.5;
    return { eye, look: p.pos.clone().setY(1.2) };
  },
];
let shotStart = 0;

// ---------------------------------------------------------------------------
const hudTrack = document.getElementById('track-name');
const hudBpm = document.getElementById('bpm');
const hudSection = document.getElementById('section');

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  const lv = audio.playing ? audio.levels() : { bass: 0, mid: 0, treble: 0, level: 0 };
  const beatF = audio.playing ? audio.beatTime() : 0;
  const beat = Math.floor(beatF);
  const beatPhase = beatF - beat;
  const bar = Math.floor(beatF / 4);
  const section = audio.playing ? sectionAt(bar) : 'intro';
  const plan = sectionPlan(section);

  if (beat !== state.lastBeat) {
    state.lastBeat = beat;
    state.beatFlash = 1;
  }
  state.beatFlash = Math.max(0, state.beatFlash - dt * 3.2);

  // --- drive the circuit ---
  state.speed += (plan.speed - state.speed) * Math.min(1, dt * 2.2);
  state.dist = (state.dist + state.speed * dt) % CIRCUIT_LEN;
  const pose = poseOnCircuit(state.dist);

  // pirouette: one full 360-degree turn across the 4-bar break, eased
  if (plan.pirouette) {
    // progress through the 4-bar break: bars completed plus the current bar fraction
    const barFrac = beatF / 4 - bar;
    const prog = THREE.MathUtils.clamp((((bar % 44) - breakStartBar(bar)) + barFrac) / 4, 0, 1);
    state.spinOffset = easeInOut(prog) * Math.PI * 2;
  } else {
    // decay any residual offset (2*pi wraps to 0)
    state.spinOffset = state.spinOffset % (Math.PI * 2);
    if (state.spinOffset > Math.PI) state.spinOffset -= Math.PI * 2;
    state.spinOffset *= Math.max(0, 1 - dt * 4);
  }

  lift.truck.position.copy(pose.pos);
  lift.truck.rotation.y = pose.heading + state.spinOffset;
  lift.spin(state.speed * dt + Math.abs(state.spinOffset) * 0.002);

  // steering: circuit curvature when driving, 90 degrees when pirouetting
  const steerTarget = plan.pirouette ? Math.PI / 2 : (state.speed > 0.2 ? -0.62 : 0);
  lift.rearSteer.rotation.y += (steerTarget - lift.rearSteer.rotation.y) * Math.min(1, dt * 3);
  lift.steeringWheel.rotation.z = -lift.rearSteer.rotation.y * 1.6;

  // --- forks: ramp toward plan, and pump a little on each beat in the drop ---
  let liftTarget = plan.lift;
  if (section === 'drop') {
    const eight = (beatF / 8) % 1;             // 8-beat lift/lower cycle
    liftTarget = 0.15 + 0.85 * (eight < 0.6 ? easeInOut(eight / 0.6) : easeInOut(1 - (eight - 0.6) / 0.4));
  }
  state.liftF += (liftTarget - state.liftF) * Math.min(1, dt * 2.8);
  lift.setLift(state.liftF);

  // mast tilt: back while driving, forward nod on the beat during grooves
  const tiltTarget = (section === 'groove1' || section === 'groove2')
    ? THREE.MathUtils.degToRad(-4 + 6 * Math.pow(1 - beatPhase, 3) * state.beatFlash)
    : THREE.MathUtils.degToRad(section === 'drop' ? 2 : -3);
  state.tilt += (tiltTarget - state.tilt) * Math.min(1, dt * 5);
  lift.setTilt(state.tilt);

  // --- bass-driven suspension squash + body bob ---
  state.bounce += (lv.bass - state.bounce) * Math.min(1, dt * 12);
  lift.body.position.y = -0.028 * state.bounce + 0.012 * Math.sin(t * 2.2);
  lift.body.scale.y = 1 - 0.035 * state.bounce;
  lift.body.rotation.z = 0.02 * Math.sin(t * 1.7) * (0.3 + lv.mid);

  // --- lights ---
  const pulse = state.beatFlash * state.beatFlash;
  tealLight.intensity = 16 * (0.35 + lv.mid * 1.4 + pulse * 0.8);
  amberLight.intensity = 12 * (0.3 + lv.bass * 1.6);
  for (const lm of lift.workLights) lm.emissiveIntensity = 0.5 + pulse * 2.6 + lv.treble * 2.2;
  safetyMat.opacity = 0.12 + 0.4 * pulse;
  headlight.intensity = 20 * (0.3 + lv.level * 0.9 + pulse * 0.4);
  bloom.strength = 0.4 + lv.level * 0.9 + pulse * 0.35;

  // --- camera: new shot every 2 bars, cut on the bar line ---
  if (bar !== state.lastShotBar && bar % 2 === 0) {
    state.lastShotBar = bar;
    state.shotIndex = (state.shotIndex + 1) % shots.length;
    shotStart = t;
  }
  const shot = shots[state.shotIndex](pose, t - shotStart);
  camera.position.lerp(shot.eye, Math.min(1, dt * 3.2));
  const look = shot.look.clone();
  camera.lookAt(look);
  camera.position.y = Math.max(0.4, camera.position.y);

  if (audio.playing) {
    hudSection.textContent = section;
    hudBpm.textContent = `${Math.round(audio.bpm)} BPM`;
  }
  composer.render();
}

// helper: bar where the current break section started (sections are 4-bar aligned)
function breakStartBar(bar) {
  const b = bar % 44;
  if (b >= 40) return 40;
  if (b >= 20 && b < 24) return 20;
  return b - (b % 4);
}

// ---------------------------------------------------------------------------
// UI: splash / play, drag-and-drop or file-pick a track
const splash = document.getElementById('splash');
const playBtn = document.getElementById('play');
const fileInput = document.getElementById('file');
const status = document.getElementById('status');

async function start(loader) {
  playBtn.disabled = true;
  status.textContent = 'loading audio…';
  try {
    await loader();
  } catch (e) {
    // fall back to the generated track (e.g. no ./track.mp3 in the repo yet)
    await audio.loadDemo();
  }
  audio.play();
  hudTrack.textContent = audio.title;
  hudBpm.textContent = `${Math.round(audio.bpm)} BPM`;
  splash.classList.add('hidden');
}

playBtn.addEventListener('click', () => start(async () => {
  // use ./track.mp3 if the user has committed one, otherwise the demo groove
  await audio.loadUrl('./track.mp3');
}));

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) start(() => audio.loadFile(fileInput.files[0]));
});

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && f.type.startsWith('audio')) {
    splash.classList.remove('hidden');
    start(() => audio.loadFile(f));
  }
});

frame();
