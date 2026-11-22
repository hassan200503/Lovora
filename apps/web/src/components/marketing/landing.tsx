import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@lovora/domain";
import {
  IconArrowDownLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconBell,
  IconCheck,
  IconEyeOff,
  IconFilm,
  IconFlask,
  IconHeart,
  IconHeartFilled,
  IconHome,
  IconImage,
  IconLink,
  IconLock,
  IconMessage,
  IconMic,
  IconPhone,
  IconPhoneOff,
  IconPlay,
  IconPlus,
  IconUsers,
  IconVideo,
  Monogram,
} from "@/components/icons";
import { CinemaWall } from "./cinema-wall";
import { JourneyCounter } from "./journey-counter";
import { MarketingNav } from "./marketing-nav";
import { QuoteRotator } from "./quote-rotator";
import { RevealRoot } from "./reveal";

const STARTED_ON = "2019-06-14T18:30:00Z";

const PRIVACY = [
  {
    Icon: IconUsers,
    title: "Two seats, enforced.",
    copy: "No discovery, no matching, no groups. A world belongs to exactly two people.",
  },
  {
    Icon: IconEyeOff,
    title: "No feed. No followers. No ads.",
    copy: "There is no audience to perform for, and nothing to sell to one.",
  },
  {
    Icon: IconLink,
    title: "Signed media, scoped storage.",
    copy: "Every file lives under your world’s path and is served through short-lived links.",
  },
  {
    Icon: IconBell,
    title: "Previews that give nothing away.",
    copy: "Notifications can hide what was said until you choose to open them.",
  },
  {
    Icon: IconArrowDownLeft,
    title: "Yours to leave with.",
    copy: "Export or delete your data from inside the app. Leaving is a first-class flow, not a support ticket.",
  },
  {
    Icon: IconLock,
    title: "18+ only.",
    copy: "Nothing here is designed for minors, and nothing is shared with an audience.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Create your world",
    copy: "Name it, choose your colours, and set the day it all began.",
  },
  {
    n: "02",
    title: "Invite the one",
    copy: "One private seat for your partner. No search, no suggestions, no strangers.",
  },
  {
    n: "03",
    title: "Step inside",
    copy: "Talk, call, watch, remember. The world fills up from there.",
  },
] as const;

const FAQS = [
  {
    q: "Is Lovora a social network?",
    a: "No. There is no public feed, no followers and no discovery. A world has exactly two seats, and nobody can request to join it.",
  },
  {
    q: "Can anyone else see our messages or photos?",
    a: "No. Access is scoped to your world and derived from your signed-in session. Media is served through signed links, and there is no public profile to stumble into.",
  },
  {
    q: "Do you show ads or sell data?",
    a: "No ads, no data sale, no cross-site tracking. If paid features arrive, they will be a choice — never advertising.",
  },
  {
    q: "What can we do together?",
    a: "Message and call, watch and listen in sync, keep a gallery and a story, answer a daily question, and research things you are curious about.",
  },
  {
    q: "What happens if we break up?",
    a: "Either partner can leave. You can export or delete your data from inside the app, and leaving is a first-class flow, not a support ticket.",
  },
  {
    q: "How much does it cost?",
    a: "Lovora is free to begin while billing is closed. No card is required, and nothing on this page charges you.",
  },
  {
    q: "Is it on my phone?",
    a: "Lovora is a web app today, built to work beautifully on your phone. Native iOS and Android apps are on the roadmap.",
  },
] as const;

const WAVE = [6, 12, 18, 9, 16, 22, 10, 14, 7, 19, 12, 5, 15, 9, 20, 8];

