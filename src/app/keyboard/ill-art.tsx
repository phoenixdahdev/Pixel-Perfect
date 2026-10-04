"use client";

import { memo, useEffect, useRef, type ReactNode, type RefObject } from "react";

// The SVG host must never re-render: React would re-inject the markup and orphan every node that GSAP and
// the listeners hold. memo + stable props keep it mounted once.
// The art is a stack of same-viewBox SVG layers (see scripts/illustrations-svg.mjs): static layers paint once
// and sit on their own compositor layer; only a layer whose contents move gets repainted.
export const IllArt = memo(function IllArt({
  hostRef,
  label,
  layers,
  className,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  label: string;
  layers: string;
  className: string;
}) {
  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      style={{ visibility: "hidden" }}
      className={[
        "relative place-self-center normal-case tracking-normal will-change-transform",
        "[&_.ill-layer]:pointer-events-none [&_.ill-layer]:absolute [&_.ill-layer]:inset-0 [&_.ill-layer]:will-change-transform",
        "[&_.ill-layer:first-child]:relative [&_svg]:block [&_svg]:h-auto [&_svg]:w-full",
        "[&_[data-live]_svg>*]:pointer-events-auto",
        className,
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: layers }}
    />
  );
});

/**
 * Tracks whether a section is the one being looked at (≥ half of it on screen), so only that section answers
 * the real keyboard and runs its idle ghost. `onEnter` fires once, the first time it comes into view (intros).
 */
export function useActiveSection(ref: RefObject<HTMLElement | null>, onEnter?: () => void) {
  const active = useRef(false);
  const enter = useRef(onEnter);
  useEffect(() => {
    enter.current = onEnter;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let entered = false;
    const io = new IntersectionObserver(
      ([e]) => {
        active.current = e.intersectionRatio >= 0.5 || (e.isIntersecting && e.intersectionRect.height >= innerHeight * 0.5);
        if (e.isIntersecting && e.intersectionRatio >= 0.25 && !entered) {
          entered = true;
          enter.current?.();
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return active;
}

export const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

/** The page frame every figure sits in: the art, and an optional control row under it. */
export function Figure({
  sectionRef,
  children,
  footer,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      ref={sectionRef}
      className="grid min-h-screen grid-rows-[1fr_auto] px-6 pt-20 pb-6 font-mono text-xs tracking-[0.12em] text-[#62666d] uppercase"
    >
      {children}
      <footer className="flex min-h-4 items-end justify-end">{footer}</footer>
    </section>
  );
}

/** Convex hull of screen points (monotone chain), for clip paths of parts that slide out of a body. */
export function hull(points: [number, number][]) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [];
  const up: [number, number][] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo.at(-2)!, lo.at(-1)!, q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of p.reverse()) {
    while (up.length >= 2 && cross(up.at(-2)!, up.at(-1)!, q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export const hullPath = (pts: [number, number][]) =>
  "M" + hull(pts).map((q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join(" L") + " Z";
