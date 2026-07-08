// Rule engine for the aquarium: a 3D, stochastic L-system.
//
// Growth is defined by a small text "rulebook" that anyone can edit. A rulebook
// has some parameters (angle, length, iterations, ...) plus production rules of
// the form  A -> BCD  that are applied repeatedly to an axiom string. The final
// string is then read by a 3D turtle to produce branch segments and polyps,
// each tagged with the growth "depth" at which it appears so the renderer can
// grow the structure outward from its base over time.
//
// Turtle alphabet
//   F   draw a segment forward (and advance)         f  advance without drawing
//   +/- turn left / right        (yaw, around up)
//   &/^ pitch down / up          (around left)
//   \// roll left / right        (around heading)
//   |   turn 180 degrees
//   [ ] push / pop turtle state
//   !   thin the branch          .  thicken the branch
//   '   advance the colour along the palette
//   L   place a polyp / leaf / frond at the tip
//
// This file has no dependency on three.js so the rule engine stays portable and
// easy to drive later from an external "brain".

import * as THREE from 'three';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Parsing a rulebook (plain text) into a config + productions.
export function parseRulebook(text) {
  const cfg = {
    axiom: 'F',
    angle: 25,          // degrees per turn
    length: 0.9,        // segment length (arbitrary units, scaled to fit tank)
    thickness: 0.16,    // base radius
    taper: 0.86,        // radius multiplier applied by '!'
    fatten: 1.15,       // radius multiplier applied by '.'
    iterations: 4,
    jitter: 0.12,       // random wobble added to every turn (organic look)
    gravity: 0.0,       // downward tropism per segment (>0 droops, <0 reaches up)
    leafSize: 0.5,      // polyp size relative to current thickness
    seed: 1,
    rules: {},          // predecessor -> [{ weight, successor }]
  };

  const numKeys = new Set([
    'angle', 'length', 'thickness', 'taper', 'fatten',
    'iterations', 'jitter', 'gravity', 'leafsize', 'seed',
  ]);

  for (let raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();     // strip comments
    if (!line) continue;

    // production: "A -> successor"  (optionally weighted: "A ->(0.3) succ")
    const prod = line.match(/^(\S+)\s*->\s*(?:\(([\d.]+)\)\s*)?(.*)$/);
    if (prod) {
      const pre = prod[1];
      const weight = prod[2] ? parseFloat(prod[2]) : 1;
      const succ = prod[3].trim();
      (cfg.rules[pre] ||= []).push({ weight, successor: succ });
      continue;
    }

    // config: "key = value" or "key: value"
    const kv = line.match(/^(\w+)\s*[:=]\s*(.+)$/);
    if (kv) {
      const key = kv[1].toLowerCase();
      const val = kv[2].trim();
      if (key === 'axiom') cfg.axiom = val;
      else if (numKeys.has(key)) {
        const n = parseFloat(val);
        if (!Number.isNaN(n)) cfg[key === 'leafsize' ? 'leafSize' : key] = n;
      }
    }
  }
  cfg.iterations = Math.max(0, Math.min(9, Math.round(cfg.iterations)));
  return cfg;
}

// ---------------------------------------------------------------------------
// A tiny seeded RNG so a given rulebook + seed always grows the same way.
function makeRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// ---------------------------------------------------------------------------
// Apply the production rules to the axiom `iterations` times.
export function expand(cfg) {
  const rng = makeRng(cfg.seed);
  let str = cfg.axiom;
  for (let i = 0; i < cfg.iterations; i++) {
    let out = '';
    for (const ch of str) {
      const options = cfg.rules[ch];
      if (!options) { out += ch; continue; }
      out += pickWeighted(options, rng()).successor;
    }
    str = out;
    if (str.length > 200000) break;   // guard against runaway rulebooks
  }
  return str;
}

