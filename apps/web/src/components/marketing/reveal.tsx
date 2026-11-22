"use client";

import { useEffect, useRef } from "react";

/**
 * Reveals `[data-reveal]` descendants as they enter the viewport.
 *
 * The hiding styles only apply once this component has mounted, so the page
 * still reads perfectly without JavaScript. Reduced-motion visitors get every
 * element immediately.
 */
export function RevealRoot({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!items.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      for (const item of items) item.classList.add("is-in");
      return;
    }

    el.classList.add("lp-reveal-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className="lp">
      {children}
    </div>
  );
}
