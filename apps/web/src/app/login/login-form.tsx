"use client";

import { useActionState, useState } from "react";
import { login } from "@/lib/actions/auth";
import { BRAND } from "@lovora/domain";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { IconAlert, IconArrowRight, IconEye, IconEyeOff, IconSpinner } from "@/components/icons";

export function LoginForm({ next, googleEnabled, notice }: { next: string; googleEnabled: boolean; notice?: string }) {
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(login, null);
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 text-[#f4ede2] shadow-[0_40px_100px_-40px_rgb(0_0_0/0.8)] backdrop-blur-2xl sm:p-8">
      <p className="eyebrow-lux text-white/55">Step inside</p>
      <h2 className="font-lux mt-3 text-3xl">Welcome back.</h2>
      <p className="mt-1.5 text-sm text-white/50">Your space with the person you chose.</p>
      {notice && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-sm text-amber-100">
          <IconAlert size={17} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      )}
      {googleEnabled && (
        <div className="mt-6">
          <GoogleButton href={`/api/auth/google/start?intent=signin&next=${encodeURIComponent(next)}`} />
          <AuthDivider />
        </div>
      )}
      <form action={action} className={googleEnabled ? "space-y-4" : "mt-6 space-y-4"}>
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label htmlFor="email" className="type-label text-white/70">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus placeholder="you@example.com" className="field" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="type-label text-white/70">
            Password
          </label>
          <div className="relative">
            <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required placeholder="Your password" className="field pr-14" />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-1.5 my-auto grid size-10 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
            >
              {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
        </div>
        {state?.error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
            <IconAlert size={17} className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}
        <button className="btn-gold w-full justify-center" disabled={pending}>
          {pending ? <IconSpinner size={17} /> : null}
          {pending ? `Opening ${BRAND.name}…` : "Enter"}
          {!pending && <IconArrowRight size={17} />}
        </button>
      </form>
      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
        <span aria-hidden>🔒</span> Private by design — no ads, no public feed.
      </p>
    </div>
  );
}