function pickWeighted(options, r) {
  if (options.length === 1) return options[0];
  let total = 0;
  for (const o of options) total += o.weight;
  let acc = r * total;
  for (const o of options) { acc -= o.weight; if (acc <= 0) return o; }
  return options[options.length - 1];
}

// ---------------------------------------------------------------------------
// Read the expanded string with a 3D turtle. Returns arrays of segments and
// polyps, each carrying the growth depth at which it should appear.
export function interpret(str, cfg) {
  const rng = makeRng(cfg.seed * 2654435761 >>> 0 || 7);
  const angle = cfg.angle * DEG;

  const segments = [];   // { start, dir, length, radius, depth, hue }
  const polyps = [];     // { pos, radius, depth, hue }

  // turtle state
  let q = new THREE.Quaternion();               // orientation; heading = q * +Y
  let pos = new THREE.Vector3(0, 0, 0);
  let radius = cfg.thickness;
  let depth = 0;                                 // distance (in F's) from root
  let hue = 0;

  const H = new THREE.Vector3();                 // scratch heading vector
  const stack = [];
  const down = new THREE.Vector3(0, -1, 0);

  const localTurn = new THREE.Quaternion();
  const rot = (axis, a) => q.multiply(localTurn.setFromAxisAngle(axis, a));
  const AX_U = new THREE.Vector3(0, 0, 1);       // local up   -> yaw
  const AX_L = new THREE.Vector3(1, 0, 0);       // local left -> pitch
  const AX_H = new THREE.Vector3(0, 1, 0);       // local heading -> roll
  const jit = () => (rng() - 0.5) * 2 * cfg.jitter * angle;

  let maxDepth = 0;

  for (const ch of str) {
    switch (ch) {
      case 'F': {
        H.set(0, 1, 0).applyQuaternion(q);
        const start = pos.clone();
        pos = pos.clone().addScaledVector(H, cfg.length);
        segments.push({ start, dir: H.clone(), length: cfg.length, radius, depth, hue });
        depth += 1;
        if (depth > maxDepth) maxDepth = depth;
        // gravity/tropism gently bends the heading toward (or away from) down
        if (cfg.gravity !== 0) {
          const t = new THREE.Quaternion().setFromUnitVectors(H, down);
          q.slerp(new THREE.Quaternion().multiplyQuaternions(t, q), Math.min(0.5, Math.abs(cfg.gravity)) * Math.sign(cfg.gravity) * 0.5 + 0);
        }
        break;
      }
      case 'f': {
        H.set(0, 1, 0).applyQuaternion(q);
        pos = pos.clone().addScaledVector(H, cfg.length);
        break;
      }
      case '+': rot(AX_U,  angle + jit()); break;
      case '-': rot(AX_U, -angle + jit()); break;
      case '&': rot(AX_L,  angle + jit()); break;
      case '^': rot(AX_L, -angle + jit()); break;
      case '\\': rot(AX_H,  angle); break;
      case '/': rot(AX_H, -angle); break;
      case '|': rot(AX_U, Math.PI); break;
      case '!': radius *= cfg.taper; break;
      case '.': radius *= cfg.fatten; break;
      case '\'': hue += 1; break;
      case 'L':
        polyps.push({ pos: pos.clone(), radius: radius * cfg.leafSize * 3.2, depth, hue });
        break;
      case '[':
        stack.push({ q: q.clone(), pos: pos.clone(), radius, depth, hue });
        break;
      case ']': {
        const s = stack.pop();
        if (s) { q = s.q; pos = s.pos; radius = s.radius; depth = s.depth; hue = s.hue; }
        break;
      }
      default: break;
    }
  }

  return { segments, polyps, maxDepth: Math.max(1, maxDepth) };
}

// Convenience: rulebook text -> geometry data in one call.
export function grow(rulebookText) {
  const cfg = parseRulebook(rulebookText);
  const str = expand(cfg);
  const data = interpret(str, cfg);
  data.cfg = cfg;
  data.stringLength = str.length;
  return data;
}
