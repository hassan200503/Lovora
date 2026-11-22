"use client";

import { useEffect, useState } from "react";

const QUOTES = [
  {
    text: "Whatever our souls are made of, his and mine are the same.",
    author: "Emily Brontë",
    source: "Wuthering Heights",
  },
  {
    text: "I would not wish any companion in the world but you.",
    author: "William Shakespeare",
    source: "The Tempest",
  },
  {
    text: "You are my heart, my life, my one and only thought.",
    author: "Arthur Conan Doyle",
    source: "The White Company",
  },
] as const;

export function QuoteRotator() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % QUOTES.length), 8000);
    return () => window.clearInterval(id);
  }, [paused, reduce]);

  const quote = QUOTES[index];

  return (
    <figure
      className="mx-auto max-w-4xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <blockquote key={index} className="lp-quote-in">
        <p className="lp-quote-text text-balance">“{quote.text}”</p>
        <figcaption className="mt-7 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[var(--lp-gold)]">
          {quote.author} <span className="text-[var(--lp-faint)]">· {quote.source}</span>
        </figcaption>
      </blockquote>
      <div className="mt-9 flex items-center justify-center gap-1" role="group" aria-label="Choose a quote">
        {QUOTES.map((item, i) => (
          <button
            key={item.author}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Quote ${i + 1}: ${item.author}`}
            aria-pressed={i === index}
            className={`lp-quote-dot ${i === index ? "is-active" : ""}`}
          >
            <span />
          </button>
        ))}
      </div>
    </figure>
  );
}
