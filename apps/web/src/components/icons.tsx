/**
 * Line icons drawn on a 24px grid with one stroke weight, so every control in
 * the app reads as one family. Decorative by default; pass a `title` when an
 * icon is the only label.
 */
type P = { className?: string; size?: number; title?: string; strokeWidth?: number };

function Svg({ className = "", size = 20, title, strokeWidth = 1.6, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10.5 12 4l8.5 6.5" />
    <path d="M5.5 9v10.5h13V9" />
    <path d="M10 19.5v-5h4v5" />
  </Svg>
);
export const IconHeart = (p: P) => (
  <Svg {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
  </Svg>
);
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 16-4.8-4.8L6 19.5" />
  </Svg>
);
export const IconHeadphones = (p: P) => (
  <Svg {...p}>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3.5" y="14" width="4" height="6" rx="1.6" />
    <rect x="16.5" y="14" width="4" height="6" rx="1.6" />
  </Svg>
);
export const IconCompass = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const IconMessage = (p: P) => (
  <Svg {...p}>
    <path d="M20.5 11.6c0 4.3-3.8 7.6-8.5 7.6-1.2 0-2.3-.2-3.3-.6L4 20l1.3-3.7A7.2 7.2 0 0 1 3.5 11.6C3.5 7.3 7.3 4 12 4s8.5 3.3 8.5 7.6Z" />
  </Svg>
);
export const IconPhone = (p: P) => (
  <Svg {...p}>
    <path d="M5 4.5h3l1.5 4-2 1.3a10 10 0 0 0 6.7 6.7l1.3-2 4 1.5v3A1.5 1.5 0 0 1 18 20.5 15.5 15.5 0 0 1 3.5 6 1.5 1.5 0 0 1 5 4.5Z" />
  </Svg>
);
export const IconPhoneOff = (p: P) => (
  <Svg {...p}>
    <path d="M3.3 13.6c-.5-.5-.5-1.3 0-1.8a12.3 12.3 0 0 1 17.4 0c.5.5.5 1.3 0 1.8l-1.7 1.7a1 1 0 0 1-1.2.2l-2.4-1.2a1 1 0 0 1-.6-.9v-1.9a9.6 9.6 0 0 0-5.6 0v1.9a1 1 0 0 1-.6.9l-2.4 1.2a1 1 0 0 1-1.2-.2Z" />
  </Svg>
);
export const IconVideo = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6.5" width="12.5" height="11" rx="2.5" />
    <path d="m15.5 10.5 5.5-3v9l-5.5-3" />
  </Svg>
);
export const IconVideoOff = (p: P) => (
  <Svg {...p}>
    <path d="M15.5 13.5v1.5a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 15V9a2.5 2.5 0 0 1 2.5-2.5h1" />
    <path d="M10 6.5h3a2.5 2.5 0 0 1 2.5 2.5v1.5l5.5-3v9" />
    <path d="m3 3 18 18" />
  </Svg>
);
export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Svg>
);
export const IconMicOff = (p: P) => (
  <Svg {...p}>
    <path d="M15 10.5V6.5a3 3 0 0 0-5.7-1.3M9 9v2.5a3 3 0 0 0 4.6 2.5" />
    <path d="M18.5 11.5a6.5 6.5 0 0 1-1 3.5M5.5 11.5a6.5 6.5 0 0 0 10 5.5M12 18v2.5M3 3l18 18" />
  </Svg>
);
export const IconFlip = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5V7a2 2 0 0 1 2-2h2.5L10 3.5h4L15.5 5H18a2 2 0 0 1 2 2v1.5" />
    <path d="M20 15.5V17a2 2 0 0 1-2 2h-2.5L14 20.5h-4L8.5 19H6a2 2 0 0 1-2-2v-1.5" />
    <path d="m7 11-3 2-1.5-3M17 13l3-2 1.5 3" />
  </Svg>
);
export const IconSpeaker = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);
export const IconSpeakerOff = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Svg>
);
export const IconReply = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 6 4 11.5 9.5 17" />
    <path d="M4.5 11.5H14a6 6 0 0 1 6 6V19" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6" />
    <path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5h6V7" />
  </Svg>
);
export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconChecks = (p: P) => (
  <Svg {...p}>
    <path d="m2.5 12.5 4.5 4.5 9.5-9.5" />
    <path d="m11.5 16 1 1 9.5-9.5" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 5-7 7 7 7" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 5 7 7-7 7" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m5 9 7 7 7-7" />
  </Svg>
);
export const IconMore = (p: P) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Svg>
);
export const IconBookmark = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 4.5h11a1 1 0 0 1 1 1v14L12 15.2l-6.5 4.3v-14a1 1 0 0 1 1-1Z" />
  </Svg>
);
export const IconBookmarkFilled = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 4.5h11a1 1 0 0 1 1 1v14L12 15.2l-6.5 4.3v-14a1 1 0 0 1 1-1Z" fill="currentColor" />
  </Svg>
);
export const IconHeartFilled = (p: P) => (
  <Svg {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="currentColor" />
  </Svg>
);
export const IconStar = (p: P) => (
  <Svg {...p}>
    <path d="m12 3.8 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8L12 3.8Z" />
  </Svg>
);
export const IconStarFilled = (p: P) => (
  <Svg {...p}>
    <path d="m12 3.8 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8L12 3.8Z" fill="currentColor" />
  </Svg>
);
export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M8 8l4-3.5L16 8" />
    <path d="M5 12.5v6a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-6" />
  </Svg>
);
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.95 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.95 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9.4c.3.63.92 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
    <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
  </Svg>
);
export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.7 12 21c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z" />
  </Svg>
);
export const IconGrid = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.6" />
    <rect x="13" y="4" width="7" height="7" rx="1.6" />
    <rect x="4" y="13" width="7" height="7" rx="1.6" />
    <rect x="13" y="13" width="7" height="7" rx="1.6" />
  </Svg>
);
export const IconFilm = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
    <path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" />
  </Svg>
);
export const IconMusic = (p: P) => (
  <Svg {...p}>
    <path d="M9 18V6.5l10-2V16" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </Svg>
);
export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5h3l1.5-2h7l1.5 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.2" />
  </Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17 14.4a5.5 5.5 0 0 1 3.5 5.1" />
  </Svg>
);
export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 5.5A1.5 1.5 0 0 1 6 4h5v16H6a1.5 1.5 0 0 1-1.5-1.5v-13Z" />
    <path d="M19.5 5.5A1.5 1.5 0 0 0 18 4h-5v16h5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
    <path d="M12 4v16" opacity="0" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.2" />
    <path d="M4 10h16M8.5 3.5V7M15.5 3.5V7" />
  </Svg>
);
export const IconMapPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s6.5-5.7 6.5-10.4a6.5 6.5 0 1 0-13 0C5.5 15.3 12 21 12 21Z" />
    <circle cx="12" cy="10.4" r="2.3" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.6-5.6L11 7" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.6 5.6L13 17" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" strokeWidth={2} />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4M12 17h.01" strokeWidth={2} />
  </Svg>
);
export const IconLogOut = (p: P) => (
  <Svg {...p}>
    <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
    <path d="M11 12h9.5M17 8.5l3.5 3.5-3.5 3.5" />
  </Svg>
);
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.8 12S6.3 5.8 12 5.8 21.2 12 21.2 12 17.7 18.2 12 18.2 2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M4 4.5 20 19.5" />
    <path d="M9.6 6.2A9.7 9.7 0 0 1 12 5.8c5.7 0 9.2 6.2 9.2 6.2a17 17 0 0 1-3.1 3.8M6.4 8A16.8 16.8 0 0 0 2.8 12S6.3 18.2 12 18.2c1 0 1.9-.2 2.8-.5" />
    <path d="M10 10.3a2.8 2.8 0 0 0 3.8 3.9" />
  </Svg>
);
export const IconSpinner = ({ className = "", size = 18 }: { className?: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 animate-spin ${className}`} aria-hidden>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.4" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.35-5.65" />
    <path d="M20 4.5V9h-4.5" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Svg>
);
export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12 3 4.5l18 7.5-18 7.5L4.5 12Zm0 0h7" />
  </Svg>
);
export const IconMinimize = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 4.5v5h-5M14.5 19.5v-5h5M4.5 4.5l5 5M19.5 19.5l-5-5" />
  </Svg>
);
export const IconExpand = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 14.5v5h-5M14.5 9.5v-5h5M14.5 9.5l-5-5M9.5 14.5l5 5" />
  </Svg>
);
export const IconFullscreen = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const IconArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5v15M6 13.5l6 6 6-6" />
  </Svg>
);
export const IconSmile = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14a4.5 4.5 0 0 0 7 0M9.3 9.8h.01M14.7 9.8h.01" strokeWidth={2} />
  </Svg>
);
export const IconArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8.5 7H17v8.5" />
  </Svg>
);
export const IconArrowDownLeft = (p: P) => (
  <Svg {...p}>
    <path d="M17 7 7 17M15.5 17H7V8.5" />
  </Svg>
);
export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c.6 4.2 2.3 6.4 6.5 8.5-4.2 2.1-5.9 4.3-6.5 8.5-.6-4.2-2.3-6.4-6.5-8.5 4.2-2.1 5.9-4.3 6.5-8.5Z" />
  </Svg>
);
/** Research: a flask with a spark of discovery. */
export const IconFlask = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 3.5h5M10.5 3.5v5.2L5.4 17.6A2 2 0 0 0 7.1 20.5h9.8a2 2 0 0 0 1.7-2.9l-5.1-8.9V3.5" />
    <path d="M7.6 14.5h8.8" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={2.6} />
  </Svg>
);
export const IconNext = (p: P) => (
  <Svg {...p}>
    <path d="M6 6v12l9-6-9-6Z" fill="currentColor" />
    <path d="M18 6v12" strokeWidth={2.2} />
  </Svg>
);
export const IconSignal = ({ bars = 3, ...p }: P & { bars?: 0 | 1 | 2 | 3 }) => (
  <Svg {...p}>
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M${6 + i * 5} ${18 - i * 4}V19`} strokeWidth={2.4} opacity={i < bars ? 1 : 0.28} />
    ))}
  </Svg>
);

/** The mark: two hearts meeting as one, the same mark as the app icon. */
export function Monogram({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static 192px brand mark, served as-is
    <img
      src="/icon-192.png"
      width={size}
      height={size}
      alt=""
      draggable={false}
      aria-hidden
      className={`shrink-0 rounded-[23%] object-cover ${className}`}
    />
  );
}
