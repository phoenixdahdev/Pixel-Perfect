"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { LABEL, LAYERS } from "./art/keyboard-svg";
import { Figure, FooterButton, IllArt, finishIntro, liveKit, skipIntro, useScene } from "./ill-art";

gsap.registerPlugin(useGSAP);

// Phrases the idle "ghost" types when nobody is touching the keyboard.
const PHRASES = ["pixel perfect", "hello world", "ship it"];
const IDLE_MS = 6000;

const codeFor = (ch: string) =>
  ch === " " ? "Space" : /[a-z]/.test(ch) ? `Key${ch.toUpperCase()}` : /\d/.test(ch) ? `Digit${ch}` : null;

export function KeyboardScene() {
  const scene = useScene({ playOnView: false }); // first on the page: the intro plays on load
  const { rootRef, sectionRef, introRef, introDoneRef } = scene;

  // ── Intro, built for 60fps:
  //    • whole-stage entrance, cable slide and controls drop animate layer <div>s → compositor only
  //    • keys drop with transform only and snap visible (no per-key opacity: half-transparent keys
  //      show the lines behind them, and group opacity costs an offscreen pass per key per frame)
  //    • no stroke draw-on: half-drawn outlines read as broken lines
  useGSAP(
    () => {
      const el = rootRef.current;
      if (!el || skipIntro(el, scene)) return;
      const layer = (name: string) => el.querySelector<HTMLElement>(`[data-layer="${name}"]`);
      const keys = gsap.utils
        .toArray<SVGGElement>(".key", el)
        .sort((a, b) => Number(a.dataset.cx) - Number(b.dataset.cx));
      const slots = gsap.utils.toArray<SVGGElement>(".knob-slot", el);
      const spin = { a: -405 };

      gsap.set(el, { autoAlpha: 1 });
      slots.forEach((s) => (s.style.transition = "none"));

      introRef.current = gsap
        .timeline({
          // start after the site template's 0.25s blur-in (src/app/template.tsx): a full-page filter
          // running under the intro doubles the per-frame cost
          delay: 0.3,
          defaults: { ease: "expo.out" },
          onComplete: () => {
            slots.forEach((s) => (s.style.transition = ""));
            finishIntro(scene, keys, [el, layer("cable"), layer("controls")]);
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
    { scope: rootRef },
  );

  // ── Live: hover press, real typing, knob wheel, clock, idle ghost typing.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const kit = liveKit(el, scene, IDLE_MS);

    const byCode = new Map<string, SVGGElement>();
    el.querySelectorAll<SVGGElement>(".key[data-code]").forEach((k) => byCode.set(k.dataset.code!, k));
    const hold = (code: string, on: boolean) => byCode.get(code)?.classList.toggle("down", on);

    kit.onKey("keydown", (e) => {
      if (!byCode.has(e.code)) return;
      kit.touch();
      hold(e.code, true);
      if (/^(Space|Arrow)/.test(e.code)) e.preventDefault();
    });
    kit.onKey("keyup", (e) => hold(e.code, false));
    kit.on(window, "blur", () => el.querySelectorAll(".key.down").forEach((k) => k.classList.remove("down")));

    // Knobs: the wheel turns the slot inside the knob's top plane, so it stays isometric.
    el.querySelectorAll<SVGGElement>(".knob-slot").forEach((slot) => {
      let a = -45;
      const knob = el.querySelector(`#${slot.dataset.knob}`);
      if (!knob) return;
      kit.on(
        knob,
        "wheel",
        (e) => {
          e.preventDefault();
          kit.touch();
          a += Math.sign(e.deltaY) * 15;
          slot.style.transform = `rotate(${a}deg)`;
        },
        { passive: false },
      );
    });

    // The display clock shows the real time.
    const time = el.querySelector(".clock-time");
    const date = el.querySelector(".clock-date");
    const tick = () => {
      const now = new Date();
      if (time) time.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (date) date.textContent = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    };
    tick();
    const clock = setInterval(tick, 10_000);

    // Idle ghost: types a phrase whenever nobody has touched the keyboard for a while.
    let p = 0;
    kit.ghost(async () => {
      for (const ch of PHRASES[p++ % PHRASES.length]) {
        if (!kit.idle()) break;
        const code = codeFor(ch);
        if (code) hold(code, true);
        await kit.sleep(60 + Math.random() * 40);
        if (code) hold(code, false);
        await kit.sleep(70 + Math.random() * 110);
      }
      await kit.sleep(2200);
    });

    return () => {
      kit.dispose();
      clearInterval(clock);
    };
  }, [rootRef, scene]);

  const replay = () => {
    if (!introRef.current) return;
    rootRef.current?.querySelectorAll(".key.down").forEach((k) => k.classList.remove("down"));
    introDoneRef.current = false;
    introRef.current.restart();
  };

  return (
    <Figure sectionRef={sectionRef} footer={<FooterButton onClick={replay}>Replay</FooterButton>}>
      <IllArt hostRef={rootRef} label={LABEL} layers={LAYERS} className="w-[min(94vw,1100px)]" />
    </Figure>
  );
}
