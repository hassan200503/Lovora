import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

/**
 * E2-003 — the cross-couple regression matrix.
 *
 * Every couple-owned table answers the same four questions, and the list of
 * tables is not written here: it is read from the database itself. Add a table
 * with a `couple_id` column and the coverage test below fails until it is
 * registered, so the matrix can never quietly fall behind the schema.
 *
 * The four questions, per table, with two couples in the database:
 *   select — one couple never sees the other's row, even knowing its key.
 *   insert — a row carries exactly the couple that wrote it, and no other.
 *   update — a tenant-scoped write cannot reach across couples.
 *   delete — a tenant-scoped delete cannot remove across couples.
 *
 * Child tables carry a composite foreign key, so a row that names the other
 * couple's parent is refused outright. That is asserted separately, below.
 */

type Side = "A" | "B";
type Keys = Record<string, string | number>;
type Party = { id: string; me: string; them: string };
type World = { A: Party; B: Party };

type TableSpec = {
  /** The columns that identify one row (the primary key, in schema order). */
  key: string[];
  /** A column the app edits, with a value that satisfies every constraint on it. */
  touch: { column: string; value: string | number };
  /** Writes one row for this side and returns its key values. */
  insert: (w: World, side: Side) => Promise<Keys>;
};

const client = new PGlite();
const db = drizzle(client, { schema });

const uid = () => randomUUID();

async function couple(name: string): Promise<string> {
  const [row] = await db.insert(schema.couples).values({ name }).returning();
  return row.id;
}

async function person(label: string): Promise<string> {
  const [row] = await db.insert(schema.people).values({ slug: `${label}-${uid()}`, displayName: label, theme: "us", passwordHash: "not-used-in-tenancy-tests" }).returning();
  return row.id;
}

async function world(): Promise<World> {
  const a = await couple("Ours");
  const b = await couple("Theirs");
  return {
    A: { id: a, me: await person("alex"), them: await person("sam") },
    B: { id: b, me: await person("kim"), them: await person("robin") },
  };
}

// ── The anchors children hang off, made per side ─────────────────────────────

async function mediaFor(w: World, side: Side): Promise<string> {
  const [row] = await db
    .insert(schema.media)
    .values({ coupleId: w[side].id, addedBy: w[side].me, kind: "photo", source: "upload", path: `rel/${w[side].id}/photo/${uid()}.webp` })
    .returning();
  return row.id;
}

async function ritualFor(w: World, side: Side): Promise<string> {
  const [row] = await db.insert(schema.rituals).values({ coupleId: w[side].id, createdBy: w[side].me, title: "Good morning text" }).returning();
  return row.id;
}

async function callFor(w: World, side: Side): Promise<string> {
  const [row] = await db.insert(schema.calls).values({ coupleId: w[side].id, callerId: w[side].me, calleeId: w[side].them, kind: "audio" }).returning();
  return row.id;
}

async function threadFor(w: World, side: Side): Promise<string> {
  const [row] = await db.insert(schema.researchThreads).values({ coupleId: w[side].id, ownerId: w[side].me, title: "How do birds navigate?" }).returning();
  return row.id;
}

/**
 * The matrix. Every entry is a table whose rows belong to one couple, plus the
 * smallest write the schema accepts. `key` doubles as the proof that a row is
 * addressable: the tests look rows up by key while pinning the tenant, and
 * expect to find nothing when the tenant is the other couple.
 */
