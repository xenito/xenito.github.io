// Procedural 3D model of a Mitsubishi EDiA EM FB20N2T 3-wheel electric forklift.
// Built to the published spec sheet (units: metres):
//   overall width 1.140, wheelbase 1.428, overall length 3.119,
//   mast lowered 2.125, lift height 3.290, overhead guard 2.050,
//   forks 0.035 x 0.100 x 1.150, front tyres 200/50-10, rear 140/55-9.
// Origin: ground level under the front (drive) axle. +Z points toward the forks.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TEAL = 0x14b18b;
const BLACK_PAINT = 0x181a1d;
const DARK_METAL = 0x26292d;
const TYRE = 0x0c0d0e;
const SILVER = 0xc6cbd1;

function materials() {
  return {
    teal: new THREE.MeshStandardMaterial({ color: TEAL, metalness: 0.35, roughness: 0.32 }),
    black: new THREE.MeshStandardMaterial({ color: BLACK_PAINT, metalness: 0.45, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: DARK_METAL, metalness: 0.5, roughness: 0.55 }),
    tyre: new THREE.MeshStandardMaterial({ color: TYRE, metalness: 0.0, roughness: 0.95 }),
    silver: new THREE.MeshStandardMaterial({ color: SILVER, metalness: 0.9, roughness: 0.25 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0.1, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0e1013, metalness: 0.2, roughness: 0.2 }),
  };
}

function badgeTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  // dark badge plate
  g.fillStyle = 'rgba(16,18,20,0.92)';
  roundRect(g, 24, 78, 464, 100, 22); g.fill();
  g.fillStyle = '#eef2f4';
  g.font = 'italic bold 64px Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('EDiA', 60, 128);
  g.fillStyle = TEAL_CSS();
  roundRect(g, 330, 88, 130, 80, 14); g.fill();
  g.fillStyle = '#08110e';
  g.font = 'bold 58px Arial, sans-serif';
  g.fillText('20', 362, 130);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function TEAL_CSS() { return '#' + TEAL.toString(16).padStart(6, '0'); }

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Three-diamond mark, built from geometry (three rhombi in the classic layout).
function tripleDiamond(mat, size) {
  const g = new THREE.Group();
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, s); shape.lineTo(s * 0.5, s * 0.5); shape.lineTo(0, 0); shape.lineTo(-s * 0.5, s * 0.5); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const top = new THREE.Mesh(geo, mat);
  const left = new THREE.Mesh(geo, mat);
  const right = new THREE.Mesh(geo, mat);
  left.rotation.z = (2 * Math.PI) / 3;
  right.rotation.z = -(2 * Math.PI) / 3;
  g.add(top, left, right);
  return g;
}

function makeWheel(mats, radius, width, boltCircle = true) {
  const w = new THREE.Group();
  const tyreGeo = new THREE.CylinderGeometry(radius, radius, width, 28, 1);
  tyreGeo.rotateZ(Math.PI / 2);
  const tyre = new THREE.Mesh(tyreGeo, mats.tyre);
  tyre.castShadow = true;
  w.add(tyre);
  // tread grooves: shallow tori
  const grooveGeo = new THREE.TorusGeometry(radius * 0.98, radius * 0.035, 6, 28);
  grooveGeo.rotateY(Math.PI / 2);
  for (const off of [-width * 0.28, 0, width * 0.28]) {
    const groove = new THREE.Mesh(grooveGeo, mats.dark);
    groove.position.x = off;
    w.add(groove);
  }
  const rimGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width * 1.02, 22);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, mats.dark);
  w.add(rim);
  const hubGeo = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width * 1.1, 14);
  hubGeo.rotateZ(Math.PI / 2);
  w.add(new THREE.Mesh(hubGeo, mats.black));
  if (boltCircle) {
    const boltGeo = new THREE.CylinderGeometry(radius * 0.055, radius * 0.055, width * 1.08, 8);
    boltGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(boltGeo, mats.silver);
      b.position.set(0, Math.cos(a) * radius * 0.36, Math.sin(a) * radius * 0.36);
      w.add(b);
    }
  }
  return w;
}

function makeFork(mats) {
  // Side profile (z = forward, y = up), extruded across x by the fork width.
  const t = 0.035;   // blade thickness
  const blade = 1.15;
  const shankH = 0.62;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(blade - 0.09, 0);
  s.lineTo(blade, t * 0.45);      // tapered tip
  s.lineTo(blade - 0.09, t);
  s.lineTo(t, t);
  s.lineTo(t, shankH);
  s.lineTo(0, shankH);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false });
  // shape was drawn in (z, y); remap so extrusion depth becomes x
  geo.rotateY(-Math.PI / 2);
  geo.translate(0.05, 0, 0);
  const fork = new THREE.Mesh(geo, mats.black);
  fork.castShadow = true;
  return fork;
}

