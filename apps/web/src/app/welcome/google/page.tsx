import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND, THEME_OPTIONS } from "@lovora/domain";
import { getCtx } from "@/lib/context";
import { completeGoogleSignup } from "@/lib/actions/onboarding";
import { GOOGLE_SIGNUP_AUDIENCE, GOOGLE_SIGNUP_COOKIE, verifyTicket } from "@/lib/auth/tickets";
import { TOPICS, TOPIC_KEYS } from "@/lib/trends/topics";
import { ActionForm, Field } from "@/components/ui/forms";
import { Starfield } from "@/components/home/sky";
import { GoogleMark } from "@/components/auth/google-mark";
import { IconArrowRight, Monogram } from "@/components/icons";

export const metadata = { title: `Finish signing up · ${BRAND.name}` };

export default async function GoogleWelcomePage() {
  if (await getCtx()) redirect("/");
  const ticket = await verifyTicket(GOOGLE_SIGNUP_AUDIENCE, (await cookies()).get(GOOGLE_SIGNUP_COOKIE)?.value);
  const email = typeof ticket?.email === "string" ? ticket.email : "";
  const name = typeof ticket?.name === "string" ? ticket.name : "";
  if (!ticket || !email) redirect("/login?error=google-state");

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
            <h1 className="font-lux mt-7 text-balance text-[2.6rem] leading-[1.0] tracking-[-0.02em] sm:text-[3.6rem] lg:text-[4rem]">One last step.</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/65 sm:text-lg">
              Google confirmed your email. Now name your shared world, pick your colours and the ideas you want to follow.
            </p>
            <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <GoogleMark size={20} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white/90">{email}</p>
                <p className="text-xs text-white/45">Verified by Google</p>
              </div>
            </div>
            <p className="mt-7 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/55">
              <a href="/api/auth/google/start?intent=signup" className="inline-flex min-h-10 items-center text-[#e2c794] underline-offset-4 hover:underline">
                Use a different Google account
              </a>
              <span aria-hidden className="text-white/25">·</span>
              <Link href="/login" className="inline-flex min-h-10 items-center gap-1 underline-offset-4 hover:underline hover:text-white">
                Sign in <IconArrowRight size={13} />
              </Link>
            </p>
          </div>

          <div className="fade-late rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.8)] backdrop-blur-2xl sm:p-8" style={{ "--d": "200ms" } as React.CSSProperties}>
            <ActionForm action={completeGoogleSignup} submit="Enter your world" className="space-y-7">
              <section className="space-y-4">
                <p className="eyebrow-lux text-white/50">You</p>
                <Field label="Your name" name="displayName">
                  <input id="displayName" name="displayName" required maxLength={80} autoComplete="name" defaultValue={name} placeholder="What should we call you?" className="field" />
                </Field>
              </section>

              <section className="space-y-4 border-t border-white/10 pt-6">
                <p className="eyebrow-lux text-white/50">Your shared world</p>
                <Field label="What do you call your shared world?" name="relationshipName">
                  <input id="relationshipName" name="relationshipName" required maxLength={60} defaultValue={BRAND.defaultSpaceName} className="field" />
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

              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-xs leading-relaxed text-white/45">
                No password needed today. You can set one later in Settings for an extra way to sign in.
              </p>
            </ActionForm>
          </div>
        </div>
      </div>
    </div>
  );
}
