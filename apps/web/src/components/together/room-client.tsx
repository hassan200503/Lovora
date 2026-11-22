"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { RoomPayload, RoomQueueItem } from "@/lib/together/room";
import type { MediaCard } from "@/lib/media/queries";
import type { FeedPage } from "@/lib/trends/query";
import { sendNudge } from "@/lib/actions/together";
import { youtubeIdFrom, youtubeThumb } from "@/lib/media/youtube";
import { Avatar } from "@/components/avatar";
import { ChatView } from "@/components/chat/chat-view";
import { useCall } from "@/components/call/call-provider";
import { YouTubeDiscovery } from "@/components/youtube/discover";
import {
  IconChevronLeft,
  IconExpand,
  IconFullscreen,
  IconHeadphones,
  IconMessage,
  IconMic,
  IconMicOff,
  IconMinimize,
  IconMusic,
  IconNext,
  IconPause,
  IconPhone,
  IconPhoneOff,
  IconPlay,
  IconPlus,
  IconVideo,
  IconX,
} from "@/components/icons";
import { useMe, useMembers } from "@/components/me-context";
import { usePulse } from "@/components/pulse";
import { ago } from "@/lib/ui/time";
import { useRoom } from "./room-provider";

const fmt = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const REACTIONS = ["❤️", "😂", "😍", "🔥", "😮", "👏", "🥹", "💃"] as const;
const W_KEY = "lovora:room-chat-w";
const C_KEY = "lovora:room-chat-collapsed";
const clampW = (n: number) => Math.max(300, Math.min(720, n));

type StageMode = "standard" | "theater" | "hidden";

const stageBar = "grid place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white";

