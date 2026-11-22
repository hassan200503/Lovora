"use client";

import { useEffect, useState } from "react";

const DAY = 86_400_000;

export function JourneyCounter({ startedOn, now, names }: { startedOn: string; now: number; names: string }) {
  const [clock, setClock] = useState(now);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = Math.max(0, clock - new Date(startedOn).getTime());
  const days = Math.floor(elapsed / DAY);
  const hours = Math.floor(elapsed / 3_600_000) % 24;
  const minutes = Math.floor(elapsed / 60_000) % 60;
  const seconds = Math.floor(elapsed / 1000) % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const parts = [
    [days.toLocaleString("en"), "days"],
    [pad(hours), "hours"],
    [pad(minutes), "minutes"],
    [pad(seconds), "seconds"],
  ] as const;

  return (
    <div>
      <p className="lp-mono">{names} · began 14 June 2019</p>
      <div
        className="mt-5 grid grid-cols-4 gap-2"
        role="group"
        aria-label={`Together for ${days.toLocaleString("en")} days, ${hours} hours and ${minutes} minutes`}
      >
        {parts.map(([value, label]) => (
          <div key={label} className="lp-clock-cell">
            <span className="num-lux block text-[1.55rem] leading-none text-[var(--lp-ink)] sm:text-[1.9rem]">{value}</span>
            <span className="mt-2 block font-mono text-[0.52rem] uppercase tracking-[0.18em] text-[var(--lp-faint)]">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--lp-faint)]">Every second counted. None of them taken for granted.</p>
    </div>
  );
}
