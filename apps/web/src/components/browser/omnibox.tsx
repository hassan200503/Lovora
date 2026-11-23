"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { IconClock, IconCompass, IconImage, IconMic, IconSearch, IconSparkle, IconX } from "@/components/icons";
import type { BrowserSuggestions } from "@/lib/browser/types";
import { TOPICS, type TopicKey } from "@/lib/trends/topics";
import { LensSearch } from "./lens-search";
import { VoiceSearch } from "./voice-search";

const RECENT_KEY = "lovora.browser.recent";
const MAX_RECENT = 6;

function readRecent(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && !!v.trim()).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

type Row = { key: string; icon: ReactNode; label: string; sub?: string; run: () => void };
type Group = { key: string; title: string; action?: ReactNode; rows: Row[] };

/**
 * The Chrome-style address bar: type to search Lovora and the web, speak it,
 * scan a photo, or hand the question to AI mode. Suggestions never touch the
 * network until there's something worth asking about.
 */
export function Omnibox({
  value,
  onChange,
  onSubmit,
  onAi,
  onTopic,
  ai,
  onAiToggle,
  placeholder,
  busy = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  onAi: (query: string) => void;
  onTopic: (topic: TopicKey) => void;
  ai: boolean;
  onAiToggle: () => void;
  placeholder?: string;
  busy?: boolean;
}) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : readRecent()));
  const [suggest, setSuggest] = useState<BrowserSuggestions | null>(null);
  const [voice, setVoice] = useState(false);
  const [lens, setLens] = useState(false);

  const q = value.trim();
  const suggestionsOpen = focused;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!focused || q.length < 2) return;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/browser/suggest?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((res) => (res.ok ? (res.json() as Promise<BrowserSuggestions>) : null))
        .then((data) => {
          if (data) setSuggest(data);
        })
        .catch(() => {
          // Offline or signed out: the search itself explains what's missing.
        });
    }, 170);
    return () => {
      ctl.abort();
      window.clearTimeout(timer);
    };
  }, [q, focused]);

  const remember = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setRecent((prev) => {
      const next = [clean, ...prev.filter((r) => r !== clean)].slice(0, MAX_RECENT);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Private browsing can refuse storage; recents simply won't survive the session.
      }
      return next;
    });
  }, []);

  const finish = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      remember(clean);
      onChange(clean);
      setFocused(false);
      (document.activeElement as HTMLElement | null)?.blur();
    },
    [onChange, remember],
  );

  const runSearch = useCallback(
    (text: string) => {
      finish(text);
      onSubmit(text.trim());
    },
    [finish, onSubmit],
  );

  const runAi = useCallback(
    (text: string) => {
      finish(text);
      onAi(text.trim());
    },
    [finish, onAi],
  );

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    const current = suggest?.query === q ? suggest : null;
    if (q.length >= 2) {
      out.push({
        key: "ask",
        title: "AI mode",
        rows: [
          {
            key: "ai",
            icon: <IconSparkle size={17} className="text-accent" />,
            label: `Ask AI about “${q.length > 52 ? `${q.slice(0, 52)}…` : q}”`,
            sub: "A grounded answer with sources",
            run: () => runAi(q),
          },
        ],
      });
      const trends = current?.trends ?? [];
      const topics = current?.topics ?? [];
      if (trends.length) {
        out.push({
          key: "lovora",
          title: "In Lovora",
          rows: trends.map((t) => ({
            key: `t-${t.id}`,
            icon: <IconCompass size={17} className="text-muted" />,
            label: t.title,
            sub: `${t.sourceName} · ${TOPICS[t.topic].label}`,
            run: () => runSearch(t.title),
          })),
        });
      }
      if (topics.length) {
        out.push({
          key: "topics",
          title: "Explore",
          rows: topics.map((t) => ({
            key: `k-${t.key}`,
            icon: <span aria-hidden>{t.emoji}</span>,
            label: `${t.label} in Lovora`,
            run: () => {
              setFocused(false);
              (document.activeElement as HTMLElement | null)?.blur();
              onTopic(t.key);
            },
          })),
        });
      }
      out.push({
        key: "web",
        title: "The web",
        rows: [
          {
            key: "web",
            icon: <IconSearch size={17} className="text-muted" />,
            label: `Search the web for “${q.length > 52 ? `${q.slice(0, 52)}…` : q}”`,
            sub: "Google, Bing and DuckDuckGo",
            run: () => runSearch(q),
          },
        ],
      });
    } else if (!q && recent.length) {
      out.push({
        key: "recent",
        title: "Recent",
        action: (
          <button
            type="button"
            className="text-xs font-medium text-muted hover:text-ink"
            onClick={() => {
              setRecent([]);
              try {
                window.localStorage.removeItem(RECENT_KEY);
              } catch {
                // Nothing stored anyway.
              }
            }}
          >
            Clear
          </button>
        ),
        rows: recent.map((r) => ({
          key: `r-${r}`,
          icon: <IconClock size={17} className="text-muted" />,
          label: r,
          run: () => runSearch(r),
        })),
      });
    }
    return out;
  }, [q, recent, suggest, runAi, runSearch, onTopic]);

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${uid}-row-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, uid]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!focused) setFocused(true);
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && rows[active]) rows[active].run();
      else if (q.length >= 2) {
        if (ai) runAi(q);
        else runSearch(q);
      }
    } else if (e.key === "Escape") {
      if (focused) {
        e.preventDefault();
        setFocused(false);
        inputRef.current?.blur();
      }
    }
  };

  let cursor = -1;

  return (
    <div ref={rootRef} className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.length < 2) return;
          if (ai) runAi(q);
          else runSearch(q);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        <div
          className={`flex h-[52px] items-center gap-1.5 rounded-full border bg-surface pl-4 pr-1.5 shadow-[0_1px_2px_rgb(20_12_20/0.05),0_10px_30px_-18px_rgb(20_12_20/0.35)] transition sm:h-14 sm:pl-5 ${
            focused ? "border-accent/55 ring-4 ring-accent/10" : "border-line hover:border-muted/35"
          }`}
        >
          <IconSearch size={19} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setActive(-1);
            }}
            onFocus={() => {
              setFocused(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? (ai ? "Ask anything, and get sources" : "Search Lovora and the web")}
            aria-label="Search Lovora and the web"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={focused && rows.length > 0}
            aria-controls={`${uid}-listbox`}
            aria-activedescendant={active >= 0 ? `${uid}-row-${active}` : undefined}
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-muted/75 sm:text-[1.02rem]"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <IconX size={16} />
            </button>
          )}
          <button
            type="button"
            aria-label={ai ? "Turn AI mode off" : "AI mode"}
            aria-pressed={ai}
            title="AI mode"
            onClick={() => {
              onAiToggle();
              inputRef.current?.focus();
            }}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition ${
              ai ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <IconSparkle size={17} />
            <span className="hidden md:inline">AI mode</span>
          </button>
          <button
            type="button"
            aria-label="Search by voice"
            title="Search by voice"
            onClick={() => setVoice(true)}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <IconMic size={19} />
            {busy && <span className="sr-only">Searching</span>}
          </button>
          <button
            type="button"
            aria-label="Search with a photo"
            title="Search with a photo"
            onClick={() => setLens(true)}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <IconImage size={19} />
          </button>
        </div>
      </form>

      {suggestionsOpen && rows.length > 0 && (
        <div
          id={`${uid}-listbox`}
          role="listbox"
          aria-label="Suggestions"
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(26rem,70dvh)] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_70px_-24px_rgb(20_12_20/0.45)]"
        >
          {groups.map((group) => (
            <div key={group.key} className="py-1">
              <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">{group.title}</p>
                {group.action}
              </div>
              {group.rows.map((row) => {
                cursor += 1;
                const index = cursor;
                return (
                  <button
                    key={row.key}
                    id={`${uid}-row-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active === index}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={row.run}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      active === index ? "bg-surface-2" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-base">{row.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{row.label}</span>
                      {row.sub && <span className="block truncate text-xs text-muted">{row.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          <p className="hidden px-3 pb-1 pt-2 text-[0.68rem] text-muted sm:block">
            <kbd className="rounded border border-line px-1 py-0.5 text-[0.62rem]">↑</kbd>{" "}
            <kbd className="rounded border border-line px-1 py-0.5 text-[0.62rem]">↓</kbd> to browse ·{" "}
            <kbd className="rounded border border-line px-1 py-0.5 text-[0.62rem]">Enter</kbd> to choose
          </p>
        </div>
      )}

      <VoiceSearch
        open={voice}
        onClose={() => setVoice(false)}
        onResult={(text) => {
          remember(text);
          onChange(text);
          if (ai) onAi(text);
          else onSubmit(text);
        }}
      />
      <LensSearch
        key={lens ? "lens-open" : "lens-closed"}
        open={lens}
        onClose={() => setLens(false)}
        onSearch={(text) => {
          remember(text);
          onChange(text);
          setLens(false);
          onSubmit(text);
        }}
      />
    </div>
  );
}
