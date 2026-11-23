import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND, THEME_OPTIONS } from "@lovora/domain";
import { getCtx } from "@/lib/context";
import { googleConfigured } from "@/lib/auth/google";
import { startWorld } from "@/lib/actions/onboarding";
import { TOPICS, TOPIC_KEYS } from "@/lib/trends/topics";
import { Field, RecoveryForm } from "@/components/ui/forms";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { PasswordInput } from "@/components/ui/password-input";
import { Starfield } from "@/components/home/sky";
import { IconArrowRight, Monogram } from "@/components/icons";

export const metadata = { title: "Begin" };

const STEPS = [
  ["01", "You", "One profile, your name, your colours."],
  ["02", "Your world", "A private place for your story together."],
  ["03", "Your curiosities", "The ideas your discoveries grow from."],
] as const;

export default async function WelcomePage() {
  if (await getCtx()) redirect("/");

  return (
    <div className="min-h-dvh bg-[#07060a] text-[#f7efe1] sm:p-3 lg:p-4">
      <div className="stage relative mx-auto min-h-dvh max-w-[1400px] overflow-hidden rounded-none px-5 py-10 sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-[32px] sm:px-8 sm:py-12 lg:rounded-[36px] lg:px-12">
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <Starfield count={140} />
        <div className="relative z-[3] mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
          <div className="lg:sticky lg:top-12">
            <div className="flex items-center gap-3">
              <Monogram size={32} />
              <p className="eyebrow-lux text-[#e7c98d]">{BRAND.name}</p>
            </div>
            <h1 className="font-lux mt-7 text-balance text-[2.6rem] leading-[1.0] tracking-[-0.02em] sm:text-[3.6rem] lg:text-[4rem]">Begin your shared world.</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/65 sm:text-lg">One profile each. One private place for your story. Pick the ideas you want to see, and your discoveries will follow them.</p>
            <ol className="mt-8 space-y-4">
              {STEPS.map(([n, title, text]) => (
                <li key={n} className="flex gap-3.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-[#e2c794]/35 font-mono text-[0.7rem] text-[#e2c794]">{n}</span>
                  <span>
                    <span className="block text-sm font-semibold text-white/90">{title}</span>
                    <span className="mt-0.5 block text-sm text-white/50">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-8 flex min-h-10 items-center text-sm text-white/55">
              Already have a world?&nbsp;
              <Link href="/login" className="inline-flex min-h-10 items-center gap-1 text-[#e2c794] underline-offset-4 hover:underline">
                Sign in <IconArrowRight size={13} />
              </Link>
            </p>
          </div>

          <div className="fade-late rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.8)] backdrop-blur-2xl sm:p-8" style={{ "--d": "200ms" } as React.CSSProperties}>
            {googleConfigured() && (
              <div className="mb-7">
                <GoogleButton href="/api/auth/google/start?intent=signup" label="Sign up with Google" />
                <p className="mt-2.5 text-center text-xs leading-relaxed text-white/40">
                  Google confirms your email. You&apos;ll name your world next.
                </p>
                <AuthDivider label="or start with email" />
              </div>
            )}
            <RecoveryForm action={startWorld} continueHref="/api/auth/continue" submit="Create our world" submitClass="btn-gold" className="space-y-7">
              <section className="space-y-4">
                <p className="eyebrow-lux text-white/50">You</p>
                <Field label="Your name" name="displayName">
                  <input id="displayName" name="displayName" required autoComplete="name" placeholder="What should we call you?" className="field" />
                </Field>
                <Field label="Email" name="email" hint="(used to sign in)">
                  <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" className="field" />
                </Field>
              </section>

              <section className="space-y-4 border-t border-white/10 pt-6">
                <p className="eyebrow-lux text-white/50">Your shared world</p>
                <Field label="What do you call your shared world?" name="relationshipName">
                  <input id="relationshipName" name="relationshipName" required defaultValue={BRAND.defaultSpaceName} className="field" />
                </Field>
                <Field label="The day it all began" name="startedOn" hint="(optional)">
                  <input id="startedOn" name="startedOn" type="date" className="field" />
                </Field>
                <fieldset>
                  <legend className="type-label text-white/85">Choose your colour</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {THEME_OPTIONS.map((t) => (
                      <label
                        key={t.value}
                        data-world={t.value}
                        className="relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 px-3 py-2.5 text-sm transition hover:border-white/30 has-checked:border-[#e2c794] has-checked:bg-white/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#e2c794]/60"
                      >
                        <input type="radio" name="theme" value={t.value} defaultChecked={t.value === "us"} className="peer sr-only" />
                        <span className="size-5 shrink-0 rounded-full border border-white/20 bg-gradient-to-br from-accent to-accent-2" aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-semibold leading-tight">{t.label}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-white/45">{t.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>

              <section className="space-y-3 border-t border-white/10 pt-6">
                <p className="eyebrow-lux text-white/50">What you&apos;re curious about</p>
                <p className="text-xs leading-relaxed text-white/45">Pick at least one. This shapes your For You feed and today&apos;s discovery.</p>
                <fieldset>
                  <legend className="sr-only">Interests</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TOPIC_KEYS.map((t) => (
                      <label
                        key={t}
                        className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-white/15 px-3 py-2.5 text-sm transition hover:border-white/30 has-checked:border-[#e2c794] has-checked:bg-white/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#e2c794]/60"
                      >
                        <input type="checkbox" name="topic" value={t} className="mt-1 size-4 shrink-0 accent-[#e2c794]" />
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            <span aria-hidden>{TOPICS[t].emoji}</span> {TOPICS[t].label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-white/45">{TOPICS[t].blurb}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>

              <section className="space-y-4 border-t border-white/10 pt-6">
                <p className="eyebrow-lux text-white/50">Keep it safe</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" name="password" hint="(10+ characters)">
                    <PasswordInput id="password" name="password" minLength={10} />
                  </Field>
                  <Field label="Confirm password" name="confirm">
                    <PasswordInput id="confirm" name="confirm" minLength={10} />
                  </Field>
                </div>
                <p className="text-xs leading-relaxed text-white/40">Next you&apos;ll get a private invitation link for your partner. They choose their own name, colour and interests.</p>
              </section>
            </RecoveryForm>
          </div>
        </div>
      </div>
    </div>
  );
}
