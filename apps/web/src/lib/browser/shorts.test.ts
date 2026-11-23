import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { decodeCursor, isShortKey, resolveTikTokLink } from "@/lib/browser/shorts";

const cursor = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decodeCursor", () => {
  it("starts at the beginning for missing or broken cursors", () => {
    expect(decodeCursor(null)).toEqual({ o: 0, c: 0 });
    expect(decodeCursor("not-base64!")).toEqual({ o: 0, c: 0 });
  });

  it("round-trips an encoded cursor", () => {
    expect(decodeCursor(cursor({ o: 12, c: 3 }))).toEqual({ o: 12, c: 3 });
  });

  it("clamps out-of-range values", () => {
    expect(decodeCursor(cursor({ o: -5, c: -1 }))).toEqual({ o: 0, c: 0 });
    expect(decodeCursor(cursor({ o: 10_000_000, c: 10_000 }))).toEqual({ o: 60_000, c: 1_000 });
    expect(decodeCursor(cursor({ o: "8.9", c: "2.2" }))).toEqual({ o: 8, c: 2 });
  });
});

describe("isShortKey", () => {
  it("accepts TikTok and YouTube keys", () => {
    expect(isShortKey("tt:123456789012345")).toBe(true);
    expect(isShortKey("yt:dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects other keys", () => {
    expect(isShortKey("tt:123")).toBe(false);
    expect(isShortKey("yt:too-long-video-id")).toBe(false);
    expect(isShortKey("https://www.tiktok.com/@a/video/123456789012345")).toBe(false);
    expect(isShortKey(null)).toBe(false);
  });
});

describe("resolveTikTokLink", () => {
  it("rejects non-TikTok and unsafe links without fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await resolveTikTokLink("just some text")).toBeNull();
    expect(await resolveTikTokLink("https://example.com/@a/video/123456789012345")).toBeNull();
    expect(await resolveTikTokLink("https://user:pass@www.tiktok.com/@a/video/123456789012345")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to the canonical link when the public page can't be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const item = await resolveTikTokLink("https://www.tiktok.com/@creator/video/123456789012345");
    expect(item).toMatchObject({
      key: "tt:123456789012345",
      platform: "tiktok",
      videoId: "123456789012345",
      author: "@creator",
      authorUrl: "https://www.tiktok.com/@creator",
      url: "https://www.tiktok.com/@creator/video/123456789012345",
      thumb: null,
    });
  });
});
