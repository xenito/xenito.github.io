// Audio engine: plays either a user-supplied track (./track.mp3 or drag-and-drop)
// or a built-in synthesized demo groove. Exposes per-frame band levels from an
// AnalyserNode plus a beat clock (BPM estimated by onset autocorrelation for
// user tracks; exact for the generated demo).

const DEMO_BPM = 112;
const DEMO_BARS = 44; // ~94 s

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.source = null;
    this.buffer = null;
    this.startedAt = 0;
    this.bpm = DEMO_BPM;
    this.beatOffset = 0; // seconds into the track where beat 0 lands
    this.isDemo = true;
    this.playing = false;
    this.title = 'built-in demo groove';
  }

  _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async loadUrl(url, title) {
    const ctx = this._ensureCtx();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
    const data = await res.arrayBuffer();
    this.buffer = await ctx.decodeAudioData(data);
    this.isDemo = false;
    this.title = title || url.split('/').pop();
    this._analyseBeats();
  }

  async loadFile(file) {
    const ctx = this._ensureCtx();
    const data = await file.arrayBuffer();
    this.buffer = await ctx.decodeAudioData(data);
    this.isDemo = false;
    this.title = file.name;
    this._analyseBeats();
  }

  async loadDemo() {
    this._ensureCtx();
    this.buffer = await renderDemoTrack();
    this.isDemo = true;
    this.bpm = DEMO_BPM;
    this.beatOffset = 0;
    this.title = 'built-in demo groove';
  }

  play() {
    const ctx = this._ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    this.stop();
    this.source = ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = true;
    this.source.connect(this.analyser);
    this.source.start();
    this.startedAt = ctx.currentTime;
    this.playing = true;
  }

  stop() {
    if (this.source) {
      try { this.source.stop(); } catch (_) { /* already stopped */ }
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
  }

  /** Seconds into the (looping) track. */
  time() {
    if (!this.playing) return 0;
    const t = this.ctx.currentTime - this.startedAt;
    return this.buffer ? t % this.buffer.duration : t;
  }

  /** Continuous beat counter (float) since track start; integer part = beat index. */
  beatTime() {
    return Math.max(0, (this.time() - this.beatOffset)) * (this.bpm / 60);
  }

  /** Per-frame band levels in 0..1: bass / mid / treble / overall. */
  levels() {
    if (!this.analyser) return { bass: 0, mid: 0, treble: 0, level: 0 };
    this.analyser.getByteFrequencyData(this.freq);
    const nyq = this.ctx.sampleRate / 2;
    const n = this.freq.length;
    const band = (lo, hi) => {
      const a = Math.max(0, Math.floor(lo / nyq * n));
      const b = Math.min(n - 1, Math.ceil(hi / nyq * n));
      let s = 0;
      for (let i = a; i <= b; i++) s += this.freq[i];
      return s / ((b - a + 1) * 255);
    };
    const bass = band(30, 130);
    const mid = band(300, 2000);
    const treble = band(4000, 12000);
    return { bass, mid, treble, level: (bass * 1.2 + mid + treble * 0.8) / 3 };
  }

  // -- offline beat analysis for user tracks ---------------------------------
  _analyseBeats() {
    const buf = this.buffer;
    const sr = buf.sampleRate;
    const ch = buf.getChannelData(0);
    const hop = 512;
    const frames = Math.floor(ch.length / hop);
    // onset envelope: positive energy flux between hops
    const env = new Float32Array(frames);
    let prev = 0;
    for (let f = 0; f < frames; f++) {
      let e = 0;
      const base = f * hop;
      for (let i = 0; i < hop; i++) { const v = ch[base + i]; e += v * v; }
      env[f] = Math.max(0, e - prev);
      prev = e;
    }
    // coarse autocorrelation over 60-180 BPM lags
    const fps = sr / hop;
    let bestBpm = 120, bestScore = -1;
    for (let bpm = 60; bpm <= 180; bpm += 0.5) {
      const lag = Math.round(fps * 60 / bpm);
      if (lag < 2 || lag * 2 >= frames) continue;
      let s = 0;
      for (let f = 0; f + lag < frames; f++) s += env[f] * env[f + lag];
      s /= (frames - lag);
      if (s > bestScore) { bestScore = s; bestBpm = bpm; }
    }
    // joint fine refinement of tempo and phase: score each (bpm, offset) pair
    // by summing the envelope in a small window around every predicted beat.
    // The coarse 0.5 BPM grid alone lets the beat grid drift over a long track,
    // which smears the phase estimate.
    const win = 2; // frames each side (~±23 ms)
    const envAt = (f) => {
      const c = Math.round(f);
      let m = 0;
      for (let i = Math.max(0, c - win); i <= Math.min(frames - 1, c + win); i++) m = Math.max(m, env[i]);
      return m;
    };
    let fineBpm = bestBpm, fineOff = 0, fineScore = -1;
    for (let bpm = bestBpm - 1; bpm <= bestBpm + 1; bpm += 0.05) {
      const lag = fps * 60 / bpm;
      for (let o = 0; o < lag; o += lag / 24) {
        let s = 0, n = 0;
        for (let f = o; f < frames; f += lag) { s += envAt(f); n++; }
        s /= n;
        if (s > fineScore) { fineScore = s; fineBpm = bpm; fineOff = o; }
      }
    }
    this.bpm = fineBpm;
    this.beatOffset = fineOff / fps;
  }
}

