"use client";

import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addYouTubeFromSearch } from "@/lib/actions/media";
import { DISCOVER_CATEGORIES, DISCOVER_ORDER, type DiscoverCategory, type DiscoverItem } from "@/lib/media/youtube";
import { IconCheck, IconChevronLeft, IconChevronRight, IconPlay, IconPlus, IconSearch, IconSpinner, IconX } from "@/components/icons";

type Page = {
  configured: boolean;
  items: DiscoverItem[];
  nextPageToken: string | null;
  added: string[];
  error?: string;
};

type Detail = {
  videoId: string;
  durationSec: number | null;
  viewCount: number | null;
  categoryId: string | null;
  embeddable: boolean | null;
};

/** What the Together room can do with a video found here. */
export type RoomDiscoverActions = {
  watch: (item: DiscoverItem, detail?: Detail) => void;
  queue: (item: DiscoverItem, detail?: Detail) => void;
  isWatching: (videoId: string) => boolean;
  isQueued: (videoId: string) => boolean;
};

export type DiscoverActionsProps =
  | { variant?: "gallery"; room?: undefined }
  | { variant: "room"; room: RoomDiscoverActions };

type RowAction = {
  label: string;
  icon?: "play" | "plus" | "check" | "spinner";
  disabled?: boolean;
  onClick: () => void;
};

type Row = {
  badge?: string;
  primary: RowAction;
  secondary?: RowAction;
};

const EMOJI: Record<DiscoverCategory, string> = {
  movies: "🎬",
  music: "🎵",
  shorts: "⚡",
  animation: "🎨",
  news: "📰",
};

const SUGGESTIONS = ["Full movies tonight", "Lo-fi to study", "Funny shorts", "Live news", "Animated films"];
const ROOM_SUGGESTIONS = [...SUGGESTIONS, "Knitting tutorials", "Bird videos"];

function duration(sec: number | null) {
  if (sec === null) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function views(n: number | null) {
  if (!n) return "";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K views`;
  return `${n} views`;
}

async function fetchPage(qs: URLSearchParams, signal?: AbortSignal): Promise<Page> {
  const res = await fetch(`/api/youtube/search?${qs}`, { signal });
  const body = (await res.json().catch(() => ({}))) as Partial<Page> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Couldn't reach YouTube just now.");
  return body as Page;
}

async function fetchDetails(ids: string[], signal?: AbortSignal): Promise<Detail[]> {
  const res = await fetch(`/api/youtube/details?ids=${encodeURIComponent(ids.join(","))}`, { signal });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as { items?: Detail[] };
  return body.items ?? [];
}

/** Details are a nicety; one request per 30 cards, cached for half an hour. */
function useVideoDetails(ids: string[]) {
  const key = ids.join(",");
  return useQuery({
    queryKey: ["yt-details", key],
    queryFn: async ({ signal }) => {
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
      const rows = (await Promise.all(chunks.map((chunk) => fetchDetails(chunk, signal)))).flat();
      return Object.fromEntries(rows.map((row) => [row.videoId, row])) as Record<string, Detail>;
    },
    enabled: ids.length > 0,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

function SetupCard() {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-line p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <IconSearch size={16} /> Live YouTube search needs one free API key
      </p>
      <p className="mt-1.5 text-sm text-muted">
        Enable <strong>YouTube Data API v3</strong> in Google Cloud, create an API key, then add{" "}
        <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.8em]">YOUTUBE_API_KEY</code> in Vercel → Settings → Environment
        Variables and redeploy. Everything else here is already wired up.
      </p>
    </div>
  );
}

function ActionButton({ action, primary }: { action: RowAction; primary: boolean }) {
  const icon =
    action.icon === "play" ? (
      <IconPlay size={12} />
    ) : action.icon === "check" ? (
      <IconCheck size={12} />
    ) : action.icon === "spinner" ? (
      <IconSpinner size={12} />
    ) : action.icon === "plus" ? (
      <IconPlus size={12} />
    ) : null;
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={action.onClick}
      aria-label={action.label}
      className={
        primary
          ? "btn min-w-0 flex-1 gap-1 px-2 py-1.5 text-[0.7rem]"
          : "btn btn-ghost min-w-0 flex-1 gap-1 border border-line px-2 py-1.5 text-[0.7rem]"
      }
    >
      {icon}
      <span className="truncate">{action.label}</span>
    </button>
  );
}

function Card({ item, detail, row, shelf = false, onPreview }: { item: DiscoverItem; detail?: Detail; row: Row; shelf?: boolean; onPreview: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const length = detail?.durationSec ?? item.durationSec;
  const count = detail?.viewCount ?? item.viewCount;
  return (
    <article className={shelf ? "w-[68vw] max-w-[244px] shrink-0 snap-start sm:w-[240px]" : "min-w-0"}>
      <button
        type="button"
        onClick={onPreview}
        className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-surface-2 text-left outline-offset-2 focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`Preview ${item.title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's public thumbnail CDN, already 320×180 */}
        <img
          src={item.thumb}
          alt=""
          width={320}
          height={180}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`size-full object-cover transition duration-500 motion-safe:group-hover:scale-[1.04] ${loaded ? "opacity-100" : "opacity-0"}`}
        />
        {!loaded && <span className="skeleton absolute inset-0 rounded-none" />}
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/25">
          <span className="grid size-9 place-items-center rounded-full bg-black/65 text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <IconPlay size={15} />
          </span>
        </span>
        {length ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums text-white">
            {duration(length)}
          </span>
        ) : null}
        {row.badge && (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-white shadow">
            <IconCheck size={10} /> {row.badge}
          </span>
        )}
      </button>
      <div className="mt-1.5 px-0.5">
        <p className="line-clamp-2 min-h-[2.4em] text-xs font-semibold leading-snug" title={item.title}>
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-[0.68rem] text-muted">
          {item.channel}
          {count ? ` · ${views(count)}` : ""}
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <ActionButton action={row.primary} primary />
          {row.secondary && <ActionButton action={row.secondary} primary={false} />}
        </div>
      </div>
    </article>
  );
}

