// Static collision world: axis-aligned boxes + ramps, a uniform XZ grid broadphase,
// character capsule movement and ray casts.

export class CollisionWorld {
  constructor(half = 180, cell = 8) {
    this.half = half;
    this.cell = cell;
    this.n = Math.ceil((half * 2) / cell);
    this.cells = Array.from({ length: this.n * this.n }, () => []);
    this.boxes = [];   // {minX,minY,minZ,maxX,maxY,maxZ, mat}
    this.ramps = [];   // {minX,minZ,maxX,maxZ, axis, h0, h1}
    this.stamp = 1;
    this.marks = new Uint32Array(4096);
    this.rampCells = Array.from({ length: this.n * this.n }, () => []);
  }

  ci(v) { return Math.max(0, Math.min(this.n - 1, Math.floor((v + this.half) / this.cell))); }

  addBox(minX, minY, minZ, maxX, maxY, maxZ, tag = 0) {
    const b = { minX, minY, minZ, maxX, maxY, maxZ, tag, id: this.boxes.length };
    this.boxes.push(b);
    if (this.boxes.length > this.marks.length) {
      const m = new Uint32Array(this.marks.length * 2); m.set(this.marks); this.marks = m;
    }
    for (let i = this.ci(minX); i <= this.ci(maxX); i++)
      for (let k = this.ci(minZ); k <= this.ci(maxZ); k++) this.cells[k * this.n + i].push(b.id);
    return b;
  }

  /** Ramp surface rising along +axis from h0 (at min) to h1 (at max). */
  addRamp(minX, minZ, maxX, maxZ, axis, h0, h1) {
    const r = { minX, minZ, maxX, maxZ, axis, h0, h1, id: this.ramps.length };
    this.ramps.push(r);
    for (let i = this.ci(minX); i <= this.ci(maxX); i++)
      for (let k = this.ci(minZ); k <= this.ci(maxZ); k++) this.rampCells[k * this.n + i].push(r.id);
    return r;
  }

