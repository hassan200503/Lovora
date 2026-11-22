"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { IconAlert, IconArrowRight, IconArrowUpRight, IconCompass, IconGlobe, IconSearch, IconSparkle } from "@/components/icons";
import { SmartImage } from "@/components/feed/media";
import { EmptyState } from "@/components/ui/empty-state";
import { TOPICS } from "@/lib/trends/topics";
import { ago } from "@/lib/ui/time";
import type { BrowserLovoraItem, BrowserSearchResult } from "@/lib/browser/types";
import { hostOf } from "./format";

async function fetchResults(q: string): Promise<BrowserSearchResult> {
  const res = await fetch(`/api/browser/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(res.status === 401 ? "Sign in to search." : "Search is unavailable right now.");
  return res.json();
}

function TopicMark({ item }: { item: BrowserLovoraItem }) {
  const topic = TOPICS[item.topic];
  return (
    <span className="flex size-full items-end bg-accent-soft p-2" aria-hidden>
      <span className="absolute -right-2 -top-3 text-[3.6rem] leading-none opacity-25">{topic?.emoji}</span>
      <span className="relative text-[0.62rem] font-semibold uppercase tracking-wide text-accent">{item.category}</span>
    </span>
  );
}

function LovoraResult({ item }: { item: BrowserLovoraItem }) {
  return (
    <Link href={`/discover/item/${item.id}`} className="card group flex min-h-[6.4rem] gap-3 overflow-hidden p-2.5 transition hover:border-accent/40 hover:shadow-app-pop">
      <span className="relative w-24 shrink-0 overflow-hidden rounded-xl bg-accent-soft sm:w-28">
        {item.imageUrl ? (
          <SmartImage src={item.imageUrl} alt="" sizes="112px" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<TopicMark item={item} />} />
        ) : (
          <TopicMark item={item} />
        )}
      </span>
      <span className="min-w-0 flex-1 py-0.5 pr-1">
        <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-accent">
          <span>{TOPICS[item.topic]?.label}</span>
          <span className="text-muted/60" aria-hidden>
            ·
          </span>
          <span className="truncate font-medium text-muted">{item.sourceName}</span>
        </span>
        <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug group-hover:underline">{item.title}</span>
        <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{item.summary}</span>
        {item.publishedAt && <span className="mt-1 block text-[0.68rem] text-muted">{ago(item.publishedAt)}</span>}
      </span>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="card flex gap-3 p-2.5">
          <div className="skeleton h-24 w-24 shrink-0 rounded-xl sm:w-28" />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-2.5 w-28 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-3 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchView({ query, onAskAi }: { query: string; onAskAi: (q: string) => void }) {
  const results = useQuery({ queryKey: ["browser-search", query], queryFn: () => fetchResults(query), enabled: query.trim().length >= 2, staleTime: 120_000, retry: 1 });

  if (results.isPending) {
    return (
      <div aria-busy className="mt-6">
        <div className="skeleton mb-5 h-4 w-52 rounded" />
        <Skeleton />
        <div className="card mt-4 space-y-2.5 p-5">
          <div className="skeleton h-4 w-36 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-10/12 rounded" />
        </div>
      </div>
    );
  }

  if (results.isError || !results.data) {
    return (
      <EmptyState className="mt-6" icon={<IconAlert size={20} />} title="Search didn't finish" action={<button type="button" className="btn" onClick={() => void results.refetch()}>Try again</button>}>
        {results.error instanceof Error ? results.error.message : "Check your connection and try again."}
      </EmptyState>
    );
  }

  const data = results.data;
  const empty = !data.url && !data.lovora.length && !data.abstract && !data.wikipedia.length && !data.related.length;

  return (
    <div className="mt-5">
      {data.url && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <IconGlobe size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Looks like an address</p>
              <p className="mt-0.5 truncate text-base font-semibold">{hostOf(data.url)}</p>
              <p className="truncate text-xs text-muted">{data.url}</p>
            </div>
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="btn">
              Open <IconArrowUpRight size={16} />
            </a>
          </div>
          <p className="border-t border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted sm:px-5">
            For your safety, Lovora opens sites in a new tab instead of loading their pages inside the app.
          </p>
        </div>
      )}

      {data.notice && (
        <div role="status" className="mt-4 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          <IconAlert size={16} className="mt-0.5 shrink-0" />
          <span>{data.notice}</span>
        </div>
      )}

      {data.lovora.length > 0 && (
        <section className="mt-6" aria-labelledby="lovora-results">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="lovora-results" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              <IconCompass size={15} /> In Lovora · {data.lovora.length}
            </h2>
            <button type="button" className="text-xs font-medium text-muted hover:text-ink" onClick={() => void results.refetch()}>
              Refresh
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.lovora.map((item) => (
              <LovoraResult key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {(data.abstract || data.wikipedia.length > 0) && (
        <section className="mt-6" aria-labelledby="knowledge">
          <h2 id="knowledge" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            <IconCompass size={15} /> Quick answers
          </h2>
          <div className="card divide-y divide-line overflow-hidden">
            {data.abstract && (
              <div className="p-4 sm:p-5">
                <p className="text-[0.94rem] leading-relaxed">{data.abstract.text}</p>
                <a href={data.abstract.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-link hover:underline">
                  Read more on {data.abstract.source || hostOf(data.abstract.url)} <IconArrowUpRight size={13} />
                </a>
              </div>
            )}
            {data.wikipedia.map((hit) => (
              <a key={hit.url} href={hit.url} target="_blank" rel="noopener noreferrer" className="group block p-4 transition hover:bg-surface-2 sm:p-5">
                <span className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold group-hover:underline">
                      {hit.title} <IconArrowUpRight size={13} className="text-muted transition group-hover:text-ink" />
                    </span>
                    <span className="mt-1 line-clamp-3 block text-xs leading-relaxed text-muted">{hit.snippet}</span>
                  </span>
                  <span className="hidden shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.66rem] font-semibold text-muted sm:block">{hostOf(hit.url)}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6" aria-labelledby="web-results">
        <h2 id="web-results" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          <IconSearch size={15} /> On the web
        </h2>
        {data.related.length > 0 ? (
          <ul className="card divide-y divide-line overflow-hidden">
            {data.related.map((hit) => (
              <li key={hit.url}>
                <a href={hit.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 p-4 transition hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-link group-hover:underline">
                      {hit.title} <IconArrowUpRight size={13} className="shrink-0" />
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted">{hit.snippet}</span>
                    <span className="mt-1 block text-[0.68rem] text-muted">{hostOf(hit.url)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          empty && (
            <EmptyState icon={<IconSearch size={20} />} title="Nothing matched that yet">
              Try different words, a shorter question, or ask AI mode for a direct answer.
            </EmptyState>
          )
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Keep looking:</span>
          {data.engines.map((engine) => (
            <a key={engine.label} href={engine.href} target="_blank" rel="noopener noreferrer" className="chip chip-outline transition hover:border-accent/40 hover:text-ink">
              {engine.label} <IconArrowUpRight size={12} />
            </a>
          ))}
        </div>

        {!data.url && (
          <button
            type="button"
            onClick={() => onAskAi(data.query)}
            className="group mt-6 flex w-full items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft p-4 text-left transition hover:border-accent/50"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white">
              <IconSparkle size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Want the short answer?</span>
              <span className="mt-0.5 block text-xs text-muted">AI mode reads the web and answers “{data.query.length > 60 ? `${data.query.slice(0, 60)}…` : data.query}” with sources.</span>
            </span>
            <IconArrowRight size={18} className="shrink-0 text-accent transition group-hover:translate-x-0.5" />
          </button>
        )}
      </section>
    </div>
  );
}