function Shelf({
  category,
  onUnconfigured,
  rowFor,
  onPreview,
}: {
  category: DiscoverCategory;
  onUnconfigured: () => void;
  rowFor: (item: DiscoverItem, collection: DiscoverCategory, detail: Detail | undefined, added: boolean) => Row;
  onPreview: (item: DiscoverItem, collection: DiscoverCategory, detail?: Detail) => void;
}) {
  const cfg = DISCOVER_CATEGORIES[category];
  const scroller = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  // Shelves below the fold don't spend an API call until they're close.
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setNear(true), { rootMargin: "500px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const q = useInfiniteQuery({
    queryKey: ["yt-shelf", category],
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ category });
      if (pageParam) qs.set("pageToken", pageParam);
      return fetchPage(qs, signal);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextPageToken,
    enabled: near,
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: DiscoverItem[] = [];
    for (const page of q.data?.pages ?? []) {
      for (const item of page.items) {
        if (!seen.has(item.videoId)) {
          seen.add(item.videoId);
          out.push(item);
        }
      }
    }
    return out;
  }, [q.data]);
  const serverAdded = useMemo(() => new Set(q.data?.pages.flatMap((p) => p.added) ?? []), [q.data]);
  const details = useVideoDetails(items.map((item) => item.videoId));
  const detailFor = (id: string) => details.data?.[id];
  const pageError = q.data?.pages.find((p) => p.error)?.error;
  const configured = q.data?.pages[0]?.configured;

  useEffect(() => {
    if (configured === false) onUnconfigured();
  }, [configured, onUnconfigured]);

  const nudge = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const titleId = `yt-shelf-${category}`;
  return (
    <section ref={shell} aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="flex items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden>{EMOJI[category]}</span> {cfg.label}
        </h3>
        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" onClick={() => nudge(-1)} className="icon-btn icon-btn-sm" aria-label={`Scroll ${cfg.label} left`}>
            <IconChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => nudge(1)} className="icon-btn icon-btn-sm" aria-label={`Scroll ${cfg.label} right`}>
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>

      {pageError && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs">
          <span className="text-muted">{pageError}</span>
          <button type="button" className="btn btn-ghost px-3 py-1 text-[0.7rem]" onClick={() => q.refetch()}>
            Retry
          </button>
        </div>
      )}

      <div
        ref={scroller}
        role="group"
        tabIndex={0}
        aria-label={`${cfg.label} shelf`}
        className="no-scrollbar -mx-1 mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {!q.data &&
          Array.from({ length: 6 }, (_, i) => (
            <div key={`sk-${i}`} className="w-[68vw] max-w-[244px] shrink-0 snap-start sm:w-[240px]">
              <div className="skeleton aspect-video w-full rounded-xl" />
              <div className="mt-2 space-y-1.5">
                <div className="skeleton h-3 w-11/12 rounded" />
                <div className="skeleton h-2.5 w-2/3 rounded" />
                <div className="skeleton h-7 w-full rounded-full" />
              </div>
            </div>
          ))}
        {items.map((item) => (
          <Card
            key={item.videoId}
            item={item}
            detail={detailFor(item.videoId)}
            shelf
            row={rowFor(item, category, detailFor(item.videoId), serverAdded.has(item.videoId))}
            onPreview={() => onPreview(item, category, detailFor(item.videoId))}
          />
        ))}
        {items.length > 0 && q.hasNextPage && (
          <button
            type="button"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="grid aspect-video w-[38vw] max-w-[150px] shrink-0 snap-start place-items-center rounded-xl border border-dashed border-line text-xs font-semibold text-muted transition hover:border-accent/60 hover:text-accent"
          >
            {q.isFetchingNextPage ? <IconSpinner size={16} /> : <>More<br />{cfg.label.toLowerCase()}</>}
          </button>
        )}
      </div>
      {q.isSuccess && items.length === 0 && !pageError && <p className="mt-1 text-xs text-muted">Nothing on this shelf right now.</p>}
    </section>
  );
}

