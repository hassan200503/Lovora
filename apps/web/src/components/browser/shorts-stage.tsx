"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  IconAlert,
  IconArrowUpRight,
  IconBookmark,
  IconBookmarkFilled,
  IconFilm,
  IconHeart,
  IconHeartFilled,
  IconMessage,
  IconPlay,
  IconPlus,
  IconShare,
  IconSpeaker,
  IconSpeakerOff,
  IconSpinner,
} from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { ago } from "@/lib/ui/time";
import type { ShortItem, ShortsFeed } from "@/lib/browser/types";
import { compact } from "./format";
import { AddVideoDialog, CommentsSheet } from "./shorts-panels";

type Social = Pick<ShortItem, "hearts" | "liked" | "saved" | "comments">;
type Entry = { item: ShortItem; uid: string };

const subscribe = () => () => {};

async function fetchShorts(cursor: string | null): Promise<ShortsFeed> {
  const res = await fetch(`/api/browser/shorts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
  if (!res.ok) throw new Error(res.status === 401 ? "Sign in to watch Shorts." : "Shorts couldn't load right now.");
  return res.json();
}

const TIKTOK_SRC = (id: string) =>
  `https://www.tiktok.com/player/v1/${id}?autoplay=1&muted=1&loop=0&controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`;

const YOUTUBE_SRC = (id: string, origin: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&fs=0&loop=0&origin=${encodeURIComponent(origin)}`;

/**
 * TikTok-shaped Shorts built on the official players. Only the visible video
 * gets an iframe, so a long scroll doesn't load dozens of players; playback,
 * sound and progress are driven over each platform's own message API.
 */
export function ShortsStage() {
  const feed = useInfiniteQuery({
    queryKey: ["browser-shorts"],
    queryFn: ({ pageParam }) => fetchShorts(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 5 * 60_000,
  });

  const entries = useMemo<Entry[]>(
    () => (feed.data?.pages ?? []).flatMap((page, p) => page.items.map((item, i) => ({ item, uid: `${p}-${i}-${item.key}` }))),
    [feed.data],
  );
  const { hasNextPage, fetchNextPage, isFetchingNextPage } = feed;

  const notice = feed.data?.pages.find((p) => p.notice)?.notice ?? null;
  const [active, setActive] = useState(0);
  const [commentsOn, setCommentsOn] = useState(false);
  const [addOn, setAddOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Social>>({});
  const overridesRef = useRef<Record<string, Social>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);

  const activeIndex = entries.length ? Math.min(active, entries.length - 1) : 0;
  const activeEntry = entries[activeIndex];
  const activeItem = activeEntry?.item;

  const socialOf = useCallback(
    (item: ShortItem): Social =>
      overrides[item.key] ?? { hearts: item.hearts, liked: item.liked, saved: item.saved, comments: item.comments },
    [overrides],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const scrollTo = useCallback((index: number) => {
    const root = scrollerRef.current;
    if (!root) return;
    const target = Math.max(0, index);
    const el = root.querySelector<HTMLElement>(`[data-index="${target}"]`);
    if (el) root.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, []);

  const advance = useCallback(() => {
    const nextIndex = activeIndex + 1;
    if (nextIndex < entries.length) scrollTo(nextIndex);
    else if (hasNextPage) void fetchNextPage().then(() => window.requestAnimationFrame(() => scrollTo(nextIndex)));
  }, [activeIndex, entries.length, hasNextPage, fetchNextPage, scrollTo]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-slide]"));
    const observer = new IntersectionObserver(
      (found) => {
        for (const entry of found) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.55) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isInteger(index)) setActive(index);
        }
      },
      { root, threshold: [0.55] },
    );
    for (const slide of slides) observer.observe(slide);
    return () => observer.disconnect();
  }, [entries.length]);

  useEffect(() => {
    if (activeIndex >= entries.length - 3 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [activeIndex, entries.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const react = useCallback(async (item: ShortItem, kind: "like" | "save", on: boolean) => {
    const base = overridesRef.current[item.key] ?? { hearts: item.hearts, liked: item.liked, saved: item.saved, comments: item.comments };
    const optimistic: Social =
      kind === "like" ? { ...base, liked: on, hearts: Math.max(0, base.hearts + (on ? 1 : -1)) } : { ...base, saved: on };
    const write = (value: Social) => {
      overridesRef.current = { ...overridesRef.current, [item.key]: value };
      setOverrides(overridesRef.current);
    };
    write(optimistic);
    try {
      const res = await fetch("/api/browser/shorts/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key, kind, on }),
      });
      const data = (await res.json().catch(() => null)) as { social?: Social } | null;
      if (!res.ok || !data?.social) throw new Error("reaction");
      write(data.social);
    } catch {
      if (overridesRef.current[item.key] === optimistic) {
        const next = { ...overridesRef.current };
        delete next[item.key];
        overridesRef.current = next;
        setOverrides(next);
      }
      setToast("That didn't save just now. Try again.");
    }
  }, []);

  const bumpComments = useCallback(
    (delta: number) => {
      if (!activeItem) return;
      const base = overridesRef.current[activeItem.key] ?? {
        hearts: activeItem.hearts,
        liked: activeItem.liked,
        saved: activeItem.saved,
        comments: activeItem.comments,
      };
      const next = { ...overridesRef.current, [activeItem.key]: { ...base, comments: Math.max(0, base.comments + delta) } };
      overridesRef.current = next;
      setOverrides(next);
    },
    [activeItem],
  );

  const share = useCallback(async (item: ShortItem) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: item.url });
        return;
      }
      await navigator.clipboard.writeText(item.url);
      setToast("Link copied");
    } catch (e) {
      if ((e as DOMException | undefined)?.name !== "AbortError") setToast("Couldn't share that link just now.");
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (commentsOn || addOn) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "PageDown" && e.key !== "PageUp") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      if (e.key === "ArrowDown" || e.key === "PageDown") scrollTo(Math.min(activeIndex + 1, entries.length - 1));
      else scrollTo(Math.max(activeIndex - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, entries.length, commentsOn, addOn, scrollTo]);

  if (feed.isPending) {
    return (
      <div className="flex min-h-[26rem] items-center justify-center rounded-3xl border border-line bg-surface-2/60">
        <p className="flex items-center gap-2.5 text-sm text-muted">
          <IconSpinner size={18} /> Finding real videos…
        </p>
      </div>
    );
  }

  if (feed.isError) {
    return (
      <EmptyState
        icon={<IconAlert size={20} />}
        title="Shorts didn't load"
        action={
          <button type="button" className="btn" onClick={() => void feed.refetch()}>
            Try again
          </button>
        }
      >
        {feed.error instanceof Error ? feed.error.message : "Check your connection and try again."}
      </EmptyState>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<IconFilm size={20} />}
        title="Shorts are quiet right now"
        action={
          <button type="button" className="btn" onClick={() => setAddOn(true)}>
            <IconPlus size={16} /> Add a TikTok link
          </button>
        }
      >
        {notice ?? "New videos arrive as the creators publish. Add a public TikTok link to keep the reel going."}
      </EmptyState>
    );
  }

  const upNext = entries.slice(activeIndex + 1, activeIndex + 8);
  const keysEnabled = !commentsOn && !addOn;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-7">
      <div className="-mx-4 sm:mx-0">
        <div className="relative mx-auto h-[calc(100dvh-13rem)] max-h-[50rem] min-h-[26rem] w-full max-w-[26rem] overflow-hidden bg-black shadow-[0_30px_80px_-30px_rgb(0_0_0/0.75)] sm:rounded-[28px] sm:border sm:border-line">
          <div ref={scrollerRef} className="no-scrollbar relative size-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
            {entries.map(({ item, uid }, index) => {
              const social = socialOf(item);
              return (
                <div
                  key={uid}
                  data-slide
                  data-index={index}
                  className="relative h-full w-full snap-start snap-always overflow-hidden bg-black text-white"
                  aria-label={`${item.title}, by ${item.author}`}
                >
                  {index === activeIndex && activeEntry ? (
                    <ShortPlayer
                      key={activeEntry.uid}
                      item={item}
                      social={social}
                      keysEnabled={keysEnabled}
                      onEnded={advance}
                      onToggleLike={() => void react(item, "like", !social.liked)}
                      onToggleSave={() => void react(item, "save", !social.saved)}
                      onComments={() => setCommentsOn(true)}
                      onShare={() => void share(item)}
                      onAdd={() => setAddOn(true)}
                    />
                  ) : (
                    <SlidePoster item={item} eager={index < 2} />
                  )}
                </div>
              );
            })}
          </div>

          {feed.isFetchingNextPage && (
            <span className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur">
              <IconSpinner size={16} />
            </span>
          )}
        </div>
        <p className="mt-2 px-1 text-center text-[0.66rem] text-muted sm:text-left">Swipe or scroll for more. Videos stream from TikTok and YouTube; nothing is downloaded or copied.</p>
        {notice && <p className="mt-2 px-1 text-center text-[0.7rem] text-warn sm:text-left">{notice}</p>}
      </div>

      <aside className="hidden lg:block">
        <div className="card sticky top-20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Up next</h2>
            <button type="button" className="chip" onClick={() => setAddOn(true)}>
              <IconPlus size={13} /> Add
            </button>
          </div>
          <ol className="max-h-[26rem] overflow-y-auto p-2">
            {upNext.length === 0 && (
              <li className="flex items-center gap-2 px-3 py-6 text-xs text-muted">
                <IconSpinner size={14} /> More videos are on their way.
              </li>
            )}
            {upNext.map(({ item, uid }, offset) => (
              <li key={uid}>
                <button type="button" onClick={() => scrollTo(activeIndex + 1 + offset)} className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-surface-2">
                  <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-ink/10">
                    {item.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote cover
                      <img src={item.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" />
                    )}
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[0.55rem] font-bold text-white">{item.platform === "tiktok" ? "TT" : "YT"}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs font-semibold leading-snug">{item.title}</span>
                    <span className="mt-1 block truncate text-[0.66rem] text-muted">{item.author}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="border-t border-line p-4">
            <p className="text-[0.7rem] leading-relaxed text-muted">Real public videos, played by the platforms themselves. Likes, saves and comments are private to the two of you.</p>
            <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => setAddOn(true)}>
              <IconPlus size={16} /> Add a TikTok link
            </button>
          </div>
        </div>
        <p className="mt-3 px-1 text-[0.66rem] leading-relaxed text-muted">Keyboard: ↑ ↓ move · space pause · M mute · L like · S save · C comments.</p>
      </aside>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-canvas shadow-lg">
          {toast}
        </div>
      )}

      <CommentsSheet
        key={`${activeItem?.key ?? "none"}-${commentsOn ? "open" : "closed"}`}
        open={commentsOn}
        onClose={() => setCommentsOn(false)}
        videoKey={activeItem?.key ?? null}
        videoTitle={activeItem?.title ?? ""}
        onCount={bumpComments}
      />
      <AddVideoDialog
        open={addOn}
        onClose={() => setAddOn(false)}
        onAdded={(message) => {
          setToast(message);
          void feed.refetch().then(() => {
            setActive(0);
            scrollTo(0);
          });
        }}
      />
    </div>
  );
}

/** A still cover for videos that aren't on screen, so scrolling stays cheap. */
function SlidePoster({ item, eager }: { item: ShortItem; eager: boolean }) {
  return item.thumb ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote cover from the public video page
    <img src={item.thumb} alt="" loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
  ) : (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#3a2f55,#0b0910_70%)]">
      <span className="text-6xl font-black opacity-30">{item.author.trim()[0]?.toUpperCase()}</span>
    </div>
  );
}

/**
 * The one playing video. Mounted per slide, so playback state resets naturally
 * and only this player listens for player messages or keyboard shortcuts.
 */
function ShortPlayer({
  item,
  social,
  keysEnabled,
  onEnded,
  onToggleLike,
  onToggleSave,
  onComments,
  onShare,
  onAdd,
}: {
  item: ShortItem;
  social: Social;
  keysEnabled: boolean;
  onEnded: () => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onComments: () => void;
  onShare: () => void;
  onAdd: () => void;
}) {
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const lastAdvance = useRef(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(item.durationSec ?? 0);
  const platform = item.platform;

  const send = useCallback(
    (command: "play" | "pause" | "mute" | "unMute") => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      if (platform === "tiktok") {
        win.postMessage({ type: command, "x-tiktok-player": true }, "https://www.tiktok.com");
      } else {
        const func = command === "play" ? "playVideo" : command === "pause" ? "pauseVideo" : command;
        win.postMessage(JSON.stringify({ event: "command", func, args: [] }), "https://www.youtube-nocookie.com");
      }
    },
    [platform],
  );

  const matchReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    setReady(true);
  }, []);

  const advance = useCallback(() => {
    const now = Date.now();
    if (now - lastAdvance.current < 1200) return;
    lastAdvance.current = now;
    onEnded();
  }, [onEnded]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const fromEmbed = /(^|\.)(tiktok\.com|youtube-nocookie\.com|youtube\.com)$/.test(event.origin.replace(/^https?:\/\//, ""));
      if (!fromEmbed) return;
      let data = event.data as unknown;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const d = data as Record<string, unknown>;
      if (d["x-tiktok-player"]) {
        if (d.type === "onPlayerReady") matchReady();
        else if (d.type === "onStateChange") {
          const state = Number(d.value);
          if (state === 0) {
            setPlaying(false);
            advance();
          } else if (state === 1) {
            matchReady();
            setPlaying(true);
          } else if (state === 2) {
            setPlaying(false);
          }
        } else if (d.type === "onCurrentTime") {
          if (typeof d.value === "number") {
            setProgress(Math.max(0, d.value));
          } else {
            const info = (typeof d.value === "object" && d.value ? d.value : d) as { currentTime?: unknown; duration?: unknown };
            const current = Number(info.currentTime);
            const total = Number(info.duration);
            if (Number.isFinite(current)) setProgress(Math.max(0, current));
            if (Number.isFinite(total) && total > 0) setDuration(total);
          }
        } else if (d.type === "onPlayerError") {
          setPlaying(false);
        }
        return;
      }
      if (d.event === "onReady") matchReady();
      else if (d.event === "onStateChange") {
        const state = Number(d.info);
        if (state === 0) {
          setPlaying(false);
          advance();
        } else if (state === 1) {
          matchReady();
          setPlaying(true);
        } else if (state === 2) {
          setPlaying(false);
        }
      } else if (d.event === "infoDelivery") {
        const info = d.info as { currentTime?: number; duration?: number; playerState?: number } | undefined;
        if (!info) return;
        if (typeof info.currentTime === "number") setProgress(Math.max(0, info.currentTime));
        if (typeof info.duration === "number" && info.duration > 0) setDuration(info.duration);
        if (info.playerState === 0) advance();
        if (info.playerState === 1) setPlaying(true);
        if (info.playerState === 2) setPlaying(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [advance, matchReady]);

  useEffect(() => {
    if (platform !== "youtube" || !origin) return;
    let tries = 0;
    const handshake = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(JSON.stringify({ event: "listening", id: 1 }), "https://www.youtube-nocookie.com");
      win.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), "https://www.youtube-nocookie.com");
    };
    handshake();
    const timer = window.setInterval(() => {
      if (readyRef.current || tries++ > 24) {
        window.clearInterval(timer);
        return;
      }
      handshake();
    }, 400);
    return () => window.clearInterval(timer);
  }, [platform, origin]);

  useEffect(() => {
    if (ready && !muted) send("unMute");
  }, [ready, muted, send]);

  const togglePlay = useCallback(() => {
    const next = !playing;
    setPlaying(next);
    send(next ? "play" : "pause");
  }, [playing, send]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    send(next ? "mute" : "unMute");
  }, [muted, send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!keysEnabled) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (target?.closest("button, a") && (e.key === " " || e.key === "Enter")) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      } else if (e.key === "l" || e.key === "L") {
        onToggleLike();
      } else if (e.key === "s" || e.key === "S") {
        onToggleSave();
      } else if (e.key === "c" || e.key === "C") {
        onComments();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keysEnabled, togglePlay, toggleMute, onToggleLike, onToggleSave, onComments]);

  const percent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      {item.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote cover from the public video page
        <img src={item.thumb} alt="" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#3a2f55,#0b0910_70%)]">
          <span className="text-6xl font-black opacity-30">{item.author.trim()[0]?.toUpperCase()}</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={platform === "tiktok" ? TIKTOK_SRC(item.videoId) : origin ? YOUTUBE_SRC(item.videoId, origin) : "about:blank"}
        title={item.title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 size-full border-0"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      <button type="button" onClick={togglePlay} className="absolute inset-0 z-10 cursor-default" aria-label={playing ? "Pause video" : "Play video"} tabIndex={-1} />
      {!playing && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <IconPlay size={26} />
        </span>
      )}

      <div className="absolute right-2.5 top-2.5 z-30 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Turn sound on" : "Mute"}
          className="grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
        >
          {muted ? <IconSpeakerOff size={17} /> : <IconSpeaker size={17} />}
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add a TikTok video"
          className="hidden size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 sm:grid"
        >
          <IconPlus size={17} />
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open this video on ${platform === "tiktok" ? "TikTok" : "YouTube"}`}
          className="grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
        >
          <IconArrowUpRight size={17} />
        </a>
      </div>

      <div className="absolute bottom-24 right-2 z-30 flex flex-col items-center gap-4">
        {item.authorUrl ? (
          <a href={item.authorUrl} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${item.author}`} className="grid size-11 place-items-center rounded-full border border-white/50 bg-black/35 text-sm font-bold text-white backdrop-blur-md">
            {item.author.trim()[0]?.toUpperCase()}
          </a>
        ) : (
          <span className="grid size-11 place-items-center rounded-full border border-white/50 bg-black/35 text-sm font-bold text-white backdrop-blur-md">{item.author.trim()[0]?.toUpperCase()}</span>
        )}
        <RailButton
          icon={social.liked ? <IconHeartFilled size={24} /> : <IconHeart size={24} />}
          label={compact(social.hearts) || "Like"}
          onClick={onToggleLike}
          active={social.liked}
          hint={`${social.hearts} ${social.hearts === 1 ? "like" : "likes"} from you two`}
        />
        <RailButton icon={<IconMessage size={24} />} label={compact(social.comments) || "Chat"} onClick={onComments} hint="Private comments" />
        <RailButton
          icon={social.saved ? <IconBookmarkFilled size={24} /> : <IconBookmark size={24} />}
          label="Save"
          onClick={onToggleSave}
          active={social.saved}
          hint={social.saved ? "Saved" : "Save for later"}
        />
        <RailButton icon={<IconShare size={24} />} label="Share" onClick={onShare} hint="Share this video" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3.5 pb-4 pr-20">
        <div className="pointer-events-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.72rem] text-white/85">
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide backdrop-blur-sm">{platform === "tiktok" ? "TikTok" : "YouTube"}</span>
          {item.viewCount !== null && <span>{compact(item.viewCount)} views</span>}
          {item.likeCount !== null && <span>{compact(item.likeCount)} likes</span>}
          {item.publishedAt && <span>{ago(item.publishedAt)}</span>}
        </div>
        {item.authorUrl ? (
          <a href={item.authorUrl} target="_blank" rel="noopener noreferrer" className="pointer-events-auto mt-1.5 inline-block text-sm font-semibold text-white hover:underline">
            {item.author}
          </a>
        ) : (
          <p className="mt-1.5 text-sm font-semibold">{item.author}</p>
        )}
        <p className="mt-1 line-clamp-2 text-[0.84rem] leading-snug text-white/90">{item.title}</p>
      </div>

      {duration > 0 && (
        <span className="absolute inset-x-0 bottom-0 z-30 h-[3px] bg-white/20" aria-hidden>
          <span className="block h-full bg-gold transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </span>
      )}
    </div>
  );
}

function RailButton({
  icon,
  label,
  onClick,
  active = false,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  hint: string;
}) {
  return (
    <button type="button" onClick={onClick} title={hint} aria-pressed={active} className="flex flex-col items-center gap-1 text-white">
      <span className={`grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur-md transition hover:bg-black/60 ${active ? "text-[#ff5d7a]" : ""}`}>{icon}</span>
      <span className="text-[0.63rem] font-semibold drop-shadow">{label}</span>
    </button>
  );
}
