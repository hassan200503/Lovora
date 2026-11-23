"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBookmark, IconChevronDown, IconChevronLeft, IconCompass, IconFilm, IconSettings, IconSparkle } from "@/components/icons";
import { InfiniteFeed, type FeedParams } from "@/components/feed/infinite-feed";
import type { FeedPage } from "@/lib/trends/query";
import { TOPICS, TOPIC_KEYS, type TopicKey } from "@/lib/trends/topics";
import { Omnibox } from "./omnibox";
import { SearchView } from "./search-view";
import { AiView } from "./ai-view";
import { ShortsStage } from "./shorts-stage";

export type BrowserPerson = {
  id: string;
  slug: string;
  displayName: string;
  theme: string;
  avatarUrl: string | null;
};

type Tab = "for-you" | "shorts" | "saved" | TopicKey;
const TAB_KEYS = new Set<string>(["for-you", "shorts", "saved", ...TOPIC_KEYS]);
const asTab = (value: string | null | undefined): Tab => (value && TAB_KEYS.has(value) ? (value as Tab) : "for-you");

const tabLabel = (tab: Tab): string =>
  tab === "for-you" ? "For you" : tab === "shorts" ? "Shorts" : tab === "saved" ? "Saved" : TOPICS[tab].label;

/**
 * The Lovora browser: one calm start page, Chrome's address bar over it, and
 * everything the couple already follows one tab away. Shorts is its own
 * full-height stage; every other tab reuses the same feed people already know.
 */
