import { GoogleMark } from "./google-mark";

/** A plain link (not a form) so the strict CSP only has to allow navigations. */
export function GoogleButton({ href, label = "Continue with Google" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white px-5 text-sm font-semibold text-[#1f1f1f] transition hover:bg-[#f4f4f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c794]"
    >
      <GoogleMark />
      <span>{label}</span>
    </a>
  );
}

export function AuthDivider({ label = "or use your email" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.16em] text-white/35">
      <span className="h-px flex-1 bg-white/10" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