  rampHeight(r, x, z) {
    const t = r.axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ);
    return r.h0 + (r.h1 - r.h0) * Math.max(0, Math.min(1, t));
  }

  /** Calls fn(box) once for every box whose cell overlaps the XZ rect. */
  query(minX, minZ, maxX, maxZ, fn) {
    const s = ++this.stamp;
    const i0 = this.ci(minX), i1 = this.ci(maxX), k0 = this.ci(minZ), k1 = this.ci(maxZ);
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const arr = this.cells[k * this.n + i];
      for (let j = 0; j < arr.length; j++) {
        const id = arr[j];
        if (this.marks[id] === s) continue;
        this.marks[id] = s;
        const b = this.boxes[id];
        if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
        if (fn(b) === false) return;
      }
    }
  }

  /** Highest walkable surface under the circle that is at most `maxUp` above feetY. */
  groundHeight(x, z, r, feetY, maxUp) {
    let best = 0; // the compound floor
    const limit = feetY + maxUp;
    this.query(x - r, z - r, x + r, z + r, b => {
      if (b.maxY > limit || b.maxY <= best) return;
      // circle vs rect overlap
      const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz <= r * r) best = b.maxY;
    });
    const rc = this.rampCells[this.ci(z) * this.n + this.ci(x)];
    for (let j = 0; j < rc.length; j++) {
      const rp = this.ramps[rc[j]];
      if (x < rp.minX || x > rp.maxX || z < rp.minZ || z > rp.maxZ) continue;
      const h = this.rampHeight(rp, x, z);
      if (h <= limit + 0.35 && h > best) best = h;
    }
    return best;
  }

  /**
   * Move a character (feet position) by velocity * dt with collisions.
   * state: {grounded}. Mutates pos & vel. Returns true if landed this step.
   */
  moveCharacter(pos, vel, dt, radius, height, stepH, state) {
    // Split large moves to avoid tunnelling.
    const speed = Math.hypot(vel.x, vel.y, vel.z) * dt;
    const steps = Math.min(8, Math.max(1, Math.ceil(speed / (radius * 0.8))));
    const sdt = dt / steps;
    let landed = false;
    for (let s = 0; s < steps; s++) landed = this._step(pos, vel, sdt, radius, height, stepH, state) || landed;
    return landed;
  }

  _step(pos, vel, dt, r, height, stepH, state) {
    let x = pos.x + vel.x * dt, z = pos.z + vel.z * dt;
    const feet = pos.y;
    // Horizontal resolution (3 iterations).
    for (let it = 0; it < 3; it++) {
      let pushed = false;
      this.query(x - r, z - r, x + r, z + r, b => {
        if (b.maxY <= feet + stepH || b.minY >= feet + height - 0.05) return;
        const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        let dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = r - d;
          x += (dx / d) * push; z += (dz / d) * push;
          // remove velocity into the wall
          const nx = dx / d, nz = dz / d, vn = vel.x * nx + vel.z * nz;
          if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
        } else {
          // centre inside the box: push out along the smallest penetration axis
          const pl = x - b.minX, pr = b.maxX - x, pb = z - b.minZ, pf = b.maxZ - z;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r; else if (m === pb) z = b.minZ - r; else z = b.maxZ + r;
        }
        pushed = true;
      });
      if (!pushed) break;
    }
    // Map bounds
    const lim = this.half - 1;
    x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));

    // Vertical
    let y = feet + vel.y * dt;
    const wasGrounded = state.grounded;
    const ground = this.groundHeight(x, z, r * 0.75, Math.max(feet, y), stepH);
    let landed = false;
    if (y <= ground) {
      if (!wasGrounded && vel.y < -0.5) landed = true;
      y = ground; if (vel.y < 0) vel.y = 0; state.grounded = true;
    } else if (wasGrounded && vel.y <= 0 && y - ground < 0.35) {
      y = ground; vel.y = 0; state.grounded = true; // stick to slopes / steps down
    } else state.grounded = false;

    // Ceiling
    if (vel.y > 0) {
      const top = y + height;
      this.query(x - r * 0.7, z - r * 0.7, x + r * 0.7, z + r * 0.7, b => {
        if (b.minY >= feet + height - 0.05 && b.minY < top) {
          const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
          if ((x - cx) ** 2 + (z - cz) ** 2 < r * r * 0.5) { y = b.minY - height; vel.y = 0; }
        }
      });
    }
    pos.x = x; pos.y = y; pos.z = z;
    return landed;
  }

  /** Horizontal-only push out of walls (used while gliding / skydiving). */
  pushOut(pos, r, height) {
    const feet = pos.y;
    for (let it = 0; it < 2; it++) {
      this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, b => {
        if (b.maxY <= feet + 0.3 || b.minY >= feet + height) return;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        if (d2 > 1e-10) { const d = Math.sqrt(d2); pos.x += dx / d * (r - d); pos.z += dz / d * (r - d); }
        else {
          const pl = pos.x - b.minX, pr = b.maxX - pos.x, pb = pos.z - b.minZ, pf = b.maxZ - pos.z, m = Math.min(pl, pr, pb, pf);
          if (m === pl) pos.x = b.minX - r; else if (m === pr) pos.x = b.maxX + r; else if (m === pb) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
        }
      });
    }
  }

  /** True if a character could stand at (x, feetY, z) without overlapping walls. */
  isFree(x, feetY, z, r, height) {
    let free = true;
    this.query(x - r, z - r, x + r, z + r, b => {
      if (b.maxY <= feetY + 0.05 || b.minY >= feetY + height) return;
      const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) { free = false; return false; }
    });
    return free;
  }

  /**
   * Ray cast against boxes, ramps and the floor. Direction must be normalised.
   * Returns {t, x,y,z, nx,ny,nz, box} or null.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    if (Math.abs(dx) < 1e-9) dx = 1e-9;
    if (Math.abs(dy) < 1e-9) dy = 1e-9;
    if (Math.abs(dz) < 1e-9) dz = 1e-9;
    let bestT = maxT, bestN = null, bestBox = null;
    // floor
    if (dy < -1e-6) { const t = -oy / dy; if (t >= 0 && t < bestT) { bestT = t; bestN = [0, 1, 0]; } }
    const s = ++this.stamp;
    const cs = this.cell;
    // 2D DDA over XZ cells
    let cx = Math.floor((ox + this.half) / cs), cz = Math.floor((oz + this.half) / cs);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDX = Math.abs(dx) > 1e-9 ? Math.abs(cs / dx) : Infinity;
    const tDZ = Math.abs(dz) > 1e-9 ? Math.abs(cs / dz) : Infinity;
    const bx = (cx + (dx > 0 ? 1 : 0)) * cs - this.half, bz = (cz + (dz > 0 ? 1 : 0)) * cs - this.half;
    let tMaxX = Math.abs(dx) > 1e-9 ? (bx - ox) / dx : Infinity;
    let tMaxZ = Math.abs(dz) > 1e-9 ? (bz - oz) / dz : Infinity;
    let tEnter = 0;
    const invX = 1 / dx, invY = 1 / dy, invZ = 1 / dz;
    for (let guard = 0; guard < 400; guard++) {
      if (tEnter > bestT) break;
      if (cx >= 0 && cz >= 0 && cx < this.n && cz < this.n) {
        const arr = this.cells[cz * this.n + cx];
        for (let j = 0; j < arr.length; j++) {
          const id = arr[j];
          if (this.marks[id] === s) continue;
          this.marks[id] = s;
          const b = this.boxes[id];
          // slab test
          let t1 = (b.minX - ox) * invX, t2 = (b.maxX - ox) * invX;
          let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), axis = 0;
          t1 = (b.minY - oy) * invY; t2 = (b.maxY - oy) * invY;
          let ymin = Math.min(t1, t2), ymax = Math.max(t1, t2);
          if (ymin > tmin) { tmin = ymin; axis = 1; } tmax = Math.min(tmax, ymax);
          t1 = (b.minZ - oz) * invZ; t2 = (b.maxZ - oz) * invZ;
          let zmin = Math.min(t1, t2), zmax = Math.max(t1, t2);
          if (zmin > tmin) { tmin = zmin; axis = 2; } tmax = Math.min(tmax, zmax);
          if (tmax < Math.max(0, tmin) || tmin > bestT) continue;
          if (tmin < 0) continue; // origin inside box: ignore
          bestT = tmin; bestBox = b;
          bestN = axis === 0 ? [-Math.sign(dx), 0, 0] : axis === 1 ? [0, -Math.sign(dy), 0] : [0, 0, -Math.sign(dz)];
        }
        // ramps in this cell
        const rc = this.rampCells[cz * this.n + cx];
        for (let j = 0; j < rc.length; j++) {
          const rp = this.ramps[rc[j]];
          const t = this._rayRamp(rp, ox, oy, oz, dx, dy, dz);
          if (t !== null && t < bestT) {
            bestT = t; bestBox = null;
            const L = rp.axis === 'x' ? rp.maxX - rp.minX : rp.maxZ - rp.minZ, H = rp.h1 - rp.h0;
            const n = rp.axis === 'x' ? [-H, L, 0] : [0, L, -H]; const m = Math.hypot(...n);
            bestN = [n[0] / m, n[1] / m, n[2] / m];
          }
        }
      }
      if (tMaxX < tMaxZ) { tEnter = tMaxX; tMaxX += tDX; cx += stepX; } else { tEnter = tMaxZ; tMaxZ += tDZ; cz += stepZ; }
      if (tEnter > maxT) break;
      if ((cx < -1 || cx > this.n) && (cz < -1 || cz > this.n)) break;
    }
    if (!bestN) return null;
    return { t: bestT, x: ox + dx * bestT, y: oy + dy * bestT, z: oz + dz * bestT, nx: bestN[0], ny: bestN[1], nz: bestN[2], box: bestBox };
  }

  _rayRamp(rp, ox, oy, oz, dx, dy, dz) {
    // plane: y = h0 + (h1-h0) * (p - min)/L along axis
    const L = rp.axis === 'x' ? rp.maxX - rp.minX : rp.maxZ - rp.minZ;
    const k = (rp.h1 - rp.h0) / L;
    const o = rp.axis === 'x' ? ox - rp.minX : oz - rp.minZ;
    const d = rp.axis === 'x' ? dx : dz;
    const denom = dy - k * d;
    if (Math.abs(denom) < 1e-8) return null;
    const t = (rp.h0 + k * o - oy) / denom;
    if (t < 0) return null;
    const px = ox + dx * t, pz = oz + dz * t;
    if (px < rp.minX || px > rp.maxX || pz < rp.minZ || pz > rp.maxZ) return null;
    return t;
  }

  /** Line of sight between two points. */
  clear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.05);
  }
}
