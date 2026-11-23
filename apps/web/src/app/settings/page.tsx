import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { preferences } from "@/lib/db/schema";
import { personTopics } from "@/lib/trends/query";
import { SOURCES } from "@/lib/trends/sources";
import { TOPICS, TOPIC_KEYS } from "@/lib/trends/topics";
import { changePassword, rotateRecoveryCode, saveFeatures, saveInterests, savePreferences, saveProfile, saveRelationship, setPassword, signOutEverywhere } from "@/lib/actions/personal";
import { ActionForm, Field, RecoveryForm } from "@/components/ui/forms";
import { AvatarPicker } from "@/components/avatar-picker";
import { AlertsSetting } from "@/components/push";
import { storageMode } from "@/lib/media/storage";
import { logout } from "@/lib/actions/auth";
import { AiKeySetting, RelaySetting } from "@/components/settings/secrets";
import { describeSecret, geminiSecret, SECRET_RELAY } from "@/lib/settings";
import { relaySource } from "@/lib/calls/ice";
import { InvitePartner } from "@/components/invite-partner";
import { Container, PageHeader } from "@/components/ui/page-header";
import { PasswordInput } from "@/components/ui/password-input";
import {
  IconBell,
  IconCompass,
  IconFlask,
  IconGlobe,
  IconGrid,
  IconHeart,
  IconLock,
  IconLogOut,
  IconSettings,
  IconStar,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { THEME_OPTIONS, coerceTheme } from "@lovora/domain";
import { UsageMeter } from "@/components/ui/usage";
import { planUsage } from "@/lib/entitlements/server";
import { flagFor } from "@/lib/flags/server";
import { formatCost, formatTokens, resetLabel } from "@/lib/entitlements/format";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { id: "plan", label: "Your plan", Icon: IconStar },
  { id: "profile", label: "Profile", Icon: IconUser },
  { id: "interests", label: "Interests", Icon: IconCompass },
  { id: "us", label: "Our journey", Icon: IconHeart },
  { id: "alerts", label: "Calls & alerts", Icon: IconBell },
  { id: "relay", label: "Call relay", Icon: IconGlobe },
  { id: "ai", label: "AI research", Icon: IconFlask },
  { id: "sections", label: "Your sections", Icon: IconGrid },
  { id: "account", label: "Account", Icon: IconLock },
  { id: "personalise", label: "Your feeds", Icon: IconSettings },
] as const;

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const me = ctx.me;
  const db = await getDb();
  const [pref] = await db.select().from(preferences).where(eq(preferences.personId, me.id));
  const topics = await personTopics(me.id);
  const followed = SOURCES.filter((s) => topics.includes(s.topic));
  const categories = topics.flatMap((t) => [...TOPICS[t].categories.map((c) => c.name), TOPICS[t].fallbackCategory]);
  const plan = await planUsage(ctx.relationship.id);
  const paywall = await flagFor(ctx.relationship.id, "paywall");
  const [gemini, relay] = await Promise.all([
    process.env.GEMINI_API_KEY ? ({ source: "env" } as const) : describeSecret(geminiSecret(ctx.relationship.id)).then((d) => ({ ...d, source: d.set ? ("saved" as const) : ("none" as const) })),
    relaySource() ? ({ source: "env" } as const) : describeSecret(SECRET_RELAY).then((d) => ({ ...d, source: d.set ? ("saved" as const) : ("none" as const) })),
  ]);

  return (
    <>
      <PageHeader world={me.theme} eyebrow="Settings" title={`Your settings, ${me.displayName.split(" ")[0]}`}>
        Everything here can be changed back at any time.
        <form action={logout} className="mt-4">
          <button className="btn btn-ghost">
            <IconLogOut size={15} /> Sign out
          </button>
        </form>
      </PageHeader>
      <Container world={me.theme} className="pb-16">
        <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          <nav
            aria-label="Settings sections"
            className="no-scrollbar mb-6 flex w-full max-w-full gap-1.5 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:mb-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
          >
            {ctx.partners.length === 0 && (
              <a href="#invite" className="inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-sm text-gold-ink transition hover:bg-gold-soft lg:rounded-xl">
                <IconUsers size={16} /> Invite partner
              </a>
            )}
            {SECTIONS.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-sm text-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 lg:rounded-xl"
              >
                <Icon size={16} className="shrink-0 opacity-80" />
                {label}
              </a>
            ))}
          </nav>
          <div className="min-w-0">
            {ctx.partners.length === 0 && (
              <section id="invite" className="card card-glow mb-6 scroll-mt-24 p-5 sm:p-6">
                <p className="eyebrow">One more step</p>
                <h2 className="type-section-title mt-1.5">Invite your partner</h2>
                <p className="mt-2 max-w-xl text-sm text-muted">Make a private link for your partner. It works once, expires after 7 days, and is replaced whenever you make a new one.</p>
                <InvitePartner />
              </section>
            )}
            <section id="plan" className="card mb-6 scroll-mt-24 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Your plan</p>
                  <h2 className="type-section-title mt-1.5">{plan.plan === "free" ? "Free, shared by both of you" : "Premium, shared by both of you"}</h2>
                </div>
                <span className={`chip ${plan.plan === "free" ? "" : "border-gold/40 bg-gold-soft text-gold-ink"}`}>{plan.plan === "free" ? "Free" : "Premium"}</span>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Limits belong to the two of you together, are enforced on the server, and never depend on what a browser asks for. Monthly counters reset on {resetLabel(plan.resetsAt)}.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <UsageMeter label="Shared storage" kind="bytes" used={plan.usage.storageBytes} limit={plan.limits.storageBytes} hint="Photos, videos, songs and profile pictures." />
                <UsageMeter
                  label="AI questions"
                  used={plan.usage.aiQuestions}
                  limit={plan.limits.aiQuestionsPerMonth}
                  hint={plan.limits.aiQuestionsPerMonth > 0 ? `Resets ${resetLabel(plan.resetsAt)}.` : "Not part of this plan right now."}
                />
                <UsageMeter
                  label="Together rooms"
                  used={plan.usage.rooms}
                  limit={plan.limits.rooms}
                  blocked={plan.limits.rooms < 1 || plan.usage.rooms > plan.limits.rooms}
                  hint={plan.limits.rooms > 0 ? "The shared player both of you steer." : "Ask support if you expected the shared player."}
                />
                <UsageMeter label="Data exports" used={plan.usage.exports} limit={plan.limits.exportsPerMonth} hint="A full copy of your world, whenever you ask." />
              </div>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="flex items-baseline justify-between gap-3 rounded-xl border border-line/70 bg-surface-2/40 px-3.5 py-3">
                  <dt className="text-xs font-semibold text-muted">Tokens this month</dt>
                  <dd className="text-sm font-semibold tabular-nums">{formatTokens(plan.usage.aiTokens)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 rounded-xl border border-line/70 bg-surface-2/40 px-3.5 py-3">
                  <dt className="text-xs font-semibold text-muted">Estimated AI cost</dt>
                  <dd className="text-sm font-semibold tabular-nums">{formatCost(plan.usage.aiCostMicros)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[0.7rem] leading-snug text-muted">
                Read from Gemini&apos;s own usage report for every answer and quiz, at the model&apos;s published rate. Your key, your bill — we never mark usage up.
              </p>
              <p className="mt-3 text-xs text-muted">No ads, and no selling your data. Premium plans aren&apos;t for sale yet — if your plans ever change, support can adjust your limits and the change is audited.</p>
              {paywall && (
                <p className="mt-3 text-sm">
                  <Link href="/premium" className="font-medium text-accent underline-offset-2 hover:underline">Compare Free and Premium</Link>
                </p>
              )}
            </section>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section id="profile" className="card scroll-mt-24 p-5 sm:p-6">
            <h2 className="type-section-title">Profile</h2>
            <p className="mt-1 text-sm text-muted">How you appear inside your world.</p>
            <div className="mt-4">
              <AvatarPicker name={me.displayName} url={me.avatarUrl} theme={me.theme} enabled={storageMode() !== "none"} />
            </div>
            <ActionForm action={saveProfile} submit="Save profile" resetOnSuccess={false} className="mt-5 space-y-3">
              <Field label="Name" name="displayName">
                <input id="displayName" name="displayName" required defaultValue={me.displayName} className="field" />
              </Field>
              <Field label="Nickname" name="nickname" hint="(optional · only the two of you see it, never public)">
                <input id="nickname" name="nickname" defaultValue={me.nickname ?? ""} className="field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Course" name="course">
                  <input id="course" name="course" defaultValue={me.course ?? ""} className="field" />
                </Field>
                <Field label="Focus" name="focus">
                  <input id="focus" name="focus" defaultValue={me.focus ?? ""} className="field" />
                </Field>
              </div>
              <Field label="Headline" name="headline">
                <input id="headline" name="headline" defaultValue={me.headline ?? ""} className="field" />
              </Field>
              <Field label="Introduction" name="intro" hint="(blank line = new paragraph)">
                <textarea id="intro" name="intro" defaultValue={me.intro ?? ""} className="field min-h-40" />
              </Field>
              <Field label="Motto" name="motto">
                <input id="motto" name="motto" defaultValue={me.motto ?? ""} className="field" />
              </Field>
              <fieldset className="min-w-0">
                <legend className="text-sm font-semibold">Your colour</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {THEME_OPTIONS.map((t) => (
                    <label key={t.value} data-world={t.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line p-2.5 text-sm transition has-checked:border-accent has-checked:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/60">
                      <input type="radio" name="theme" value={t.value} defaultChecked={coerceTheme(me.theme) === t.value} className="sr-only" />
                      <span className="size-5 shrink-0 rounded-full border border-white/40 bg-gradient-to-br from-accent to-accent-2 shadow-sm" aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-semibold">{t.label}</span>
                        <span className="block text-xs text-muted">{t.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Birthday 🎂" name="birthday" hint="(your partner gets a countdown and a celebration on the day)">
                <input id="birthday" name="birthday" type="date" defaultValue={me.birthday ?? ""} className="field" />
              </Field>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="publicProfile" defaultChecked={me.publicProfile} className="mt-1 size-4 accent-[var(--color-accent)]" />
                <span>
                  Turn on my public profile. It gets its own private link, never your sign-in name, and shows only your name, introduction, and skills and projects marked 🌍 Public. Never
                  memories, journals, vaults or your nickname.
                  {me.publicProfile && me.publicHandle && (
                    <Link href={`/p/${me.publicHandle}`} className="ml-1 font-medium text-accent underline-offset-2 hover:underline">
                      View it
                    </Link>
                  )}
                </span>
              </label>
            </ActionForm>
          </section>

          <div className="min-w-0 space-y-8">
            <section id="interests" className="card scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">Interests</h2>
              <p className="mt-1 text-sm text-muted">These decide your For You feed and dashboard.</p>
              <ActionForm action={saveInterests} submit="Save interests" resetOnSuccess={false} className="mt-3">
                <div className="grid grid-cols-2 gap-2">
                  {TOPIC_KEYS.map((t) => (
                    <label key={t} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-2.5 text-sm transition has-checked:border-accent has-checked:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/60">
                      <input type="checkbox" name="topic" value={t} defaultChecked={topics.includes(t)} className="size-4 accent-[var(--color-accent)]" />
                      <span aria-hidden>{TOPICS[t].emoji}</span> {TOPICS[t].label}
                    </label>
                  ))}
                </div>
              </ActionForm>
            </section>

            <section id="us" data-world="us" className="card-glow scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">Our journey</h2>
              <p className="mt-1 text-sm text-muted">Shared by both of you. The day it began powers the journey clock on the home page, and every anniversary.</p>
              <ActionForm action={saveRelationship} submit="Save" resetOnSuccess={false} className="mt-3 space-y-3">
                <Field label="What do you call your universe?" name="rel-name">
                  <input id="rel-name" name="name" required defaultValue={ctx.relationship.name} className="field" />
                </Field>
                <Field label="The day it all began" name="startedOn">
                  <input id="startedOn" name="startedOn" type="date" defaultValue={ctx.relationship.startedOn ?? ""} className="field" />
                </Field>
                <Field label="Next time we're together ✈️" name="nextMeetOn" hint="(counts down on the home page)">
                  <input id="nextMeetOn" name="nextMeetOn" type="date" defaultValue={ctx.relationship.nextMeetOn ?? ""} className="field" />
                </Field>
              </ActionForm>
            </section>

            <section id="alerts" className="card scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">Calls &amp; alerts</h2>
              <p className="mt-1 text-sm text-muted">Voice and video calls ring on any device where you&apos;re signed in. Turn alerts on for each phone or computer you want to ring when the site is closed.</p>
              <AlertsSetting />
            </section>

            <section id="relay" className="card scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">Call relay</h2>
              <p className="mt-1 text-sm text-muted">
                Some mobile networks block direct calls. A relay (TURN server) passes the call through when that happens, so calls connect everywhere. Metered and Cloudflare both have free plans. Shared by both of you.
              </p>
              <RelaySetting status={relay} />
            </section>

            <section id="ai" className="card scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">AI research</h2>
              <p className="mt-1 text-sm text-muted">
                <Link href="/research" className="font-medium text-accent underline-offset-2 hover:underline">Research</Link> uses Google&apos;s Gemini to read real studies with you, teach you anything and quiz you. The key is shared by both of you, stored encrypted, and never shown again.
              </p>
              <AiKeySetting status={gemini} />
            </section>

            <section id="sections" className="card scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">Your sections</h2>
              <p className="mt-1 text-sm text-muted">Optional areas in your world.</p>
              <ActionForm action={saveFeatures} submit="Save sections" resetOnSuccess={false} className="mt-3 space-y-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3 text-sm transition has-checked:border-accent has-checked:bg-accent-soft">
                  <input type="checkbox" name="feature" value="projects" defaultChecked={me.features.includes("projects")} className="size-4 accent-[var(--color-accent)]" /> <span aria-hidden>🛠️</span> Things I&apos;m Building (projects)
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3 text-sm transition has-checked:border-accent has-checked:bg-accent-soft">
                  <input type="checkbox" name="feature" value="thinking" defaultChecked={me.features.includes("thinking")} className="size-4 accent-[var(--color-accent)]" /> <span aria-hidden>🧠</span> Questions I&apos;m Thinking About
                </label>
              </ActionForm>
            </section>

            <section id="account" className="card scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">Account</h2>
              <p className="mt-1 text-sm text-muted">
                You sign in as <span className="font-semibold text-ink">{me.email}</span>.
                {me.passwordSet ? null : " Your Google account is linked; no password is set yet."}
              </p>
              {me.passwordSet ? (
                <ActionForm action={changePassword} submit="Change password" className="mt-3 space-y-3">
                  <Field label="Current password" name="current">
                    <PasswordInput id="current" name="current" autoComplete="current-password" />
                  </Field>
                  <Field label="New password" name="next" hint="(10+ characters)">
                    <PasswordInput id="next" name="next" autoComplete="new-password" minLength={10} />
                  </Field>
                  <Field label="New password again" name="confirm">
                    <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={10} />
                  </Field>
                </ActionForm>
              ) : (
                <ActionForm action={setPassword} submit="Set password" className="mt-3 space-y-3">
                  <p className="text-xs leading-relaxed text-muted">
                    Add a password so this account can also sign in without Google. Other devices will be signed out.
                  </p>
                  <Field label="New password" name="next" hint="(10+ characters)">
                    <PasswordInput id="new-password" name="next" autoComplete="new-password" minLength={10} />
                  </Field>
                  <Field label="New password again" name="confirm">
                    <PasswordInput id="new-confirm" name="confirm" autoComplete="new-password" minLength={10} />
                  </Field>
                </ActionForm>
              )}
              <div className="mt-5 border-t border-line/70 pt-4">
                <p className="text-sm font-semibold">Recovery</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {me.passwordSet
                    ? "If you forget your password, a 6-digit code is emailed to your address. This saved code is the offline fallback. Making a new one stops the previous code."
                    : "Your account recovers with a 6-digit code emailed to your address. You can also keep an offline recovery code as a fallback."}
                </p>
                <RecoveryForm action={rotateRecoveryCode} submit="Generate a new code" continueHref="/settings" title="Your new recovery code" className="mt-3 space-y-3">
                  {me.passwordSet && (
                    <Field label="Current password" name="current-recovery">
                      <PasswordInput id="current-recovery" name="current" autoComplete="current-password" />
                    </Field>
                  )}
                </RecoveryForm>
              </div>
              <div className="mt-5 border-t border-line/70 pt-4">
                <p className="text-sm font-semibold">Sign out everywhere else</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">Use this if you left a device signed in. This phone or computer stays signed in; every other session ends now.</p>
                <ActionForm action={signOutEverywhere} submit="Sign out other devices" resetOnSuccess={false} className="mt-3" />
              </div>
            </section>

            <section id="personalise" className="card scroll-mt-24 p-5 sm:p-6">
              <h2 className="type-section-title">Personalise your feeds</h2>
              <ActionForm action={savePreferences} submit="Save preferences" resetOnSuccess={false} className="mt-3 space-y-5">
                <fieldset className="min-w-0">
                  <legend className="text-sm font-semibold">Favourite topics <span className="font-normal text-muted">(twice the space in For You)</span></legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <label key={t} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-sm transition has-checked:border-accent has-checked:bg-accent-soft">
                        <input type="checkbox" name="favoriteTopics" value={t} defaultChecked={pref?.favoriteTopics.includes(t)} className="size-3.5 accent-[var(--color-accent)]" />
                        {TOPICS[t].label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="min-w-0">
                  <legend className="text-sm font-semibold">Sources</legend>
                  <p className="mt-1 text-xs text-muted">Mute a source to hide it; star one to remember you trust it.</p>
                  <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-2 text-sm">
                    {followed.map((s) => (
                      <li key={s.key} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3">
                        <span className="min-w-0 flex-1 truncate">
                          <span aria-hidden>{TOPICS[s.topic].emoji}</span> {s.name}
                        </span>
                        <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-2 text-xs text-muted transition has-checked:bg-gold-soft has-checked:text-gold-ink">
                          <input type="checkbox" name="savedSources" value={s.key} defaultChecked={pref?.savedSources.includes(s.key)} className="size-3.5 accent-[var(--color-gold-ink)]" aria-label={`Trust ${s.name}`} />
                          <span aria-hidden>⭐</span> Trust
                        </label>
                        <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-2 text-xs text-muted transition has-checked:bg-surface-2 has-checked:text-ink">
                          <input type="checkbox" name="mutedSources" value={s.key} defaultChecked={pref?.mutedSources.includes(s.key)} className="size-3.5 accent-[var(--color-accent)]" aria-label={`Mute ${s.name}`} />
                          Mute
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <fieldset className="min-w-0">
                  <legend className="text-sm font-semibold">Hide categories</legend>
                  <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto text-sm">
                    {[...new Set(categories)].map((c) => (
                      <label key={c} className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 text-xs transition has-checked:border-accent has-checked:bg-accent-soft">
                        <input type="checkbox" name="blockedCategories" value={c} defaultChecked={pref?.blockedCategories.includes(c)} className="size-3.5 accent-[var(--color-accent)]" />
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="Hide items mentioning" name="blockedKeywords" hint="(comma separated)">
                  <input id="blockedKeywords" name="blockedKeywords" defaultValue={pref?.blockedKeywords.join(", ")} className="field" />
                </Field>
                <Field label="Digest frequency" name="digestFrequency">
                  <select id="digestFrequency" name="digestFrequency" defaultValue={pref?.digestFrequency ?? "weekly"} className="field">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="off">Off</option>
                  </select>
                </Field>
              </ActionForm>
            </section>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
