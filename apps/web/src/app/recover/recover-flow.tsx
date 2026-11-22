"use client";

import Link from "next/link";
import { useEffect, useState, useActionState } from "react";
import { recoverPassword } from "@/lib/actions/auth";
import { recoveryStep } from "@/lib/actions/recovery";
import { PasswordInput } from "@/components/ui/password-input";
import { RecoveryForm } from "@/components/ui/forms";
import { IconAlert, IconArrowRight, IconCheck, IconLock } from "@/components/icons";

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
      <IconAlert size={17} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}

/** Counts down locally; the server remains the authority on the 60-second window. */
function ResendButton({ seconds, pending }: { seconds: number; pending: boolean }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <button type="submit" className="min-h-10 text-sm text-[#e2c794] underline-offset-4 hover:underline disabled:opacity-50" disabled={pending || left > 0}>
      {left > 0 ? `Resend in ${left}s` : "Email a new code"}
    </button>
  );
}

const label = "type-label text-white/70";
const input = "field";

/**
 * Email-code recovery, then a saved recovery code as the offline fallback.
 * The reset ticket itself lives in an httpOnly cookie set by the server action.
 */
export function RecoverFlow({ emailEnabled }: { emailEnabled: boolean }) {
  const [state, action, pending] = useActionState(recoveryStep, null);
  const [copied, setCopied] = useState(false);
  const step = state?.step ?? "request";
  const email = state?.email ?? "";

  if (emailEnabled && step === "done") {
    const code = state?.recoveryCode ?? "";
    return (
      <div role="status" className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.8)] backdrop-blur-2xl sm:p-8">
        <span className="grid size-11 place-items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-emerald-200">
          <IconCheck size={20} />
        </span>
        <h2 className="font-lux mt-4 text-3xl">You&apos;re back in.</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Your password changed and every other device was signed out. Save the new recovery code below — the old one no longer works.
        </p>
        <code className="mt-5 block rounded-xl border border-[#e2c794]/30 bg-black/40 px-4 py-4 text-center font-mono text-lg tracking-[0.18em] text-[#f7efe1]">{code}</code>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                window.prompt("Copy your recovery code", code);
              }
            }}
          >
            {copied ? "Copied" : "Copy code"}
          </button>
          <Link href="/api/auth/continue" className="btn-gold inline-flex items-center gap-2">
            Enter your world <IconArrowRight size={15} />
          </Link>        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.8)] backdrop-blur-2xl sm:p-8">
      {!emailEnabled ? (
        <>
          <p className="eyebrow-lux text-white/55">Recovery code</p>
          <h2 className="font-lux mt-3 text-3xl">Use your saved code.</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Email recovery is not available on this deployment yet. Enter the one-time recovery code you saved when you created your account.
          </p>
          <div className="mt-5">
            <RecoveryForm action={recoverPassword} submit="Set a new password" submitClass="btn-gold" title="Your new recovery code" className="space-y-4" continueHref="/">
              <div className="space-y-1.5">
                <label htmlFor="legacy-email" className={label}>
                  Email
                </label>
                <input id="legacy-email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" className={input} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="legacy-code" className={label}>
                  Recovery code
                </label>
                <input id="legacy-code" name="code" required autoComplete="one-time-code" spellCheck={false} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" className={`${input} font-mono uppercase tracking-wider`} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="legacy-password" className={label}>
                  New password <span className="font-normal text-white/45">(10+ characters)</span>
                </label>
                <PasswordInput id="legacy-password" name="password" minLength={10} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="legacy-confirm" className={label}>
                  Confirm new password
                </label>
                <PasswordInput id="legacy-confirm" name="confirm" minLength={10} />
              </div>
            </RecoveryForm>
          </div>
        </>
      ) : step === "code" ? (
        <>
          <p className="eyebrow-lux text-white/55">Check your email</p>
          <h2 className="font-lux mt-3 text-3xl">Enter your code.</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            We sent a 6-digit code to <span className="font-semibold text-white/85">{email}</span>. It expires in 10 minutes.
          </p>
          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="step" value="verify" />
            <input type="hidden" name="email" value={email} />
            <div className="space-y-1.5">
              <label htmlFor="otp" className={label}>
                Verification code
              </label>
              <input
                id="otp"
                name="code"
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                className={`${input} text-center font-mono text-2xl tracking-[0.4em]`}
              />
            </div>
            {state?.error && <ErrorLine>{state.error}</ErrorLine>}
            <button className="btn-gold w-full justify-center" disabled={pending}>
              {pending ? "Checking…" : "Confirm code"}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <form action={action}>
              <input type="hidden" name="step" value="request" />
              <input type="hidden" name="from" value="code" />
              <input type="hidden" name="email" value={email} />
              <ResendButton key={state?.cooldownKey ?? 0} seconds={state?.cooldownSeconds ?? 0} pending={pending} />
            </form>
            <Link href="/recover" className="inline-flex min-h-10 items-center text-sm text-white/50 underline-offset-4 hover:underline">
              Use a different email
            </Link>
          </div>
        </>
      ) : step === "password" ? (
        <>
          <p className="eyebrow-lux text-white/55">Verified</p>
          <h2 className="font-lux mt-3 text-3xl">Choose a new password.</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">Use at least 10 characters. Every other device will be signed out.</p>
          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="step" value="reset" />
            <div className="space-y-1.5">
              <label htmlFor="new-password" className={label}>
                New password
              </label>
              <PasswordInput id="new-password" name="password" minLength={10} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-confirm" className={label}>
                Confirm new password
              </label>
              <PasswordInput id="new-confirm" name="confirm" minLength={10} autoComplete="new-password" />
            </div>
            {state?.error && <ErrorLine>{state.error}</ErrorLine>}
            <button className="btn-gold w-full justify-center" disabled={pending}>
              {pending ? "Saving…" : "Set password & sign in"}
            </button>
          </form>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-white/40">
            <IconLock size={14} className="mt-0.5 shrink-0 text-[#e2c794]" />
            This proves you can read the account&apos;s email, so the password can be reset safely.
          </p>
        </>
      ) : (
        <>
          <p className="eyebrow-lux text-white/55">Email recovery</p>
          <h2 className="font-lux mt-3 text-3xl">We&apos;ll email you a code.</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Enter the email on your account. If it&apos;s registered, a 6-digit code arrives within a minute.
          </p>
          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="step" value="request" />
            <div className="space-y-1.5">
              <label htmlFor="recover-email" className={label}>
                Email
              </label>
              <input
                id="recover-email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                inputMode="email"
                defaultValue={email}
                placeholder="you@example.com"
                className={input}
              />
            </div>
            {state?.error && <ErrorLine>{state.error}</ErrorLine>}
            <button className="btn-gold w-full justify-center" disabled={pending}>
              {pending ? "Sending…" : "Email me a code"}
            </button>
          </form>
          <details className="mt-6 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm text-white/55 hover:text-white">Use a saved recovery code instead</summary>
            <div className="mt-4">
              <RecoveryForm action={recoverPassword} submit="Set a new password" submitClass="btn-gold" title="Your new recovery code" className="space-y-4" continueHref="/">
                <div className="space-y-1.5">
                  <label htmlFor="fallback-code" className={label}>
                    Recovery code
                  </label>
                  <input id="fallback-code" name="code" required autoComplete="one-time-code" spellCheck={false} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" className={`${input} font-mono uppercase tracking-wider`} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="fallback-password" className={label}>
                    New password <span className="font-normal text-white/45">(10+ characters)</span>
                  </label>
                  <PasswordInput id="fallback-password" name="password" minLength={10} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="fallback-confirm" className={label}>
                    Confirm new password
                  </label>
                  <PasswordInput id="fallback-confirm" name="confirm" minLength={10} />
                </div>
              </RecoveryForm>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