// ---- synthesized demo track -------------------------------------------------
// A warehouse-friendly electro groove rendered once into a buffer with
// OfflineAudioContext: kick, snare/clap, hats, sub bass line, and a minor-key
// chord pad. Entirely code-generated, so there are no licensing concerns.

async function renderDemoTrack() {
  const sr = 44100;
  const spb = 60 / DEMO_BPM;                 // seconds per beat
  const dur = DEMO_BARS * 4 * spb;
  const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);

  const master = off.createGain();
  master.gain.value = 0.8;
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(off.destination);

  const noiseBuf = makeNoise(off, 1.0);

  const kick = (t) => {
    const o = off.createOscillator();
    const g = off.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.26);
  };
  const clap = (t) => {
    const s = off.createBufferSource();
    s.buffer = noiseBuf;
    const f = off.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.9;
    const g = off.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(f).connect(g).connect(master);
    s.start(t); s.stop(t + 0.2);
  };
  const hat = (t, open) => {
    const s = off.createBufferSource();
    s.buffer = noiseBuf;
    const f = off.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7500;
    const g = off.createGain();
    const d = open ? 0.22 : 0.05;
    g.gain.setValueAtTime(open ? 0.22 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f).connect(g).connect(master);
    s.start(t); s.stop(t + d + 0.02);
  };
  const bassNote = (t, freq, len) => {
    const o = off.createOscillator();
    o.type = 'sawtooth';
    const f = off.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + len);
    const g = off.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.34, t);
    g.gain.setValueAtTime(0.34, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f).connect(g).connect(master);
    o.start(t); o.stop(t + len + 0.02);
  };
  const pad = (t, freqs, len) => {
    for (const fq of freqs) {
      const o = off.createOscillator();
      o.type = 'triangle';
      o.frequency.value = fq;
      o.detune.value = (Math.random() - 0.5) * 10;
      const g = off.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + len * 0.3);
      g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + len + 0.02);
    }
  };
  const lead = (t, freq, len) => {
    const o = off.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = off.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2500;
    const g = off.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f).connect(g).connect(master);
    o.start(t); o.stop(t + len + 0.02);
  };

  // A minor: A1=55, C2=65.4, D2=73.4, E2=82.4, G2=98
  const bassLines = [
    [55, 55, 98, 55, 65.4, 55, 73.4, 82.4],
    [55, 55, 98, 55, 65.4, 65.4, 110, 98],
  ];
  const chords = [
    [220, 261.6, 329.6],       // Am
    [174.6, 220, 261.6],       // F
    [196, 246.9, 293.7],       // G
    [164.8, 220, 246.9],       // E-ish
  ];
  const leadScale = [440, 523.25, 587.33, 659.25, 783.99, 880];

  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  for (let bar = 0; bar < DEMO_BARS; bar++) {
    const t0 = bar * 4 * spb;
    const section = sectionAt(bar);
    // drums
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * spb;
      if (section !== 'break') kick(t);
      if (section === 'drop' && b === 3 && bar % 4 === 3) kick(t + spb * 0.5); // fill
      if (b === 1 || b === 3) clap(t);
      hat(t + spb * 0.5, false);
      if (section === 'drop' || section === 'groove2') {
        hat(t + spb * 0.25, false);
        hat(t + spb * 0.75, b === 3);
      }
    }
    // bass: eighth notes
    if (section !== 'intro') {
      const line = bassLines[bar % 2];
      for (let i = 0; i < 8; i++) {
        if (section === 'break' && i % 2 === 1) continue;
        bassNote(t0 + i * spb * 0.5, line[i], spb * 0.46);
      }
    }
    // pads: one chord per bar
    pad(t0, chords[bar % 4], 4 * spb);
    // sparse lead in drop sections
    if (section === 'drop') {
      for (let i = 0; i < 4; i++) {
        if (rnd() < 0.55) lead(t0 + i * spb + spb * (rnd() < 0.5 ? 0 : 0.5), leadScale[Math.floor(rnd() * leadScale.length)], spb * 0.4);
      }
    }
  }

  return off.startRendering();
}

// Section map for the demo track, by bar index. Used by the choreography too.
export function sectionAt(bar) {
  const b = bar % DEMO_BARS;
  if (b < 4) return 'intro';
  if (b < 12) return 'groove1';
  if (b < 20) return 'drop';
  if (b < 24) return 'break';
  if (b < 32) return 'groove2';
  if (b < 40) return 'drop';
  return 'break';
}

function makeNoise(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
