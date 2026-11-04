// Ground-level navigation grid with A* path finding and string-pulling, used by bots.

class MinHeap {
  constructor(cap) { this.ids = new Int32Array(cap); this.f = new Float32Array(cap); this.size = 0; }
  push(id, f) {
    let i = this.size++;
    this.ids[i] = id; this.f[i] = f;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop() {
    const top = this.ids[0];
    this.size--;
    if (this.size > 0) {
      this.ids[0] = this.ids[this.size]; this.f[0] = this.f[this.size];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < this.size && this.f[l] < this.f[m]) m = l;
        if (r < this.size && this.f[r] < this.f[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  swap(a, b) {
    const ti = this.ids[a]; this.ids[a] = this.ids[b]; this.ids[b] = ti;
    const tf = this.f[a]; this.f[a] = this.f[b]; this.f[b] = tf;
  }
}

export class NavGrid {
  constructor(world, half, cell = 2, agentR = 0.5) {
    this.half = half; this.cell = cell;
    this.n = Math.floor((half * 2) / cell);
    const N = this.n * this.n;
    this.walk = new Uint8Array(N);
    this.cost = new Float32Array(N).fill(1);
    this.g = new Float32Array(N);
    this.parent = new Int32Array(N);
    this.seen = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.gen = 0;
    this.heap = new MinHeap(N * 4);
    this.build(world, agentR);
  }

  build(world, agentR) {
    const n = this.n, c = this.cell;
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
      const x = -this.half + (i + 0.5) * c, z = -this.half + (k + 0.5) * c;
      const r = c * 0.5 + agentR - 0.15;
      let ok = Math.abs(x) < this.half - 3 && Math.abs(z) < this.half - 3;
      if (ok) world.query(x - r, z - r, x + r, z + r, b => {
        if (b.maxY > 0.55 && b.minY < 1.9) {
          if (b.maxX > x - r && b.minX < x + r && b.maxZ > z - r && b.minZ < z + r) { ok = false; return false; }
        }
      });
      if (ok) {
        const rc = world.rampCells[world.ci(z) * world.n + world.ci(x)];
        for (const id of rc) {
          const rp = world.ramps[id];
          if (x + r > rp.minX && x - r < rp.maxX && z + r > rp.minZ && z - r < rp.maxZ) { ok = false; break; }
        }
      }
      this.walk[k * n + i] = ok ? 1 : 0;
    }
    // Prefer cells away from walls (bots hug walls less, look more natural)
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
      const id = k * n + i;
      if (!this.walk[id]) continue;
      let near = 0;
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = k + dk;
        if (a < 0 || b < 0 || a >= n || b >= n || !this.walk[b * n + a]) near++;
      }
      this.cost[id] = 1 + near * 0.35;
    }
  }

  toCell(x, z) {
    const i = Math.floor((x + this.half) / this.cell), k = Math.floor((z + this.half) / this.cell);
    if (i < 0 || k < 0 || i >= this.n || k >= this.n) return -1;
    return k * this.n + i;
  }
  cellCenter(id) {
    const i = id % this.n, k = (id / this.n) | 0;
    return { x: -this.half + (i + 0.5) * this.cell, z: -this.half + (k + 0.5) * this.cell };
  }
  isWalkable(x, z) { const id = this.toCell(x, z); return id >= 0 && this.walk[id] === 1; }

  nearestWalkable(x, z, maxR = 12) {
    const id0 = this.toCell(x, z);
    if (id0 >= 0 && this.walk[id0]) return id0;
    const i0 = Math.floor((x + this.half) / this.cell), k0 = Math.floor((z + this.half) / this.cell);
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bd = Infinity;
      for (let dk = -r; dk <= r; dk++) for (let di = -r; di <= r; di++) {
        if (Math.abs(di) !== r && Math.abs(dk) !== r) continue;
        const i = i0 + di, k = k0 + dk;
        if (i < 0 || k < 0 || i >= this.n || k >= this.n) continue;
        const id = k * this.n + i;
        if (!this.walk[id]) continue;
        const d = di * di + dk * dk;
        if (d < bd) { bd = d; best = id; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  randomWalkableNear(x, z, radius, rng = Math.random) {
    for (let tries = 0; tries < 30; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (this.isWalkable(px, pz)) return { x: px, z: pz };
    }
    const id = this.nearestWalkable(x, z, 20);
    return id >= 0 ? this.cellCenter(id) : { x, z };
  }

  /** Straight walkable line between two world points on the grid. */
  lineWalkable(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (this.cell * 0.45));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.isWalkable(x, z)) return false;
      // check slight sideways to keep clearance
    }
    return true;
  }

  /** A* from (ax,az) to (bx,bz). Returns array of {x,z} or null. maxNodes bounds the work. */
  findPath(ax, az, bx, bz, maxNodes = 9000) {
    const n = this.n;
    const start = this.nearestWalkable(ax, az, 6);
    const goal = this.nearestWalkable(bx, bz, 12);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [{ x: bx, z: bz }];
    const gen = ++this.gen;
    const heap = this.heap; heap.size = 0;
    const gi = goal % n, gk = (goal / n) | 0;
    const h = id => { const dx = Math.abs(id % n - gi), dz = Math.abs(((id / n) | 0) - gk); return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)); };
    this.g[start] = 0; this.seen[start] = gen; this.parent[start] = -1;
    heap.push(start, h(start));
    let expanded = 0, found = false, bestId = start, bestH = h(start);
    const DI = [1, -1, 0, 0, 1, 1, -1, -1], DK = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.size > 0) {
      const cur = heap.pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (cur === goal) { found = true; break; }
      const hc = h(cur); if (hc < bestH) { bestH = hc; bestId = cur; }
      if (++expanded > maxNodes) break;
      const ci = cur % n, ck = (cur / n) | 0;
      for (let d = 0; d < 8; d++) {
        const i = ci + DI[d], k = ck + DK[d];
        if (i < 0 || k < 0 || i >= n || k >= n) continue;
        const nid = k * n + i;
        if (!this.walk[nid] || this.closed[nid] === gen) continue;
        if (d >= 4 && (!this.walk[ck * n + i] || !this.walk[k * n + ci])) continue; // no corner cutting
        const ng = this.g[cur] + (d >= 4 ? 1.4142 : 1) * this.cost[nid];
        if (this.seen[nid] !== gen || ng < this.g[nid]) {
          this.seen[nid] = gen; this.g[nid] = ng; this.parent[nid] = cur;
          heap.push(nid, ng + h(nid) * 1.15);
        }
      }
    }
    let end = found ? goal : bestId;
    if (end === start) return null;
    const cells = [];
    for (let c = end; c !== -1; c = this.parent[c]) { cells.push(c); if (cells.length > 4000) break; }
    cells.reverse();
    const pts = cells.map(c => this.cellCenter(c));
    if (found) pts[pts.length - 1] = { x: bx, z: bz };
    // string pull
    const out = [];
    let anchor = { x: ax, z: az };
    let i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 40);
      while (j > i && !this.lineWalkable(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); anchor = pts[j]; i = j + 1;
    }
    return out;
  }
}
