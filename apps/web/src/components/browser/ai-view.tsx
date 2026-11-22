"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconAlert, IconArrowRight, IconRefresh, IconSearch, IconSparkle, IconSpinner } from "@/components/icons";
import { Answer, WebSources } from "@/components/research/answer";
import type { ResearchSource } from "@/lib/research/types";
import type { BrowserAiEvent } from "@/lib/browser/types";
import { hostOf } from "./format";

type State = {
  text: string;
  status: string;
  sources: { title: string; url: string }[];
  safety: string | null;
  error: string | null;
  done: { model: string; grounded: boolean } | null;
  usage: { used: number; limit: number } | null;
};

const INITIAL: State = { text: "", status: "Thinking…", sources: [], safety: null, error: null, done: null, usage: null };

/** AI mode: one grounded, sourced answer streamed as it's written, with safety and quota handled. */
export function AiView({ query, onSearch }: { query: string; onSearch: (q: string) => void }) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setState(INITIAL);
    const apply = (event: BrowserAiEvent) => {
      setState((prev) => {
        switch (event.t) {
          case "status":
            return { ...prev, status: event.text };
          case "delta":
            return { ...prev, text: prev.text + event.text, status: prev.text ? "" : prev.status };
          case "sources":
            return { ...prev, sources: event.items };
          case "usage":
            return { ...prev, usage: { used: event.used, limit: event.limit } };
          case "done":
            return { ...prev, status: "", done: { model: event.model, grounded: event.grounded } };
          case "safety":
            return { ...prev, text: "", safety: event.message, status: "" };
          case "error":
            return { ...prev, error: event.message, status: "" };
          default:
            return prev;
        }
      });
    };

    void (async () => {
      try {
        const res = await fetch("/api/browser/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(res.status === 401 ? "Sign in to use AI mode." : "AI mode is unavailable right now.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const lines = (final = false) => {
          let cut: number;
          while ((cut = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 1);
            if (!line.trim()) continue;
            try {
              apply(JSON.parse(line) as BrowserAiEvent);
            } catch {
              // A malformed line is skipped rather than breaking the answer.
            }
          }
          if (final && buffer.trim()) {
            try {
              apply(JSON.parse(buffer) as BrowserAiEvent);
            } catch {
              // Same here.
            }
          }
          if (final) buffer = "";
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          lines();
        }
        buffer += decoder.decode();
        lines(true);
      } catch (e) {
        if (ctl.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          status: "",
          error: e instanceof Error ? e.message : "AI mode couldn't finish. Try again.",
        }));
      }
    })();

    return () => ctl.abort();
  }, [query, attempt]);

  const sources = useMemo<ResearchSource[]>(
    () => state.sources.map((s, i) => ({ kind: "web" as const, title: s.title, uri: s.url, domain: hostOf(s.url), n: i + 1 })),
    [state.sources],
  );

  const noKey = !!state.error && /Gemini API key/i.test(state.error);
  const streaming = !state.safety && !state.error && !state.done;

  if (state.safety) {
    return (
      <div role="alert" className="card mt-6 border-warn/30 p-5 sm:p-6">
        <p className="flex items-center gap-2 font-semibold">
          <IconAlert size={18} className="text-warn" /> This needs a different kind of help
        </p>
        <div className="mt-2 text-sm leading-relaxed text-muted">
          <Answer text={state.safety} sources={[]} />
        </div>
        <button type="button" className="btn btn-ghost mt-4" onClick={() => onSearch(query)}>
          <IconSearch size={16} /> Search the web instead
        </button>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="card mt-6 p-5 sm:p-6" role="alert">
        <p className="flex items-center gap-2 font-semibold">
          <IconAlert size={18} className="text-warn" /> AI mode couldn&apos;t answer
        </p>
        <p className="mt-1.5 text-sm text-muted">{state.error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {noKey ? (
            <Link href="/settings#ai" className="btn">
              Open Settings <IconArrowRight size={16} />
            </Link>
          ) : (
            <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
              <IconRefresh size={16} /> Try again
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => onSearch(query)}>
            <IconSearch size={16} /> Search the web instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">
          <IconSparkle size={13} /> AI mode
        </span>
        <span className="text-xs text-muted">Answering “{query.length > 70 ? `${query.slice(0, 70)}…` : query}”</span>
      </div>

      <article className="card mt-3 px-5 py-5 sm:px-7 sm:py-6" aria-busy={streaming}>
        {streaming && !state.text && (
          <p className="flex items-center gap-2.5 text-sm text-muted" role="status">
            <IconSpinner size={17} /> {state.status || "Thinking…"}
          </p>
        )}

        {state.text && (
          <>
            <Answer text={state.text} sources={sources} streaming={streaming} />
            {streaming && state.status && (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                <IconSpinner size={13} /> {state.status}
              </p>
            )}
          </>
        )}

        {state.sources.length > 0 && <WebSources items={sources} />}

        {state.done && (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[0.7rem] text-muted">
            <span>{state.done.grounded ? "Checked against the web" : "Answered from what the model already knows"}</span>
            {state.usage && state.usage.limit > 0 && (
              <span>
                · {state.usage.used} of {state.usage.limit} AI questions this month
              </span>
            )}
            <button type="button" className="ml-auto font-medium text-ink underline-offset-2 hover:underline" onClick={() => onSearch(query)}>
              See web results instead
            </button>
          </div>
        )}
      </article>

      <p className="mt-3 px-1 text-[0.7rem] leading-relaxed text-muted">AI answers can be wrong. Check anything important against the sources, especially for health, money or safety.</p>
    </div>
  );
}
