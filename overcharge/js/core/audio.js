// Web Audio engine: sampled gunshots + procedurally synthesised effects and music.
// Positional sounds use distance attenuation + stereo panning relative to the camera.

const FILES = {
  ar: 'assault_rifle_shot', shotgun: 'shotgun_shot', smg: 'blaster_shot',
  reload: 'reload', pump: 'shotgun_shot_reload', step1: 'step1', step2: 'step2',
  impact1: 'impact1', impact2: 'impact2', impact3: 'impact3', ammo: 'ammo',
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.master = null; this.sfxBus = null; this.musicBus = null;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.vol = { master: 0.8, sfx: 1, music: 0.5 };
    this.loops = {};
    this.lowpass = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.lowpass = this.ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass'; this.lowpass.frequency.value = 20000;
    this.master.connect(this.lowpass); this.lowpass.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
    this.applyVolumes();
    this.synthAll();
  }

  unlock() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfxBus.gain.value = this.vol.sfx;
    this.musicBus.gain.value = this.vol.music * 0.55;
  }

  async loadAll(base, onProgress) {
    this.init();
    const names = Object.keys(FILES);
    let done = 0;
    await Promise.all(names.map(async n => {
      try {
        const res = await fetch(`${base}/${FILES[n]}.mp3`);
        const ab = await res.arrayBuffer();
        this.buffers[n] = await new Promise((ok, fail) => this.ctx.decodeAudioData(ab, ok, fail));
      } catch (e) { console.warn('audio load failed', n, e); }
      done++; onProgress && onProgress(done / names.length);
    }));
  }

  setListener(x, y, z, yaw) { const l = this.listener; l.x = x; l.y = y; l.z = z; l.yaw = yaw; }

  /** Muffle everything (storm, menus). */
  setMuffle(amount) {
    if (!this.ctx) return;
    const f = 20000 * Math.pow(1 - amount, 3) + 600;
    this.lowpass.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.15);
  }

  /**
   * Play a sound. opts: {pos:{x,y,z}, vol, rate, range, detune}
   */
  play(name, opts = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    const buf = this.buffers[name];
    if (!buf) return null;
    let gain = opts.vol ?? 1;
    let pan = 0;
    if (opts.pos) {
      const l = this.listener;
      const dx = opts.pos.x - l.x, dy = opts.pos.y - l.y, dz = opts.pos.z - l.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const range = opts.range ?? 90;
      if (d > range) return null;
      const near = opts.near ?? 4;
      gain *= d < near ? 1 : Math.pow(1 - (d - near) / (range - near), 1.6);
      // camera-relative right vector: yaw rotates around Y, forward = (-sin, -cos)
      const rx = Math.cos(this.listener.yaw), rz = -Math.sin(this.listener.yaw);
      if (d > 0.5) pan = Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.85;
    }
    if (gain < 0.01) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() - 0.5) * (opts.jitter ?? 0.06));
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g);
    if (ctx.createStereoPanner && pan !== 0) {
      const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(opts.music ? this.musicBus : this.sfxBus);
    } else g.connect(opts.music ? this.musicBus : this.sfxBus);
    src.start();
    return src;
  }

  loop(name, vol = 1, music = false) {
    if (!this.ctx || this.loops[name]) return;
    const buf = this.buffers[name]; if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = LOOP_STARTS[name] || 0; src.loopEnd = buf.duration;
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.4);
    src.connect(g); g.connect(music ? this.musicBus : this.sfxBus);
    src.start();
    this.loops[name] = { src, g };
  }
  loopVolume(name, vol) {
    const l = this.loops[name]; if (!l || !this.ctx) return;
    l.g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2);
  }
  stopLoop(name) {
    const l = this.loops[name]; if (!l || !this.ctx) return;
    l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    const s = l.src; setTimeout(() => { try { s.stop(); } catch { /* already stopped */ } }, 1200);
    delete this.loops[name];
  }
  stopAllLoops() { Object.keys(this.loops).forEach(n => this.stopLoop(n)); }

  // ---------- procedural synthesis ----------
  synthAll() {
    const sr = this.ctx.sampleRate;
    const mk = (dur, fn, ch = 1) => {
      const len = Math.max(1, Math.floor(dur * sr));
      const b = this.ctx.createBuffer(ch, len, sr);
      for (let c = 0; c < ch; c++) fn(b.getChannelData(c), sr, len, c);
      return b;
    };
    const rnd = () => Math.random() * 2 - 1;

    this.buffers.explosion = mk(1.6, (d, sr, n) => {
      let lp = 0, lp2 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        lp += (rnd() - lp) * 0.08; lp2 += (lp - lp2) * 0.2;
        const env = Math.exp(-t * 3.2);
        const thump = Math.sin(2 * Math.PI * (55 * t - 18 * t * t)) * Math.exp(-t * 6);
        d[i] = (lp2 * 2.6 * env + thump * 0.9) * (t < 0.004 ? t / 0.004 : 1);
      }
    });
    this.buffers.shock = mk(1.4, (d, sr, n) => {
      let lp = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const cut = 0.02 + 0.25 * Math.exp(-t * 4);
        lp += (rnd() - lp) * cut;
        ph += 2 * Math.PI * (90 + 260 * Math.exp(-t * 5)) / sr;
        const boom = Math.sin(ph) * Math.exp(-t * 4.5);
        d[i] = (lp * 1.8 * Math.exp(-t * 2.5) + boom * 0.8) * Math.min(1, t / 0.005);
      }
    });
    this.buffers.zap = mk(0.9, (d, sr, n) => {
      let ph = 0, f = 300;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        if (i % 300 === 0) f = 180 + Math.random() * 900;
        ph += f / sr;
        const saw = (ph % 1) * 2 - 1;
        const crackle = Math.random() < 0.02 ? rnd() * 2 : 0;
        d[i] = (saw * 0.45 + crackle + rnd() * 0.15) * Math.exp(-t * 3.5) * Math.min(1, t / 0.003);
      }
    });
    this.buffers.sniper = mk(1.2, (d, sr, n) => {
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        lp += (rnd() - lp) * (0.5 * Math.exp(-t * 10) + 0.05);
        const crack = rnd() * Math.exp(-t * 60);
        const body = Math.sin(2 * Math.PI * (120 - 60 * t) * t) * Math.exp(-t * 9);
        d[i] = (crack * 1.4 + lp * 1.3 * Math.exp(-t * 2.8) + body * 0.7) * 0.9;
      }
    });
    this.buffers.hit = mk(0.06, (d, sr, n) => {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 70) * 0.6; }
    });
    this.buffers.headshot = mk(0.35, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = (Math.sin(2 * Math.PI * 1900 * t) + 0.7 * Math.sin(2 * Math.PI * 2850 * t)) * Math.exp(-t * 14) * 0.45;
      }
    });
    this.buffers.shieldhit = mk(0.12, (d, sr, n) => {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * 1500 * t) * 0.5 + rnd() * 0.25) * Math.exp(-t * 40) * 0.5; }
    });
    this.buffers.shieldbreak = mk(0.7, (d, sr, n) => {
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; ph += (2400 - 1800 * t) / sr;
        d[i] = (Math.sin(2 * Math.PI * ph) * 0.4 + rnd() * 0.3 * Math.exp(-t * 20)) * Math.exp(-t * 5);
      }
    });
    this.buffers.elim = mk(0.9, (d, sr, n) => {
      const notes = [880, 1108.7, 1318.5, 1760];
      for (let i = 0; i < n; i++) {
        const t = i / sr; let s = 0;
        notes.forEach((f, k) => { const st = k * 0.07; if (t > st) s += Math.sin(2 * Math.PI * f * (t - st)) * Math.exp(-(t - st) * 5) * 0.3; });
        d[i] = s;
      }
    });
    this.buffers.click = mk(0.05, (d, sr, n) => {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 90) * 0.5; }
    });
    this.buffers.uiopen = mk(0.25, (d, sr, n) => {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (500 + 1600 * t) * t) * Math.exp(-t * 14) * 0.4; }
    });
    this.buffers.chest = mk(1.1, (d, sr, n) => {
      const notes = [659.3, 783.99, 987.8, 1318.5, 1568];
      for (let i = 0; i < n; i++) {
        const t = i / sr; let s = 0;
        notes.forEach((f, k) => { const st = k * 0.06; if (t > st) s += Math.sin(2 * Math.PI * f * (t - st)) * Math.exp(-(t - st) * 4) * 0.22; });
        d[i] = s + rnd() * 0.05 * Math.exp(-t * 8);
      }
    });
    this.buffers.chesthum = mk(2.0, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = (Math.sin(2 * Math.PI * 440 * t) * 0.15 + Math.sin(2 * Math.PI * 660 * t) * 0.1) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 2 * t));
      }
    });
    this.buffers.pickup = mk(0.18, (d, sr, n) => {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (700 + 900 * t / 0.18) * t) * Math.exp(-t * 18) * 0.4; }
    });
    this.buffers.equip = mk(0.16, (d, sr, n) => {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * 0.3; d[i] = (lp * 0.8 + (t > 0.08 && t < 0.1 ? rnd() * 0.8 : 0)) * Math.exp(-t * 18); }
    });
    this.buffers.swing = mk(0.3, (d, sr, n) => {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; const c = 0.05 + 0.4 * Math.sin(Math.PI * t / 0.3); lp += (rnd() - lp) * c; d[i] = lp * Math.sin(Math.PI * t / 0.3) * 0.9; }
    });
    this.buffers.throw = this.buffers.swing;
    this.buffers.bounce = mk(0.08, (d, sr, n) => {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * 420 * t) + rnd() * 0.4) * Math.exp(-t * 60) * 0.5; }
    });
    this.buffers.land = mk(0.2, (d, sr, n) => {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * 0.12; d[i] = lp * 2.2 * Math.exp(-t * 22); }
    });
    this.buffers.deploy = mk(0.5, (d, sr, n) => {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * 0.25; d[i] = lp * Math.exp(-t * 7) * (1 - Math.exp(-t * 60)); }
    });
    // Loops
    this.buffers.storm = mk(3.0, (d, sr, n) => {
      let b = 0, lp = 0;
      for (let i = 0; i < n; i++) {
        b = (b + rnd() * 0.02) * 0.998; lp += (rnd() - lp) * 0.02;
        const t = i / sr;
        d[i] = (b * 3 + lp * 0.6) * (0.7 + 0.3 * Math.sin(2 * Math.PI * t / 1.5)) + Math.sin(2 * Math.PI * 48 * t) * 0.08;
      }
      fadeLoop(d, sr);
    });
    this.buffers.wind = mk(3.0, (d, sr, n) => {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (0.05 + 0.03 * Math.sin(2 * Math.PI * t / 3)); d[i] = lp * 1.6; }
      fadeLoop(d, sr);
    });
    this.buffers.engine = mk(2.0, (d, sr, n) => {
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; lp += (rnd() - lp) * 0.04;
        d[i] = Math.sin(2 * Math.PI * 62 * t) * 0.25 + Math.sin(2 * Math.PI * 124.5 * t) * 0.12 + lp * 0.5;
      }
      fadeLoop(d, sr);
    });
    this.buffers.music = this.synthMusic(mk);
  }

  synthMusic(mk) {
    // 16-bar ambient electro loop at 100 BPM in A minor: Am F C G
    const bpm = 100, beat = 60 / bpm, bars = 8, dur = bars * 4 * beat;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const arp = [0, 1, 2, 1, 2, 0, 2, 1];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    return mk(dur, (d, sr, n, ch) => {
      let lp = 0, kickPh = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const bar = Math.floor(t / (4 * beat)) % bars;
        const chord = chords[Math.floor(bar / 2) % 4];
        let s = 0;
        // pad (detuned saws, lowpassed)
        for (const m of chord) {
          const f = mtof(m);
          s += (((t * f * 1.003) % 1) * 2 - 1) * 0.05 + (((t * f * 0.997) % 1) * 2 - 1) * 0.05;
        }
        lp += (s - lp) * 0.035;
        let out = lp * 0.9;
        // arpeggio pluck on 8ths
        const e = Math.floor(t / (beat / 2));
        const et = t - e * (beat / 2);
        const note = chord[arp[e % 8]] + 12 + (ch === 1 && e % 4 === 3 ? 12 : 0);
        out += Math.sin(2 * Math.PI * mtof(note) * et) * Math.exp(-et * 9) * 0.12;
        // soft kick on beats
        const bt = t % beat;
        if (bt < 0.002) kickPh = 0;
        kickPh += 2 * Math.PI * (45 + 90 * Math.exp(-bt * 30)) / sr;
        out += Math.sin(kickPh) * Math.exp(-bt * 9) * 0.35;
        // hats on offbeats
        const ht = (t + beat / 2) % beat;
        out += (Math.random() * 2 - 1) * Math.exp(-ht * 80) * 0.04;
        d[i] = out;
      }
      fadeLoop(d, sr, 0.02);
    }, 2);
  }
}

// Loops crossfade their head into their tail, so they must loop back to `sec`, not 0.
const LOOP_STARTS = { storm: 0.05, wind: 0.05, engine: 0.05, music: 0.02, chesthum: 0 };
function fadeLoop(d, sr, sec = 0.05) {
  const n = Math.floor(sr * sec);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const a = d[i], b = d[d.length - n + i];
    d[d.length - n + i] = b * (1 - k) + a * k;
  }
}

export const Audio = new AudioEngine();
