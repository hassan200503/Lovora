"use client";

import { useEffect, useRef, useState } from "react";
import { IconMic, IconMicOff } from "@/components/icons";
import { BrowserDialog } from "./browser-dialog";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: { length: number; [index: number]: SpeechResult } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Hold the mic and talk: Web Speech in the browser, nothing recorded or stored by us. */
export function VoiceSearch({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (text: string) => void }) {
  return (
    <BrowserDialog open={open} onClose={onClose} title="Voice search" subtitle="Speak now — your browser does the listening.">
      {open && <VoiceSession onClose={onClose} onResult={onResult} />}
    </BrowserDialog>
  );
}

/** Mounted per opening, so every session starts with a clean transcript and a fresh recogniser. */
function VoiceSession({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => void }) {
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(true);
  const [Ctor] = useState<RecognitionCtor | null>(() => recognitionCtor());
  const sent = useRef(false);
  const callbacks = useRef({ onClose, onResult });
  useEffect(() => {
    callbacks.current = { onClose, onResult };
  }, [onClose, onResult]);

  useEffect(() => {
    if (!Ctor) return;
    let result = "";
    const rec = new Ctor();
    rec.lang = navigator.language || "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]!;
        if (r.isFinal) result += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript((result + interim).trim());
      if (result.trim() && !sent.current) {
        sent.current = true;
        const text = result.trim();
        window.setTimeout(() => {
          callbacks.current.onResult(text);
          callbacks.current.onClose();
        }, 350);
      }
    };
    rec.onerror = (event) => {
      const code = event.error ?? "";
      setError(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in your browser settings, then try again."
          : code === "no-speech"
            ? "I didn't hear anything. Tap the mic and try again."
            : "Voice search stopped. Try again, or type your question.",
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
    } catch {
      window.setTimeout(() => {
        setError("Voice search couldn't start. Try again.");
        setListening(false);
      }, 0);
    }
    return () => {
      try {
        rec.abort();
      } catch {
        // Already stopped.
      }
    };
  }, [Ctor]);

  const unsupported = !Ctor;
  const shownError = unsupported ? "Voice search isn't available in this browser. Try Chrome, Edge or Safari on your phone." : error;

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="relative grid size-24 place-items-center rounded-full bg-accent-soft text-accent">
        {listening && !shownError && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/15 motion-reduce:hidden" />
            <span className="absolute inset-3 animate-pulse rounded-full bg-accent/10 motion-reduce:hidden" />
          </>
        )}
        {shownError ? <IconMicOff size={34} /> : <IconMic size={34} />}
      </span>
      <p className="mt-5 min-h-12 max-w-sm text-lg font-semibold leading-snug" aria-live="polite">
        {transcript || (shownError ? "Microphone off" : listening ? "Listening…" : "Nothing heard — tap the mic and try again.")}
      </p>
      {shownError ? (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {shownError}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">Say what you&apos;re looking for. It searches as soon as you finish.</p>
      )}
      {transcript && !shownError && (
        <button
          type="button"
          className="btn mt-5"
          onClick={() => {
            onResult(transcript);
            onClose();
          }}
        >
          Search for “{transcript.length > 40 ? `${transcript.slice(0, 40)}…` : transcript}”
        </button>
      )}
    </div>
  );
}