const registry: Record<string, TableSpec> = {
  couple_members: {
    key: ["couple_id", "person_id"],
    touch: { column: "status", value: "left" },
    insert: async (w, side) => {
      await db.insert(schema.coupleMembers).values({ coupleId: w[side].id, personId: w[side].me, slug: `m-${uid()}`, slot: 1 });
      return { couple_id: w[side].id, person_id: w[side].me };
    },
  },
  invitations: {
    key: ["id"],
    touch: { column: "token_hash", value: "rotated" },
    insert: async (w, side) => {
      const [row] = await db
        .insert(schema.invitations)
        .values({ coupleId: w[side].id, tokenHash: uid(), createdBy: w[side].me, expiresAt: new Date(Date.now() + 86_400_000) })
        .returning();
      return { id: row.id };
    },
  },
  entitlements: {
    key: ["couple_id"],
    touch: { column: "plan", value: "premium" },
    insert: async (w, side) => {
      await db.insert(schema.entitlements).values({ coupleId: w[side].id });
      return { couple_id: w[side].id };
    },
  },
  usage_ledger: {
    key: ["id"],
    touch: { column: "quantity", value: 5 },
    insert: async (w, side) => {
      const [row] = await db.insert(schema.usageLedger).values({ coupleId: w[side].id, metric: "ai_question", period: "2026-01" }).returning();
      return { id: row.id };
    },
  },
  memories: {
    key: ["id"],
    touch: { column: "title", value: "Rewritten" },
    insert: async (w, side) => {
      const [row] = await db.insert(schema.memories).values({ coupleId: w[side].id, addedBy: w[side].me, title: "The first night", occurredOn: "2026-01-01" }).returning();
      return { id: row.id };
    },
  },
  shared_learning: {
    key: ["id"],
    touch: { column: "title", value: "Rewritten" },
    insert: async (w, side) => {
      const [row] = await db
        .insert(schema.sharedLearning)
        .values({ coupleId: w[side].id, addedBy: w[side].me, title: "Why the sky is blue", occurredOn: "2026-01-01" })
        .returning();
      return { id: row.id };
    },
  },
  photos: {
    key: ["id"],
    touch: { column: "caption", value: "Rewritten" },
    insert: async (w, side) => {
      const [row] = await db.insert(schema.photos).values({ coupleId: w[side].id, uploadedBy: w[side].me, mime: "image/webp", bytes: "AAAA" }).returning();
      return { id: row.id };
    },
  },
  media: {
    key: ["id"],
    touch: { column: "caption", value: "Rewritten" },
    insert: async (w, side) => ({ id: await mediaFor(w, side) }),
  },
  media_reactions: {
    key: ["media_id", "person_id"],
    touch: { column: "emoji", value: "👍" },
    insert: async (w, side) => {
      const mediaId = await mediaFor(w, side);
      await db.insert(schema.mediaReactions).values({ mediaId, coupleId: w[side].id, personId: w[side].me, emoji: "❤️" });
      return { media_id: mediaId, person_id: w[side].me };
    },
  },
  media_comments: {
    key: ["id"],
    touch: { column: "body", value: "Rewritten" },
    insert: async (w, side) => {
      const mediaId = await mediaFor(w, side);
      const [row] = await db.insert(schema.mediaComments).values({ mediaId, coupleId: w[side].id, personId: w[side].me, body: "Look at this" }).returning();
      return { id: row.id };
    },
  },
  room_state: {
    key: ["couple_id"],
    touch: { column: "title", value: "Rewritten" },
    insert: async (w, side) => {
      await db.insert(schema.roomState).values({ coupleId: w[side].id });
      return { couple_id: w[side].id };
    },
  },
  room_events: {
    key: ["id"],
    touch: { column: "body", value: "Rewritten" },
    insert: async (w, side) => {
      const [row] = await db.insert(schema.roomEvents).values({ coupleId: w[side].id, personId: w[side].me, kind: "chat", body: "hello" }).returning();
      return { id: row.id };
    },
  },
  daily_answers: {
    key: ["couple_id", "day", "person_id"],
    touch: { column: "answer", value: "Rewritten" },
    insert: async (w, side) => {
      await db.insert(schema.dailyAnswers).values({ coupleId: w[side].id, day: "2026-01-01", personId: w[side].me, answer: "yes" });
      return { couple_id: w[side].id, day: "2026-01-01", person_id: w[side].me };
    },
  },
  rituals: {
    key: ["id"],
    touch: { column: "title", value: "Rewritten" },
    insert: async (w, side) => ({ id: await ritualFor(w, side) }),
  },
  ritual_checks: {
    key: ["ritual_id", "day", "person_id"],
    touch: { column: "note", value: "Rewritten" },
    insert: async (w, side) => {
      const ritualId = await ritualFor(w, side);
      await db.insert(schema.ritualChecks).values({ ritualId, coupleId: w[side].id, day: "2026-01-01", personId: w[side].me, note: "kept it" });
      return { ritual_id: ritualId, day: "2026-01-01", person_id: w[side].me };
    },
  },
  messages: {
    key: ["id"],
    touch: { column: "body", value: "Rewritten" },
    insert: async (w, side) => {
      const [row] = await db.insert(schema.messages).values({ coupleId: w[side].id, senderId: w[side].me, body: "hi" }).returning();
      return { id: row.id };
    },
  },
  chat_state: {
    key: ["person_id"],
    touch: { column: "last_read_id", value: 99 },
    insert: async (w, side) => {
      await db.insert(schema.chatState).values({ personId: w[side].me, coupleId: w[side].id });
      return { person_id: w[side].me };
    },
  },
  calls: {
    key: ["id"],
    touch: { column: "status", value: "ended" },
    insert: async (w, side) => ({ id: await callFor(w, side) }),
  },
  call_signals: {
    key: ["id"],
    touch: { column: "payload", value: "Rewritten" },
    insert: async (w, side) => {
      const callId = await callFor(w, side);
      const [row] = await db.insert(schema.callSignals).values({ callId, coupleId: w[side].id, fromId: w[side].me, kind: "offer", payload: "v=0" }).returning();
      return { id: row.id };
    },
  },
  research_threads: {
    key: ["id"],
    touch: { column: "title", value: "Rewritten" },
    insert: async (w, side) => ({ id: await threadFor(w, side) }),
  },
  research_messages: {
    key: ["id"],
    touch: { column: "content", value: "Rewritten" },
    insert: async (w, side) => {
      const threadId = await threadFor(w, side);
      const [row] = await db.insert(schema.researchMessages).values({ threadId, coupleId: w[side].id, role: "user", content: "why?" }).returning();
      return { id: row.id };
    },
  },
  short_reactions: {
    key: ["person_id", "video_key", "kind"],
    touch: { column: "created_at", value: "2026-01-01T00:00:00Z" },
    insert: async (w, side) => {
      const videoKey = `yt:${uid()}`;
      await db.insert(schema.shortReactions).values({ coupleId: w[side].id, personId: w[side].me, videoKey, kind: "like" });
      return { person_id: w[side].me, video_key: videoKey, kind: "like" };
    },
  },
  short_comments: {
    key: ["id"],
    touch: { column: "body", value: "Rewritten" },
    insert: async (w, side) => {
      const [row] = await db
        .insert(schema.shortComments)
        .values({ coupleId: w[side].id, personId: w[side].me, videoKey: `tt:${uid()}`, body: "This one" })
        .returning();
      return { id: row.id };
    },
  },
  short_links: {
    key: ["id"],
    touch: { column: "url", value: "https://www.tiktok.com/@lovora/video/1" },
    insert: async (w, side) => {
      const videoKey = `tt:${uid()}`;
      const [row] = await db
        .insert(schema.shortLinks)
        .values({
          coupleId: w[side].id,
          addedBy: w[side].me,
          videoKey,
          url: "https://www.tiktok.com/@lovora/video/1",
          meta: { title: "A short", author: "Lovora", thumb: null, url: "https://www.tiktok.com/@lovora/video/1" },
        })
        .returning();
      return { id: row.id };
    },
  },
};

