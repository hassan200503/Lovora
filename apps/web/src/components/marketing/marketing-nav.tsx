"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconArrowRight, IconMenu, IconX, Monogram } from "@/components/icons";

const LINKS = [
  { href: "#world", label: "The world" },
  { href: "#inside", label: "Inside" },
  { href: "#privacy", label: "Privacy" },
  { href: "#cinema", label: "The reel" },
  { href: "#rituals", label: "Rituals" },
  { href: "#questions", label: "Questions" },
] as const;

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header className={`lp-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="lp-container flex h-[72px] items-center justify-between gap-6">
        <Link href="#top" className="group flex items-center gap-3">
          <Monogram size={30} />
          <span className="flex flex-col leading-none">
            <span className="font-lux text-[1.35rem] font-medium tracking-[0.16em] text-[var(--lp-ink)]">LOVORA</span>
            <span className="mt-1 font-mono text-[0.48rem] uppercase tracking-[0.3em] text-[var(--lp-faint)]">A private world for two</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="lp-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="lp-nav-link px-2">
            Sign in
          </Link>
          <Link href="/welcome" className="btn-gold lp-nav-cta">
            Begin your world <IconArrowRight size={15} />
          </Link>
        </div>

        <button
          ref={toggle}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="lp-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="lp-icon-btn lg:hidden"
        >
          {open ? <IconX size={21} /> : <IconMenu size={21} />}
        </button>
      </div>

      {open && (
        <div id="lp-mobile-nav" ref={panel} className="lp-mobile-panel lg:hidden">
          <nav aria-label="Mobile" className="lp-container flex flex-col py-3">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="lp-mobile-link">
                {link.label}
                <IconArrowRight size={15} />
              </a>
            ))}
            <div className="mt-4 grid gap-2.5 border-t border-[var(--lp-line)] pt-5">
              <Link href="/login" onClick={() => setOpen(false)} className="btn-glass justify-center">
                Sign in
              </Link>
              <Link href="/welcome" onClick={() => setOpen(false)} className="btn-gold justify-center">
                Begin your world <IconArrowRight size={15} />
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
