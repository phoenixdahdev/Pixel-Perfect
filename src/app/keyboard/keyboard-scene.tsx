"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { LABEL, LAYERS } from "./art/keyboard-svg";
import { Figure, IllArt, isTypingTarget, useActiveSection } from "./ill-art";

gsap.registerPlugin(useGSAP);

// Phrases the idle "ghost" types when nobody is touching the keyboard.
const PHRASES = ["pixel perfect", "hello world", "ship it"];
const IDLE_MS = 6000;

const codeFor = (ch: string) =>
  ch === " " ? "Space" : /[a-z]/.test(ch) ? `Key${ch.toUpperCase()}` : /\d/.test(ch) ? `Digit${ch}` : null;

export function KeyboardScene() {
  const root = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const active = useActiveSection(section);
  const intro = useRef<gsap.core.Timeline | null>(null);
  const introDone = useRef(false);
  const lastUser = useRef(0);

  // ── Intro, built for 60fps:
  //    • whole-stage entrance, cable slide and controls drop animate layer <div>s → compositor only
  //    • keys drop with transform only and snap visible (no per-key opacity: half-transparent keys
  //      show the lines behind them, and group opacity costs an offscreen pass per key per frame)
  //    • no stroke draw-on: half-drawn outlines read as broken lines
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const layer = (name: string) => el.querySelector<HTMLElement>(`[data-layer="${name}"]`);

      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(el, { autoAlpha: 1 });
        introDone.current = true;
        return;
      }

      const keys = gsap.utils
        .toArray<SVGGElement>(".key", el)
        .sort((a, b) => Number(a.dataset.cx) - Number(b.dataset.cx));
      const slots = gsap.utils.toArray<SVGGElement>(".knob-slot", el);
      const layers = [layer("cable"), layer("controls")].filter(Boolean) as HTMLElement[];
      const spin = { a: -405 };

      gsap.set(el, { autoAlpha: 1 });
      slots.forEach((s) => (s.style.transition = "none"));

      intro.current = gsap
        .timeline({
          // start after the site template's 0.25s blur-in (src/app/template.tsx): a full-page filter
          // running under the intro doubles the per-frame cost
          delay: 0.3,
          defaults: { ease: "expo.out" },
          onComplete: () => {
            // Hand transforms back to CSS so hover/typing (.key.down) can take over.
            keys.forEach((k) => k.removeAttribute("transform"));
            gsap.set(keys, { clearProps: "transform,visibility" });
            gsap.set([el, ...layers], { clearProps: "transform,opacity" });
            slots.forEach((s) => (s.style.transition = ""));
            introDone.current = true;
          },
        })
        .from(el, { y: 24, opacity: 0, duration: 0.9 }, 0)
        // keys snap visible at the start of their own drop
        .fromTo(keys, { visibility: "hidden" }, { visibility: "visible", duration: 0.01, stagger: { amount: 0.9 } }, 0.35)
        .from(keys, { y: -18, duration: 0.55, ease: "back.out(1.6)", stagger: { amount: 0.9 } }, 0.35)
        .from(layer("controls"), { y: -12, opacity: 0, duration: 0.6 }, 1)
        .to(spin, { a: -45, duration: 1.2, ease: "power3.out", onUpdate: () => slots.forEach((s) => (s.style.transform = `rotate(${spin.a}deg)`)) }, 1)
        // world −y is screen (+x, −y/2): the cable layer slides along the cable's own axis into the port
        .from(layer("cable"), { xPercent: 12, yPercent: -12, opacity: 0, duration: 1 }, 1.1)
        .to(keys, { y: 3.4, duration: 0.1, ease: "power1.out", yoyo: true, repeat: 1, stagger: { amount: 0.7 } }, 1.9);
    },
    { scope: root },
  );

  // ── Live interactions: hover press, real typing, knob wheel, clock, idle ghost typing.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const svg = el; // the layer stack: keys live in two layers, knobs + clock in another

    const byCode = new Map<string, SVGGElement>();
    svg.querySelectorAll<SVGGElement>(".key[data-code]").forEach((k) => byCode.set(k.dataset.code!, k));
    const press = (code: string, on: boolean) => byCode.get(code)?.classList.toggle("down", on);
    const touch = () => (lastUser.current = performance.now());

    const onOver = (e: PointerEvent) => {
      if (!introDone.current) return;
      const k = (e.target as Element).closest(".key");
      if (k) { k.classList.add("down"); touch(); }
    };
    const onOut = (e: PointerEvent) => {
      const k = (e.target as Element).closest(".key");
      if (k && !k.contains(e.relatedTarget as Node | null)) k.classList.remove("down");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!active.current || isTypingTarget(e.target) || !byCode.has(e.code)) return;
      touch();
      press(e.code, true);
      if (/^(Space|Arrow)/.test(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => press(e.code, false);
    const releaseAll = () => svg.querySelectorAll(".key.down").forEach((k) => k.classList.remove("down"));

    svg.addEventListener("pointerover", onOver);
    svg.addEventListener("pointerout", onOut);
    addEventListener("keydown", onKeyDown);
    addEventListener("keyup", onKeyUp);
    addEventListener("blur", releaseAll);

    // Knobs: the wheel turns the slot inside the knob's top plane, so it stays isometric.
    const knobCleanups: (() => void)[] = [];
    svg.querySelectorAll<SVGGElement>(".knob-slot").forEach((slot) => {
      let a = -45;
      const knob = svg.querySelector(`#${slot.dataset.knob}`);
      const onWheel = (e: Event) => {
        e.preventDefault();
        touch();
        a += Math.sign((e as WheelEvent).deltaY) * 15;
        slot.style.transform = `rotate(${a}deg)`;
      };
      knob?.addEventListener("wheel", onWheel, { passive: false });
      knobCleanups.push(() => knob?.removeEventListener("wheel", onWheel));
    });

    // The display clock shows the real time.
    const time = svg.querySelector(".clock-time");
    const date = svg.querySelector(".clock-date");
    const tick = () => {
      const now = new Date();
      if (time) time.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (date) date.textContent = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    };
    tick();
    const clock = setInterval(tick, 10_000);

    // Idle ghost: types a phrase whenever nobody has touched the keyboard for a while.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alive = true;
    let timer = 0;
    const sleep = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)));
    const idle = () => performance.now() - lastUser.current > IDLE_MS;
    (async () => {
      let p = 0;
      while (alive) {
        await sleep(1500);
        if (!alive || reduce || !introDone.current || !active.current || !idle()) continue;
        for (const ch of PHRASES[p++ % PHRASES.length]) {
          if (!alive || !idle()) break;
          const code = codeFor(ch);
          if (code) press(code, true);
          await sleep(60 + Math.random() * 40);
          if (code) press(code, false);
          await sleep(70 + Math.random() * 110);
        }
        await sleep(2200);
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(clock);
      svg.removeEventListener("pointerover", onOver);
      svg.removeEventListener("pointerout", onOut);
      removeEventListener("keydown", onKeyDown);
      removeEventListener("keyup", onKeyUp);
      removeEventListener("blur", releaseAll);
      knobCleanups.forEach((f) => f());
    };
  }, [active]);

  const replay = () => {
    if (!intro.current) return;
    root.current?.querySelectorAll(".key.down").forEach((k) => k.classList.remove("down"));
    introDone.current = false;
    intro.current.restart();
  };

  return (
    <Figure
      sectionRef={section}
      footer={
        <button type="button" onClick={replay} className="uppercase transition-colors hover:text-[#d0d6e0]">
          Replay
        </button>
      }
    >
      <IllArt hostRef={root} label={LABEL} layers={LAYERS} className="w-[min(94vw,1100px)]" />
    </Figure>
  );
}