// ── Generic SQL helpers ──────────────────────────────────────────────────────

function predicate(key: string[], offset: number): string {
  return key.map((column, i) => `"${column}" = $${offset + i}`).join(" AND ");
}

function vals(key: string[], keys: Keys): (string | number)[] {
  return key.map((column) => keys[column]);
}

/** Counts rows matching a predicate, with the parameters in order. */
async function count(table: string, where: string, params: unknown[]): Promise<number> {
  const { rows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`, params);
  return rows[0].n;
}

/** Runs an UPDATE or DELETE and returns how many rows it touched. */
async function touch(statement: string, params: unknown[]): Promise<number> {
  const { rows } = await client.query(statement, params);
  return rows.length;
}

/** Reads one column of one row as text, for before/after comparisons. */
async function cell(table: string, column: string, key: string[], keys: Keys): Promise<string | null> {
  const { rows } = await client.query<{ v: string | null }>(`SELECT "${column}"::text AS v FROM "${table}" WHERE ${predicate(key, 1)}`, vals(key, keys));
  return rows[0]?.v ?? null;
}

async function tenantOf(table: string, key: string[], keys: Keys): Promise<string | null> {
  return cell(table, "couple_id", key, keys);
}

async function reset(): Promise<void> {
  // Everything couple-owned cascades from these two.
  await client.exec('TRUNCATE TABLE "couples", "people" RESTART IDENTITY CASCADE');
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}, 120_000);

beforeEach(async () => {
  await reset();
}, 30_000);

afterAll(async () => {
  await client.close();
});

// ── The matrix itself ────────────────────────────────────────────────────────

for (const [table, spec] of Object.entries(registry)) {
  describe(`${table} belongs to one couple`, () => {
    let w: World;
    let ours: Keys;
    let theirs: Keys;

    beforeEach(async () => {
      w = await world();
      ours = await spec.insert(w, "A");
      theirs = await spec.insert(w, "B");
    });

    it("select — the other couple's row is unreachable, even by key", async () => {
      expect(await count(table, '"couple_id" = $1', [w.A.id])).toBe(1);
      expect(await count(table, '"couple_id" = $1', [w.B.id])).toBe(1);
      expect(await count(table, `"couple_id" = $1 AND ${predicate(spec.key, 2)}`, [w.A.id, ...vals(spec.key, theirs)])).toBe(0);
      expect(await count(table, `"couple_id" = $1 AND ${predicate(spec.key, 2)}`, [w.B.id, ...vals(spec.key, ours)])).toBe(0);
    });

    it("insert — a row carries exactly the couple that wrote it", async () => {
      expect(await tenantOf(table, spec.key, ours)).toBe(w.A.id);
      expect(await tenantOf(table, spec.key, theirs)).toBe(w.B.id);
      expect(await count(table, `"couple_id" = $1 AND ${predicate(spec.key, 2)}`, [w.A.id, ...vals(spec.key, ours)])).toBe(1);
    });

    it("update — a tenant-scoped write cannot reach across couples", async () => {
      const before = await cell(table, spec.touch.column, spec.key, theirs);

      const crossed = await touch(
        `UPDATE "${table}" SET "${spec.touch.column}" = $1 WHERE "couple_id" = $2 AND ${predicate(spec.key, 3)} RETURNING 1`,
        [spec.touch.value, w.A.id, ...vals(spec.key, theirs)],
      );
      expect(crossed, "an update pinned to the wrong couple must match nothing").toBe(0);
      expect(await cell(table, spec.touch.column, spec.key, theirs)).toBe(before);

      const own = await touch(`UPDATE "${table}" SET "${spec.touch.column}" = $1 WHERE "couple_id" = $2 AND ${predicate(spec.key, 3)} RETURNING 1`, [
        spec.touch.value,
        w.A.id,
        ...vals(spec.key, ours),
      ]);
      expect(own, "the same update pinned to the right couple must land").toBe(1);
    });

    it("delete — a tenant-scoped delete cannot remove across couples", async () => {
      const crossed = await touch(`DELETE FROM "${table}" WHERE "couple_id" = $1 AND ${predicate(spec.key, 2)} RETURNING 1`, [w.A.id, ...vals(spec.key, theirs)]);
      expect(crossed, "a delete pinned to the wrong couple must match nothing").toBe(0);
      expect(await count(table, predicate(spec.key, 1), vals(spec.key, theirs))).toBe(1);

      const own = await touch(`DELETE FROM "${table}" WHERE "couple_id" = $1 AND ${predicate(spec.key, 2)} RETURNING 1`, [w.A.id, ...vals(spec.key, ours)]);
      expect(own).toBe(1);
      expect(await count(table, predicate(spec.key, 1), vals(spec.key, ours))).toBe(0);
    });
  });
}

// ── Composite keys: a child cannot point at another couple's parent ──────────

const crossParent: Record<string, (w: World) => Promise<unknown>> = {
  media_reactions: async (w) => db.insert(schema.mediaReactions).values({ mediaId: await mediaFor(w, "B"), coupleId: w.A.id, personId: w.A.me, emoji: "👍" }),
  media_comments: async (w) => db.insert(schema.mediaComments).values({ mediaId: await mediaFor(w, "B"), coupleId: w.A.id, personId: w.A.me, body: "wrong parent" }),
  ritual_checks: async (w) => db.insert(schema.ritualChecks).values({ ritualId: await ritualFor(w, "B"), coupleId: w.A.id, day: "2026-01-02", personId: w.A.me }),
  call_signals: async (w) => db.insert(schema.callSignals).values({ callId: await callFor(w, "B"), coupleId: w.A.id, fromId: w.A.me, kind: "offer", payload: "v=0" }),
  research_messages: async (w) => db.insert(schema.researchMessages).values({ threadId: await threadFor(w, "B"), coupleId: w.A.id, role: "user", content: "wrong parent" }),
};

describe("children name their own couple's parent", () => {
  beforeEach(async () => {
    await reset();
  }, 30_000);

  /**
   * Drizzle wraps a driver error, so the Postgres message lives on `cause`.
   * Returns both texts, or throws if the write was actually accepted.
   */
  async function refusal(fn: () => Promise<unknown>): Promise<string> {
    try {
      await fn();
    } catch (e) {
      const err = e as { message?: string; cause?: { message?: string } };
      return [err.message, err.cause?.message].filter(Boolean).join(" | ");
    }
    throw new Error("expected the write to be refused, but it was accepted");
  }

  for (const [table, attempt] of Object.entries(crossParent)) {
    it(`${table} refuses a parent from the other couple`, async () => {
      const w = await world();
      expect(await refusal(() => attempt(w))).toMatch(/foreign key constraint/i);
    });
  }

  it("and accepts the same row when the parent is its own", async () => {
    const w = await world();
    const mediaId = await mediaFor(w, "A");
    await db.insert(schema.mediaReactions).values({ mediaId, coupleId: w.A.id, personId: w.A.me, emoji: "👍" });
    expect(await count("media_reactions", '"couple_id" = $1', [w.A.id])).toBe(1);
  });
});

// ── Coverage: the matrix cannot fall behind the schema ───────────────────────

describe("coverage", () => {
  it("covers every table that carries the tenant column", async () => {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'couple_id' ORDER BY table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(Object.keys(registry).sort());
  });

  it("never lets the tenant be null, and keeps no legacy column", async () => {
    const nullable = await client.query(
      `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'couple_id' AND is_nullable = 'YES'`,
    );
    expect(nullable.rows).toEqual([]);

    const legacy = await client.query(`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'relationship_id'`);
    expect(legacy.rows).toEqual([]);
  });

  it("gives every couple-owned table a real foreign key to its couple", async () => {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT DISTINCT kcu.table_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'couple_id' AND ccu.table_name = 'couples'
        ORDER BY kcu.table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(Object.keys(registry).sort());
  });
});