/** lg and up: the chat docks beside the player instead of opening as a sheet. */
function useDesktop() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export function RoomClient({ initial }: { initial: RoomPayload }) {
  const me = useMe();
  const members = useMembers();
  const { stage, activate, playerError, dismissPlayerError, connection, latency, inCall, callDuck, setCallDuck, ...room } = useRoom()!;
  const desktop = useDesktop();
  const call = useCall();
  const pulse = usePulse();
  const [, startNudge] = useTransition();
  const [link, setLink] = useState("");
  const [stageMode, setStageMode] = useState<StageMode>("standard");
  const [chatW, setChatW] = useState(352);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);

  // The player itself lives in the layout (so chat, calls and other pages never stop it); this page
  // hands it the server's first read and marks the box the picture should fill.
  useEffect(() => activate(initial), [activate, initial]);

  // Remember how wide (or hidden) the dock was on this device, after first paint so hydration is stable.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const w = Number(localStorage.getItem(W_KEY));
        if (Number.isFinite(w) && w > 0) setChatW(clampW(Math.min(w, window.innerWidth - 600)));
        setChatCollapsed(localStorage.getItem(C_KEY) === "1");
      } catch {
        /* storage may be unavailable; keep the defaults */
      }
      setPrefsReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!prefsReady) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(W_KEY, String(chatW));
        localStorage.setItem(C_KEY, chatCollapsed ? "1" : "0");
      } catch {
        /* storage may be unavailable; the layout still works for this visit */
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [prefsReady, chatW, chatCollapsed]);

  // The call pill sits just to the left of the dock while the room is open.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--lovora-chat-w", desktop ? `${chatCollapsed ? 56 : chatW}px` : "0px");
    return () => {
      root.style.removeProperty("--lovora-chat-w");
    };
  }, [desktop, chatCollapsed, chatW]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  useEffect(() => {
    if (stageMode !== "theater") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [stageMode]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (!shell.current?.requestFullscreen) {
        setStageMode("theater");
        return;
      }
      await shell.current.requestFullscreen({ navigationUI: "hide" });
      // Some browsers (notably iPhone Safari) resolve without entering fullscreen.
      if (!document.fullscreenElement) setStageMode("theater");
    } catch {
      /* a browser that won't fullscreen a div: the cinema view is the fallback */
      setStageMode("theater");
    }
  }, [setStageMode]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Escape" && stageMode === "theater" && !document.fullscreenElement) setStageMode("standard");
      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [stageMode, toggleFullscreen]);

  const live = room.active;
  const state = live ? room.state : initial.state;
  const events = live ? room.events : initial.events;
  const partners = live ? room.partners : initial.partners;
  const { key, title, isAudio, ytId, now, dur, volume, inSync, send, togglePlay, seekTo } = room;
  const mode: StageMode = (!key || playerError) && stageMode === "hidden" ? "standard" : stageMode;
  const partnerHere = partners.some((p) => p.here);
  const nameOf = (slug: string) => members.find((m) => m.slug === slug)?.displayName.split(" ")[0] ?? "";
  const partner = members.find((m) => m.id !== me.id);
  const pState = partners.find((p) => p.slug === partner?.slug);
  const status = pState?.here ? "here with you 💞" : pState?.online ? "online, elsewhere on the site" : pState?.lastSeenAt ? `offline · last seen ${ago(pState.lastSeenAt)}` : "offline";
  const first = partner?.displayName.split(" ")[0] ?? "";

  const callSnap = call?.snap;
  const callPhase = callSnap?.phase ?? "idle";
  const callActive = callPhase === "outgoing" || callPhase === "incoming" || callPhase === "connecting" || callPhase === "connected" || callPhase === "reconnecting";
  const callMinimized = call?.minimized ?? false;

  const lib = useQuery({
    queryKey: ["room-library"],
    queryFn: async () => {
      const [songs, videos, knit, birds] = await Promise.all([
        fetch("/api/gallery?kind=song").then((r) => r.json() as Promise<{ items: MediaCard[] }>),
        fetch("/api/gallery?kind=video").then((r) => r.json() as Promise<{ items: MediaCard[] }>),
        fetch(`/api/trends?feed=topic&topic=knitting&category=${encodeURIComponent("Video tutorials")}`).then((r) => r.json() as Promise<FeedPage>),
        fetch(`/api/trends?feed=topic&topic=birds&category=${encodeURIComponent("Bird videos")}`).then((r) => r.json() as Promise<FeedPage>),
      ]);
      return { ours: [...songs.items, ...videos.items], discover: [...knit.items, ...birds.items].filter((t) => t.extra?.youtubeId).slice(0, 24) };
    },
    staleTime: 60_000,
  });

  const activity = events.filter((e) => e.kind === "system").slice(-3).reverse();
  const unread = pulse.data?.chat?.unread ?? 0;

  const playQueueItem = (q: RoomQueueItem) => {
    setStageMode("standard");
    if (q.kind === "youtube" && q.youtube) void send({ type: "load", youtubeId: q.youtube.id, title: q.youtube.title ?? undefined, play: true });
    else if (q.media) void send({ type: "load", mediaId: q.media.id, play: true });
  };
  const removeQueueItem = (q: RoomQueueItem) => {
    if (q.kind === "youtube" && q.youtube) void send({ type: "dequeueYouTube", videoId: q.youtube.id });
    else if (q.media) void send({ type: "dequeue", mediaId: q.media.id });
  };
  const playMedia = (m: MediaCard) => {
    setStageMode("standard");
    void send({ type: "load", mediaId: m.id, play: true });
  };

  const startDockResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatW;
    const max = clampW(window.innerWidth - 600);
    const move = (ev: PointerEvent) => setChatW(clampW(Math.min(max, startW - (ev.clientX - startX))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const syncLabel = connection === "reconnecting" ? "Reconnecting" : !inSync ? "Syncing" : partnerHere ? "In sync" : "Ready";
  const syncTone = connection === "reconnecting" || !inSync ? "text-amber-300" : "text-emerald-400";
  const syncTitle = latency === null ? "Measuring the shared clock…" : `Shared clock round trip ${latency} ms`;

  const reactionButtons = (small = false) => (
    <div className={`flex flex-wrap items-center ${small ? "justify-center gap-1" : "gap-2"}`}>
      {REACTIONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => void send({ type: "react", emoji: r })}
          className={`grid place-items-center rounded-full border border-line transition hover:scale-110 hover:bg-surface-2 ${small ? "size-9 border-white/15 text-lg hover:bg-white/10" : "size-11 text-xl"}`}
          aria-label={`Send ${r}`}
        >
          {r}
        </button>
      ))}
    </div>
  );

  const art = ytId ? youtubeThumb(ytId, "mq") : (state?.current?.thumbUrl ?? null);

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <div className="min-w-0 flex-1">
        {/* Who's here */}
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <div className="flex -space-x-2">
            {members.map((m) => (
              <Avatar key={m.id} name={m.displayName} url={m.avatarUrl} theme={m.theme} size={44} online={m.id === me.id ? true : (pState?.online ?? false)} />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{partner ? `${first} is ${status}` : "Just you for now"}</p>
            <p className="text-xs text-muted">{pState?.here ? "Everything you play, pause or skip happens for both of you." : "Start something — it'll be waiting in sync when they join."}</p>
          </div>
          <button type="button" onClick={() => setMobileChat(true)} className="icon-btn relative lg:hidden" aria-label={`Messages with ${first}`}>
            <IconMessage size={18} />
            {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 text-[0.62rem] font-bold text-white">{unread}</span>}
          </button>
          {!pState?.here && (
            <button className="btn" onClick={() => startNudge(async () => void (await sendNudge("invite")))}>
              <IconHeadphones size={16} /> Invite {first}
            </button>
          )}
        </div>

        {/* Stage: play-now and the whole picture, cinema view, fullscreen, or audio-only with the picture tucked away. */}
        <div
          ref={shell}
          data-world="us"
          className={
            mode === "theater"
              ? "fixed inset-0 z-[70] bg-black"
              : mode === "hidden"
                ? "relative mt-4 overflow-hidden rounded-2xl border border-line bg-zinc-950 text-white shadow-lg"
                : "relative mt-4 overflow-hidden rounded-3xl bg-black shadow-2xl"
          }
        >
          {mode === "theater" && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/80">Cinema</span>
                <p className="truncate text-sm font-semibold">{title ?? "Together"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => void toggleFullscreen()} className="grid size-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white" aria-label="Full screen" title="Full screen">
                  <IconFullscreen size={18} />
                </button>
                <button type="button" onClick={() => setStageMode("standard")} className="grid size-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white" aria-label="Leave cinema view" title="Leave cinema view">
                  <IconMinimize size={18} />
                </button>
              </div>
            </div>
          )}

          <div
            ref={stage}
            data-room-stage
            className={
              mode === "theater"
                ? "absolute inset-0"
                : mode === "hidden"
                  ? "pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
                  : `relative ${isAudio || !key ? "aspect-[16/9] sm:aspect-[21/9]" : "aspect-video"}`
            }
          >
            {(isAudio || !key) && (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent via-rose-900 to-accent-2 p-6 text-center text-white">
                {key ? (
                  <div>
                    {ytId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={youtubeThumb(ytId, "mq")} alt="" className={`mx-auto size-28 rounded-2xl object-cover shadow-2xl ${state?.playing ? "animate-[spin_12s_linear_infinite] rounded-full" : ""}`} />
                    ) : (
                      <IconMusic size={54} className={`mx-auto block ${state?.playing ? "animate-pulse" : ""}`} aria-hidden />
                    )}
                    <p className="font-display mt-4 text-2xl font-semibold">{title}</p>
                    {state?.current?.artist && <p className="opacity-80">{state.current.artist}</p>}
                  </div>
                ) : (
                  <div>
                    <IconHeadphones size={46} strokeWidth={1.3} className="mx-auto opacity-90" />
                    <p className="font-lux mt-4 text-3xl font-medium">Pick something to enjoy together</p>
                    <p className="mt-1 text-sm opacity-80">A song from your gallery, a video, a knitting tutorial — or any YouTube video below.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {playerError && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 p-6 text-center text-white">
              <div className="max-w-sm">
                <p className="font-semibold">This one can&apos;t play here</p>
                <p className="mt-1 text-sm text-white/70">{playerError}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {ytId && (
                    <a href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noreferrer" className="btn btn-ghost border-white/25 text-white">
                      Open on YouTube
                    </a>
                  )}
                  <button type="button" onClick={dismissPlayerError} className="btn">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "hidden" ? (
            <div className="relative z-10 flex items-center gap-3 p-3">
              {art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={art} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-white">
                  <IconMusic size={17} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{title ?? "Playing together"}</p>
                <p className="truncate text-xs text-white/60">Picture hidden — audio keeps playing with {first || "your partner"}</p>
              </div>
              <button type="button" onClick={() => void togglePlay()} className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-night" aria-label={state?.playing ? "Pause for both" : "Play for both"}>
                {state?.playing ? <IconPause size={15} /> : <IconPlay size={15} className="translate-x-px" />}
              </button>
              <button type="button" onClick={() => setStageMode("standard")} className="btn btn-ghost shrink-0 border-white/20 px-3 py-1.5 text-xs text-white">
                Show
              </button>
            </div>
          ) : key ? (
            <div
              className={
                mode === "theater"
                  ? "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 text-white sm:px-6"
                  : "flex flex-wrap items-center gap-x-3 gap-y-2 bg-zinc-950 px-4 py-3 text-white"
              }
            >
              <div className="flex w-full items-center gap-2.5 sm:gap-3">
                <button onClick={() => void togglePlay()} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-95" aria-label={state?.playing ? "Pause for both" : "Play for both"}>
                  {state?.playing ? <IconPause size={18} /> : <IconPlay size={18} className="translate-x-px" />}
                </button>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-white/70">{fmt(now)}</span>
                <input
                  type="range"
                  min={0}
                  max={dur || 1}
                  step={0.5}
                  value={Math.min(now, dur || 1)}
                  onChange={(e) => room.setScrub(Number(e.target.value))}
                  onMouseUp={(e) => void seekTo(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => void seekTo(Number((e.target as HTMLInputElement).value))}
                  onKeyUp={(e) => void seekTo(Number((e.target as HTMLInputElement).value))}
                  className="min-w-16 flex-1 accent-pink-400"
                  aria-label="Position (moves it for both of you)"
                />
                <span className="w-10 shrink-0 text-xs tabular-nums text-white/70">{fmt(dur)}</span>
                <button onClick={() => void send({ type: "next" })} className={`${stageBar} size-9 shrink-0`} aria-label="Next in queue" title="Next">
                  <IconNext size={18} />
                </button>
                <span title={syncTitle} className={`hidden shrink-0 items-center gap-1.5 text-xs sm:flex ${syncTone}`} aria-live="polite">
                  <span className={`size-1.5 rounded-full ${connection === "reconnecting" || !inSync ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden />
                  {syncLabel}
                  {latency !== null && <span className="hidden tabular-nums text-white/70 lg:inline">· {latency} ms</span>}
                </span>
                <span title={syncTitle} className={`grid size-8 shrink-0 place-items-center sm:hidden ${syncTone}`} aria-label={syncLabel}>
                  <span className={`size-2 rounded-full ${connection === "reconnecting" || !inSync ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden />
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => room.setVolume(Number(e.target.value))}
                    className="hidden w-20 accent-pink-400 md:block"
                    aria-label="My volume (only for me)"
                  />
                  <button type="button" onClick={() => setStageMode(mode === "theater" ? "standard" : "theater")} className={`${stageBar} hidden size-9 sm:grid`} aria-label={mode === "theater" ? "Shrink the picture" : "Expand the picture"} title={mode === "theater" ? "Shrink" : "Expand"}>
                    {mode === "theater" ? <IconMinimize size={17} /> : <IconExpand size={17} />}
                  </button>
                  <button type="button" onClick={() => void toggleFullscreen()} className={`${stageBar} size-9`} aria-label={fullscreen ? "Leave full screen" : "Full screen"} title={fullscreen ? "Leave full screen" : "Full screen"}>
                    <IconFullscreen size={17} />
                  </button>
                  <button type="button" onClick={() => setStageMode("hidden")} className={`${stageBar} size-9`} aria-label="Hide the picture but keep the sound" title="Hide picture, keep sound">
                    <IconMinimize size={17} />
                  </button>
                </div>
              </div>
              {mode === "theater" && <div className="w-full pt-1">{reactionButtons(true)}</div>}
            </div>
          ) : null}
        </div>

        {/* Hangout: voices over the movie, mixed to taste. */}
        <div className="card mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 p-3" role="region" aria-label="Hangout">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <IconHeadphones size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{callActive && callPhase !== "incoming" ? (callPhase === "connected" || callPhase === "reconnecting" ? "You're in the hangout" : "Connecting your hangout…") : "Hangout while you watch"}</p>
            <p className="text-xs text-muted">
              {callActive && callPhase !== "incoming"
                ? callMinimized
                  ? "The call is in the floating pill, so the movie stays big."
                  : "The movie is mixed under your voices — set the balance below."
                : "Hear each other and talk over the film. Your voices duck the movie automatically."}
            </p>
          </div>
          {call && !callActive && (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => call.start("audio", { minimize: true })}>
                <IconPhone size={16} /> Voice
              </button>
              <button type="button" className="btn" onClick={() => call.start("video", { minimize: true })}>
                <IconVideo size={16} /> Video
              </button>
            </div>
          )}
          {call && callActive && callPhase !== "incoming" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => call.engine.toggleMic()} className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-surface-2" aria-label={callSnap?.micOn ? "Mute" : "Unmute"} title={callSnap?.micOn ? "Mute" : "Unmute"}>
                {callSnap?.micOn ? <IconMic size={17} /> : <IconMicOff size={17} />}
              </button>
              <button type="button" onClick={() => call.setMinimized(!callMinimized)} className="btn btn-ghost px-3 py-1.5 text-xs">
                {callMinimized ? "Open call" : "Minimise call"}
              </button>
              <button type="button" onClick={() => call.engine.hangup()} className="grid size-9 place-items-center rounded-full text-danger transition hover:bg-danger/10" aria-label="End the call" title="End the call">
                <IconPhoneOff size={17} />
              </button>
            </div>
          )}
          {inCall && (
            <label className="flex w-full items-center gap-2 text-xs text-muted sm:w-auto">
              <IconMusic size={14} className="shrink-0" />
              <span className="shrink-0">Movie</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={callDuck}
                onChange={(e) => setCallDuck(Number(e.target.value))}
                className="min-w-20 flex-1 accent-pink-400 sm:w-28"
                aria-label="Movie volume during the call (only for me)"
              />
              <span className="w-9 shrink-0 text-right tabular-nums">{Math.round(callDuck * 100)}%</span>
            </label>
          )}
        </div>

        {mode !== "theater" && <div className="mt-3">{reactionButtons()}</div>}

        {activity.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-muted">
            {activity.map((e) => (
              <li key={e.id} suppressHydrationWarning>
                <span className="font-semibold text-ink">{nameOf(e.slug)}</span> {e.body} · {ago(e.createdAt)}
              </li>
            ))}
          </ul>
        )}

        {/* Messages: one tap to the same conversation, as a sheet on phones. */}
        <button type="button" onClick={() => setMobileChat(true)} className="tile mt-5 flex w-full items-center gap-3 p-4 text-left lg:hidden">
          <span className="grid size-10 place-items-center rounded-full bg-gold-soft text-gold-ink">
            <IconMessage size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Messages with {first}</span>
            <span className="block text-xs text-muted">{unread ? `${unread} unread` : "Chat, call or video call"}</span>
          </span>
          {unread > 0 && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
        </button>

        {/* Queue: gallery songs and videos plus YouTube finds, in one order. */}
        {state && state.queueItems.length > 0 && (
          <section className="mt-6" aria-labelledby="queue-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="queue-title" className="font-semibold">Up next</h2>
              <span className="text-xs text-muted">{state.queueItems.length} queued</span>
            </div>
            <ul className="mt-2 space-y-2">
              {state.queueItems.map((q, i) => (
                <li key={q.key} className="card flex items-center gap-3 p-2 pr-2 text-sm">
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted">{i + 1}</span>
                  {q.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.thumbUrl} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                      <IconMusic size={16} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{q.title}</span>
                    <span className="block text-[0.68rem] text-muted">{q.kind === "youtube" ? "YouTube" : q.media?.kind === "song" ? "Song" : "Video"}</span>
                  </span>
                  <button type="button" className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent-soft" onClick={() => playQueueItem(q)}>
                    Play now
                  </button>
                  <button type="button" className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-red-600" onClick={() => removeQueueItem(q)} aria-label={`Remove ${q.title} from the queue`}>
                    <IconX size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Library */}
        <section className="mt-8" aria-labelledby="library-title">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const id = youtubeIdFrom(link);
              if (!id) return;
              setLink("");
              setStageMode("standard");
              void send({ type: "load", youtubeId: id, play: true });
            }}
          >
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste any YouTube link to play it together now" className="field" aria-label="YouTube link" />
            <button className="btn shrink-0">Play</button>
          </form>

          <h2 id="library-title" className="mt-6 font-semibold">From our gallery</h2>
          {lib.data && lib.data.ours.length === 0 && <p className="mt-2 text-sm text-muted">Add songs and videos in the Gallery and they&apos;ll show up here.</p>}
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {lib.data?.ours.map((m) => (
              <div key={m.id} className="card overflow-hidden">
                <div className="relative aspect-video bg-surface-2">
                  {m.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center bg-accent-soft text-accent">
                      <IconMusic size={22} />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold">{m.title ?? m.caption ?? (m.kind === "video" ? "Video" : "Song")}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <button type="button" className="inline-flex items-center gap-1 font-semibold text-accent" onClick={() => playMedia(m)}>
                      <IconPlay size={11} /> Watch together
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 text-muted transition hover:text-ink" onClick={() => void send({ type: "queue", mediaId: m.id })}>
                      <IconPlus size={11} /> Queue
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {lib.isPending && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton aspect-video rounded-2xl" />)}
          </div>

          {!!lib.data?.discover.length && (
            <>
              <h2 className="mt-6 font-semibold">Watch together: knitting tutorials &amp; bird videos</h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {lib.data.discover.map((t) => (
                  <div key={t.id} className="card overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={youtubeThumb(t.extra!.youtubeId!, "mq")} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                    <div className="p-2">
                      <p className="line-clamp-2 text-xs font-semibold">{t.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-semibold text-accent"
                          onClick={() => {
                            setStageMode("standard");
                            void send({ type: "load", youtubeId: t.extra!.youtubeId!, title: t.title, play: true });
                          }}
                        >
                          <IconPlay size={11} /> Watch together
                        </button>
                        <button type="button" className="inline-flex items-center gap-1 text-muted transition hover:text-ink" onClick={() => void send({ type: "queueYouTube", videoId: t.extra!.youtubeId!, title: t.title })}>
                          <IconPlus size={11} /> Add to queue
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <YouTubeDiscovery
            variant="room"
            room={{
              watch: (item) => {
                setStageMode("standard");
                void send({ type: "load", youtubeId: item.videoId, title: item.title, play: true });
              },
              queue: (item) => void send({ type: "queueYouTube", videoId: item.videoId, title: item.title }),
              isWatching: (videoId) => state?.youtube?.id === videoId || state?.current?.youtubeId === videoId,
              isQueued: (videoId) => !!state?.queueItems.some((q) => q.kind === "youtube" && q.youtube?.id === videoId),
            }}
          />
        </section>
      </div>

      {/* Chat: the same conversation as Messages, docked beside the stage. Drag the edge to resize, or tuck it away. */}
      <aside className="hidden shrink-0 lg:block" style={{ width: chatCollapsed ? 56 : chatW }} aria-label="Chat dock">
        {!desktop ? (
          <div className="skeleton h-[calc(100dvh-7rem)] min-h-[34rem] rounded-[24px]" />
        ) : chatCollapsed ? (
          <button
            type="button"
            onClick={() => setChatCollapsed(false)}
            className="card sticky top-20 flex h-44 w-14 flex-col items-center justify-center gap-2 text-muted transition hover:border-accent/50 hover:text-ink"
            aria-label="Show chat"
            title="Show chat"
          >
            <IconMessage size={18} />
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] [writing-mode:vertical-rl]">Messages</span>
            {unread > 0 && <span className="rounded-full bg-emerald-500 px-1.5 text-[0.62rem] font-bold text-white">{unread}</span>}
            <IconChevronLeft size={14} />
          </button>
        ) : (
          <div className="sticky top-20 h-[calc(100dvh-7rem)] min-h-[34rem]">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chat"
              aria-valuemin={300}
              aria-valuemax={720}
              aria-valuenow={chatW}
              tabIndex={0}
              onPointerDown={startDockResize}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setChatW((w) => clampW(w + 16));
                if (e.key === "ArrowRight") setChatW((w) => clampW(w - 16));
              }}
              className="group absolute -left-3 top-0 z-10 hidden h-full w-5 cursor-col-resize touch-none lg:block"
            >
              <span className="absolute inset-y-8 left-1/2 w-px -translate-x-1/2 rounded bg-line transition group-hover:bg-accent" aria-hidden />
            </div>
            <ChatView variant="panel" onCollapse={() => setChatCollapsed(true)} callMinimized />
          </div>
        )}
      </aside>

      {/* Phones: the same chat as a full-height sheet; it lifts above the keyboard while typing. */}
      {mobileChat && !desktop && (
        <div className="fixed inset-0 z-[84] lg:hidden" role="dialog" aria-modal="true" aria-label={`Chat with ${first}`}>
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => setMobileChat(false)} aria-label="Close chat" />
          <div className="rise absolute inset-x-0 bottom-0 h-[86dvh] rounded-t-[28px] border-t border-line bg-bg p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-1.5 mt-1 h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="h-[calc(100%-0.75rem)]">
              <ChatView variant="panel" keyboardAware onCollapse={() => setMobileChat(false)} callMinimized />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
