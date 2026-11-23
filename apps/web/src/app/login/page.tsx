import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCtx } from "@/lib/context";
import { BRAND } from "@lovora/domain";
import { googleConfigured } from "@/lib/auth/google";
import { pick, parseVerse, VERSE_COOKIE, VERSES } from "@/lib/journey/verses";
import { Starfield } from "@/components/home/sky";
import { RememberLines } from "@/components/home/remember";
import { IconArrowRight, Monogram } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata = { title: `Sign in · ${BRAND.name}` };

const NOTICES: Record<string, string> = {
  "google-cancelled": "Google sign-in was cancelled. You can try again or use your email.",
  "google-unavailable": "Google sign-in is not set up on this deployment yet. Use your email and password.",
  "google-state": "That Google sign-in expired before it finished. Please try again.",
  "google-failed": "Google sign-in could not be completed. Please try again.",
  "google-linked": "That Google account cannot sign in here. Try another account or your password.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCtx()) redirect("/");
  const { next, error } = await searchParams;
  const notice = typeof error === "string" ? NOTICES[error] : undefined;
  const verse = pick(VERSES, (await cookies()).get(VERSE_COOKIE)?.value);
  let i = 0;
  return (
    <div className="min-h-dvh bg-[#07060a] sm:p-3 lg:p-4">
      <RememberLines cookies={{ [VERSE_COOKIE]: verse.remember }} />
      <div className="stage relative flex min-h-dvh items-center overflow-hidden sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-[32px] lg:min-h-[calc(100dvh-2rem)] lg:rounded-[36px]">
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <Starfield count={180} />
        <div className="relative z-[3] mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-12 sm:gap-12 sm:px-8 sm:py-14 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:px-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <Monogram size={34} />
              <span className="eyebrow-lux text-[#e7c98d]">{BRAND.name}</span>
            </div>
            <h1 className="verse font-lux mt-9 text-balance text-[2.35rem] leading-[1.05] tracking-[-0.012em] text-[#f7efe1] sm:mt-10 sm:text-[3.6rem] lg:text-[4.3rem]">
              {parseVerse(verse.text).map((part, p) =>
                part.t.split(/(\s+)/).map((w, k) =>
                  /^\s+$/.test(w) ? (
                    <span key={`${p}-${k}`}> </span>
                  ) : w ? (
                    <span key={`${p}-${k}`} className={`w ${part.em ? "gold-shimmer italic" : ""}`} style={{ "--i": i++ } as React.CSSProperties}>
                      {w}
                    </span>
                  ) : null,
                ),
              )}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55 sm:mt-6">{BRAND.tagline} No public feed. No ads. Just the two of you.</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/55 sm:mt-8">
              <Link href="/welcome" className="inline-flex min-h-10 items-center gap-1.5 text-[#e2c794] underline-offset-4 hover:underline">
                Create your private world <IconArrowRight size={14} />
              </Link>
              <span aria-hidden className="text-white/25">·</span>
              <Link href="/recover" className="inline-flex min-h-10 items-center underline-offset-4 hover:underline hover:text-white">
                Recover an account
              </Link>
            </div>
          </div>
          <div className="fade-late lg:pl-2" style={{ "--d": "240ms" } as React.CSSProperties}>
            <LoginForm next={typeof next === "string" ? next : "/"} notice={notice} googleEnabled={googleConfigured()} />
          </div>
        </div>
      </div>
    </div>
  );
}
