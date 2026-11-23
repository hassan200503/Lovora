import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { BRAND, THEME_OPTIONS, coerceTheme } from "@lovora/domain";
import { getCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { coupleMembers, couples, people } from "@/lib/db/schema";
import { findInvitation } from "@/lib/auth/invite";
import { joinWorld } from "@/lib/actions/onboarding";
import { TOPICS, TOPIC_KEYS } from "@/lib/trends/topics";
import { Field, RecoveryForm } from "@/components/ui/forms";
import { PasswordInput } from "@/components/ui/password-input";
import { Starfield } from "@/components/home/sky";
import { IconArrowRight, Monogram } from "@/components/icons";

export const metadata = { title: "Join" };

type Invite = {
  relationshipName: string;
  hostName: string;
  hostTheme: string;
  full: boolean;
};

async function lookup(token: string): Promise<Invite | null> {
  const db = await getDb();
  const invite = await findInvitation(db, token);
  if (!invite) return null;
  const [couple] = await db.select().from(couples).where(eq(couples.id, invite.coupleId)).limit(1);
  if (!couple) return null;
  const active = and(eq(coupleMembers.coupleId, couple.id), eq(coupleMembers.status, "active"));
  const [{ n }] = await db.select({ n: count() }).from(coupleMembers).where(active);
  const [host] = await db
    .select({ displayName: people.displayName, theme: people.theme })
    .from(coupleMembers)
    .innerJoin(people, eq(people.id, coupleMembers.personId))
    .where(active)
    .limit(1);
  if (!host) return null;
  return { relationshipName: couple.name, hostName: host.displayName, hostTheme: coerceTheme(host.theme), full: Number(n) >= 2 };
}

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  if (await getCtx()) redirect("/");
  const { token } = await params;
  const invite = await lookup(token);
  const suggested = THEME_OPTIONS.find((t) => t.value !== invite?.hostTheme)?.value ?? "us";

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
            {invite ? (
              <>
                <h1 className="font-lux mt-7 text-balance text-[2.6rem] leading-[1.0] tracking-[-0.02em] sm:text-[3.6rem] lg:text-[4rem]">
                  Join {invite.hostName.split(" ")[0]} in {invite.relationshipName}.
                </h1>
                <p className="mt-5 max-w-md text-base leading-relaxed text-white/65 sm:text-lg">
                  Choose your own name, colour and interests. Your feed is built from what you pick — not what someone else picked for you.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-lux mt-7 text-balance text-[2.6rem] leading-[1.0] tracking-[-0.02em] sm:text-[3.6rem] lg:text-[4rem]">This invitation isn&apos;t available.</h1>
                <p className="mt-5 max-w-md text-base leading-relaxed text-white/65 sm:text-lg">
                  The link may have expired, or your partner may already have joined. Ask for a fresh link, or sign in if you&apos;re already here.
                </p>
                <Link href="/" className="btn-gold mt-8">
                  Go to sign in <IconArrowRight size={16} />
                </Link>
              </>
            )}
          </div>

          {invite && !invite.full && (
            <div className="fade-late rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.8)] backdrop-blur-2xl sm:p-8" style={{ "--d": "200ms" } as React.CSSProperties}>
              <RecoveryForm action={joinWorld} continueHref="/api/auth/continue" submit={`Join ${invite.relationshipName}`} submitClass="btn-gold" className="space-y-7">
                <input type="hidden" name="token" value={token} />
                <section className="space-y-4">
                  <p className="eyebrow-lux text-white/50">You</p>
                  <Field label="Your name" name="displayName">
                    <input id="displayName" name="displayName" required autoComplete="name" placeholder="What should we call you?" className="field" />
                  </Field>
                  <Field label="Email" name="email" hint="(used to sign in)">
                    <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" className="field" />
                  </Field>
                </section>

                <section className="space-y-3 border-t border-white/10 pt-6">
                  <p className="eyebrow-lux text-white/50">Your colour &amp; curiosities</p>
                  <fieldset>
                    <legend className="type-label text-white/85">Choose your colour</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {THEME_OPTIONS.map((t) => (
                        <label
                          key={t.value}
                          data-world={t.value}
                          className="relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 px-3 py-2.5 text-sm transition hover:border-white/30 has-checked:border-[#e2c794] has-checked:bg-white/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#e2c794]/60"
                        >
                          <input type="radio" name="theme" value={t.value} defaultChecked={t.value === suggested} className="peer sr-only" />
                          <span className="size-5 shrink-0 rounded-full border border-white/20 bg-gradient-to-br from-accent to-accent-2" aria-hidden />
                          <span className="min-w-0">
                            <span className="block font-semibold leading-tight">{t.label}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-white/45">{t.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="type-label text-white/85">What are you curious about?</legend>
                    <p className="mt-1 text-xs text-white/45">Pick at least one. This shapes your For You feed and today&apos;s discovery.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                </section>
              </RecoveryForm>
            </div>
          )}

          {invite?.full && (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 text-sm leading-relaxed text-white/65 sm:p-8">
              <p className="font-semibold text-white">This invitation has already been used.</p>
              <p className="mt-2">Your partner can create a fresh link from Settings → Invite your partner. If this is you, sign in below.</p>
              <Link href="/" className="btn-gold mt-6">
                Go to sign in <IconArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
