"use client";

import { useEffect, useRef, useState } from "react";
import { IconAlert, IconPlus, IconSend, IconSpinner, IconTrash } from "@/components/icons";
import { ago } from "@/lib/ui/time";
import type { ShortComment } from "@/lib/browser/types";
import { BrowserDialog } from "./browser-dialog";

/** The couple's private conversation under a video. Public platform counts stay on the video. */
export function CommentsSheet({
  open,
  onClose,
  videoKey,
  videoTitle,
  onCount,
}: {
  open: boolean;
  onClose: () => void;
  videoKey: string | null;
  videoTitle: string;
  onCount: (delta: number) => void;
}) {
  const [comments, setComments] = useState<ShortComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !videoKey) return;
    const ctl = new AbortController();
    fetch(`/api/browser/shorts/comments?key=${encodeURIComponent(videoKey)}`, { signal: ctl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Comments couldn't load. Try again.");
        const data = (await res.json()) as { comments: ShortComment[] };
        setComments(data.comments);
      })
      .catch((e) => {
        if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : "Comments couldn't load.");
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });
    return () => ctl.abort();
  }, [open, videoKey]);

  useEffect(() => {
    if (open && !loading) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, loading, comments.length]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || !videoKey || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/browser/shorts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: videoKey, body }),
      });
      const data = (await res.json().catch(() => null)) as { comment?: ShortComment; error?: string } | null;
      if (!res.ok || !data?.comment) throw new Error(data?.error ?? "That comment didn't send. Try again.");
      setComments((prev) => [...prev, data.comment!]);
      setDraft("");
      onCount(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That comment didn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch("/api/browser/shorts/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("That comment couldn't be deleted.");
      setComments((prev) => prev.filter((c) => c.id !== id));
      onCount(-1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That comment couldn't be deleted.");
    }
  };

  return (
    <BrowserDialog open={open} onClose={onClose} title={`Comments${comments.length ? ` · ${comments.length}` : ""}`} subtitle={videoTitle ? videoTitle.slice(0, 90) : "Only the two of you can see these."}>
      <div className="max-h-[45dvh] min-h-36 overflow-y-auto rounded-xl border border-line bg-surface-2/50 p-3">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <IconSpinner size={16} /> Loading comments…
          </p>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">
            <p className="font-medium text-ink">No comments yet</p>
            <p className="mt-1">Say the first thing that came to mind.</p>
          </div>
        ) : (
          <ul className="space-y-3.5">
            {comments.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{c.name.trim()[0]?.toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold">{c.name}</span>
                    <span className="text-[0.66rem] text-muted">{ago(c.createdAt)}</span>
                    {c.mine && (
                      <button type="button" onClick={() => void remove(c.id)} aria-label="Delete comment" className="ml-auto rounded-full p-1 text-muted transition hover:bg-surface hover:text-danger">
                        <IconTrash size={13} />
                      </button>
                    )}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-danger">
          <IconAlert size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Write a comment</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Add a comment…"
            className="field !min-h-11"
          />
        </label>
        <button type="submit" className="btn !size-11 !min-h-11 !rounded-full !p-0" disabled={!draft.trim() || sending} aria-label="Send comment">
          {sending ? <IconSpinner size={18} /> : <IconSend size={18} />}
        </button>
      </form>
      <p className="mt-2 text-[0.66rem] text-muted">Private to you two. Up to 500 characters.</p>
    </BrowserDialog>
  );
}

/** Paste a public TikTok link and it joins the couple's Shorts. */
export function AddVideoDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (message: string) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setUrl("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    const value = url.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/browser/shorts/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "That link couldn't be added.");
      onAdded(data.message ?? "Added to Shorts");
      setUrl("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That link couldn't be added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrowserDialog open={open} onClose={close} title="Add a TikTok video" subtitle="It plays from TikTok, in the couple's own Shorts.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="block text-xs font-semibold" htmlFor="short-link">
          Public TikTok link
        </label>
        <input
          id="short-link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.tiktok.com/@creator/video/…"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className="field mt-1.5"
        />
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">Full links and vm.tiktok.com short links both work. Private, friends-only or removed videos can&apos;t be added.</p>
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            <IconAlert size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        <button type="submit" className="btn mt-4 w-full" disabled={!url.trim() || busy}>
          {busy ? <IconSpinner size={17} /> : <IconPlus size={17} />} {busy ? "Checking the link…" : "Add to Shorts"}
        </button>
      </form>
    </BrowserDialog>
  );
}
