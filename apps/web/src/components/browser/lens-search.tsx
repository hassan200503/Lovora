"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconAlert, IconCamera, IconImage, IconSearch, IconSpinner } from "@/components/icons";
import { BrowserDialog } from "./browser-dialog";

type LensResult = { title: string; summary: string; tags: string[]; searchQuery: string; notes: string[] };
type LensResponse = { ok: boolean; configured?: boolean; error?: string; result?: LensResult };

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

/** Re-encodes in the page: this strips EXIF/location and keeps the upload small. */
async function prepare(file: File): Promise<string> {
  if (!ACCEPT.split(",").includes(file.type)) throw new Error("Choose a PNG, JPEG or WebP photo.");
  if (file.size > MAX_BYTES) throw new Error("That image is over 8 MB. Try a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    if (!g) throw new Error("This browser can't prepare the photo. Try a different one.");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, width, height);
    g.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Chrome's "Search with Lens", scoped honestly: describe the photo, then search what it shows. */
export function LensSearch({ open, onClose, onSearch }: { open: boolean; onClose: () => void; onSearch: (query: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<LensResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    setUnconfigured(false);
    setBusy(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const scan = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setUnconfigured(false);
    setBusy(true);
    try {
      const image = await prepare(file);
      setPreview(image);
      const res = await fetch("/api/browser/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = (await res.json().catch(() => null)) as LensResponse | null;
      if (!data) throw new Error("The scan couldn't finish. Try again.");
      if (!data.ok || !data.result) {
        setUnconfigured(data.configured === false);
        throw new Error(data.error ?? "The scan couldn't finish. Try again.");
      }
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan couldn't finish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrowserDialog open={open} onClose={close} title="Search with a photo" subtitle="The photo is read once, then forgotten. Nothing is saved." wide>
      <input ref={picker} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" accept={ACCEPT} capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ""; }} />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div
          className="relative mx-auto aspect-square w-full max-w-[15rem] overflow-hidden rounded-2xl border border-dashed border-line bg-surface-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void scan(e.dataTransfer.files?.[0]);
          }}
        >
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy}
            aria-label="Choose a photo"
            className="flex size-full items-center justify-center transition hover:bg-surface"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL/data URL preview
              <img src={preview} alt="The photo you chose" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-6 text-center text-xs text-muted">
                <IconImage size={30} />
                Drag a photo in, or tap to choose one
              </span>
            )}
          </button>
          {busy && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center bg-night/55 text-white backdrop-blur-[2px]">
              <IconSpinner size={26} />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => picker.current?.click()} disabled={busy}>
              <IconImage size={17} /> Choose photo
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => camera.current?.click()} disabled={busy}>
              <IconCamera size={17} /> Use camera
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">PNG, JPEG or WebP. Our AI reads what&apos;s in it and suggests a search; it never keeps the photo.</p>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2.5 text-sm text-warn">
              <IconAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                {error}
                {unconfigured && (
                  <>
                    {" "}
                    <Link href="/settings#ai" className="font-semibold underline underline-offset-2" onClick={onClose}>
                      Open Settings
                    </Link>
                    .
                  </>
                )}
              </span>
            </div>
          )}

          {result && (
            <div className="mt-4">
              <h3 className="text-base font-semibold">{result.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{result.summary}</p>
              {result.tags.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {result.tags.map((tag) => (
                    <li key={tag}>
                      <button type="button" className="chip chip-outline" onClick={() => { onSearch(tag); reset(); }}>
                        {tag}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {result.notes.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-muted">
                  {result.notes.map((note) => (
                    <li key={note} className="flex gap-2">
                      <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      {note}
                    </li>
                  ))}
                </ul>
              )}
              {result.searchQuery && (
                <button type="button" className="btn mt-4 w-full sm:w-auto" onClick={() => { onSearch(result.searchQuery); reset(); }}>
                  <IconSearch size={17} /> Search “{result.searchQuery.length > 44 ? `${result.searchQuery.slice(0, 44)}…` : result.searchQuery}”
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </BrowserDialog>
  );
}
