"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowUpRight, IconCheck, IconChevronLeft, IconChevronRight, IconPause, IconPlay } from "@/components/icons";

const FILMS = [
  {
    id: "8VOAxzgq42A",
    title: "Romeo + Juliet",
    year: "1996",
    line: "Two houses at war. Two children who choose each other anyway.",
  },
  {
    id: "Ur_DIHs92NM",
    title: "Pride & Prejudice",
    year: "2005",
    line: "A sharp mind, a stubborn heart, and one honest letter.",
  },
  {
    id: "I7c1etV7D7g",
    title: "Titanic",
    year: "1997",
    line: "The sea took everything except the promise she kept.",
  },
  {
    id: "BjJcYdEOI0k",
    title: "The Notebook",
    year: "2004",
    line: "He reads their story aloud until she remembers.",
  },
  {
    id: "0pdqf4P9MB8",
    title: "La La Land",
    year: "2016",
    line: "They found the ending they dreamed of — apart.",
  },
  {
    id: "A5GJLwWiYSg",
    title: "West Side Story",
    year: "2021",
    line: "Two gangs, one city, and a love that refused sides.",
  },
  {
    id: "4w8lohkQtbY",
    title: "The Great Gatsby",
    year: "2013",
    line: "He built a palace of parties to win her back.",
  },
  {
    id: "9ItBvH5J6ss",
    title: "The Fault in Our Stars",
    year: "2014",
    line: "They chose each other for whatever time was left.",
  },
] as const;

const ROTATE_MS = 24_000;

export function CinemaWall() {
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      update();
    });
    media.addEventListener("change", update);
    return () => {
      window.cancelAnimationFrame(frameId);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (paused || interacting || reduce) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % FILMS.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, interacting, reduce]);

  const film = FILMS[active];
  const src = `https://www.youtube-nocookie.com/embed/${film.id}?autoplay=${reduce ? 0 : 1}&mute=1&controls=0&loop=1&playlist=${film.id}&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1`;
  const move = (step: number) => setActive((i) => (i + step + FILMS.length) % FILMS.length);

  return (
    <div
      ref={frame}
      className="lp-cinema"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-2 pb-2.5 pt-1">
        <p className="lp-mono flex items-center gap-2 text-[var(--lp-gold)]">
          <span className="lp-live-dot" aria-hidden />
          Now showing
        </p>
        <p className="lp-mono">
          {String(active + 1).padStart(2, "0")} <span className="text-[var(--lp-line)]">/</span> {String(FILMS.length).padStart(2, "0")}
        </p>
      </div>

      <div className="lp-cinema-screen">
        {mounted ? (
          <iframe
            key={`${film.id}-${reduce ? "still" : "motion"}`}
            src={src}
            title={`${film.title} (${film.year}) official trailer`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#08070b]">
            <span className="lp-mono">Lovora cinema</span>
          </div>
        )}

        <div className="lp-cinema-scrim" aria-hidden />
        <div className="lp-cinema-caption">
          <p className="font-lux text-[1.55rem] leading-none text-[#f7efe1] sm:text-[1.8rem]">
            {film.title} <span className="font-sans text-[0.62rem] font-medium tracking-[0.18em] text-white/50">{film.year}</span>
          </p>
          <p className="mt-2 max-w-[28rem] text-[0.78rem] leading-snug text-white/65">{film.line}</p>
        </div>
        <p className="lp-cinema-silent">
          <span className="size-1 rounded-full bg-[var(--lp-gold)]" aria-hidden /> Muted preview
        </p>
      </div>

      <div className="lp-cinema-progress" aria-hidden>
        <span key={active} className={paused || interacting || reduce ? "is-paused" : ""} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-0.5" role="group" aria-label="Choose a trailer">
        {FILMS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(index)}
            aria-pressed={index === active}
            className={`lp-film ${index === active ? "is-active" : ""}`}
          >
            <span className="lp-film-num">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <span className="lp-film-year">{item.year}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--lp-line)] pt-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => move(-1)} className="lp-icon-btn" aria-label="Previous trailer">
            <IconChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="lp-icon-btn"
            aria-label={paused ? "Resume trailer rotation" : "Pause trailer rotation"}
            aria-pressed={paused}
          >
            {paused ? <IconPlay size={15} /> : <IconPause size={15} />}
          </button>
          <button type="button" onClick={() => move(1)} className="lp-icon-btn" aria-label="Next trailer">
            <IconChevronRight size={16} />
          </button>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${film.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="lp-cinema-link"
        >
          Watch on YouTube <IconArrowUpRight size={13} />
        </a>
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 px-1 text-[0.62rem] leading-relaxed text-[var(--lp-faint)]">
        <IconCheck size={12} className="mt-0.5 shrink-0 text-[var(--lp-gold)]" />
        Official trailers, streamed by YouTube. Lovora does not host these films.
      </p>
    </div>
  );
}
