"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { LABEL, LAYERS } from "./art/macropad-svg";
import { Figure, IllArt, isTypingTarget, useActiveSection } from "./ill-art";

gsap.registerPlugin(useGSAP);

const IDLE_MS = 5000;
const START = "2021";

// A clamshell macropad: three caps (2 · 0 · 2) and a bare switch. Dropping the fourth cap onto the switch
// rolls the year on the display from 2021 to 2022.
export function MacropadScene() {
  const root = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const intro = useRef<gsap.core.Timeline | null>(null);
  const introDone = useRef(false);
  const lastUser = useRef(0);
  const api = useRef<{ drop: () => void; reset: () => void } | null>(null);
  const active = useActiveSection(section, () => intro.current?.play());

  // ── Intro (plays the first time the section scrolls into view): the stage rises, the display unit
  //    drops onto its ribbon, the three caps drop in order, then the fourth cap lands and the year rolls.
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
      const caps = gsap.utils.toArray<SVGGElement>(".key:not(.off)", el);
      gsap.set(el, { autoAlpha: 0 });
      intro.current = gsap
        .timeline({
          paused: true,
          defaults: { ease: "expo.out" },
          onComplete: () => {
            caps.forEach((k) => k.removeAttribute("transform"));
            gsap.set(caps, { clearProps: "transform,visibility" });
            gsap.set([el, layer("display")], { clearProps: "transform,opacity" });
            introDone.current = true;
            lastUser.current = performance.now(); // the idle ghost waits a full idle period after the intro
            api.current?.drop();
          },
        })
        .fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0)
        .from(layer("display"), { y: -16, opacity: 0, duration: 0.8 }, 0.3)
        .fromTo(caps, { visibility: "hidden" }, { visibility: "visible", duration: 0.01, stagger: 0.12 }, 0.55)
        .from(caps, { y: -22, duration: 0.6, ease: "back.out(1.7)", stagger: 0.12 }, 0.55);
    },
    { scope: root },
  );

  // ── Live: hover press, click/type to write on the display, drop the last cap, idle ghost.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const keys = [...el.querySelectorAll<SVGGElement>(".key")];
    const cap = el.querySelector<SVGGElement>("#key-3")!;
    const digits = [...el.querySelectorAll<SVGTextElement>(".digit")];
    const caret = el.querySelector<SVGRectElement>(".caret")!;
    const X = digits.map((d) => Number(d.getAttribute("x")));
    let text = START;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => (timers.delete(t), fn()), ms);
      timers.add(t);
    };
    const touch = () => (lastUser.current = performance.now());

    const render = () => {
      digits.forEach((d, i) => (d.textContent = text[i] ?? ""));
      caret.setAttribute("x", String(text.length ? X[text.length - 1] + 7 : X[0] - 7));
    };
    const type = (ch: string) => {
      text = text.length < 4 ? text + ch : text.slice(1) + ch;
      render();
    };
    const back = () => {
      text = text.slice(0, -1);
      render();
    };
    const press = (k: Element, ms = 110) => {
      k.classList.add("down");
      later(() => k.classList.remove("down"), ms);
    };
    const drop = () => {
      if (!cap.classList.contains("off")) return;
      cap.classList.remove("off");
      cap.classList.add("drop");
      later(() => {
        cap.classList.remove("drop");
        if (text.length === 4) back();
        later(() => {
          press(cap);
          type("2");
        }, 260);
      }, reduce ? 0 : 640);
    };
    const reset = () => {
      cap.classList.add("off");
      text = START;
      render();
    };
    api.current = { drop, reset };

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
      if (k) return type(k.dataset.legend!);
      if ((e.target as Element).closest("#switch")) drop();
    };
    let flip = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!active.current || !introDone.current || isTypingTarget(e.target)) return;
      if (e.key === "Backspace" || e.key === "r" || e.key === "R") {
        touch();
        if (e.key === "Backspace") back();
        else reset();
        return;
      }
      const match = keys.filter((k) => k.dataset.legend === e.key && !k.classList.contains("off"));
      if (!match.length) return;
      touch();
      press(match[flip++ % match.length]);
      type(e.key);
    };
    el.addEventListener("pointerover", onOver);
    el.addEventListener("pointerout", onOut);
    el.addEventListener("click", onClick);
    addEventListener("keydown", onKeyDown);

    // Idle ghost: lift the last cap off (back to 2021), then drop it again so the year rolls over.
    let alive = true;
    let timer = 0;
    const sleep = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)));
    const idle = () => performance.now() - lastUser.current > IDLE_MS;
    (async () => {
      while (alive) {
        await sleep(1500);
        if (!alive || reduce || !introDone.current || !active.current || !idle()) continue;
        if (!cap.classList.contains("off")) {
          reset();
          await sleep(1300);
        }
        if (alive && idle()) drop();
        await sleep(3500);
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
      timers.forEach(clearTimeout);
      el.removeEventListener("pointerover", onOver);
      el.removeEventListener("pointerout", onOut);
      el.removeEventListener("click", onClick);
      removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  return (
    <Figure
      sectionRef={section}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              lastUser.current = performance.now();
              api.current?.reset();
            }}
            className="uppercase transition-colors hover:text-[#d0d6e0]"
          >
            Reset
          </button>
        </>
      }
    >
      <IllArt hostRef={root} label={LABEL} layers={LAYERS} className="w-[min(92vw,78vh,760px)] cursor-default [&_svg]:overflow-visible [&_.key:not(.off)]:cursor-pointer [&_#switch]:cursor-pointer" />
    </Figure>
  );
}
