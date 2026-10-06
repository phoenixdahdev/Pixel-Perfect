/**
 * Gaze: a beige desktop computer. A low case with vents, a floppy slot and a power light; a CRT on a stand,
 * its tube behind; a mouse on its cable; a potted plant. The pointer is put on the desk: the monitor turns
 * its head toward it on the stand and its two eyes finish the look, both on springs. When the look lands on
 * the plant or the mouse, that object takes the bright edge and the eyes give it up. At rest it glances at
 * the plant. The slider is how far the head may turn, in degrees.
 *
 * The pattern: a field (one continuous position, springs), read on the desk plane, which never moves.
 */
const { Cam, circ, clamp, facing, fillet, fit, hull, open, poly, proj, prism, rings, ringAt, rrect, run, seg,
  unproj, spring, stepS, mk, solid, put, flatDot, place, pointer, register, disposer } = HL;

const ring = (R, x = 0, y = 0, n = 32) => circ(R, n).map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
const PX = 30, PY = 28, SZ = 42;            // the stand's pivot; the screen is the face x = 54 when facing +x
const PLANT = [72, -20], MOUSE = [96, 48];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.0);
  fit(C, [[0, 0, 0], [64, 52, 0], [0, 52, 0], [104, 54, 0], [PLANT[0] + 10, PLANT[1] - 10, 0], [PX - 33, PY, 62], [PX, PY - 33, 62], [PX + 33, PY, 62], [PX, PY + 33, 62], [PLANT[0], PLANT[1], 30]], 200, 166);
  const P = proj(C), front = facing(C);
  const taper = (foot, top, z0, z1, inner) => ({
    sil: poly(hull(ringAt(P, foot, z0).concat(ringAt(P, top, z1)))),
    crease: inner ? open(ringAt(P, run(inner, front), z1)) : "",
  });
  const box = (par, x0, y0, x1, y1, r, b, z0, z1) => { const s = solid(par), [o, i] = rings(x0, y0, x1, y1, r, b); put(s, prism(P, front, o, i, z0, z1)); return s; };
  /** A rounded rectangle on a vertical face: x = const (u along y) or y = const (u along x). */
  const onX = (x, y0, z0, y1, z1, r) => poly(rrect(y0, z0, y1, z1, r, 4).map((q) => P(x, q.u, q.v)));
  const mark = (par, d, cls = "nf lo") => mk("path", { d, class: cls }, par);

  const g = mk("g", {}, svg);
  // on the desk first: the cable, from the case's side out to the mouse
  mark(g, open([[64, 40], [74, 40], [80, 32], [88, 30], [90, 38], [92, 44]].map(([x, y]) => P(x, y, 0))));

  // the plant: a round pot (two tapers, a bulge) and three leaves standing in their own planes
  const plant = mk("g", {}, g), [px, py] = PLANT;
  put(solid(plant), taper(ring(7, px, py), ring(10, px, py), 0, 7));
  put(solid(plant), taper(ring(10, px, py), ring(7.5, px, py), 7, 15, ring(6, px, py)));
  const leaf = fillet([[0, 0], [2, 6], [8, 12], [13, 13], [9, 4]], [0.4, 3, 2, 0.6, 3]);
  for (const deg of [120, 300, 30]) {
    const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
    const el = solid(plant);
    put(el, { sil: poly(leaf.map(([s, t]) => P(px + dx * s, py + dy * s, 14 + t))), crease: seg(P(px, py, 14), P(px + dx * 9, py + dy * 9, 20)) });
  }

  // the case: vents on its long side, a floppy slot and a power light on its short one
  const box0 = mk("g", {}, g);
  box(box0, 0, 0, 64, 52, 5, 1.6, 0, 18);
  mark(box0, [8, 11.5, 15].map((x) => seg(P(x, 52, 6), P(x, 52, 12))).join(""));
  mark(box0, onX(64, 28, 7, 46, 13, 1.5), "nf");
  mark(box0, seg(P(64, 30.5, 10), P(64, 40, 10)));
  place(mk("circle", { r: 1.1, class: "dot m" }, box0), P(64, 43, 10));
  place(mk("circle", { r: 0.9, class: "dot off" }, box0), P(64, 48.5, 3.5));

  // the monitor: a plate on the case, the tube's back, then the front bezel with its screen
  const mon = mk("g", {}, g);
  box(mon, 16, 10, 46, 42, 4, 1.2, 18, 20);
  // the head turns on the stand: every part is built in the head's own frame, then turned by yaw about the pivot
  const turn = (q, c, s) => ({ u: PX + (q.u - PX) * c - (q.v - PY) * s, v: PY + (q.u - PX) * s + (q.v - PY) * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c });
  const HEAD = [[26, 18, 36, 34, 3, 1, 20, 24], [14, 14, 42, 42, 6, 1.6, 27, 57], [40, 6, 54, 50, 7, 1.8, 22, 62]]
    .map(([x0, y0, x1, y1, r, b, z0, z1]) => ({ rr: rings(x0, y0, x1, y1, r, b), z0, z1, el: solid(mon) }));
  const screen = [mk("path", { class: "nf" }, mon), mk("path", { class: "nf lo" }, mon)];
  const eyes = [mk("path", { class: "nf hi" }, mon), mk("path", { class: "nf hi" }, mon)];
  function drawHead(yaw, ey, ez) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const h of HEAD) put(h.el, prism(P, front, h.rr[0].map((q) => turn(q, c, s)), h.rr[1].map((q) => turn(q, c, s)), h.z0, h.z1));
    // a rounded rectangle on the screen face, (u, v) = (y, z) in the head's frame
    const face = (y0, z0, y1, z1, r) => poly(rrect(y0, z0, y1, z1, r, 4).map((q) => { const t = turn({ u: 54, v: q.u, nu: 0, nv: 0 }, c, s); return P(t.u, t.v, q.v); }));
    screen[0].setAttribute("d", face(12, 28, 44, 56, 6));
    screen[1].setAttribute("d", face(14, 30, 42, 54, 5));
    [-5, 5].forEach((d, i) => eyes[i].setAttribute("d", face(PY + d - 1.6 + ey, SZ - 5 + ez, PY + d + 1.6 + ey, SZ + 5 + ez, 1.6)));
  }

  // the mouse, with the seam between its buttons
  const mouse = mk("g", {}, g), [mx, my] = MOUSE;
  const mS = solid(mouse);
  put(mS, taper(rrect(mx - 7, my - 5, mx + 7, my + 5, 5, 4), rrect(mx - 5, my - 3.5, mx + 5.5, my + 3.5, 3.5, 4), 0, 4.5, rrect(mx - 3.5, my - 2, mx + 4, my + 2, 2, 4)));
  mark(mouse, seg(P(mx + 1.5, my, 4.5), P(mx + 5.5, my, 3.4)));

  // gaze: three springs, the head's yaw (radians) and the eyes across (y) and up (z) the screen
  const rad = (d) => (d * Math.PI) / 180;
  let maxTurn = rad(value);
  const yawS = spring(0, { eps: 0.001 }), gy = spring(0, { eps: 0.01 }), gz = spring(0, { eps: 0.01 });
  let drawn = "";
  const B = register(stage, (dt) => {
    const m = stepS(yawS, dt) | stepS(gy, dt) | stepS(gz, dt);
    const key = [yawS.x, gy.x, gz.x].map((v) => v.toFixed(3)).join();
    if (key !== drawn) { drawn = key; drawHead(yawS.x, gy.x, gz.x); }
    return Boolean(m);
  });
  bag.add(B.unregister);

  const centre = P(54, PY, SZ);
  /** Turn toward a desk point: the head takes what it may of the angle, the eyes the rest. */
  function aim(x, y, up) {
    const phi = Math.atan2(y - PY, x - PX), yaw = clamp(phi, -maxTurn, maxTurn);
    yawS.t = yaw;
    gy.t = clamp((phi - yaw) / rad(40), -1, 1) * 6;
    gz.t = clamp(up, -1, 1) * 4;
  }
  let last = null;
  function look(sx, sy) {
    let on = "rest";
    last = sx == null ? null : [sx, sy];
    if (sx == null) { yawS.t = rad(-6); gy.t = -5; gz.t = 1.5; } // rest: face the reader, eyes slid toward the plant
    else {
      const [x, y] = unproj(C, sx, sy, 0);
      aim(x, y, (centre[1] - sy) / 70);
      on = Math.hypot(x - PLANT[0], y - PLANT[1]) < 16 ? "plant" : Math.hypot(x - MOUSE[0], y - MOUSE[1]) < 12 ? "mouse" : "you";
    }
    plant.querySelectorAll(".sil").forEach((el) => el.classList.toggle("hi", on === "plant"));
    mS.sil.classList.toggle("hi", on === "mouse");
    eyes.forEach((e) => e.classList.toggle("hi", on === "rest" || on === "you"));
    read.textContent = on;
    B.wake();
  }
  look();

  bag.add(pointer(stage, { move: (p) => look(p[0], p[1]), leave: () => look() }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { maxTurn = rad(v); look(...(last ?? [])); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "gaze",
  means: "A desktop computer that turns its head and eyes toward the pointer, and says what it is looking at.",
  rules: [1, 4, 5, 8],
  range: [10, 25, 40],
  mount,
});
