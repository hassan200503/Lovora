import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cleanQuery, queryAsUrl, searchEngines, searchableQuery, topicSuggestions } from "@/lib/browser/search";

describe("cleanQuery", () => {
  it("collapses whitespace and strips control and zero-width characters", () => {
    expect(cleanQuery("  hello\u0000 \u200b  world\n")).toBe("hello world");
  });

  it("caps the query at 200 characters", () => {
    expect(cleanQuery("a".repeat(500))).toHaveLength(200);
  });

  it("treats non-strings as empty", () => {
    expect(cleanQuery(undefined)).toBe("");
    expect(cleanQuery(null)).toBe("");
  });
});

describe("searchableQuery", () => {
  it("needs at least two characters", () => {
    expect(searchableQuery(" a ")).toBeNull();
    expect(searchableQuery(" ai ")).toBe("ai");
  });
});

describe("queryAsUrl", () => {
  it("turns bare domains into https addresses", () => {
    expect(queryAsUrl("example.com")).toBe("https://example.com/");
    expect(queryAsUrl("bbc.co.uk/news")).toBe("https://bbc.co.uk/news");
  });

  it("keeps explicit http(s) addresses", () => {
    expect(queryAsUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
    expect(queryAsUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects searches, credentials and non-web schemes", () => {
    expect(queryAsUrl("how to cook")).toBeNull();
    expect(queryAsUrl("user:pass@example.com")).toBeNull();
    expect(queryAsUrl("ftp://example.com")).toBeNull();
    expect(queryAsUrl("https://localhost")).toBeNull();
  });

  it("only guesses addresses for known endings, www. or paths", () => {
    expect(queryAsUrl("lovora.app")).toBe("https://lovora.app/");
    expect(queryAsUrl("not-a-domain.qqq")).toBeNull();
    expect(queryAsUrl("www.anything.qqq")).toBe("https://www.anything.qqq/");
  });
});

describe("topicSuggestions", () => {
  it("matches labels and categories", () => {
    expect(topicSuggestions("foot").map((t) => t.key)).toContain("football");
    expect(topicSuggestions("world").map((t) => t.key)).toContain("news");
  });

  it("returns nothing for an empty query", () => {
    expect(topicSuggestions("")).toEqual([]);
  });
});

describe("searchEngines", () => {
  it("encodes the query for each engine", () => {
    const links = searchEngines("a b&c");
    expect(links).toHaveLength(4);
    expect(links[0]?.href).toBe("https://www.google.com/search?q=a%20b%26c");
    expect(new Set(links.map((l) => l.label)).size).toBe(4);
  });
});
