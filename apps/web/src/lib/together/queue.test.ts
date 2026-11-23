import { describe, expect, it } from "vitest";
import { appendEntry, currentEntryKey, entryKey, hasEntry, isCurrentEntry, legacyQueueData, mediaEntry, mediaIdsOf, parseQueueData, removeEntry, takeFirst, youtubeEntry } from "./queue";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("room queue", () => {
  it("keeps insertion order across both kinds", () => {
    const queue = appendEntry(appendEntry(appendEntry([], mediaEntry(A)), youtubeEntry("dQw4w9WgXcQ", "A video")), mediaEntry(B));
    expect(queue.map(entryKey)).toEqual([`m:${A}`, "y:dQw4w9WgXcQ", `m:${B}`]);
    expect(mediaIdsOf(queue)).toEqual([A, B]);
  });

  it("dedupes by stable key, case-insensitively for uuids", () => {
    const queue = appendEntry(appendEntry([], mediaEntry(A)), mediaEntry(A.toUpperCase()));
    expect(queue).toHaveLength(1);
    expect(hasEntry(queue, `m:${A}`)).toBe(true);
  });

  it("removes only the named item", () => {
    const queue = [mediaEntry(A), youtubeEntry("dQw4w9WgXcQ"), mediaEntry(B)];
    expect(removeEntry(queue, "y:dQw4w9WgXcQ").map(entryKey)).toEqual([`m:${A}`, `m:${B}`]);
    expect(removeEntry(queue, "y:missingnone").map(entryKey)).toEqual(queue.map(entryKey));
  });

  it("takes the first item and returns the rest", () => {
    const taken = takeFirst([youtubeEntry("dQw4w9WgXcQ", "Music"), mediaEntry(B)]);
    expect(taken?.first).toEqual(youtubeEntry("dQw4w9WgXcQ", "Music"));
    expect(taken?.rest).toEqual([mediaEntry(B)]);
    expect(takeFirst([])).toBeNull();
  });

  it("drops malformed jsonb rather than throwing", () => {
    const parsed = parseQueueData([
      null,
      "nope",
      { kind: "media", id: "not-a-uuid" },
      { kind: "media", id: A.toUpperCase() },
      { kind: "youtube", videoId: "short" },
      { kind: "youtube", videoId: "dQw4w9WgXcQ", title: "  Hello   there  " },
      { kind: "youtube", videoId: "dQw4w9WgXcQ", title: "duplicate" },
      { kind: "other", id: B },
    ]);
    expect(parsed).toEqual([mediaEntry(A), youtubeEntry("dQw4w9WgXcQ", "Hello there")]);
  });

  it("caps the queue", () => {
    const many = Array.from({ length: 100 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(parseQueueData(many.map((id) => ({ kind: "media", id })))).toHaveLength(60);
    expect(appendEntry([mediaEntry(A)], mediaEntry(B), 1)).toEqual([mediaEntry(A)]);
  });

  it("reads the legacy uuid[] column as media entries", () => {
    expect(legacyQueueData([A, "junk", B])).toEqual([mediaEntry(A), mediaEntry(B)]);
  });

  it("recognises an ended report by prefixed or bare id", () => {
    expect(currentEntryKey(A, null)).toBe(`m:${A}`);
    expect(currentEntryKey(null, "dQw4w9WgXcQ")).toBe("y:dQw4w9WgXcQ");
    expect(currentEntryKey(null, null)).toBe("");
    // The player only knows the bare id; a stale report from the previous track must not advance.
    expect(isCurrentEntry(A, A, null)).toBe(true);
    expect(isCurrentEntry(`m:${A}`, A, null)).toBe(true);
    expect(isCurrentEntry("dQw4w9WgXcQ", null, "dQw4w9WgXcQ")).toBe(true);
    expect(isCurrentEntry(B, A, null)).toBe(false);
    expect(isCurrentEntry(A, null, "dQw4w9WgXcQ")).toBe(false);
    expect(isCurrentEntry("", null, null)).toBe(true);
  });
});
