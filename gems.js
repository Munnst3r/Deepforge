// ===== The goal on each mode's last tab =====
// Each mode's end goal stands in a golden alchemist's sigil (a circle with a triangle in it), with orbs of light
// circling it and its own atmosphere behind. Each has several designs, unlocked by milestones in that mode:
// all of them gems: tall faceted stones that turn slowly, some with rings, shards or cracks of fire.
//   Industrialist: twelve, raw ore to sovereign gold · Capitalist: twelve · Communist: six, one per Great Work stage
// Drawn on a canvas as real low-poly 3D (meshes rotated, lit and painted back to front) with a bloom pass for
// everything that glows. The mode says which family and design to show, how bright, how full, and which orbs circle
// it (mode.stone()). It only animates while its tab is open.
const StoneView = (() => {
  const cv = $('stc'), ctx = cv.getContext('2d');
  const layer = document.createElement('canvas'), lx = layer.getContext('2d');
  const blurA = document.createElement('canvas'), ax = blurA.getContext('2d');
  const blurB = document.createElement('canvas'), bx = blurB.getContext('2d');
  let W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0, running = false, last = 0, turn = 0, spin = 0, clock = 0, look = null;

  function setup() {
    if (W) return; // sized once (and again after a resize): reading the width every frame forces a layout
    const w = Math.round(cv.clientWidth);
    if (!w) return;
    W = w;
    H = Math.round(w * 0.8);
    dpr = Math.min(devicePixelRatio || 1, 2.5); // full phone sharpness: the facets and veins are fine detail
    for (const c of [cv, layer]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    blurA.width = Math.ceil(W / 4);
    blurA.height = Math.ceil(H / 4);
    blurB.width = Math.ceil(W / 11);
    blurB.height = Math.ceil(H / 11);
    R = H * 0.2;
    cx = W / 2;
    cy = H * 0.52;
  }
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // ---- 3D: meshes are rotated, lit from the upper left and front, and painted back to front
  const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
  const unit = (v) => {
    const l = Math.hypot(...v) || 1;
    return v.map((c) => c / l);
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const LIGHT = unit([-0.55, -0.8, -0.5]), HALF = unit([LIGHT[0], LIGHT[1], LIGHT[2] - 1]); // y is down, the viewer at -z
  const S = ([x, y, z]) => [cx + x * R, cy + y * R, z]; // to the screen (z kept for depth)
  const normalOf = (p) => unit(cross(sub(p[1], p[0]), sub(p[2], p[0])));
  const zOf = (pts) => pts.reduce((s, p) => s + p[2], 0) / pts.length;
  const path = (g, pts) => {
    g.beginPath();
    pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  // a face's color: ambient plus diffuse light, plus a hot specular glint where it faces the light square on
  function lit(base, n, amb = 0.28, spec = 0.6, specCol = [255, 240, 220], shine = 22) {
    const d = Math.max(0, dot(n, LIGHT)), s = Math.pow(Math.max(0, dot(n, HALF)), shine) * spec;
    return base.map((c, k) => Math.min(255, c * (amb + (1 - amb) * d) + specCol[k] * s));
  }
  // closes a mesh: every face wound to face outward from `cen`, so the ones facing away can be skipped
  const outward = (faces, cen) =>
    faces.map((f) => {
      const n = cross(sub(f[1], f[0]), sub(f[2], f[0])), m = [0, 1, 2].map((i) => f.reduce((s, p) => s + p[i], 0) / f.length);
      return dot(n, sub(m, cen)) < 0 ? f.slice().reverse() : f;
    });

  // ---- glow: whatever paint() draws is bloomed (soft, wide light) and laid over the scene additively
  function bloom(paint, strength = 1) {
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lx.globalCompositeOperation = 'source-over';
    lx.globalAlpha = 1;
    lx.clearRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    paint(lx);
    lx.globalCompositeOperation = 'source-over';
    lx.globalAlpha = 1;
    ax.clearRect(0, 0, blurA.width, blurA.height);
    ax.drawImage(layer, 0, 0, blurA.width, blurA.height);
    bx.clearRect(0, 0, blurB.width, blurB.height);
    bx.drawImage(blurA, 0, 0, blurB.width, blurB.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingQuality = 'low';
    ctx.globalAlpha = 0.75 * strength;
    ctx.drawImage(blurB, 0, 0, W, H);
    ctx.globalAlpha = 0.6 * strength;
    ctx.drawImage(blurA, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  // soft clouds behind the goal: a few big blurred blobs that drift slowly
  function clouds(g, list) {
    for (const [x, y, r, c, a, sp] of list) {
      const ox = Math.sin(clock * sp + x * 7) * R * 0.25, oy = Math.cos(clock * sp * 0.8 + y * 5) * R * 0.18;
      const gx = cx + x * R + ox, gy = cy + y * R + oy, gr = g.createRadialGradient(gx, gy, 0, gx, gy, r * R);
      gr.addColorStop(0, rgba(c, a));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.fillRect(gx - r * R, gy - r * R, 2 * r * R, 2 * r * R);
    }
  }
  const STARS = Array.from({ length: 70 }, (_, k) => [Math.sin(k * 12.9898) * 43758.5453 % 1, Math.sin(k * 78.233) * 12345.678 % 1, (k % 5) / 5]);
  function stars(g, col, n = 70) {
    for (let k = 0; k < n; k++) {
      const [a, b, p] = STARS[k], x = Math.abs(a) * W, y = Math.abs(b) * H, tw = 0.35 + 0.65 * Math.abs(Math.sin(clock * (0.6 + p) + k));
      g.fillStyle = rgba(col, 0.55 * tw);
      g.fillRect(x, y, k % 7 ? 1 : 1.6, k % 7 ? 1 : 1.6);
    }
  }
  // the sigil: a circle with a ring of ticks, a triangle standing in it
  function sigil(g, alpha) {
    const r = R * 2.15;
    g.strokeStyle = `rgba(226,196,132,${alpha})`;
    g.lineWidth = 1.3;
    g.beginPath();
    g.arc(cx, cy, r, 0, 6.283);
    g.stroke();
    g.lineWidth = 0.8;
    g.strokeStyle = `rgba(226,196,132,${alpha * 0.55})`;
    g.beginPath();
    g.arc(cx, cy, r * 1.06, 0, 6.283);
    g.stroke();
    for (let k = 0; k < 36; k++) {
      const a = spin + (k * Math.PI) / 18, r2 = r * (k % 3 ? 1.1 : 1.14);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 1.06, cy + Math.sin(a) * r * 1.06);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.stroke();
    }
    g.lineWidth = 1.3;
    g.strokeStyle = `rgba(226,196,132,${alpha})`;
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
      k ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.stroke();
  }

  // ---- geometry. Every builder returns faces (lists of points) wound to face outward, y down, the viewer at -z
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
  const mid = (f) => scl(f.reduce(add, [0, 0, 0]), 1 / f.length);
  const wind = (f, c) => (dot(cross(sub(f[1], f[0]), sub(f[2], f[0])), sub(mid(f), c)) < 0 ? f.slice().reverse() : f);
  const vary = (c, v) => {
    const k = 1 + (rnd() - 0.5) * v;
    return c.map((x) => Math.min(255, x * k));
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  // a crystal: a column of `n` sides from b along dir, with a pointed tip
  function prism(b, dir, r, L, tip, n = 6, rot = 0, r0 = 0.85) {
    const d = unit(dir), a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = unit(cross(d, a)), v = cross(d, u);
    const ring = (off, rr) =>
      Array.from({ length: n }, (_, k) => {
        const t = rot + (k * 2 * Math.PI) / n;
        return add(add(b, scl(d, off)), add(scl(u, Math.cos(t) * rr), scl(v, Math.sin(t) * rr)));
      });
    const lo = ring(-0.1 * L, r * r0), hi = ring(L, r), ap = add(b, scl(d, L + tip)), c = add(b, scl(d, L * 0.5));
    const f = [];
    for (let k = 0; k < n; k++) {
      const m = (k + 1) % n;
      f.push([lo[k], lo[m], hi[m], hi[k]]);
      if (tip > 0) f.push([hi[k], hi[m], ap]);
    }
    f.push(lo.slice());
    if (!(tip > 0)) f.push(hi.slice());
    return f.map((q) => wind(q, c));
  }
  // a shard: a stretched double pyramid
  function shard(c, r, h, rot = 0) {
    const ring = [0, 1, 2, 3].map((k) => add(c, rotY([Math.cos((k * Math.PI) / 2) * r, 0, Math.sin((k * Math.PI) / 2) * r * 0.7], rot)));
    const top = add(c, [0, -h, 0]), bot = add(c, [0, h * 0.8, 0]), f = [];
    for (let k = 0; k < 4; k++) f.push([top, ring[k], ring[(k + 1) % 4]], [bot, ring[k], ring[(k + 1) % 4]]);
    return f.map((q) => wind(q, c));
  }
  // faces with a color (each a little different), plus any shared settings
  const paint = (faces, c, o = {}, v = 0.1) => faces.map((p) => Object.assign({ p, c: vary(c, v) }, o));

  // a ring around the goal, split so its far half passes behind and its near half in front
  function ring(c, r, tx, tz, w, col, o = {}) {
    const pts = Array.from({ length: 73 }, (_, k) => {
      const a = (k * 2 * Math.PI) / 72;
      return add(c, rotZ(rotX([Math.cos(a) * r, 0, Math.sin(a) * r], tx), tz));
    });
    const xf = o.spin ? (t) => (p) => add(c, rotY(sub(p, c), t * o.spin)) : null;
    const make = (half) => ({ lines: [{ pts, w, kind: o.kind || 'ring', col, half, c, glow: o.glow ?? 0.8, dots: o.dots, dotCol: o.dotCol }], at: c, bias: (half === 'back' ? 1 : -1) * r * (o.sep ?? 0.9), xf, order: o.order || 0 });
    return [make('back'), make('front')];
  }

  // ---- drawing a scene: objects painted back to front (each one's faces back to front), lit, with what glows
  // collected for the bloom
  let view = { yaw: 0, tilt: 0.4, sc: 1, lift: 0 }, glowK = 1;
  const V = (p) => {
    const q = rotX(rotY(p, view.yaw), view.tilt);
    return [q[0] * view.sc, q[1] * view.sc + view.lift, q[2] * view.sc];
  };
  const P = (p) => S(V(p));
  function render(objs, G) {
    const list = [];
    for (const o of objs) {
      const f = o.xf ? o.xf(clock) : null, T = f ? (p) => V(f(p)) : V, fs = [];
      let zs = 0;
      for (const fc of o.faces || []) {
        const w = fc.p.map(T), z = zOf(w), n = normalOf(w), back = n[2] >= 0;
        zs += z;
        if (back && !fc.ds && !o.glass) continue;
        fs.push({ fc, pts: w.map(S), n: back && fc.ds ? scl(n, -1) : n, z, back });
      }
      fs.sort((a, b) => b.z - a.z);
      const z = o.at ? T(o.at)[2] : o.faces && o.faces.length ? zs / o.faces.length : 0;
      list.push({ o, fs, T, z: z + (o.bias || 0) });
    }
    list.sort((a, b) => (a.o.order || 0) - (b.o.order || 0) || b.z - a.z);
    for (const { o, fs, T } of list) {
      if (o.glass) {
        for (const f of fs) if (f.back) glassBack(f, o);
        if (o.inner) o.inner(ctx, T, G);
        for (const f of fs) if (!f.back) glassFront(f, o, G);
      } else for (const f of fs) face(f, G);
      for (const ln of o.lines || []) line(ln, T, G);
      for (const d of o.dots || []) {
        const q = T(d.p), r = T(add(d.p, scl(d.n, 0.1)));
        if (r[2] - q[2] > 0) continue;
        const [x, y] = S(q);
        ctx.fillStyle = rgba(d.col, 1);
        ctx.beginPath();
        ctx.arc(x, y, d.r * R, 0, 6.283);
        ctx.fill();
      }
      for (const gl of o.glows || []) G.pts.push([...S(T(gl.p)).slice(0, 2), gl.r * R * view.sc, gl.col, gl.a]);
      if (o.draw) o.draw(ctx, T, G);
    }
  }
  function face({ fc, pts, n }, G) {
    let c = lit(fc.c, n, fc.amb ?? 0.36, fc.spec ?? 0.3, [255, 238, 214], fc.shine || 12);
    if (fc.e) c = mix(c, mix(fc.c, [255, 255, 255], 0.28), Math.min(1, fc.e * (0.75 + 0.25 * glowK)));
    path(ctx, pts);
    ctx.fillStyle = rgba(c, fc.a ?? 1);
    ctx.fill();
    if (fc.edge) {
      ctx.strokeStyle = rgba(fc.edge, (fc.ea ?? 0.8) * (0.5 + 0.5 * Math.max(0, dot(n, LIGHT)) + 0.3));
      ctx.lineWidth = fc.ew || 0.8;
      ctx.stroke();
    } else if ((fc.a ?? 1) === 1) {
      ctx.strokeStyle = rgba(c, 1); // closes the hairline gaps between facets
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    if (fc.e) G.faces.push([pts, fc.gc || fc.c, fc.e]);
  }
  function glassBack({ fc, pts, n }, o) {
    path(ctx, pts);
    ctx.fillStyle = rgba(mix(lit(fc.c, scl(n, -1), 0.5, 0), o.deep || [20, 10, 30], 0.5), 0.92);
    ctx.fill();
    ctx.strokeStyle = rgba(fc.edge || fc.c, 0.22);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  function glassFront({ fc, pts, n }, o, G) {
    const d = Math.max(0, dot(n, LIGHT)), c = lit(fc.c, n, 0.5, 0.9, [255, 250, 245], 16);
    const [a, b] = [pts[0], pts[Math.min(2, pts.length - 1)]], gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    gr.addColorStop(0, rgba(mix(c, [255, 255, 255], 0.18 + 0.2 * d), fc.a ?? 0.8));
    gr.addColorStop(1, rgba(mix(c, o.deep || [20, 10, 30], 0.3), (fc.a ?? 0.8) * 0.85));
    path(ctx, pts);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = rgba(fc.edge || mix(fc.c, [255, 255, 255], 0.6), 0.45 + 0.45 * d);
    ctx.lineWidth = fc.ew || 0.9;
    ctx.stroke();
    if (fc.e) G.faces.push([pts, fc.gc || fc.c, fc.e]);
  }
  // a line on (or around) the goal: a glowing vein, a ring, a vine, a chain. Segments on the far side of the surface
  // they lie on (or, for a ring, on its other half) are skipped
  function line(ln, T, G) {
    const q = ln.pts.map(T), pts = q.map(S);
    let vis = null;
    if (ln.ns) vis = ln.pts.map((p, i) => T(add(p, scl(ln.ns[i], 0.1)))[2] - q[i][2] < 0.015);
    else if (ln.half) {
      const zc = T(ln.c)[2];
      vis = q.map((p) => (ln.half === 'back' ? p[2] > zc : p[2] <= zc));
    }
    const segs = (g, wMul, col, a) => {
      g.strokeStyle = rgba(col, a);
      g.lineCap = g.lineJoin = 'round';
      if (!ln.taper) {
        g.lineWidth = Math.max(0.6, ln.w * R * wMul);
        g.beginPath();
        let on = false;
        for (let i = 0; i < pts.length; i++) {
          const ok = !vis || (vis[i] && (i === 0 || vis[i - 1]));
          if (ok && on) g.lineTo(pts[i][0], pts[i][1]);
          else g.moveTo(pts[i][0], pts[i][1]);
          on = !vis || vis[i];
        }
        g.stroke();
        return;
      }
      for (let i = 0; i + 1 < pts.length; i++) {
        if (vis && !(vis[i] && vis[i + 1])) continue;
        g.lineWidth = Math.max(0.6, ln.w * R * wMul * (1 - (0.65 * i) / pts.length));
        g.beginPath();
        g.moveTo(pts[i][0], pts[i][1]);
        g.lineTo(pts[i + 1][0], pts[i + 1][1]);
        g.stroke();
      }
    };
    const k = 0.85 + 0.15 * Math.sin(clock * 3 + ln.pts.length);
    if (ln.kind === 'glow') {
      segs(ctx, 2.1, mix(ln.col, [60, 10, 0], 0.35), 0.55 * k);
      segs(ctx, 1, ln.col, 0.95);
      segs(ctx, 0.38, ln.hot || mix(ln.col, [255, 255, 240], 0.75), 1);
    } else if (ln.kind === 'ring') {
      segs(ctx, 1.6, mix(ln.col, [0, 0, 0], 0.45), 0.9);
      segs(ctx, 1, ln.col, 1);
      segs(ctx, 0.35, mix(ln.col, [255, 255, 255], 0.6), 0.9);
    } else if (ln.kind === 'chain') {
      segs(ctx, 1.4, [20, 18, 24], 1);
      g2dDash(() => segs(ctx, 0.9, ln.col, 1));
    } else segs(ctx, 1, ln.col, ln.a ?? 1);
    if (ln.dots)
      for (let i = 0; i < ln.dots; i++) {
        const j = Math.floor((i * (pts.length - 1)) / ln.dots);
        if (vis && !vis[j]) continue;
        const [x, y] = pts[j], s = ln.w * R * 1.1;
        ctx.fillStyle = rgba(ln.dotCol || mix(ln.col, [255, 255, 255], 0.5), 1);
        ctx.beginPath();
        ctx.moveTo(x, y - s * 1.6);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s * 1.6);
        ctx.lineTo(x - s, y);
        ctx.fill();
      }
    if (ln.glow && ln.kind !== 'flat' && ln.kind !== 'chain') G.lines.push({ pts, vis, w: ln.w, col: ln.col, a: ln.glow * k, taper: ln.taper });
  }
  function g2dDash(fn) {
    ctx.setLineDash([R * 0.035, R * 0.025]);
    fn();
    ctx.setLineDash([]);
  }
  // everything collected as glowing, painted into the bloom layer
  function paintGlow(g, G) {
    for (const [pts, c, e] of G.faces) {
      path(g, pts);
      g.fillStyle = rgba(c, 0.32 * e * glowK);
      g.fill();
    }
    g.lineCap = g.lineJoin = 'round';
    for (const l of G.lines) {
      g.strokeStyle = rgba(l.col, 0.7 * l.a * glowK);
      for (let i = 0; i + 1 < l.pts.length; i++) {
        if (l.vis && !(l.vis[i] && l.vis[i + 1])) continue;
        g.lineWidth = l.w * R * 2.4 * (l.taper ? 1 - (0.65 * i) / l.pts.length : 1);
        g.beginPath();
        g.moveTo(l.pts[i][0], l.pts[i][1]);
        g.lineTo(l.pts[i + 1][0], l.pts[i + 1][1]);
        g.stroke();
      }
    }
    for (const [x, y, r, c, a] of G.pts) glowDot(g, x, y, r, c, a * (0.7 + 0.3 * glowK));
  }
  function glowDot(g, x, y, r, c, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(c, a));
    gr.addColorStop(0.35, rgba(c, a * 0.35));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---- particles, all in screen space from points on the model
  const SEEDS = Array.from({ length: 60 }, (_, k) => [((k * 0.618034) % 1), ((k * 0.414214) % 1), ((k * 0.732051) % 1), k]);
  // sparks or embers rising from an area of the ground
  function embers(g, col, n, x0, x1, y0, rise, size = 1) {
    for (let i = 0; i < n; i++) {
      const [a, b, c, k] = SEEDS[i % 60], t = (clock * (0.07 + 0.08 * c) + b) % 1;
      const [x, y] = P([lerp(x0, x1, a) + Math.sin(clock * 0.8 + k) * 0.12 * t, y0 - t * rise, (c - 0.5) * 0.8]);
      g.fillStyle = rgba(mix(col, [255, 255, 220], c * 0.5), (1 - t) * Math.min(1, t * 10));
      g.beginPath();
      g.arc(x, y, (0.7 + 0.8 * c) * size, 0, 6.283);
      g.fill();
    }
  }
  // soft puffs of smoke curling up from a point
  function smoke(g, src, col, a, n, rise, spread = 0.35, size = 0.28) {
    for (let i = 0; i < n; i++) {
      const [, b, c, k] = SEEDS[(i * 7) % 60], t = (clock * (0.09 + 0.05 * c) + b + i / n) % 1;
      const [x, y] = P([src[0] + Math.sin(clock * 0.6 + k + t * 4) * spread * t, src[1] - t * rise, src[2]]), r = R * size * (0.35 + t);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(col, a * (1 - t) * Math.min(1, t * 6)));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // four-pointed twinkles around the goal
  function twinkles(g, col, n, rx, ry, yc = -0.4, size = 1) {
    for (let i = 0; i < n; i++) {
      const [a, b, c, k] = SEEDS[(i * 11) % 60], tw = Math.max(0, Math.sin(clock * (0.8 + c) + k * 2));
      const [x, y] = P([(a - 0.5) * 2 * rx, yc + (b - 0.5) * 2 * ry, -0.6]), s = R * 0.07 * size * (0.5 + c) * tw;
      if (s < 0.3) continue;
      g.fillStyle = rgba(col, 0.9 * tw);
      g.beginPath();
      g.moveTo(x, y - s);
      g.quadraticCurveTo(x, y, x + s * 0.7, y);
      g.quadraticCurveTo(x, y, x, y + s);
      g.quadraticCurveTo(x, y, x - s * 0.7, y);
      g.quadraticCurveTo(x, y, x, y - s);
      g.fill();
    }
  }
  // objects that float and bob around a center, turning slowly as a group
  function orbiters(make, n, r, yc, o = {}) {
    const objs = [];
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n + rnd() * 0.5, rr = r * (0.85 + rnd() * 0.3), y = yc + (rnd() - 0.5) * (o.ys ?? 0.9), ph = rnd() * 6;
      const c = [Math.cos(a) * rr, y, Math.sin(a) * rr * (o.flat ?? 0.8)];
      objs.push({
        faces: make(c, i),
        at: c,
        xf: (t) => (p) => {
          const q = add(rotY(sub(p, c), t * 0.6 + ph), c), turn = t * (o.speed ?? 0.12);
          return add(rotY([q[0], q[1] + Math.sin(t * 1.1 + ph) * 0.05, q[2]], turn), [0, 0, 0]);
        },
      });
    }
    return objs;
  }

  // ===== Gems: every mode shows a gem; each mode has its own set =====
  // A tall faceted stone, turning slowly: its far facets seen dark through the near ones, a light at its heart; some
  // wear rings, some shed shards, some are cracked with fire
  function gemPts(s = {}) {
    const N = s.n || 8, tH = s.top || 1.15, bH = s.bot || 1.35, gR = s.r || 0.78, gy = s.gy ?? -0.12;
    const rp = (r, y, off) => Array.from({ length: N }, (_, k) => {
      const a = ((k + off) * 2 * Math.PI) / N;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
    const top = [0, -tH, 0], cr = rp(gR * 0.55, lerp(gy, -tH, 0.45), 0.5), gd = rp(gR, gy, 0), pv = rp(gR * 0.52, lerp(gy, bH, 0.45), 0.5), bot = [0, bH, 0], f = [];
    for (let k = 0; k < N; k++) {
      const n = (k + 1) % N;
      f.push([top, cr[k], cr[n]], [cr[k], gd[n], cr[n]], [cr[k], gd[k], gd[n]], [gd[k], pv[k], gd[n]], [pv[k], pv[n], gd[n]], [pv[k], bot, pv[n]]);
    }
    return { faces: outward(f, [0, 0, 0]), prof: [[-tH, 0], [lerp(gy, -tH, 0.45), gR * 0.55], [gy, gR], [lerp(gy, bH, 0.45), gR * 0.52], [bH, 0]] };
  }
  const gemSpin = (t) => (p) => rotY(p, t * 0.42);
  function gemScene(o) {
    const g = gemPts(o.shape);
    let faces = g.faces;
    if (o.fracture) faces = faces.map((f) => {
      const m = mid(f), n = unit(m), off = 0.05 + rnd() * 0.08;
      return f.map((p) => add(add(m, scl(sub(p, m), 0.9)), scl(n, off)));
    });
    const gem = {
      faces: faces.map((p) => ({ p, c: vary(o.col, 0.16), edge: o.edge, a: o.alpha ?? 0.8, e: o.e ?? 0.15, gc: o.col })),
      glass: true, deep: o.deep, at: [0, 0, 0], xf: gemSpin, lines: [],
      inner(c2, T) {
        const [x, y] = S(V([0, 0.1, 0])), r = R * (o.coreR || 0.85), gr = c2.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(o.core || mix(o.col, [255, 255, 255], 0.6), 0.7 * glowK));
        gr.addColorStop(0.4, rgba(o.col, 0.3 * glowK));
        gr.addColorStop(1, rgba(o.col, 0));
        c2.globalCompositeOperation = 'lighter';
        c2.fillStyle = gr;
        c2.fillRect(x - r, y - r, r * 2, r * 2);
        c2.globalCompositeOperation = 'source-over';
      },
    };
    if (o.cracks) {
      const surf = (a, y) => {
        let i = 0;
        while (i < g.prof.length - 2 && g.prof[i + 1][0] < y) i++;
        const r = lerp(g.prof[i][1], g.prof[i + 1][1], (y - g.prof[i][0]) / (g.prof[i + 1][0] - g.prof[i][0])) * 0.93;
        return [[Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a), 0, Math.sin(a)]];
      };
      for (let k = 0; k < o.cracks.n; k++) {
        const pts = [], ns = [];
        let a = (k * 2 * Math.PI) / o.cracks.n + rnd(), y = -0.9 + rnd() * 0.5;
        for (let j = 0; j < 14 && y < 1.2; j++) {
          const [p, n] = surf(a, y);
          pts.push(p);
          ns.push(n);
          y += 0.13;
          a += (rnd() - 0.5) * 0.5;
        }
        gem.lines.push({ pts, ns, w: o.cracks.w || 0.022, taper: true, kind: 'glow', col: o.cracks.col, hot: o.cracks.hot });
      }
    }
    if (o.spine) gem.lines.push({ pts: [[0, -1.2, 0], [0, -1.9, 0]], w: 0.012, kind: 'flat', col: [232, 196, 120] }, { pts: [[0, 1.4, 0], [0, 1.85, 0]], w: 0.012, kind: 'flat', col: [232, 196, 120] });
    const objs = [gem];
    if (o.extra) o.extra(objs);
    return objs;
  }
  const shards = (n, col, r = 1.55, o = {}) => orbiters((c) => paint(shard(c, 0.06 + rnd() * 0.06, 0.12 + rnd() * 0.12, rnd() * 3), col, { e: o.e ?? 0.2, edge: o.edge, ea: 0.6 }, 0.2), n, r, o.yc ?? -0.1, { ys: o.ys ?? 1.6, speed: o.speed ?? 0.15 });
  const GEMS = [
    {
      name: 'Pure', tags: 'Clean · Classic · Simple', bg: [[110, 100, 90], [90, 80, 70]], star: [255, 240, 220],
      build: () => gemScene({ col: [226, 230, 238], edge: [232, 192, 110], deep: [60, 60, 70], core: [255, 255, 255], e: 0.1, spine: true }),
      gfx: (g) => twinkles(g, [255, 240, 210], 6, 1.5, 1.2, 0),
    },
    {
      name: 'Rose Quartz', tags: 'Warm · Soft · Pure', bg: [[170, 70, 110], [120, 50, 90]], star: [255, 210, 230],
      build: () => gemScene({
        col: [246, 140, 172], edge: [255, 214, 228], deep: [90, 30, 60],
        extra: (objs) => objs.push(...ring([0, -1.42, 0], 0.32, 0.25, 0, 0.016, [240, 200, 120], { spin: 0.4, sep: 0.5, glow: 0.6 })),
      }),
      gfx: (g) => twinkles(g, [255, 220, 235], 8, 1.5, 1.2, 0),
    },
    {
      name: 'Ice Vein', tags: 'Cold · Sharp · Clean', bg: [[40, 120, 150], [30, 80, 110]], star: [210, 245, 255],
      build: () => gemScene({ col: [120, 216, 236], edge: [225, 250, 255], deep: [20, 60, 80], extra: (objs) => objs.push(...shards(7, [150, 230, 250], 1.45, { e: 0.35, edge: [230, 250, 255] })) }),
      gfx: (g) => twinkles(g, [220, 250, 255], 10, 1.6, 1.2, 0),
    },
    {
      name: 'Nature', tags: 'Organic · Lush · Life', bg: [[40, 130, 70], [30, 90, 50]], star: [200, 255, 210],
      build: () => gemScene({
        col: [72, 204, 104], edge: [200, 255, 210], deep: [10, 50, 25],
        extra: (objs) => objs.push(...orbiters((c) => {
          const leaf = [add(c, [0, -0.16, 0]), add(c, [0.08, 0, 0.03]), add(c, [0, 0.12, 0]), add(c, [-0.08, 0, -0.03])];
          return [{ p: leaf, c: vary([90, 180, 70], 0.25), ds: true, amb: 0.5 }];
        }, 9, 1.4, -0.1, { ys: 1.8, speed: 0.2 })),
      }),
      gfx: (g) => embers(g, [180, 255, 160], 12, -1.2, 1.2, 1.2, 2.6, 0.9),
    },
    {
      name: 'Fractured', tags: 'Broken · Sharp · Chaotic', bg: [[40, 90, 170], [30, 60, 130]], star: [190, 220, 255],
      build: () => gemScene({ col: [84, 158, 236], edge: [205, 232, 255], deep: [16, 40, 90], fracture: true, extra: (objs) => objs.push(...shards(14, [100, 170, 240], 1.25, { e: 0.3, edge: [210, 235, 255], speed: 0.3 })) }),
      gfx: (g) => twinkles(g, [180, 220, 255], 10, 1.6, 1.2, 0),
    },
    {
      name: 'Ember', tags: 'Hot · Volcanic · Destructive', bg: [[160, 40, 20], [110, 30, 20]], star: [255, 180, 130],
      build: () => gemScene({ col: [222, 64, 42], edge: [255, 170, 120], deep: [60, 8, 4], core: [255, 200, 120], cracks: { n: 6, col: [255, 140, 40], hot: [255, 230, 150] } }),
      gfx: (g) => embers(g, [255, 120, 40], 24, -1.2, 1.2, 1.0, 2.8, 1.1),
    },
    {
      name: 'Shadow Core', tags: 'Dark · Energetic · Unstable', bg: [[30, 90, 70], [30, 50, 50]], star: [180, 255, 220],
      build: () => gemScene({ col: [56, 62, 68], edge: [110, 130, 130], deep: [8, 10, 12], core: [80, 255, 180], coreR: 0.6, e: 0.05, cracks: { n: 7, col: [70, 255, 170], hot: [210, 255, 230] }, extra: (objs) => objs.push(...shards(6, [60, 66, 72], 1.5, { e: 0, edge: [110, 140, 130] })) }),
      gfx: (g) => embers(g, [90, 255, 180], 10, -1.0, 1.0, 1.0, 2.6, 0.9),
    },
    {
      name: 'Void', tags: 'Dark · Mysterious · Powerful', bg: [[90, 30, 140], [60, 20, 100]], star: [230, 180, 255],
      build: () => gemScene({
        col: [86, 48, 120], edge: [210, 130, 255], deep: [20, 6, 34], core: [230, 120, 255],
        extra(objs) {
          objs.push(...ring([0, 0.05, 0], 1.45, 0.45, -0.12, 0.03, [240, 110, 236], { glow: 1, spin: 0.3 }));
          objs.push(...shards(7, [70, 40, 100], 1.7, { e: 0.1, edge: [190, 120, 255] }));
        },
      }),
      gfx: (g) => twinkles(g, [230, 160, 255], 10, 1.6, 1.2, 0),
    },
    {
      name: 'Ascendant', tags: 'Regal · Focused · Divine', bg: [[170, 60, 30], [150, 100, 40]], star: [255, 220, 170],
      build: () => gemScene({
        col: [236, 76, 58], edge: [255, 204, 150], deep: [70, 10, 6], core: [255, 220, 160], spine: true, shape: { top: 1.25 },
        extra: (objs) => objs.push({ faces: paint(prism([0, -1.95, 0], [0, -1, 0], 0.07, 0.05, 0.28, 4), [255, 206, 110], { e: 0.8 }, 0), glows: [{ p: [0, -2.05, 0], r: 0.4, col: [255, 200, 110], a: 0.8 }], at: [0, -2, 0] }),
      }),
      gfx: (g) => twinkles(g, [255, 220, 150], 10, 1.5, 1.3, -0.2),
    },
    {
      name: 'Orbital', tags: 'Cosmic · Balanced · Noble', bg: [[170, 120, 30], [130, 90, 30]], star: [255, 230, 170],
      build: () => gemScene({
        col: [246, 196, 92], edge: [255, 242, 196], deep: [90, 50, 10], core: [255, 250, 220],
        extra(objs) {
          objs.push(...ring([0, -0.05, 0], 1.45, 0.3, 0.2, 0.03, [250, 206, 110], { spin: 0.35, dots: 4 }));
          objs.push(...ring([0, -0.05, 0], 1.32, 0.3, -0.35, 0.024, [250, 206, 110], { spin: -0.28 }));
        },
      }),
      gfx: (g) => twinkles(g, [255, 236, 180], 10, 1.6, 1.2, 0),
    },
    {
      name: 'Ether', tags: 'Mystic · Arcane · Otherworldly', bg: [[110, 70, 180], [80, 50, 140]], star: [220, 200, 255],
      build: () => gemScene({
        col: [160, 116, 232], edge: [232, 206, 255], deep: [34, 14, 70], core: [236, 210, 255],
        extra: (objs) => objs.push(...ring([0, -0.05, 0], 1.42, 0.45, 0.1, 0.04, [196, 140, 255], { spin: 0.25, glow: 1 })),
      }),
      gfx: (g) => twinkles(g, [220, 200, 255], 12, 1.6, 1.2, 0),
    },
    {
      name: 'Celestial', tags: 'Radiant · Ethereal · Infinite', bg: [[140, 110, 200], [170, 130, 70]], star: [255, 240, 220],
      build: () => gemScene({
        col: [198, 178, 246], edge: [255, 240, 210], deep: [40, 24, 80], core: [255, 250, 240], e: 0.25,
        extra(objs) {
          objs.push(...ring([0, -0.1, 0], 1.48, 0.32, 0.22, 0.026, [246, 206, 112], { spin: 0.3, dots: 6, dotCol: [255, 244, 210] }));
          objs.push(...ring([0, 0.0, 0], 1.32, 0.28, -0.25, 0.018, [246, 206, 112], { spin: -0.24 }));
        },
      }),
      gfx: (g) => twinkles(g, [255, 236, 190], 18, 1.8, 1.4, 0, 1.3),
    },
  ];
  // Industrialist: twelve gems, from raw ore to the sovereign's gold, as the mines grow
  const GEMS_IND = [
    {
      name: 'Raw Ore', tags: 'Rough · Heavy · Unworked', bg: [[100, 90, 80], [70, 64, 58]], star: [230, 220, 200],
      build: () => gemScene({ col: [128, 118, 108], edge: [200, 176, 130], deep: [40, 36, 32], core: [230, 200, 150], coreR: 0.55, alpha: 0.92, e: 0.05, fracture: true, shape: { n: 7, top: 1.0, bot: 1.2, r: 0.84 } }),
      gfx: (g) => twinkles(g, [240, 210, 150], 5, 1.4, 1.1, 0, 0.8),
    },
    {
      name: 'Native Copper', tags: 'Warm · Ductile · Honest', bg: [[170, 90, 50], [110, 60, 40]], star: [255, 200, 160],
      build: () => gemScene({ col: [214, 120, 72], edge: [255, 196, 150], deep: [70, 30, 14], core: [255, 210, 170], shape: { n: 8, top: 1.05, bot: 1.25 } }),
      gfx: (g) => twinkles(g, [255, 200, 160], 7, 1.5, 1.2, 0),
    },
    {
      name: 'Hematite', tags: 'Dark · Dense · Ironbound', bg: [[90, 70, 70], [60, 50, 55]], star: [230, 210, 210],
      build: () => gemScene({ col: [78, 76, 82], edge: [196, 196, 206], deep: [14, 12, 16], core: [220, 120, 110], coreR: 0.6, e: 0.08, alpha: 0.88, shape: { n: 6 }, extra: (objs) => objs.push(...shards(8, [96, 94, 102], 1.5, { e: 0.05, edge: [200, 200, 210] })) }),
      gfx: (g) => embers(g, [255, 170, 110], 8, -1.0, 1.0, 1.0, 2.2, 0.8),
    },
    {
      name: 'Pyrite', tags: 'Brassy · Cubic · Bold', bg: [[170, 140, 60], [110, 90, 40]], star: [255, 236, 170],
      build: () => gemScene({ col: [214, 184, 92], edge: [255, 238, 170], deep: [70, 54, 14], core: [255, 244, 200], shape: { n: 4, top: 1.2, bot: 1.2, r: 0.9 }, extra: (objs) => objs.push(...shards(5, [220, 190, 100], 1.55, { e: 0.3, edge: [255, 236, 170] })) }),
      gfx: (g) => twinkles(g, [255, 236, 170], 9, 1.6, 1.2, 0),
    },
    {
      name: 'Imperial Topaz', tags: 'Golden · Clear · Bright', bg: [[200, 130, 40], [150, 90, 30]], star: [255, 220, 160],
      build: () => gemScene({ col: [244, 164, 64], edge: [255, 226, 170], deep: [90, 44, 8], core: [255, 236, 190], shape: { n: 10, top: 1.3, bot: 1.4, r: 0.66 } }),
      gfx: (g) => twinkles(g, [255, 220, 160], 10, 1.5, 1.3, 0),
    },
    {
      name: 'Garnet', tags: 'Deep · Steady · Loyal', bg: [[140, 30, 40], [90, 20, 30]], star: [255, 190, 190],
      build: () => gemScene({
        col: [158, 30, 44], edge: [255, 170, 170], deep: [40, 4, 10], core: [255, 140, 140], shape: { n: 6, top: 1.0, bot: 1.0, r: 0.9 },
        extra: (objs) => objs.push(...ring([0, -0.1, 0], 1.38, 0.32, 0.12, 0.02, [214, 172, 112], { spin: 0.3 })),
      }),
      gfx: (g) => twinkles(g, [255, 190, 190], 8, 1.5, 1.2, 0),
    },
    {
      name: 'Jade', tags: 'Calm · Smooth · Enduring', bg: [[50, 130, 100], [30, 90, 70]], star: [200, 255, 230],
      build: () => gemScene({ col: [86, 176, 132], edge: [210, 250, 228], deep: [14, 54, 40], core: [220, 255, 236], alpha: 0.9, shape: { n: 12, top: 1.1, bot: 1.2, r: 0.8 } }),
      gfx: (g) => embers(g, [180, 255, 220], 8, -1.1, 1.1, 1.1, 2.4, 0.8),
    },
    {
      name: 'Deep Sapphire', tags: 'Cool · Royal · Still', bg: [[40, 70, 170], [30, 50, 120]], star: [200, 220, 255],
      build: () => gemScene({
        col: [52, 92, 210], edge: [190, 214, 255], deep: [8, 18, 70], core: [200, 220, 255],
        extra: (objs) => objs.push(...ring([0, -0.05, 0], 1.45, 0.4, -0.15, 0.03, [180, 200, 255], { spin: -0.3, dots: 3, glow: 0.7 })),
      }),
      gfx: (g) => twinkles(g, [200, 220, 255], 11, 1.6, 1.2, 0),
    },
    {
      name: 'Forge Heart', tags: 'Iron · Fire · Relentless', bg: [[150, 70, 30], [80, 40, 30]], star: [255, 200, 140],
      build: () => gemScene({ col: [70, 60, 58], edge: [210, 160, 110], deep: [12, 8, 6], core: [255, 190, 90], coreR: 0.7, e: 0.06, cracks: { n: 5, col: [255, 170, 60], hot: [255, 240, 180], w: 0.026 } }),
      gfx: (g) => embers(g, [255, 160, 60], 20, -1.1, 1.1, 1.0, 2.6, 1.0),
    },
    {
      name: 'Black Opal', tags: 'Rare · Shifting · Secret', bg: [[40, 110, 140], [90, 50, 130]], star: [210, 240, 255],
      build: () => gemScene({
        col: [34, 40, 58], edge: [120, 220, 230], deep: [6, 8, 14], core: [120, 255, 230], coreR: 0.7, e: 0.06, cracks: { n: 6, col: [110, 160, 255], hot: [220, 250, 255], w: 0.018 },
        extra: (objs) => objs.push(...shards(6, [40, 46, 66], 1.55, { e: 0.1, edge: [200, 140, 255] })),
      }),
      gfx: (g) => twinkles(g, [180, 255, 230], 12, 1.6, 1.2, 0),
    },
    {
      name: 'Platinum', tags: 'Pale · Precious · Exact', bg: [[150, 150, 170], [100, 104, 120]], star: [240, 244, 255],
      build: () => gemScene({
        col: [210, 214, 226], edge: [255, 255, 255], deep: [60, 62, 74], core: [255, 255, 255], e: 0.2, spine: true, shape: { n: 10, top: 1.25, bot: 1.4, r: 0.7 },
        extra(objs) {
          objs.push(...ring([0, -0.1, 0], 1.46, 0.32, 0.22, 0.024, [230, 232, 244], { spin: 0.3, dots: 4, dotCol: [255, 255, 255] }));
          objs.push(...ring([0, 0.0, 0], 1.3, 0.28, -0.25, 0.018, [230, 232, 244], { spin: -0.24 }));
        },
      }),
      gfx: (g) => twinkles(g, [240, 244, 255], 16, 1.7, 1.3, 0),
    },
    {
      name: 'Sovereign Gold', tags: 'Crowned · Radiant · Vast', bg: [[190, 130, 40], [140, 100, 50]], star: [255, 236, 180],
      build: () => gemScene({
        col: [240, 186, 72], edge: [255, 240, 190], deep: [90, 52, 8], core: [255, 250, 220], e: 0.25, spine: true, shape: { n: 12, top: 1.3, bot: 1.4 },
        extra(objs) {
          objs.push({ faces: paint(prism([0, -1.95, 0], [0, -1, 0], 0.08, 0.05, 0.3, 4), [255, 214, 120], { e: 0.8 }, 0), glows: [{ p: [0, -2.05, 0], r: 0.45, col: [255, 210, 120], a: 0.85 }], at: [0, -2, 0] });
          objs.push(...ring([0, -0.05, 0], 1.48, 0.32, 0.18, 0.03, [250, 206, 110], { spin: 0.32, dots: 6, dotCol: [255, 244, 210] }));
          objs.push(...shards(8, [250, 206, 110], 1.75, { e: 0.6, edge: [255, 240, 190] }));
        },
      }),
      gfx: (g) => twinkles(g, [255, 236, 180], 20, 1.8, 1.4, 0, 1.3),
    },
  ];
  // Communist: six gems, one for each stage of the Great Work, from raw stone to the Philosopher's Stone
  const GEMS_COM = [
    {
      name: 'Prima Materia', tags: 'Raw · Formless · Waiting', bg: [[110, 100, 96], [80, 72, 70]], star: [230, 220, 214],
      build: () => gemScene({ col: [133, 122, 112], edge: [196, 180, 170], deep: [40, 36, 34], core: [220, 200, 190], coreR: 0.5, alpha: 0.92, e: 0.04, fracture: true, shape: { n: 6, top: 1.0, bot: 1.1, r: 0.88 } }),
      gfx: (g) => twinkles(g, [230, 220, 214], 4, 1.4, 1.1, 0, 0.8),
    },
    {
      name: 'Nigredo', tags: 'Black · Dissolving · Deep', bg: [[70, 60, 90], [40, 36, 50]], star: [210, 200, 230],
      build: () => gemScene({
        col: [44, 40, 52], edge: [143, 133, 153], deep: [6, 6, 8], core: [180, 160, 220], coreR: 0.6, e: 0.04, cracks: { n: 5, col: [150, 130, 200], hot: [230, 220, 255], w: 0.016 },
        extra: (objs) => objs.push(...shards(7, [50, 46, 60], 1.55, { e: 0, edge: [143, 133, 153] })),
      }),
      gfx: (g) => embers(g, [160, 140, 200], 8, -1.0, 1.0, 1.0, 2.2, 0.8),
    },
    {
      name: 'Albedo', tags: 'White · Washed · Pure', bg: [[160, 166, 180], [110, 116, 130]], star: [240, 244, 255],
      build: () => gemScene({
        col: [226, 228, 234], edge: [255, 255, 255], deep: [70, 72, 84], core: [255, 255, 255], e: 0.15, shape: { n: 10, top: 1.25, bot: 1.35, r: 0.72 },
        extra: (objs) => objs.push(...ring([0, -0.05, 0], 1.42, 0.38, 0.1, 0.022, [236, 238, 248], { spin: 0.26, glow: 0.6 })),
      }),
      gfx: (g) => twinkles(g, [240, 244, 255], 12, 1.6, 1.2, 0),
    },
    {
      name: 'Citrinitas', tags: 'Yellow · Dawning · Wise', bg: [[200, 170, 70], [150, 120, 50]], star: [255, 240, 190],
      build: () => gemScene({
        col: [228, 200, 120], edge: [255, 244, 200], deep: [90, 70, 20], core: [255, 250, 220], shape: { n: 8, top: 1.2, bot: 1.3 },
        extra: (objs) => objs.push(...shards(9, [236, 206, 120], 1.5, { e: 0.45, edge: [255, 244, 200] })),
      }),
      gfx: (g) => twinkles(g, [255, 240, 190], 14, 1.6, 1.2, 0),
    },
    {
      name: 'Rubedo', tags: 'Red · Living · Complete', bg: [[170, 60, 70], [110, 40, 50]], star: [255, 200, 200],
      build: () => gemScene({
        col: [200, 72, 88], edge: [255, 196, 200], deep: [60, 10, 18], core: [255, 210, 200], cracks: { n: 4, col: [255, 120, 110], hot: [255, 230, 210], w: 0.018 },
        extra: (objs) => objs.push(...ring([0, -0.05, 0], 1.44, 0.34, -0.18, 0.026, [217, 143, 152], { spin: -0.3, dots: 4 })),
      }),
      gfx: (g) => embers(g, [255, 150, 140], 16, -1.1, 1.1, 1.0, 2.6, 1.0),
    },
    {
      name: "Philosopher's Stone", tags: 'Perfected · Eternal · One', bg: [[190, 70, 90], [180, 130, 60]], star: [255, 230, 210],
      build: () => gemScene({
        col: [226, 60, 80], edge: [255, 220, 170], deep: [70, 6, 16], core: [255, 236, 200], e: 0.25, spine: true, shape: { n: 12, top: 1.3, bot: 1.4 },
        extra(objs) {
          objs.push({ faces: paint(prism([0, -1.95, 0], [0, -1, 0], 0.07, 0.05, 0.28, 4), [255, 210, 120], { e: 0.8 }, 0), glows: [{ p: [0, -2.05, 0], r: 0.42, col: [255, 200, 130], a: 0.85 }], at: [0, -2, 0] });
          objs.push(...ring([0, -0.1, 0], 1.48, 0.32, 0.22, 0.026, [246, 206, 112], { spin: 0.3, dots: 6, dotCol: [255, 244, 210] }));
          objs.push(...ring([0, 0.0, 0], 1.32, 0.28, -0.25, 0.018, [236, 150, 160], { spin: -0.24 }));
        },
      }),
      gfx: (g) => twinkles(g, [255, 230, 210], 20, 1.8, 1.4, 0, 1.3),
    },
  ];
  const FAMILIES = { ind: GEMS_IND, gem: GEMS, com: GEMS_COM };
  const FAMILY_SEED = { ind: 3, gem: 9, com: 5 };

  // the scene for the design on show, built once (seeded, so it's the same every time) and again when it changes
  let built = { key: '', objs: [] };
  const caption = $('stl');
  let captionKey = '';
  function draw(dt) {
    setup();
    if (!W) return;
    look = mode.stone(); // { family: 'ind' | 'gem' | 'com', style, next, fill: 0–1, orbs }
    const list = FAMILIES[look.family] || GEMS, idx = Math.max(0, Math.min(list.length - 1, look.style | 0)), D = list[idx];
    const fill = look.fill;
    clock += dt;
    spin += dt * 0.04;
    glowK = 0.55 + 0.45 * fill;
    const key = look.family + idx;
    if (built.key !== key) {
      seed = 101 + idx * 17 + (FAMILY_SEED[look.family] || 0);
      built = { key, objs: D.build() };
    }
    view = { yaw: 0, tilt: 0.12, sc: 0.7, lift: 0.02 };
    if (caption) {
      const ck = look.family + idx + (look.next || '') + resonance(mode.key);
      if (ck !== captionKey) {
        captionKey = ck;
        const res = Math.round((resonance(mode.key) - 1) * 100);
        caption.innerHTML = `<b>${D.name}</b><small>${D.tags}</small><small class="stn">Design ${idx + 1} of ${list.length}${look.next ? ' · Next: ' + look.next : ' · All designs unlocked'}</small>` +
          `<small class="stn">Each design here gives +${RESONANCE_STEP * 100}% output in your other modes${res ? ` · theirs give +${res}% here` : ''}</small>`;
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    // 1. the atmosphere behind, in the design's colors
    const [c1, c2] = D.bg;
    ctx.globalCompositeOperation = 'lighter';
    clouds(ctx, [[-0.3, -0.7, 2.3, c1, 0.26 * (0.6 + 0.4 * fill), 0.1], [1.2, 0.2, 1.4, c2, 0.16, 0.14], [-1.4, 0.3, 1.3, c1, 0.14, 0.12], [0.2, 0.4, 1.6, c2, 0.12, 0.08]]);
    stars(ctx, D.star, 50);
    ctx.globalCompositeOperation = 'source-over';
    // 2. the sigil and the orbs behind the goal, with their own soft bloom
    const back = [], front = [];
    look.orbs.forEach((o, i) => {
      const a = o.a + clock * o.v;
      const x = cx + Math.cos(a) * R * o.r, y = cy + Math.sin(a) * R * o.r * 0.32 + Math.cos(a) * R * o.tilt * o.r;
      (Math.sin(a) < 0 ? back : front).push([x, y, o.color, o.alpha * (0.75 + 0.25 * Math.sin(clock * 2 + i)), o.size]);
    });
    const dots = (g, l) =>
      l.forEach(([x, y, c, a, size]) => {
        g.globalAlpha = a;
        g.fillStyle = c;
        g.beginPath();
        g.arc(x, y, size, 0, 6.283);
        g.fill();
      });
    bloom((g) => {
      sigil(g, 0.4 + 0.3 * fill);
      dots(g, back);
    }, 0.6);
    // 3. the goal: its shadow, the scene, then smoke and everything that glows
    const [gx, gy] = P([0, 1.75, 0]), sh = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 1.9);
    sh.addColorStop(0, 'rgba(0,0,0,.6)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(gx, gy, R * 1.9, R * 0.45, 0, 0, 6.283);
    ctx.fill();
    const G = { faces: [], lines: [], pts: [] };
    render(built.objs, G);
    bloom((g) => {
      paintGlow(g, G);
      if (D.gfx) D.gfx(g);
    }, 0.6 + 0.35 * fill);
    // 4. the orbs passing in front
    bloom((g) => dots(g, front), 0.6);
  }
  function frame(t) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - (last || t)) / 1000);
    last = t;
    draw(dt);
  }
  addEventListener('resize', () => (running || W) && ((W = 0), draw(0)));
  return {
    // show(true) when the Magnum Opus tab opens, show(false) when it closes
    show(on) {
      const animate = on && !reducedMotion && settings.effects;
      if (on && !animate) return void draw(0);
      if (animate && !running) {
        running = true;
        last = 0;
        requestAnimationFrame(frame);
      } else if (!animate) running = false;
    },
    // for the design preview tool: how many designs each family has
    counts: () => ({ ind: GEMS_IND.length, gem: GEMS.length, com: GEMS_COM.length }),
  };
})();
