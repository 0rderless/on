// Asset loading with progress reporting.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeTextures } from './textures.js';
import { Audio } from './audio.js';

// The hosted preview build ships the same models as glTF JSON with embedded buffers.
const EXT = window.OC_PREVIEW ? '.gltf.json' : '.glb';
const MODELS = {
  soldier: 'assets/models/soldier' + EXT,
  run: 'assets/models/run_anim' + EXT,
  rifle: 'assets/models/rifle' + EXT,
  shotgun: 'assets/models/shotgun' + EXT,
  blaster: 'assets/models/blaster' + EXT,
};
// Rough byte weights so the progress bar moves smoothly.
const WEIGHTS = { soldier: 3.1, run: 0.36, rifle: 0.88, shotgun: 0.6, blaster: 0.47 };

export const Assets = {
  gltf: {},
  tex: null,

  async load(onProgress) {
    const loader = new GLTFLoader();
    const prog = {};
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) + 1.2; // + audio + textures
    const report = (label) => {
      let done = 0;
      for (const k in prog) done += prog[k];
      onProgress && onProgress(Math.min(1, done / total), label);
    };
    const tasks = Object.entries(MODELS).map(([key, url]) => new Promise((resolve, reject) => {
      loader.load(url, g => { this.gltf[key] = g; prog[key] = WEIGHTS[key]; report(`Loaded ${key}`); resolve(); },
        e => { if (e.total) { prog[key] = WEIGHTS[key] * (e.loaded / e.total); report(`Loading ${key}…`); } },
        err => reject(new Error(`Failed to load ${url}: ${err.message || err}`)));
    }));
    tasks.push(Audio.loadAll('assets/audio', f => { prog.audio = f * 0.7; report('Loading sounds…'); }));
    await Promise.all(tasks);
    this.tex = makeTextures();
    prog.tex = 0.5; report('Painting the compound…');
    return this;
  },
};
