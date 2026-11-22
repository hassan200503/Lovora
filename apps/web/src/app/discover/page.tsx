import { requireCtx } from "@/lib/context";
import { forYouFeed, personTopics, type FeedPage } from "@/lib/trends/query";
import { refreshIfStale } from "@/lib/trends/refresh";
import { BrowserShell } from "@/components/browser/browser-shell";
import type { BrowserPerson } from "@/components/browser/browser-shell";

export const metadata = { title: "Lovora browser" };

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const ctx = await requireCtx();
  const p = await searchParams;
  const as = typeof p.as === "string" ? p.as : undefined;
  const q = typeof p.q === "string" ? p.q.slice(0, 200) : "";
  const tab = typeof p.tab === "string" ? p.tab : "for-you";
  const ai = p.mode === "ai";
  const viewing = ctx.members.find((m) => m.slug === as) ?? ctx.me;
  const topics = await personTopics(viewing.id);
  let initial: FeedPage | null = null;
  if (!q && tab === "for-you") {
    initial = await forYouFeed(ctx.members, { personId: viewing.id, cursor: null }).catch(() => null);
    await refreshIfStale().catch(() => {});
  }
  const people: BrowserPerson[] = ctx.members.map((m) => ({
    id: m.id,
    slug: m.slug,
    displayName: m.displayName,
    theme: m.theme,
    avatarUrl: m.avatarUrl,
  }));
  return (
    <BrowserShell
      meId={ctx.me.id}
      viewing={{ id: viewing.id, slug: viewing.slug, displayName: viewing.displayName, theme: viewing.theme, avatarUrl: viewing.avatarUrl }}
      people={people}
      topics={topics}
      initialQuery={q}
      initialAi={ai}
      initialTab={tab}
      initialFeed={initial}
    />
  );
}