function pillar(mats, x0, y0, z0, x1, y1, z1, r = 0.034) {
  const a = new THREE.Vector3(x0, y0, z0);
  const b = new THREE.Vector3(x1, y1, z1);
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r, r, len, 12);
  const m = new THREE.Mesh(geo, mats.black);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

export function buildForklift() {
  const mats = materials();
  const truck = new THREE.Group();
  truck.name = 'forklift';

  const parts = {
    truck,
    body: null, mastTilt: null, mastInner: null, carriage: null,
    wheelFL: null, wheelFR: null, rearSteer: null, rearWheels: [],
    workLights: [], steeringWheel: null,
    mats,
  };

  // ---- body group (squashes on bass; wheels stay put) -----------------------
  const body = new THREE.Group();
  truck.add(body);
  parts.body = body;

  // chassis skirt between the axles
  const skirt = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.34, 2.0, 3, 0.05), mats.black);
  skirt.position.set(0, 0.34, -0.62);
  skirt.castShadow = true;
  body.add(skirt);

  // front cowl / dash tower (holds steering column, front guard pillars)
  const cowl = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.62, 0.42, 3, 0.06), mats.black);
  cowl.position.set(0, 0.64, 0.1);
  cowl.castShadow = true;
  body.add(cowl);
  const dashTop = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.1, 0.3, 3, 0.04), mats.dark);
  dashTop.position.set(0, 0.98, 0.06);
  dashTop.rotation.x = -0.25;
  body.add(dashTop);
  // full-colour display
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.02), mats.glass);
  display.position.set(0.2, 1.04, -0.02);
  display.rotation.x = -0.35;
  body.add(display);

  // operator floor plate
  const floorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.75), mats.dark);
  floorPlate.position.set(0, 0.45, -0.42);
  body.add(floorPlate);

  // teal battery side pods with EDiA badge
  const badge = badgeTexture();
  const badgeMat = new THREE.MeshStandardMaterial({ map: badge, transparent: true, metalness: 0.2, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.62, 1.12, 4, 0.07), mats.teal);
    pod.position.set(side * 0.48, 0.62, -0.66);
    pod.castShadow = true;
    body.add(pod);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), badgeMat);
    plate.position.set(side * 0.565, 0.66, -0.62);
    plate.rotation.y = side * Math.PI / 2;
    body.add(plate);
    // black fender arch above the front wheel
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.27, 0.22, 18, 1, true, -Math.PI * 0.1, Math.PI * 1.2),
      new THREE.MeshStandardMaterial({ color: BLACK_PAINT, metalness: 0.45, roughness: 0.45, side: THREE.DoubleSide }));
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(side * 0.47, 0.23, 0);
    body.add(arch);
  }

  // counterweight: teal wrap + black cap, rounded rear
  const cwTeal = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.56, 0.78, 4, 0.12), mats.teal);
  cwTeal.position.set(0, 0.55, -1.22);
  cwTeal.castShadow = true;
  body.add(cwTeal);
  const cwBlack = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.34, 0.7, 4, 0.1), mats.black);
  cwBlack.position.set(0, 0.96, -1.2);
  cwBlack.castShadow = true;
  body.add(cwBlack);
  const cwSkirt = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.3, 0.62, 3, 0.08), mats.black);
  cwSkirt.position.set(0, 0.22, -1.24);
  body.add(cwSkirt);
  // rear vents
  for (let i = 0; i < 3; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.03), mats.dark);
    vent.position.set(-0.2, 0.9 + i * 0.06, -1.565);
    body.add(vent);
  }
  // Mitsubishi three-diamond on the rear
  const rearMark = tripleDiamond(mats.silver, 0.085);
  rearMark.position.set(0.28, 0.98, -1.562);
  rearMark.rotation.y = Math.PI;
  body.add(rearMark);

  // seat on pedestal
  const pedestal = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.3, 0.5, 3, 0.05), mats.black);
  pedestal.position.set(0, 0.78, -0.82);
  body.add(pedestal);
  const seatBase = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.1, 0.45, 3, 0.04), mats.seat);
  seatBase.position.set(0, 0.99, -0.8);
  body.add(seatBase);
  const seatBack = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.58, 0.11, 3, 0.05), mats.seat);
  seatBack.position.set(0, 1.28, -1.02);
  seatBack.rotation.x = 0.12;
  seatBack.castShadow = true;
  body.add(seatBack);
  // floating armrest with fingertip controls (right side)
  const armrest = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.06, 0.45, 3, 0.03), mats.black);
  armrest.position.set(0.32, 1.06, -0.78);
  body.add(armrest);
  const joy = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.09, 8), mats.dark);
  joy.position.set(0.32, 1.12, -0.62);
  body.add(joy);

  // steering column + wheel
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 10), mats.black);
  column.position.set(0, 1.12, -0.06);
  column.rotation.x = 0.6;
  body.add(column);
  const sw = new THREE.Group();
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 24), mats.seat);
  sw.add(rimT);
  const spokeGeo = new THREE.BoxGeometry(0.24, 0.02, 0.015);
  const sp1 = new THREE.Mesh(spokeGeo, mats.dark); sw.add(sp1);
  const sp2 = new THREE.Mesh(spokeGeo, mats.dark); sp2.rotation.z = Math.PI / 2; sw.add(sp2);
  sw.position.set(0, 1.3, -0.16);
  sw.rotation.x = -0.97;
  body.add(sw);
  parts.steeringWheel = sw;

  // ---- overhead guard (h6 = 2.05 m) ----------------------------------------
  const ohg = new THREE.Group();
  body.add(ohg);
  // front pillars lean back slightly; rear pillars rise from the counterweight
  ohg.add(pillar(mats, 0.49, 0.9, 0.26, 0.47, 2.02, 0.1));
  ohg.add(pillar(mats, -0.49, 0.9, 0.26, -0.47, 2.02, 0.1));
  ohg.add(pillar(mats, 0.5, 1.1, -1.18, 0.47, 2.02, -0.98));
  ohg.add(pillar(mats, -0.5, 1.1, -1.18, -0.47, 2.02, -0.98));
  // long entry handle on the right front pillar
  ohg.add(pillar(mats, 0.545, 1.2, 0.22, 0.53, 1.75, 0.14, 0.016));

  // roof frame + longitudinal slats (the rack look from the press shots)
  const railGeo = new RoundedBoxGeometry(0.07, 0.06, 1.35, 2, 0.02);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, mats.black);
    rail.position.set(side * 0.5, 2.06, -0.44);
    rail.castShadow = true;
    ohg.add(rail);
  }
  const crossGeo = new RoundedBoxGeometry(1.06, 0.055, 0.07, 2, 0.02);
  for (const z of [0.2, -1.08]) {
    const bar = new THREE.Mesh(crossGeo, mats.black);
    bar.position.set(0, 2.06, z);
    ohg.add(bar);
  }
  for (let i = 0; i < 5; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 1.24), mats.dark);
    slat.position.set(-0.36 + i * 0.18, 2.075, -0.44);
    slat.castShadow = true;
    ohg.add(slat);
  }
  // teal roof fascia, front and rear (signature EDiA accents)
  const fasciaF = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.075, 0.3, 3, 0.03), mats.teal);
  fasciaF.position.set(0, 2.05, 0.28);
  fasciaF.rotation.x = 0.12;
  ohg.add(fasciaF);
  const fasciaR = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.07, 0.24, 3, 0.03), mats.teal);
  fasciaR.position.set(0, 2.05, -1.16);
  fasciaR.rotation.x = -0.1;
  ohg.add(fasciaR);

  // LED work lights (front pillar pair + rear pair) — beat reactive
  const lightMatProto = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d8, emissiveIntensity: 0.6 });
  for (const [x, y, z, ry] of [[0.5, 1.86, 0.16, 0.3], [-0.5, 1.86, 0.16, -0.3], [0.5, 1.9, -1.06, Math.PI - 0.3], [-0.5, 1.9, -1.06, Math.PI + 0.3]]) {
    const lm = lightMatProto.clone();
    const lamp = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.06, 0.05, 2, 0.015), lm);
    lamp.position.set(x, y, z);
    lamp.rotation.y = ry;
    ohg.add(lamp);
    parts.workLights.push(lm);
  }

  // ---- wheels ---------------------------------------------------------------
  // front drive wheels: 200/50-10 => dia ~0.454 m, width 0.20 m, track 0.938 m
  const RF = 0.227;
  parts.wheelFL = makeWheel(mats, RF, 0.2);
  parts.wheelFL.position.set(-0.469, RF, 0);
  parts.wheelFR = makeWheel(mats, RF, 0.2);
  parts.wheelFR.position.set(0.469, RF, 0);
  truck.add(parts.wheelFL, parts.wheelFR);

  // rear: single steering unit with twin 140/55-9 wheels (dia ~0.38 m), 360-degree capable
  const RR = 0.19;
  const rearSteer = new THREE.Group();
  rearSteer.position.set(0, RR, -1.428);
  const fork1 = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.16, 0.3, 2, 0.04), mats.black);
  fork1.position.y = RR * 0.75;
  rearSteer.add(fork1);
  for (const side of [-1, 1]) {
    const rw = makeWheel(mats, RR, 0.14, false);
    rw.position.set(side * 0.1, 0, 0);
    rearSteer.add(rw);
    parts.rearWheels.push(rw);
  }
  truck.add(rearSteer);
  parts.rearSteer = rearSteer;

  // ---- mast (tilts a/b = 5/7.5 deg), duplex with inner stage + carriage -----
  const mastTilt = new THREE.Group();
  mastTilt.position.set(0, 0.24, 0.3); // pivot near the drive axle
  truck.add(mastTilt);
  parts.mastTilt = mastTilt;

  const H_OUT = 2.0; // outer channel height => top ~2.125 over ground (h1)
  const railOutGeo = new THREE.BoxGeometry(0.075, H_OUT, 0.14);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railOutGeo, mats.black);
    rail.position.set(side * 0.36, H_OUT / 2 - 0.1, 0);
    rail.castShadow = true;
    mastTilt.add(rail);
  }
  for (const y of [0.28, 1.15, 1.82]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.05), mats.black);
    brace.position.set(0, y, -0.085);
    mastTilt.add(brace);
  }
  // tilt cylinders from chassis to mast (visual)
  for (const side of [-1, 1]) {
    const tc = pillar(mats, side * 0.42, 0.28, -0.62, side * 0.38, 0.62, -0.06, 0.032);
    body.add(tc);
  }

  // inner stage
  const mastInner = new THREE.Group();
  mastTilt.add(mastInner);
  parts.mastInner = mastInner;
  const H_IN = 1.9;
  const railInGeo = new THREE.BoxGeometry(0.06, H_IN, 0.1);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railInGeo, mats.dark);
    rail.position.set(side * 0.27, H_IN / 2 - 0.08, 0.02);
    rail.castShadow = true;
    mastInner.add(rail);
  }
  const innerTop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.05), mats.dark);
  innerTop.position.set(0, H_IN - 0.12, 0.02);
  mastInner.add(innerTop);
  // free-lift cylinder (centre, the EDiA high-visibility layout)
  const flCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.5, 12), mats.dark);
  flCyl.position.set(0, 0.68, 0.06);
  mastInner.add(flCyl);
  const flRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 10), mats.silver);
  flRod.position.set(0, 1.75, 0.06);
  mastInner.add(flRod);
  // hoses over the crossbar (high-durability hoses in the spec)
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const pts = [
      new THREE.Vector3(side * 0.1, 0.3, 0.12),
      new THREE.Vector3(side * 0.16, 1.2, 0.1),
      new THREE.Vector3(side * 0.12, 1.7, 0.14),
      new THREE.Vector3(side * 0.08, 1.2, 0.2),
    ];
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.014, 6), hoseMat);
    mastInner.add(tube);
  }
  // lift chains
  for (const side of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.024, 1.55, 0.008), mats.dark);
    chain.position.set(side * 0.09, 0.85, 0.17);
    mastInner.add(chain);
  }

  // carriage + forks (carriage width b3 = 0.92 m)
  const carriage = new THREE.Group();
  mastInner.add(carriage);
  parts.carriage = carriage;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.09, 0.045), mats.black);
  plate.position.set(0, 0.5, 0.22);
  carriage.add(plate);
  const plate2 = plate.clone();
  plate2.position.y = 0.16;
  carriage.add(plate2);
  for (const side of [-1, 1]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.05), mats.black);
    upright.position.set(side * 0.4, 0.33, 0.22);
    carriage.add(upright);
    const fork = makeFork(mats);
    // blade underside sits ~0.05 m over ground with mast lowered
    fork.position.set(side * 0.2, -0.19, 0.25);
    carriage.add(fork);
  }

  // ---- kinematics helpers ----------------------------------------------------
  const LIFT_TOTAL = 3.29; // h3
  parts.setLift = (f) => {
    const L = THREE.MathUtils.clamp(f, 0, 1);
    mastInner.position.y = 1.45 * L;
    carriage.position.y = LIFT_TOTAL * L - 1.45 * L; // remaining travel on the carriage
  };
  parts.setTilt = (rad) => { // + tilts forward (spec: 5 fwd / 7.5 back)
    mastTilt.rotation.x = THREE.MathUtils.clamp(rad, -THREE.MathUtils.degToRad(7.5), THREE.MathUtils.degToRad(5));
  };
  parts.setSteer = (rad) => { rearSteer.rotation.y = rad; };
  parts.spin = (deltaDist) => {
    const a = deltaDist / RF;
    parts.wheelFL.rotation.x += a;
    parts.wheelFR.rotation.x += a;
    for (const rw of parts.rearWheels) rw.rotation.x += deltaDist / RR;
  };
  parts.setLift(0);
  return parts;
}