function SearchResults({
  query,
  onUnconfigured,
  rowFor,
  onPreview,
}: {
  query: string;
  onUnconfigured: () => void;
  rowFor: (item: DiscoverItem, collection: DiscoverCategory | null, detail: Detail | undefined, added: boolean) => Row;
  onPreview: (item: DiscoverItem, collection: DiscoverCategory | null, detail?: Detail) => void;
}) {
  const q = useInfiniteQuery({
    queryKey: ["yt-search", query],
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ q: query });
      if (pageParam) qs.set("pageToken", pageParam);
      return fetchPage(qs, signal);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextPageToken,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: DiscoverItem[] = [];
    for (const page of q.data?.pages ?? []) {
      for (const item of page.items) {
        if (!seen.has(item.videoId)) {
          seen.add(item.videoId);
          out.push(item);
        }
      }
    }
    return out;
  }, [q.data]);
  const details = useVideoDetails(items.map((item) => item.videoId));
  const visible = items.filter((item) => details.data?.[item.videoId]?.embeddable !== false);
  const serverAdded = useMemo(() => new Set(q.data?.pages.flatMap((p) => p.added) ?? []), [q.data]);
  const pageError = q.data?.pages.find((p) => p.error)?.error;
  const configured = q.data?.pages[0]?.configured;

  useEffect(() => {
    if (configured === false) onUnconfigured();
  }, [configured, onUnconfigured]);

  const collectionFor = (item: DiscoverItem) => (details.data?.[item.videoId]?.categoryId === "10" ? "music" : null);

  return (
    <div className="mt-4" aria-busy={q.isFetching}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm">
          Results for <span className="font-semibold">“{query}”</span>
        </p>
        {q.isFetching ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <IconSpinner size={13} /> Searching…
          </span>
        ) : visible.length ? (
          <span className="shrink-0 text-xs text-muted">{visible.length} found</span>
        ) : null}
      </div>

      {pageError && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{pageError}</p>}

      {q.isError ? (
        <div className="card mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted">{q.error instanceof Error ? q.error.message : "Couldn't load YouTube just now."}</span>
          <button type="button" className="btn btn-ghost" onClick={() => q.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className={`mt-3 grid grid-cols-2 gap-2.5 transition-opacity sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5 ${q.isPlaceholderData ? "opacity-55" : ""}`}>
            {!q.data &&
              Array.from({ length: 10 }, (_, i) => (
                <div key={`search-sk-${i}`}>
                  <div className="skeleton aspect-video w-full rounded-xl" />
                  <div className="mt-2 space-y-1.5">
                    <div className="skeleton h-3 w-11/12 rounded" />
                    <div className="skeleton h-2.5 w-2/3 rounded" />
                    <div className="skeleton h-7 w-full rounded-full" />
                  </div>
                </div>
              ))}
            {visible.map((item) => (
              <Card
                key={item.videoId}
                item={item}
                detail={details.data?.[item.videoId]}
                row={rowFor(item, collectionFor(item), details.data?.[item.videoId], serverAdded.has(item.videoId))}
                onPreview={() => onPreview(item, collectionFor(item), details.data?.[item.videoId])}
              />
            ))}
          </div>

          {q.isSuccess && !q.isPlaceholderData && visible.length === 0 && !pageError && (
            <div className="mt-6 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
              <p className="font-semibold">Nothing matched “{query}”</p>
              <p className="mt-1 text-sm text-muted">Try a shorter name, the artist, or a different spelling.</p>
            </div>
          )}

          {q.hasNextPage && visible.length > 0 && (
            <div className="mt-4 flex justify-center">
              <button type="button" className="btn btn-ghost px-5 py-2 text-xs" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                {q.isFetchingNextPage ? (
                  <>
                    <IconSpinner size={13} /> Loading more…
                  </>
                ) : (
                  "Load more results"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Live YouTube search and shelves. In the gallery, anything added lands in the
 * shared gallery at once; in the Together room the same cards start a shared
 * playback (Watch together) or append to the room queue.
 */
export function YouTubeDiscovery(props: DiscoverActionsProps) {
  const variant = props.variant ?? "gallery";
  const room = props.variant === "room" ? props.room : undefined;
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ item: DiscoverItem; collection: DiscoverCategory | null; detail?: Detail } | null>(null);
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState<string[]>([]);
  const [flash, setFlash] = useState<{ text: string; error?: boolean } | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();

  // Typing settles before a request goes out; the previous results stay on screen meanwhile.
  useEffect(() => {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed.length < 2) return;
    const t = setTimeout(() => setQuery(trimmed), 350);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4500);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!preview) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [preview]);

  const addedSet = useMemo(() => new Set(justAdded), [justAdded]);
  const markUnconfigured = useCallback(() => setUnconfigured(true), []);

  const isBusy = useCallback((videoId: string) => adding.includes(videoId), [adding]);

  async function add(item: DiscoverItem, collection: DiscoverCategory | null, detail?: Detail) {
    if (adding.includes(item.videoId) || addedSet.has(item.videoId)) return;
    setAdding((ids) => (ids.includes(item.videoId) ? ids : [...ids, item.videoId]));
    setJustAdded((ids) => (ids.includes(item.videoId) ? ids : [...ids, item.videoId]));
    try {
      const kind = collection === "music" || detail?.categoryId === "10" ? "song" : "video";
      const result = await addYouTubeFromSearch({
        videoId: item.videoId,
        collection: collection ?? (kind === "song" ? "music" : null),
        kind,
        title: item.title,
        channel: item.channel,
        durationSec: detail?.durationSec ?? null,
      });
      if (result.ok) {
        setFlash({ text: result.message ?? "Added to your Shared gallery ❤️" });
        void qc.invalidateQueries({ queryKey: ["gallery"] });
        void qc.invalidateQueries({ queryKey: ["gallery-stats"] });
        router.refresh();
      } else {
        setJustAdded((ids) => ids.filter((id) => id !== item.videoId));
        setFlash({ text: result.error ?? "Couldn't add that one. Try again.", error: true });
      }
    } catch {
      setJustAdded((ids) => ids.filter((id) => id !== item.videoId));
      setFlash({ text: "Couldn't add that one. Check your connection and try again.", error: true });
    } finally {
      setAdding((ids) => ids.filter((id) => id !== item.videoId));
    }
  }

  const rowFor = useCallback(
    (item: DiscoverItem, collection: DiscoverCategory | null, detail: Detail | undefined, added: boolean): Row => {
      if (room) {
        const watching = room.isWatching(item.videoId);
        const queued = room.isQueued(item.videoId);
        return {
          badge: watching ? "Watching" : queued ? "In queue" : undefined,
          primary: {
            label: watching ? "Playing" : "Watch together",
            icon: watching ? "check" : "play",
            disabled: watching,
            onClick: () => {
              setPreview(null);
              room.watch(item, detail);
            },
          },
          secondary: {
            label: queued ? "Queued" : "Add to queue",
            icon: queued ? "check" : "plus",
            disabled: queued || watching,
            onClick: () => room.queue(item, detail),
          },
        };
      }
      const isAdded = added || addedSet.has(item.videoId);
      const busy = isBusy(item.videoId);
      return {
        badge: isAdded ? "In gallery" : undefined,
        primary: {
          label: isAdded ? "Added" : busy ? "Adding…" : "Add",
          icon: isAdded ? "check" : busy ? "spinner" : "plus",
          disabled: isAdded || busy,
          onClick: () => void add(item, collection, detail),
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `add` closes over the same state as these
    [room, addedSet, isBusy],
  );

  const normalized = text.replace(/\s+/g, " ").trim();
  const activeQuery = normalized.length >= 2 ? query : "";
  const searching = activeQuery.length >= 2;
  const suggestionsOpen = normalized.length === 0;
  const suggestions = variant === "room" ? ROOM_SUGGESTIONS : SUGGESTIONS;

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent" aria-hidden>
          <IconSearch size={15} />
        </span>
        <div>
          <h3 className="type-section-title text-base">Search from YouTube live</h3>
          <p className="mt-0.5 text-xs text-muted">
            {room
              ? "Type any film, song, short, animation or news clip — or browse a shelf. Preview it, then press Watch together to start it for both of you, or Add to queue to keep it for later."
              : "Type any film, song, short, animation or news clip by name — or browse a shelf. Preview it, then press Add and it appears in your Shared gallery for both of you straight away."}
          </p>
        </div>
      </div>

      <form
        role="search"
        className="relative mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const next = text.replace(/\s+/g, " ").trim();
          if (next.length >= 2) setQuery(next);
        }}
      >
        <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.replace(/\s+/g, " ").trim().length < 2) setQuery("");
          }}
          placeholder={room ? "Find something for tonight — “full movie”, “lo-fi”, “funny shorts”…" : "Search YouTube by name — “Adele”, “full movie”, “funny shorts”…"}
          className="field pl-10 pr-20 text-sm"
          aria-label="Search YouTube"
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {activeQuery && normalized !== activeQuery && normalized.length >= 2 && <IconSpinner size={14} />}
          {text && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setQuery("");
              }}
              className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
              aria-label="Clear search"
            >
              <IconX size={15} />
            </button>
          )}
        </span>
      </form>

      {suggestionsOpen && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip chip-quiet shrink-0" onClick={() => setText(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite" className="min-h-5">
        {flash && <p className={`mt-2 text-sm ${flash.error ? "text-red-600" : "text-accent"}`}>{flash.text}</p>}
      </div>

      {unconfigured ? (
        <SetupCard />
      ) : searching ? (
        <SearchResults
          query={activeQuery}
          onUnconfigured={markUnconfigured}
          rowFor={rowFor}
          onPreview={(item, collection, detail) => setPreview({ item, collection, detail })}
        />
      ) : (
        <div className="mt-3 space-y-5">
          {DISCOVER_ORDER.map((category) => (
            <Shelf
              key={category}
              category={category}
              onUnconfigured={markUnconfigured}
              rowFor={rowFor}
              onPreview={(item, collection, detail) => setPreview({ item, collection, detail })}
            />
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-[0.68rem] text-muted">
        Powered by YouTube. Playback stays on YouTube&apos;s privacy-enhanced player — nothing is downloaded.
      </p>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={preview.item.title}
          className="fixed inset-0 z-[90] overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setPreview(null)}
        >
          <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 pb-2 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{preview.item.title}</p>
                <p className="truncate text-xs text-white/60">{preview.item.channel}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="Close preview"
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
              <iframe
                key={preview.item.videoId}
                src={`https://www.youtube-nocookie.com/embed/${preview.item.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={preview.item.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="size-full"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/60">
                {views(preview.detail?.viewCount ?? preview.item.viewCount ?? null) || "YouTube"} ·{" "}
                {duration(preview.detail?.durationSec ?? preview.item.durationSec) || "Video"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://www.youtube.com/watch?v=${preview.item.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost border-white/20 text-xs text-white"
                >
                  Open on YouTube
                </a>
                {(() => {
                  const row = rowFor(preview.item, preview.collection, preview.detail, addedSet.has(preview.item.videoId));
                  return (
                    <>
                      {row.secondary && (
                        <button
                          type="button"
                          disabled={row.secondary.disabled}
                          onClick={row.secondary.onClick}
                          className="btn btn-ghost border-white/20 px-4 py-1.5 text-xs text-white"
                        >
                          {row.secondary.icon === "check" ? <IconCheck size={13} /> : <IconPlus size={13} />}
                          {row.secondary.label}
                        </button>
                      )}
                      <button type="button" disabled={row.primary.disabled} onClick={row.primary.onClick} className="btn px-4 py-1.5 text-xs">
                        {row.primary.icon === "check" ? <IconCheck size={13} /> : row.primary.icon === "spinner" ? <IconSpinner size={13} /> : row.primary.icon === "play" ? <IconPlay size={13} /> : <IconPlus size={13} />}
                        {row.primary.label}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
