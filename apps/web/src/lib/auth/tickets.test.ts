import { describe, expect, it, vi } from "vitest";
import { signTicket, verifyTicket } from "@/lib/auth/tickets";

vi.mock("server-only", () => ({}));

describe("purpose-bound tickets", () => {
  it("round-trips a payload for its own audience", async () => {
    const token = await signTicket("lovora/test-a", { sub: "person-1", ver: 3 }, 60);
    expect(await verifyTicket("lovora/test-a", token)).toMatchObject({ sub: "person-1", ver: 3, aud: "lovora/test-a" });
  });

  it("rejects the same token for another purpose", async () => {
    const token = await signTicket("lovora/test-a", { sub: "person-1" }, 60);
    expect(await verifyTicket("lovora/test-b", token)).toBeNull();
  });

  it("rejects tampered and missing tokens", async () => {
    const token = await signTicket("lovora/test-a", { sub: "person-1" }, 60);
    expect(await verifyTicket("lovora/test-a", `${token.slice(0, -2)}xx`)).toBeNull();
    expect(await verifyTicket("lovora/test-a", undefined)).toBeNull();
  });
});