function Ticker() {
  const items = ["A private world for two", "No feed", "No followers", "No ads", "18+ only", "Built for exactly two"];
  return (
    <div className="lp-ticker" aria-hidden="true">
      <div className="lp-ticker-track">
        {[0, 1].map((group) => (
          <div key={group} className="lp-ticker-group">
            {items.map((item) => (
              <span key={item} className="lp-ticker-item">
                {item}
                <span className="lp-ticker-dot" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero-glow" aria-hidden />
      <div className="lp-container relative z-10 grid items-center gap-12 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-28 lg:pt-20">
        <div>
          <p className="lp-eyebrow lp-hero-in" style={{ "--d": "60ms" } as React.CSSProperties}>
            A private world for two
          </p>
          <h1 id="lp-hero-title" className="lp-h1 lp-hero-in mt-6 text-balance" style={{ "--d": "140ms" } as React.CSSProperties}>
            Everything you share, <span className="block">kept <span className="gold-shimmer italic">between you.</span></span>
          </h1>
          <p className="lp-lede lp-hero-in mt-7" style={{ "--d": "260ms" } as React.CSSProperties}>
            Messages, calls, film nights, photos, memories and the small rituals that hold you together — in one beautiful place built for exactly two people.
          </p>
          <ul className="lp-hero-list lp-hero-in mt-8" style={{ "--d": "360ms" } as React.CSSProperties}>
            {["Two seats. One private world.", "No public feed. No followers. No ads.", "Film nights and calls, in sync.", "Export or delete everything, any time."].map((item) => (
              <li key={item}>
                <span className="lp-check" aria-hidden>
                  <IconCheck size={11} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="lp-hero-in mt-9 flex flex-wrap gap-3" style={{ "--d": "460ms" } as React.CSSProperties}>
            <Link href="/welcome" className="btn-gold">
              Begin your world <IconArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn-glass">
              Step inside
            </Link>
          </div>
          <p className="lp-hero-in mt-4 font-mono text-[0.58rem] uppercase tracking-[0.24em] text-[var(--lp-faint)]" style={{ "--d": "540ms" } as React.CSSProperties}>
            No card · No ads · No audience
          </p>

          <dl className="lp-stats lp-hero-in mt-10" style={{ "--d": "620ms" } as React.CSSProperties}>
            {[
              ["2", "Seats in every world"],
              ["1", "Private world, yours alone"],
              ["0", "Strangers, ads, followers"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="num-lux block text-[2.1rem] leading-none text-[var(--lp-gold)]">{value}</span>
                  <span className="mt-1.5 block text-[0.66rem] leading-snug text-[var(--lp-faint)]">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lp-hero-in lg:pl-2" style={{ "--d": "320ms" } as React.CSSProperties}>
          <CinemaWall />
        </div>
      </div>
    </section>
  );
}

function SectionHead({
  id,
  n,
  eyebrow,
  title,
  copy,
}: {
  id: string;
  n: string;
  eyebrow: string;
  title: React.ReactNode;
  copy?: string;
}) {
  return (
    <div className="lp-section-head" data-reveal>
      <p className="lp-eyebrow">
        <span className="lp-section-n">{n}</span>
        {eyebrow}
      </p>
      <h2 id={id} className="lp-h2 mt-5 max-w-4xl text-balance">
        {title}
      </h2>
      {copy && <p className="lp-lede mt-5">{copy}</p>}
    </div>
  );
}

function FeatureCard({
  n,
  Icon,
  title,
  copy,
  className,
  children,
}: {
  n: string;
  Icon: (props: { size?: number; className?: string }) => React.ReactNode;
  title: React.ReactNode;
  copy: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`lp-card ${className ?? ""}`} data-reveal>
      <div className="flex items-center justify-between gap-3">
        <span className="lp-card-icon" aria-hidden>
          <Icon size={17} />
        </span>
        <span className="lp-card-num">{n}</span>
      </div>
      <h3 className="lp-h3 mt-6">{title}</h3>
      <p className="mt-3 max-w-md text-[0.9rem] leading-relaxed text-[var(--lp-muted)]">{copy}</p>
      <div className="lp-card-visual">{children}</div>
    </article>
  );
}

function ChatMock() {
  return (
    <div className="lp-chat" aria-hidden="true">
      <div className="lp-bubble lp-bubble-theirs">
        <p>I found the place with the terrible espresso.</p>
        <span>Sam · 09:12</span>
      </div>
      <div className="lp-bubble lp-bubble-mine">
        <p>Terrible espresso is our love language.</p>
        <span>Alex · 09:13 · Read</span>
      </div>
      <div className="lp-voice-row">
        <span className="lp-voice-play">
          <IconPlay size={10} />
        </span>
        <span className="lp-wave">
          {WAVE.map((height, index) => (
            <i key={index} style={{ height }} />
          ))}
        </span>
        <span className="lp-mono">0:14</span>
        <span className="lp-voice-heart">
          <IconHeartFilled size={11} />
        </span>
      </div>
    </div>
  );
}

function CallMock() {
  return (
    <div className="lp-call" aria-hidden="true">
      <div className="lp-call-avatars">
        <span>A</span>
        <span>S</span>
      </div>
      <p className="lp-mono mt-4 text-[var(--lp-gold)]">In call · 00:42:16</p>
      <div className="lp-call-wave">
        {WAVE.slice(0, 12).map((height, index) => (
          <i key={index} style={{ height }} />
        ))}
      </div>
      <div className="lp-call-controls">
        <span>
          <IconMic size={13} />
        </span>
        <span>
          <IconVideo size={13} />
        </span>
        <span className="is-end">
          <IconPhoneOff size={13} />
        </span>
      </div>
    </div>
  );
}

function RoomMock() {
  return (
    <div className="lp-room" aria-hidden="true">
      <Image src="/media/cinema/rooftop.webp" alt="" fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
      <div className="lp-room-scrim" />
      <span className="lp-sync">
        <IconCheck size={11} /> In sync · 0.04s
      </span>
      <span className="lp-room-play">
        <IconPlay size={16} />
      </span>
      <div className="lp-room-bottom">
        <p className="font-lux text-[1.2rem] leading-none text-[#f7efe1]">Pride &amp; Prejudice</p>
        <div className="lp-room-bar">
          <span />
        </div>
      </div>
    </div>
  );
}

function GalleryMock() {
  return (
    <div className="lp-gallery" aria-hidden="true">
      <div className="lp-gallery-lead">
        <Image src="/media/cinema/umbrella.webp" alt="" fill sizes="(max-width: 1024px) 50vw, 18vw" className="object-cover" />
        <span className="lp-gallery-cap">A rainy Tuesday</span>
      </div>
      <div>
        <Image src="/media/cinema/ballroom.webp" alt="" fill sizes="(max-width: 1024px) 25vw, 10vw" className="object-cover" />
      </div>
      <div>
        <Image src="/media/cinema/platform.webp" alt="" fill sizes="(max-width: 1024px) 25vw, 10vw" className="object-cover" />
      </div>
    </div>
  );
}

function QuestionMock() {
  return (
    <div className="lp-question" aria-hidden="true">
      <p className="lp-mono">Today’s question</p>
      <p className="mt-2 font-lux text-[1.25rem] leading-tight text-[var(--lp-ink)]">What is one ordinary thing about us you hope never changes?</p>
      <div className="lp-answer-pills">
        <span className="is-mine">The way you make tea</span>
        <span className="is-theirs">Sunday mornings, nowhere to be</span>
      </div>
      <p className="lp-mono mt-3 flex items-center gap-1.5 text-[var(--lp-gold)]">
        <IconLock size={10} /> Revealed to both of you
      </p>
    </div>
  );
}

function ResearchMock() {
  return (
    <div className="lp-research" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <p className="lp-mono">Research · cited</p>
        <IconFlask size={14} className="text-[var(--lp-gold)]" />
      </div>
      <p className="mt-3 font-lux text-[1.35rem] leading-tight text-[var(--lp-ink)]">What does the research say about long-distance couples?</p>
      <div className="lp-source">
        <span>01</span>
        <p>Journal of Social and Personal Relationships</p>
      </div>
      <div className="lp-source">
        <span>02</span>
        <p>Communication Research</p>
      </div>
      <p className="mt-3 text-xs text-[var(--lp-faint)]">Read the source, keep the idea, learn it together.</p>
    </div>
  );
}

function StoryMock() {
  const rows = [
    ["12 Oct", "A memory from the coast", "The wind took the umbrella."],
    ["04 Aug", "Watched together", "Pride & Prejudice, 2005."],
    ["14 Jun", "Five years", "Dinner on the rooftop."],
  ] as const;
  return (
    <ol className="lp-story" aria-hidden="true">
      {rows.map(([date, title, copy]) => (
        <li key={title}>
          <span className="lp-story-dot" />
          <span className="lp-mono w-12 shrink-0">{date}</span>
          <span className="min-w-0">
            <span className="block font-medium text-[var(--lp-ink)]">{title}</span>
            <span className="mt-0.5 block text-xs text-[var(--lp-faint)]">{copy}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Features() {
  return (
    <section id="world" className="lp-section scroll-mt-24" aria-labelledby="lp-world-title">
      <div className="lp-container">
        <SectionHead
          id="lp-world-title"
          n="01"
          eyebrow="The world"
          title={
            <>
              The whole of us, <span className="italic text-[var(--lp-gold)]">in one place.</span>
            </>
          }
          copy="Most apps give you a chat. Lovora gives you a home: the conversation, the call, the film, the photo, the question, the memory — kept together and kept private."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-12">
          <FeatureCard
            n="01 / Messages"
            Icon={IconMessage}
            title="Said, and kept."
            copy="Text, voice notes, photos, reactions and replies. Delivery and read state, with previews that never give the words away."
            className="lg:col-span-7"
          >
            <ChatMock />
          </FeatureCard>

          <FeatureCard
            n="02 / Calls"
            Icon={IconPhone}
            title="The same room, wherever you are."
            copy="Voice and video that ring on both phones, with presence you choose to share."
            className="lg:col-span-5"
          >
            <CallMock />
          </FeatureCard>

          <FeatureCard
            n="03 / Together"
            Icon={IconFilm}
            title="Press play at the same moment."
            copy="Watch YouTube, listen to a podcast or share something you made. Playback stays in sync to the second."
            className="lg:col-span-5"
          >
            <RoomMock />
          </FeatureCard>

          <FeatureCard
            n="04 / Gallery"
            Icon={IconImage}
            title="A home for the ordinary."
            copy="Photos, videos and songs in one private gallery, with albums and memories that surface again."
            className="lg:col-span-3"
          >
            <GalleryMock />
          </FeatureCard>

          <FeatureCard
            n="05 / Ritual"
            Icon={IconHeart}
            title="A small ritual that becomes a story."
            copy="One question a day, answered privately, revealed only when you are both ready."
            className="lg:col-span-4"
          >
            <QuestionMock />
          </FeatureCard>

          <FeatureCard
            n="06 / Curious"
            Icon={IconFlask}
            title="Grow together, not just side by side."
            copy="Real sources, shared discoveries, and research you can read, cite and learn from."
            className="lg:col-span-7"
          >
            <ResearchMock />
          </FeatureCard>

          <FeatureCard
            n="07 / Story"
            Icon={IconHeart}
            title="Every step, remembered."
            copy="Milestones, ordinary Tuesdays, plans and discoveries — a timeline only the two of you can read."
            className="lg:col-span-5"
          >
            <StoryMock />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

function ProductWindow() {
  return (
    <div className="lp-window">
      <div className="lp-window-bar">
        <span className="lp-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="lp-window-title">
          <IconLock size={10} /> our-world · private
        </span>
        <span className="lp-mono">20:41</span>
      </div>
      <div className="lp-window-body">
        <aside className="lp-rail" aria-hidden="true">
          <span className="is-active">
            <IconHome size={16} />
          </span>
          <span>
            <IconMessage size={16} />
          </span>
          <span>
            <IconPhone size={16} />
          </span>
          <span>
            <IconFilm size={16} />
          </span>
          <span>
            <IconImage size={16} />
          </span>
          <span>
            <IconHeart size={16} />
          </span>
        </aside>
        <div className="lp-window-main">
          <div className="flex items-center justify-between gap-4">
            <p className="lp-eyebrow">Chapter V</p>
            <p className="lp-mono">Day 2,718 of forever</p>
          </div>
          <p className="lp-window-verse">Whatever the weather, we walk this road as one.</p>
          <div className="lp-window-grid">
            <div className="lp-window-card">
              <p className="lp-mono">Together again</p>
              <p className="lp-window-num">
                12 <span>days</span>
              </p>
              <p className="lp-window-sub">Saturday, 5 December</p>
            </div>
            <div className="lp-window-card">
              <p className="lp-mono">Next anniversary</p>
              <p className="lp-window-num">
                43 <span>days</span>
              </p>
              <p className="lp-window-sub">14 June · 7 years</p>
            </div>
            <div className="lp-window-card lp-window-question">
              <p className="lp-mono">Today’s question</p>
              <p className="mt-1.5 font-lux text-[1.15rem] leading-tight">What is one ordinary thing about us you hope never changes?</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="lp-answer-pill">Sam answered</span>
                <span className="lp-mono">Waiting for you</span>
              </div>
            </div>
          </div>
          <div className="lp-window-list">
            <p className="lp-mono">From our journey</p>
            {[
              { Icon: IconHeart, label: "A memory from the coast", date: "12 Oct" },
              { Icon: IconFilm, label: "Watched: Pride & Prejudice", date: "04 Aug" },
              { Icon: IconMessage, label: "A conversation worth keeping", date: "28 Jul" },
            ].map(({ Icon, label, date }) => (
              <div key={label} className="lp-window-row">
                <span className="lp-window-row-icon">
                  <Icon size={12} />
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="lp-mono">{date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Inside() {
  return (
    <section id="inside" className="lp-section scroll-mt-24" aria-labelledby="lp-inside-title">
      <div className="lp-container">
        <SectionHead
          id="lp-inside-title"
          n="02"
          eyebrow="Inside"
          title={
            <>
              A home, <span className="italic text-[var(--lp-gold)]">not a feed.</span>
            </>
          }
          copy="No timeline to perform for. Open it and the first thing you see is the life you are actually living: the day you began, the next time you’ll be together, and the question waiting for both of you."
        />
        <div className="mt-12" data-reveal>
          <ProductWindow />
        </div>
        <p className="mt-4 text-center text-[0.68rem] leading-relaxed text-[var(--lp-faint)]">
          An illustration of the Lovora home. Names and dates are fictional.
        </p>
      </div>
    </section>
  );
}

function FilmMarquee() {
  const titles = ["Romeo + Juliet", "Pride & Prejudice", "Titanic", "The Notebook", "La La Land", "West Side Story", "The Great Gatsby", "The Fault in Our Stars"];
  return (
    <div className="lp-film-marquee" aria-hidden="true">
      <div className="lp-film-marquee-track">
        {[0, 1].map((group) => (
          <div key={group} className="lp-film-marquee-group">
            {titles.map((title) => (
              <span key={title} className="lp-film-marquee-item">
                {title}
                <i />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Statement() {
  return (
    <section className="lp-statement-band" aria-label="No audience">
      <div className="lp-container" data-reveal>
        <p className="lp-statement">
          <span className="lp-outline">No followers.</span> <span className="lp-outline">No likes.</span>{" "}
          <span className="lp-outline">No strangers.</span> <span className="lp-outline">No algorithm.</span>
        </p>
        <p className="lp-statement-end">
          Only <span className="italic text-[var(--lp-gold)]">the two of you.</span>
        </p>
        <p className="lp-lede mt-8">
          Love is not a performance metric. Lovora has no public feed, no follower counts, and no streaks that punish you for living. Just a quiet place to be
          together.
        </p>
      </div>
    </section>
  );
}

function VaultPanel() {
  return (
    <div className="lp-vault">
      <div className="flex items-center justify-between gap-4">
        <p className="lp-mono">Access · our world</p>
        <span className="lp-card-icon size-9" aria-hidden>
          <IconLock size={14} />
        </span>
      </div>
      <div className="lp-keys" aria-hidden="true">
        <span className="lp-key">
          <span>A</span> Alex
        </span>
        <span className="lp-key-line" />
        <span className="lp-key">
          <span>S</span> Sam
        </span>
      </div>
      <p className="lp-vault-num">0</p>
      <p className="lp-vault-caption">strangers with a key</p>
      <ul className="lp-vault-list">
        {["Every record scoped to your world", "Every file served by signed link", "No public profile, no discovery"].map((item) => (
          <li key={item}>
            <IconCheck size={12} className="shrink-0 text-[var(--lp-gold)]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="lp-section scroll-mt-24" aria-labelledby="lp-privacy-title">
      <div className="lp-container grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            id="lp-privacy-title"
            n="03"
            eyebrow="Privacy"
            title={
              <>
                What you share here is not content. <span className="italic text-[var(--lp-gold)]">It is your life.</span>
              </>
            }
            copy="Lovora is built for two seats, not two million followers. Access comes from your session, every record is scoped to your world, and media is served through signed links. There is no public profile to stumble into."
          />
          <p className="mt-8 border-l border-[var(--lp-line)] pl-4 text-sm leading-relaxed text-[var(--lp-faint)]">
            Privacy is an architecture decision, not a setting.
          </p>
        </div>

        <div>
          <ul className="lp-privacy-list">
            {PRIVACY.map(({ Icon, title, copy }) => (
              <li key={title} data-reveal>
                <span className="lp-card-icon" aria-hidden>
                  <Icon size={16} />
                </span>
                <span>
                  <span className="block font-medium text-[var(--lp-ink)]">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--lp-muted)]">{copy}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8" data-reveal>
            <VaultPanel />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReelTile({
  src,
  title,
  label,
  className,
  delay,
}: {
  src: string;
  title: string;
  label: string;
  className: string;
  delay: string;
}) {
  return (
    <figure className={`lp-reel-tile ${className}`} data-reveal>
      <div className="lp-reel-media" style={{ animationDelay: delay }}>
        <Image src={src} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
      </div>
      <div className="lp-reel-scrim" aria-hidden />
      <figcaption className="lp-reel-caption">
        <span className="lp-mono">{label}</span>
        <span className="font-lux text-[1.5rem] leading-none text-[#f7efe1]">{title}</span>
      </figcaption>
    </figure>
  );
}

function Cinema() {
  return (
    <section id="cinema" className="lp-section scroll-mt-24" aria-labelledby="lp-cinema-title">
      <div className="lp-container">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            id="lp-cinema-title"
            n="04"
            eyebrow="The reel"
            title={
              <>
                Love, <span className="italic text-[var(--lp-gold)]">in motion.</span>
              </>
            }
            copy="A rotating reel of the feeling we build for: rain, trains, ballrooms and rooftops. No faces, no audience — just the moments that stay."
          />
          <Link href="/welcome" className="lp-text-link mb-1">
            Bring the cinema home <IconArrowRight size={14} />
          </Link>
        </div>

        <div className="lp-reel mt-12">
          <ReelTile
            src="/media/cinema/umbrella.webp"
            title="The Umbrella"
            label="Scene 01 · Rain, 11pm"
            className="lg:col-span-7"
            delay="-3s"
          />
          <ReelTile
            src="/media/cinema/ballroom.webp"
            title="The Last Dance"
            label="Scene 02 · Ballroom, 1958"
            className="lg:col-span-5"
            delay="-11s"
          />
          <ReelTile
            src="/media/cinema/platform.webp"
            title="Platform Four"
            label="Scene 03 · Farewell, 1946"
            className="lg:col-span-5"
            delay="-7s"
          />
          <ReelTile
            src="/media/cinema/rooftop.webp"
            title="The Rooftop"
            label="Scene 04 · Dusk, tonight"
            className="lg:col-span-7"
            delay="-15s"
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[var(--lp-faint)]">Stills from the Lovora reel, created for this page.</p>
      </div>
    </section>
  );
}

function Rituals({ now }: { now: number }) {
  return (
    <section id="rituals" className="lp-section scroll-mt-24" aria-labelledby="lp-rituals-title">
      <div className="lp-container">
        <SectionHead
          id="lp-rituals-title"
          n="05"
          eyebrow="The rituals"
          title={
            <>
              The small things <span className="italic text-[var(--lp-gold)]">that become the story.</span>
            </>
          }
          copy="No streaks. No pressure. Just a rhythm that belongs to you."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <article className="lp-card lp-ritual-card" data-reveal>
            <p className="lp-mono">The journey clock</p>
            <h3 className="lp-h3 mt-3">Every second, kept.</h3>
            <div className="lp-card-visual">
              <JourneyCounter startedOn={STARTED_ON} now={now} names="Alex & Sam" />
            </div>
          </article>

          <article className="lp-card lp-ritual-card" data-reveal>
            <p className="lp-mono">The daily question</p>
            <h3 className="lp-h3 mt-3">A question worth answering.</h3>
            <div className="lp-card-visual">
              <QuestionMock />
            </div>
          </article>

          <article className="lp-card lp-ritual-card" data-reveal>
            <p className="lp-mono">This week</p>
            <h3 className="lp-h3 mt-3">A life, not a feed.</h3>
            <div className="lp-card-visual">
              <div className="lp-digest" aria-hidden="true">
                {[
                  ["Mon", "Sam added a photo from the coast"],
                  ["Wed", "You watched Pride & Prejudice together"],
                  ["Fri", "A new question, answered by both"],
                ].map(([day, text]) => (
                  <div key={day} className="lp-digest-row">
                    <span className="lp-mono w-8 shrink-0">{day}</span>
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--lp-gold)]" />
                    <span className="text-sm text-[var(--lp-muted)]">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function QuoteBand() {
  return (
    <section className="lp-quote-band" aria-label="Words on love">
      <Image src="/media/cinema/ballroom.webp" alt="" fill sizes="100vw" className="object-cover" />
      <div className="lp-quote-veil" aria-hidden />
      <div className="lp-container relative z-10 py-24 text-center sm:py-28">
        <p className="lp-eyebrow">The words we keep</p>
        <div className="mt-10">
          <QuoteRotator />
        </div>
      </div>
    </section>
  );
}

function Begin() {
  return (
    <section id="begin" className="lp-section scroll-mt-24" aria-labelledby="lp-begin-title">
      <div className="lp-container">
        <SectionHead
          id="lp-begin-title"
          n="06"
          eyebrow="Begin"
          title={
            <>
              Two minutes. <span className="italic text-[var(--lp-gold)]">One other person.</span>
            </>
          }
          copy="A private world is not something you join. It is something the two of you make."
        />
        <ol className="lp-steps mt-12">
          {STEPS.map(({ n, title, copy }) => (
            <li key={n} data-reveal>
              <span className="lp-step-num">{n}</span>
              <h3 className="lp-h3 mt-4">{title}</h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--lp-muted)]">{copy}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-wrap gap-3" data-reveal>
          <Link href="/welcome" className="btn-gold">
            Create your world <IconArrowRight size={16} />
          </Link>
          <Link href="/login" className="btn-glass">
            I already have one
          </Link>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="questions" className="lp-section scroll-mt-24" aria-labelledby="lp-faq-title">
      <div className="lp-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            id="lp-faq-title"
            n="07"
            eyebrow="Questions"
            title={
              <>
                Before you <span className="italic text-[var(--lp-gold)]">begin.</span>
              </>
            }
            copy="The honest answers to the things people ask first."
          />
        </div>
        <div className="lp-faq" data-reveal>
          {FAQS.map(({ q, a }) => (
            <details key={q}>
              <summary>
                {q}
                <span className="lp-plus" aria-hidden>
                  <IconPlus size={18} />
                </span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="lp-final" aria-labelledby="lp-final-title">
      <Image src="/media/cinema/umbrella.webp" alt="" fill sizes="100vw" className="object-cover" />
      <div className="lp-final-veil" aria-hidden />
      <div className="lp-container relative z-10 py-28 text-center sm:py-32">
        <p className="lp-eyebrow">Begin</p>
        <h2 id="lp-final-title" className="lp-h2 mx-auto mt-5 max-w-3xl text-balance">
          Whatever the weather, <span className="italic text-[var(--lp-gold)]">we walk this road as one.</span>
        </h2>
        <p className="lp-lede mx-auto mt-5 text-center">Begin your private world today. It takes two minutes and one other person.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/welcome" className="btn-gold">
            Create your world <IconArrowRight size={16} />
          </Link>
          <Link href="/login" className="btn-glass">
            Sign in
          </Link>
        </div>
        <p className="mt-5 font-mono text-[0.56rem] uppercase tracking-[0.24em] text-white/50">No card · No ads · No audience · 18+ only</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <Monogram size={34} />
              <span className="flex flex-col leading-none">
                <span className="font-lux text-[1.4rem] font-medium tracking-[0.16em]">LOVORA</span>
                <span className="mt-1 font-mono text-[0.48rem] uppercase tracking-[0.3em] text-[var(--lp-faint)]">{BRAND.tagline}</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--lp-muted)]">
              One private place for the conversation, the call, the film, the photo and the story. Built for two, and no one else.
            </p>
            <p className="mt-5 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-[var(--lp-faint)]">No ads · No feed · No followers · 18+</p>
          </div>

          <nav aria-label="Explore">
            <p className="lp-footer-head">Explore</p>
            <ul className="lp-footer-links">
              {[
                ["The world", "#world"],
                ["Inside", "#inside"],
                ["Privacy", "#privacy"],
                ["The reel", "#cinema"],
                ["Rituals", "#rituals"],
                ["Questions", "#questions"],
              ].map(([label, href]) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Begin">
            <p className="lp-footer-head">Begin</p>
            <ul className="lp-footer-links">
              <li>
                <Link href="/welcome">Create your world</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
              <li>
                <Link href="/recover">Recover an account</Link>
              </li>
            </ul>
            <a href="#top" className="lp-text-link mt-6">
              Back to the top <IconArrowUpRight size={13} />
            </a>
          </nav>
        </div>

        <div className="mt-12 border-t border-[var(--lp-line)] pt-6">
          <div className="flex flex-col justify-between gap-4 text-[0.68rem] leading-relaxed text-[var(--lp-faint)] sm:flex-row sm:items-start">
            <p>© 2026 {BRAND.name}. Made for two.</p>
            <p className="max-w-2xl sm:text-right">
              Official trailers are embedded from YouTube and remain the property of their studios. {BRAND.name} is not affiliated with the films shown. Cinematic stills
              were created for this page; names and dates in illustrations are fictional.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage({ now }: { now: number }) {
  return (
    <RevealRoot>
      <a href="#main" className="lp-skip">
        Skip to content
      </a>
      <div id="top" />
      <Ticker />
      <MarketingNav />
      <main id="main">
        <Hero />
        <Features />
        <Inside />
        <FilmMarquee />
        <Statement />
        <Privacy />
        <Cinema />
        <Rituals now={now} />
        <QuoteBand />
        <Begin />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </RevealRoot>
  );
}
