"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { LABEL, LAYERS } from "./art/register-svg";
import DATA from "./art/register-data.json";
import { paperPaths, printRow, type PaperCfg, type PrintedRow } from "./art/register-paper";
import { Figure, IllArt, hullPath, isTypingTarget, useActiveSection } from "./ill-art";

gsap.registerPlugin(useGSAP);

const IDLE_MS = 5000;
const PAPER = DATA.paper as PaperCfg;
const LMAX = (PAPER.curve.length - 1) * PAPER.step;
const ROW_W = PAPER.x1 - PAPER.x0;

type Api = { act: (role: string) => void };

// A toy cash register: grey keys ring up items onto the receipt, the orange total key springs the drawer,
// the feed key (front row, col 2) feeds paper and the key behind it tears the receipt off.
export function RegisterScene() {
  const root = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const intro = useRef<gsap.core.Timeline | null>(null);
  const introDone = useRef(false);
  const lastUser = useRef(0);
  const api = useRef<Api | null>(null);
  const active = useActiveSection(section, () => intro.current?.play());

  // ── Intro: the stage rises and the keys drop in left to right; then the register prints its receipt and
  //    the drawer springs open, as in the reference.
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(el, { autoAlpha: 1 });
        introDone.current = true;
        return;
      }
      const keys = gsap.utils
        .toArray<SVGGElement>(".key", el)
        .sort((a, b) => Number(a.dataset.cx) - Number(b.dataset.cx));
      const top = el.querySelector<HTMLElement>('[data-layer="top"]');
      gsap.set(el, { autoAlpha: 0 });
      intro.current = gsap
        .timeline({
          paused: true,
          defaults: { ease: "expo.out" },
          onComplete: () => {
            keys.forEach((k) => k.removeAttribute("transform"));
            gsap.set(keys, { clearProps: "transform,visibility" });
            gsap.set([el, top], { clearProps: "transform,opacity" });
            introDone.current = true;
            lastUser.current = performance.now(); // the idle ghost waits a full idle period after the intro
          },
        })
        .fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0)
        .from(top, { y: -10, opacity: 0, duration: 0.7 }, 0.3)
        .fromTo(keys, { visibility: "hidden" }, { visibility: "visible", duration: 0.01, stagger: { amount: 0.7 } }, 0.4)
        .from(keys, { y: -14, duration: 0.5, ease: "back.out(1.7)", stagger: { amount: 0.7 } }, 0.4)
        .call(() => api.current?.act("intro"), [], 1.4);
    },
    { scope: root },
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const fill = $(".receipt-fill"), edge = $(".receipt-edge"), ink = $(".receipt-ink");
    const tray = $<SVGGElement>('[data-layer="drawer"] .tray'), clip = $(".out-clip");
    const keys = [...el.querySelectorAll<SVGGElement>(".key")];
    const whites = keys.filter((k) => k.dataset.role === "item");
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => (timers.delete(t), fn()), ms);
      timers.add(t);
    };
    const touch = () => (lastUser.current = performance.now());

    // ── receipt: printed rows ride along as the paper feeds out of the slot
    let L = DATA.paperL;
    let lines: PrintedRow[] = DATA.lines.map((l) => ({ ...l }));
    let row = lines.length;
    const drawPaper = () => {
      const p = paperPaths(PAPER, L, lines);
      fill.setAttribute("d", p.fill);
      edge.setAttribute("d", p.edge);
      ink.setAttribute("d", p.ink);
    };
    let queue = Promise.resolve();
    const feed = (amount: number, segs?: number[][], dur = 200) => {
      queue = queue.then(
        () =>
          new Promise<void>((done) => {
            if (segs) lines.unshift({ d: 0, segs });
            const start = performance.now();
            let last = 0;
            const step = (now: number) => {
              const k = reduce || !dur ? 1 : Math.min(1, (now - start) / dur);
              const e = 1 - (1 - k) ** 3;
              const dd = (e - last) * amount;
              last = e;
              L = Math.min(LMAX, L + dd);
              lines.forEach((l) => (l.d += dd));
              lines = lines.filter((l) => l.d < LMAX);
              drawPaper();
              if (k < 1) requestAnimationFrame(step);
              else done();
            };
            requestAnimationFrame(step);
          }),
      );
    };
    const tear = () => {
      queue = queue.then(() => {
        L = 0;
        lines = [];
        drawPaper();
      });
      feed(8);
    };

    // ── drawer: one spring on the pull; world +y is screen (−s, s/2)
    const dr = DATA.drawer;
    const P = (x: number, y: number, z: number): [number, number] => [PAPER.ox + x - y, PAPER.oy + (x + y) / 2 - z];
    let s = dr.pull, v = 0, target = dr.pull, raf = 0;
    const setPull = (x: number) => {
      const k = x - dr.pull;
      tray.setAttribute("transform", `translate(${(-k).toFixed(2)} ${(k / 2).toFixed(2)})`);
      const pts: [number, number][] = [];
      for (const X of [dr.x0, dr.x1]) for (const Y of [dr.front, dr.front + Math.max(0, x) + 2]) for (const Z of [dr.z0, dr.z1]) pts.push(P(X, Y, Z));
      clip.setAttribute("d", hullPath(pts));
    };
    const spring = () => {
      cancelAnimationFrame(raf);
      if (reduce) {
        s = target;
        setPull(s);
        return;
      }
      let t0 = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.032, (now - t0) / 1000);
        t0 = now;
        v += (170 * (target - s) - 22 * v) * dt; // stiffness 170, damping 22
        s += v * dt;
        if (target === 0 && s < 0) {
          s = 0; // stops against the back of the body
          v = -v * 0.3;
        }
        setPull(s);
        if (Math.abs(v) > 0.05 || Math.abs(target - s) > 0.05) raf = requestAnimationFrame(tick);
        else {
          s = target;
          setPull(s);
        }
      };
      raf = requestAnimationFrame(tick);
    };
    const toggleDrawer = () => {
      target = target ? 0 : dr.pull;
      spring();
    };

    const act = (role: string) => {
      if (role === "intro") {
        // print the reference's receipt row by row, then pop the drawer
        L = 0;
        lines = [];
        drawPaper();
        DATA.lines.slice().reverse().forEach((ln) => feed(4.5, ln.segs, 70));
        feed(DATA.paperL - DATA.lines.length * 4.5, undefined, 300);
        later(toggleDrawer, reduce ? 0 : 1500);
        return;
      }
      if (role === "item") {
        feed(4.5, printRow(row++, ROW_W));
      }
      if (role === "feed") feed(9);
      if (role === "clear") {
        tear();
      }
      if (role === "total") {
        feed(4.5, [[3, ROW_W - 3]]);
        feed(4.5, [[3, 9], [15, ROW_W - 3]]);
        feed(6);
        toggleDrawer();
      }
    };
    api.current = { act };
    // start closed with an empty slot: the intro prints and opens it
    if (!reduce) {
      L = 0;
      lines = [];
      drawPaper();
      s = target = 0;
      setPull(0);
    }

    const press = (k: Element, ms = 120) => {
      k.classList.add("down");
      later(() => k.classList.remove("down"), ms);
    };
    const onOver = (e: PointerEvent) => {
      if (!introDone.current) return;
      const k = (e.target as Element).closest(".key");
      if (!k) return;
      k.classList.add("down");
      touch();
    };
    const onOut = (e: PointerEvent) => {
      const k = (e.target as Element).closest(".key");
      if (k && !k.contains(e.relatedTarget as Node | null)) k.classList.remove("down");
    };
    const onClick = (e: MouseEvent) => {
      if (!introDone.current) return;
      touch();
      const k = (e.target as Element).closest<SVGGElement>(".key");
      if (k) act(k.dataset.role!);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!active.current || !introDone.current || isTypingTarget(e.target)) return;
      let k: SVGGElement | null = null;
      if (/^[0-9]$/.test(e.key)) k = whites[(Number(e.key) * 7) % whites.length];
      else if (e.key === "Enter") k = $<SVGGElement>("#key-total");
      else if (e.key === " ") {
        k = $<SVGGElement>("#key-feed");
        e.preventDefault();
      } else if (e.key === "Backspace" || e.key === "Escape") k = $<SVGGElement>("#key-clear");
      if (!k) return;
      touch();
      press(k);
      act(k.dataset.role!);
    };
    el.addEventListener("pointerover", onOver);
    el.addEventListener("pointerout", onOut);
    el.addEventListener("click", onClick);
    addEventListener("keydown", onKeyDown);

    // Idle ghost: rings up three items and totals; tears the receipt off once it reaches the end.
    let alive = true;
    let timer = 0;
    const sleep = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)));
    const idle = () => performance.now() - lastUser.current > IDLE_MS;
    (async () => {
      while (alive) {
        await sleep(1500);
        if (!alive || reduce || !introDone.current || !active.current || !idle()) continue;
        if (L > LMAX - 20) {
          press($("#key-clear"));
          act("clear");
          await sleep(900);
        }
        for (const i of [3, 11, 6]) {
          if (!alive || !idle()) break;
          press(whites[i]);
          act("item");
          await sleep(420);
        }
        if (alive && idle()) {
          press($("#key-total"), 180);
          act("total");
        }
        await sleep(4000);
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerover", onOver);
      el.removeEventListener("pointerout", onOut);
      el.removeEventListener("click", onClick);
      removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  return (
    <Figure
      sectionRef={section}
    >
      <IllArt hostRef={root} label={LABEL} layers={LAYERS} className="w-[min(92vw,74vh,720px)] [&_.key]:cursor-pointer" />
    </Figure>
  );
}