export function BrowserShell({
  meId,
  viewing,
  people,
  topics,
  initialQuery,
  initialAi,
  initialTab,
  initialFeed,
}: {
  meId: string;
  viewing: BrowserPerson;
  people: BrowserPerson[];
  topics: TopicKey[];
  initialQuery: string;
  initialAi: boolean;
  initialTab: string;
  initialFeed: FeedPage | null;
}) {
  const me = people.find((p) => p.id === meId) ?? viewing;
  const [tab, setTab] = useState<Tab>(() => asTab(initialTab));
  const [draft, setDraft] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [ai, setAi] = useState(initialAi && initialQuery.length >= 2);
  const [viewingSlug, setViewingSlug] = useState(viewing.slug);
  const [category, setCategory] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [initialSlug] = useState(viewing.slug);

  const viewer = people.find((p) => p.slug === viewingSlug) ?? viewing;
  const label = tabLabel(tab);

  const syncUrl = useCallback(
    (next: { tab?: Tab; q?: string; ai?: boolean; slug?: string }) => {
      if (typeof window === "undefined") return;
      const nextTab = next.tab ?? tab;
      const nextQuery = (next.q ?? searchQuery).trim();
      const nextAi = next.ai ?? ai;
      const nextSlug = next.slug ?? viewingSlug;
      const url = new URL(window.location.href);
      if (nextTab === "for-you") url.searchParams.delete("tab");
      else url.searchParams.set("tab", nextTab);
      if (nextQuery) url.searchParams.set("q", nextQuery);
      else url.searchParams.delete("q");
      if (nextQuery && nextAi) url.searchParams.set("mode", "ai");
      else url.searchParams.delete("mode");
      if (nextSlug && nextSlug !== me.slug) url.searchParams.set("as", nextSlug);
      else url.searchParams.delete("as");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    },
    [tab, searchQuery, ai, viewingSlug, me.slug],
  );

  const reveal = useCallback(() => {
    window.requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      const clean = q.trim();
      if (clean.length < 2) return;
      setDraft(clean);
      setSearchQuery(clean);
      syncUrl({ q: clean, tab, ai });
      reveal();
    },
    [syncUrl, tab, ai, reveal],
  );

  const runAi = useCallback(
    (q: string) => {
      const clean = q.trim();
      if (clean.length < 2) return;
      setDraft(clean);
      setSearchQuery(clean);
      setAi(true);
      syncUrl({ q: clean, ai: true, tab });
      reveal();
    },
    [syncUrl, tab, reveal],
  );

  const toggleAi = useCallback(() => {
    const next = !ai;
    setAi(next);
    syncUrl({ ai: next });
  }, [ai, syncUrl]);

  const openTab = useCallback(
    (next: Tab) => {
      setTab(next);
      setSearchQuery("");
      setDraft("");
      setAi(false);
      setCategory(null);
      syncUrl({ tab: next, q: "", ai: false });
      reveal();
    },
    [syncUrl, reveal],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDraft("");
    setAi(false);
    setCategory(null);
    syncUrl({ q: "", ai: false });
    reveal();
  }, [syncUrl, reveal]);

  const switchPerson = useCallback(
    (slug: string) => {
      setViewingSlug(slug);
      setCategory(null);
      syncUrl({ slug });
    },
    [syncUrl],
  );

  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      const q = (p.get("q") ?? "").slice(0, 200);
      const nextTab = asTab(p.get("tab"));
      const slug = p.get("as");
      setTab(nextTab);
      setDraft(q);
      setSearchQuery(q);
      setAi(p.get("mode") === "ai" && q.length >= 2);
      setCategory(null);
      if (slug && people.some((person) => person.slug === slug)) setViewingSlug(slug);
      else setViewingSlug(me.slug);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [people, me.slug]);

  const searchActive = searchQuery.trim().length >= 2;
  const isShort = tab === "shorts";

  const orderedTopics = useMemo(() => {
    const subscribed = topics.filter((t) => t !== "football" && t !== "news");
    const rest = TOPIC_KEYS.filter((t) => t !== "football" && t !== "news" && !subscribed.includes(t));
    return [...subscribed, ...rest];
  }, [topics]);

  const feed: FeedParams = useMemo(() => {
    if (tab === "saved") return { feed: "saved", as: viewingSlug };
    if (tab === "for-you" || tab === "shorts") return { feed: "for-you", as: viewingSlug };
    return { feed: "topic", topic: tab, as: viewingSlug, category };
  }, [tab, viewingSlug, category]);

  const seed =
    tab === "for-you" && !searchActive && !category && viewingSlug === initialSlug && initialFeed ? initialFeed : undefined;
  const feedTopics: TopicKey[] = tab === "for-you" || tab === "saved" || tab === "shorts" ? topics : [tab];
  const empty =
    tab === "saved" ? (
      <EmptyState icon={<IconBookmark size={20} />} title="Nothing saved yet">
        Tap the bookmark on a story and it will wait for you here.
      </EmptyState>
    ) : tab === "for-you" ? (
      <EmptyState icon={<IconCompass size={20} />} title="Your feed is warming up">
        Follow a few topics in Settings → Your sections, or browse Football and News above.
      </EmptyState>
    ) : (
      <EmptyState icon={<IconCompass size={20} />} title={`Nothing in ${label} yet`}>
        New {label.toLowerCase()} stories arrive as sources publish — check back through the day.
      </EmptyState>
    );

  return (
    <div data-world="indigo" className="min-h-dvh bg-canvas">
      {isShort ? (
        <div className="border-b border-line bg-canvas">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <button type="button" onClick={() => openTab("for-you")} className="icon-btn shrink-0" aria-label="Back to the start page">
              <IconChevronLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">Shorts</h1>
              <p className="truncate text-xs text-muted">Real videos, endless scroll</p>
            </div>
            <span className="ml-auto chip shrink-0">
              <IconFilm size={13} /> {viewer.displayName.split(" ")[0]}&apos;s world
            </span>
          </div>
        </div>
      ) : (
        <section className="relative overflow-hidden border-b border-line">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute -right-28 top-2 size-80 rounded-full bg-gold/10 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,var(--accent-soft),transparent_62%)] opacity-70" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 pb-7 pt-5 sm:px-6 sm:pb-10 sm:pt-9">
            <div className="flex items-start justify-between gap-3">
              <p className="eyebrow flex items-center gap-2.5 text-accent">
                <span className="h-px w-6 bg-current opacity-45" aria-hidden />
                Lovora browser
              </p>
              {people.length > 1 ? (
                <label className="flex items-center gap-2">
                  <Avatar name={viewer.displayName} url={viewer.avatarUrl} theme={viewer.theme} size={26} />
                  <span className="relative">
                    <span className="sr-only">Viewing as</span>
                    <select
                      value={viewingSlug}
                      onChange={(e) => switchPerson(e.target.value)}
                      className="max-w-[9.5rem] appearance-none truncate rounded-full border border-line bg-surface py-1.5 pl-3 pr-7 text-xs font-semibold text-ink outline-none transition hover:border-muted/40 focus:border-accent"
                    >
                      {people.map((person) => (
                        <option key={person.id} value={person.slug}>
                          {person.displayName.split(" ")[0]}
                        </option>
                      ))}
                    </select>
                    <IconChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
                  </span>
                </label>
              ) : (
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Avatar name={viewer.displayName} url={viewer.avatarUrl} theme={viewer.theme} size={24} />
                  {viewer.displayName.split(" ")[0]}&apos;s world
                </span>
              )}
            </div>

            <h1 className="type-page-title font-display mt-4 max-w-4xl text-balance sm:mt-5">
              Get started with <span className="text-accent">Lovora browser</span>
            </h1>
            <p className="type-body mt-2 max-w-2xl text-muted sm:mt-3">
              Search Lovora and the wider web, ask for a straight answer, or settle in with real Shorts — all inside your private world.
            </p>

            <div className="mt-5 max-w-3xl sm:mt-7">
              <Omnibox
                value={draft}
                onChange={setDraft}
                onSubmit={runSearch}
                onAi={runAi}
                onTopic={openTab}
                ai={ai}
                onAiToggle={toggleAi}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.72rem] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <IconSparkle size={13} /> AI mode answers with sources
              </span>
              <span className="hidden h-3 w-px bg-line sm:block" aria-hidden />
              <span>Photo scans stay private — the photo is never saved</span>
              <Link href="/settings#interests" className="ml-auto hidden items-center gap-1.5 font-medium text-ink hover:underline md:inline-flex">
                <IconSettings size={13} /> Personalise
              </Link>
            </div>
          </div>
        </section>
      )}

      <nav aria-label="Browser sections" className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-3 sm:px-5">
          <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto py-2" role="tablist">
            <TabButton active={tab === "for-you"} onClick={() => openTab("for-you")} icon={<IconSparkle size={14} />} label="For you" />
            <TabButton active={tab === "shorts"} onClick={() => openTab("shorts")} icon={<IconFilm size={14} />} label="Shorts" />
            <TabButton active={tab === "football"} onClick={() => openTab("football")} icon={<span aria-hidden>⚽</span>} label="Football" />
            <TabButton active={tab === "news"} onClick={() => openTab("news")} icon={<span aria-hidden>📰</span>} label="News" />
            {orderedTopics.map((key) => (
              <TabButton
                key={key}
                active={tab === key}
                onClick={() => openTab(key)}
                icon={<span aria-hidden>{TOPICS[key].emoji}</span>}
                label={TOPICS[key].label}
              />
            ))}
            <TabButton active={tab === "saved"} onClick={() => openTab("saved")} icon={<IconBookmark size={14} />} label="Saved" />
          </div>
          <Link href="/settings#interests" className="hidden shrink-0 items-center gap-1.5 px-2 text-xs font-semibold text-muted transition hover:text-ink md:inline-flex">
            <IconSettings size={14} /> Personalise
          </Link>
        </div>
      </nav>

      <div ref={contentRef} className="mx-auto max-w-6xl scroll-mt-16 px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
        {searchActive ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button type="button" className="chip chip-outline transition hover:border-accent/40 hover:text-ink" onClick={clearSearch}>
                <IconChevronLeft size={13} /> Back to {label}
              </button>
              {ai && (
                <span className="chip">
                  <IconSparkle size={13} /> AI mode
                </span>
              )}
            </div>
            {ai ? <AiView query={searchQuery} onSearch={runSearch} /> : <SearchView query={searchQuery} onAskAi={runAi} />}
          </div>
        ) : isShort ? (
          <ShortsStage />
        ) : tab === "for-you" || tab === "saved" ? (
          <section aria-labelledby="feed-title">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="feed-title" className="type-section-title text-xl">
                  {label}
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {tab === "for-you" ? "Stories from the topics you both follow, gathered in one place." : "Everything you bookmarked, ready when you are."}
                </p>
              </div>
            </div>
            <InfiniteFeed
              key={`${tab}-${viewingSlug}`}
              params={feed}
              topics={feedTopics}
              empty={empty}
              initial={seed}
            />
          </section>
        ) : (
          <section aria-labelledby="feed-title">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <h2 id="feed-title" className="type-section-title flex items-center gap-2 text-xl">
                  <span aria-hidden>{TOPICS[tab].emoji}</span> {label}
                </h2>
                <p className="mt-0.5 max-w-2xl text-sm text-muted">{TOPICS[tab].blurb}</p>
              </div>
            </div>
            <div className="no-scrollbar -mx-1 mb-4 mt-3 flex gap-1.5 overflow-x-auto px-1 py-1" role="group" aria-label="Filter by category">
              <button
                type="button"
                aria-pressed={!category}
                onClick={() => setCategory(null)}
                className={`chip shrink-0 transition ${!category ? "bg-ink text-canvas" : "chip-outline hover:border-accent/40 hover:text-ink"}`}
              >
                All
              </button>
              {TOPICS[tab].categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={category === c.name}
                  onClick={() => setCategory(category === c.name ? null : c.name)}
                  className={`chip shrink-0 transition ${category === c.name ? "bg-ink text-canvas" : "chip-outline hover:border-accent/40 hover:text-ink"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <InfiniteFeed
              key={`${tab}-${viewingSlug}-${category ?? "all"}`}
              params={feed}
              topics={feedTopics}
              empty={empty}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-semibold transition sm:px-3.5 sm:py-2 ${
        active ? "bg-ink text-canvas shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
