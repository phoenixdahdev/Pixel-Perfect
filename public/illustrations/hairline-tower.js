/**
 * Tower: a wizard's tower on a floating island. A tapering stone base with a door, a stone middle with a
 * window, a half-timbered top floor and a witch's hat with a bent tip, a dormer and a chimney; pines and a
 * cauldron on the grass, stepping stones up to the door, a rock tapering away underneath.
 * The pointer's height picks a floor; the two joints above it open, staggered outwards from it, and the
 * floor picked takes the bright edge. At rest the hat floats a little off the tower, and is the bright mark.
 * The slider is the gap.
 *
 * The pattern: scrub and pick, with tweens for the choice and a hit test on the floors' rest bands.
 */
const { Cam, circ, fit, hull, open, poly, proj, rings, prism, ringAt, run, facing, seg, clamp,
  tween, tset, tval, tdone, mk, solid, put, flatDot, place, pointer, register, disposer } = HL;

const ring = (R, x = 0, y = 0, n = 48) => circ(R, n).map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
const FLOORS = [
  { name: "island", z0: -40, z1: 0 },
  { name: "door", z0: 0, z1: 24 },
  { name: "window", z0: 24, z1: 46 },
  { name: "study", z0: 47, z1: 62 },
  { name: "hat", z0: 62, z1: 108 },
];
const REST = [0, 0, 0, 0, 6], STEP = 40;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value;
  const C = Cam(45, 0.5, 1.5);
  fit(C, [[-60, -60, 0], [60, 60, 0], [60, -60, 0], [-60, 60, 0], [14, 10, -64], [0, 0, 108 + 2 * 20]], 200, 166);
  const P = proj(C), front = facing(C);

  /** A solid whose top differs from its foot: hull of the two rings, and the near half of `inner` as the crease. */
  const taper = (foot, top, z0, z1, inner) => ({
    sil: poly(hull(ringAt(P, foot, z0).concat(ringAt(P, top, z1)))),
    crease: inner ? open(ringAt(P, run(inner, front), z1)) : "",
  });
  /** A rounded rectangle standing on a round tower's face at angle th (deg), radius R: windows and doors. */
  const onFace = (th, R, z0, w, h) => {
    const a = (th * Math.PI) / 180, cx = R * Math.cos(a), cy = R * Math.sin(a), tx = -Math.sin(a), ty = Math.cos(a);
    const r = w / 2, pts = [[-r, 0], [r, 0]];
    for (let k = 0; k <= 8; k++) pts.push([r * Math.cos((k * Math.PI) / 8), h - r + r * Math.sin((k * Math.PI) / 8)]);
    return poly(pts.map(([u, v]) => P(cx + tx * u, cy + ty * u, z0 + v)));
  };
  /** A post or brace on the timber floor's face, from (th0, z0) to (th1, z1). */
  const beam = (R, th0, z0, th1, z1) => {
    const p = (th, z) => P(R * Math.cos((th * Math.PI) / 180), R * Math.sin((th * Math.PI) / 180), z);
    return seg(p(th0, z0), p(th1, z1));
  };

  const g = mk("g", {}, svg);
  // one group per floor, bottom to top: painting upwards is painting back to front for a stack
  const floors = FLOORS.map((f) => ({ ...f, g: mk("g", {}, g), tw: tween(0), drawn: NaN, parts: [] }));

  // ── the island and what grows on it: never lifted, back to front
  const isl = floors[0].g;
  put(solid(isl), taper(ring(56, 0, 0, 64), ring(10, 14, 10, 24), -5, -64));
  const [gr, gi] = rings(-60, -60, 60, 60, 28, 2);
  put(solid(isl), prism(P, front, gr, gi, -5, 0));
  const pine = (x, y, s) => {
    put(solid(isl), prism(P, front, ring(1.6 * s, x, y, 12), ring(1, x, y, 12), 0, 4 * s));
    [[10, 4, 13], [8, 11, 19], [5.6, 17, 25]].forEach(([r, z0, z1]) =>
      put(solid(isl), taper(ring(r * s, x, y, 24), ring(0.8, x, y, 8), z0 * s, z1 * s)));
  };
  pine(-48, 12, 1); pine(-36, 30, 1.25); pine(-50, 34, 0.85);
  put(solid(isl), taper(ring(4.5, 34, -24, 24), ring(7, 34, -24, 24), 0, 6));
  put(solid(isl), taper(ring(7, 34, -24, 24), ring(6, 34, -24, 24), 6, 10, ring(4.6, 34, -24, 24)));
  [[24, 24], [31, 31], [38, 37], [44, 45]].forEach(([x, y]) => place(flatDot(isl, C, 2.2, "dot off"), P(x, y, 0)));

  // ── the floors that lift: each a group of solids redrawn at its lift
  const add = (i, build, cls) => {
    const el = cls === "mark" ? mk("path", { class: "nf lo" }, floors[i].g) : solid(floors[i].g);
    floors[i].parts.push({ el, build });
  };
  add(1, (z) => taper(ring(19), ring(16.5), z, z + 24, ring(15)));
  add(1, (z) => onFace(45, 18.2, z, 8, 14), "mark");
  add(1, (z) => onFace(80, 17.6, z + 13, 4, 7), "mark");
  add(2, (z) => taper(ring(17.5), ring(15), z + 24, z + 46, ring(13.6)));
  add(2, (z) => onFace(25, 16.4, z + 30, 5, 9), "mark");
  add(3, (z) => taper(ring(16.5), ring(16.5), z + 47, z + 62, ring(15)));
  add(3, (z) => [0, 45, 90].map((t) => beam(16.6, t, z + 47, t, z + 62)).join("") + open(ringAt(P, run(ring(16.6), front), z + 50.5)) +
    onFace(22, 16.7, z + 52, 4.5, 7.5) + onFace(68, 16.7, z + 52, 4.5, 7.5), "mark");
  add(4, (z) => taper(ring(5.5, -15, 9, 16), ring(4, -15, 9, 16), z + 64, z + 84, ring(3, -15, 9, 16)));
  add(4, (z) => taper(ring(30, 0, 0, 64), ring(30, 0, 0, 64), z + 62, z + 65, ring(28.4, 0, 0, 64)));
  add(4, (z) => taper(ring(15), ring(5.5, -3, 3), z + 65, z + 96));
  add(4, (z) => taper(ring(5.5, -3, 3), ring(2.6, 1, -2, 12), z + 96, z + 104));
  add(4, (z) => taper(ring(2.6, 1, -2, 12), ring(0.7, 7, -7, 8), z + 104, z + 107));
  add(4, (z) => open(ringAt(P, run(ring(13.1, -0.6, 0.6), front), z + 71)), "mark");
  add(4, (z) => taper(ring(3.6, 13, 13, 16), ring(3.2, 13, 13, 16), z + 65, z + 73, ring(2.4, 13, 13, 16)));
  add(4, (z) => taper(ring(4.4, 13, 13, 16), ring(0.6, 12, 12, 8), z + 73, z + 79));
  const smoke = [mk("circle", { r: 1.6, class: "dot off" }, floors[4].g), mk("circle", { r: 1.1, class: "dot off" }, floors[4].g)];

  function draw(f, lift) {
    if (lift === f.drawn) return;
    f.drawn = lift;
    for (const p of f.parts) {
      const r = p.build(lift);
      if (typeof r === "string") p.el.setAttribute("d", r);
      else put(p.el, r);
    }
    if (f === floors[4]) { place(smoke[0], P(-17, 11, lift + 90)); place(smoke[1], P(-19, 13, lift + 96)); }
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    floors.forEach((f, i) => { if (i) draw(f, tval(f.tw, now)); if (!tdone(f.tw, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  // hit test on the floors' rest bands: the nearest rest centre on screen, within the tower's reach
  const centres = FLOORS.map((f, i) => P(0, 0, (f.z0 + f.z1) / 2 + REST[i]));
  const cx = P(0, 0, 0)[0];
  const hit = ([x, y]) => {
    if (Math.abs(x - cx) > 70 || y < centres[4][1] - 50 || y > centres[0][1] + 40) return -1;
    let best = -1, d = Infinity;
    centres.forEach((c, i) => { const e = Math.abs(c[1] - y); if (e < d) { d = e; best = i; } });
    return best;
  };

  let act = null;
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : (act ?? 4);
    act = a;
    floors.forEach((f, i) => {
      const lift = a < 0 ? REST[i] : i > a ? gap * clamp(i - a, 0, 2) : 0;
      tset(f.tw, lift, now, Math.abs(i - from) * STEP);
      const lit = a < 0 ? i === 4 : i === a;
      f.g.querySelectorAll(".sil").forEach((el) => el.classList.toggle("hi", lit));
    });
    read.textContent = a < 0 ? "rest" : FLOORS[a].name;
    B.wake();
  }
  floors.forEach((f, i) => { if (i) draw(f, REST[i]); f.tw = tween(REST[i]); });
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { gap = v; const a = act; act = null; setActive(a); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "tower",
  means: "A wizard's tower on a floating island: the pointer picks a floor and the tower opens above it.",
  rules: [1, 2, 5, 9],
  range: [8, 14, 20],
  mount,
});
