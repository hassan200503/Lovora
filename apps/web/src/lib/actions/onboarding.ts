"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { THEME_KEYS } from "@lovora/domain";
import { createSession } from "@/lib/auth/session";
import { consumeInvitation, findInvitation } from "@/lib/auth/invite";
import {
  consumeAttempt,
  createGoogleAccount,
  displayNameProblem,
  emailProblem,
  hashPassword,
  hashRecoveryCode,
  insertCoupleMember,
  newRecoveryCode,
  normalizeEmail,
  passwordProblem,
  registerCouple,
  resolveGoogleAccount,
} from "@/lib/auth/accounts";
import { holdSession } from "@/lib/auth/continue";
import {
  GOOGLE_SIGNUP_AUDIENCE,
  GOOGLE_SIGNUP_COOKIE,
  verifyTicket,
} from "@/lib/auth/tickets";
import { getDb } from "@/lib/db/client";
import { coupleMembers, couples } from "@/lib/db/schema";
import { getCtx } from "@/lib/context";
import { isTopicKey, type TopicKey } from "@/lib/trends/topics";
import { ActionState, formObject, isoDate, reqText } from "./util";
import { z } from "zod";

function chosenTopics(fd: FormData): TopicKey[] {
  return [...new Set(fd.getAll("topic").map(String).filter(isTopicKey))];
}

function clientIp(requestHeaders: Headers): string {
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip")?.trim() || "local";
}

const personInput = z.object({
  email: reqText(200),
  displayName: reqText(80),
  theme: z.enum(THEME_KEYS),
});

function personProblem(fd: FormData, data: z.infer<typeof personInput>, password: string, confirm: string): string | null {
  if (password !== confirm) return "The passwords do not match.";
  return (
    emailProblem(data.email) ??
    passwordProblem(password) ??
    displayNameProblem(data.displayName) ??
    (chosenTopics(fd).length ? null : "Pick at least one interest.")
  );
}

/** Self-serve signup: every visitor can create their own couple and first account. */
export async function startWorld(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await getCtx()) return { error: "You are already signed in." };
  const parsedPerson = personInput.safeParse(formObject(fd));
  const parsedWorld = z
    .object({ relationshipName: reqText(60), startedOn: isoDate.optional() })
    .safeParse(formObject(fd));
  if (!parsedPerson.success) return { error: parsedPerson.error.issues[0]?.message ?? "Check your details" };
  if (!parsedWorld.success) return { error: parsedWorld.error.issues[0]?.message ?? "Check your world details" };
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const problem = personProblem(fd, parsedPerson.data, password, confirm);
  if (problem) return { error: problem };

  const db = await getDb();
  const ip = clientIp(await headers());
  if (!(await consumeAttempt(db, "ip", `signup:${ip}`, 10, 60 * 60_000))) {
    return { error: "Too many sign-ups from this connection. Try again later." };
  }

  const registered = await registerCouple(db, {
    email: parsedPerson.data.email,
    password,
    displayName: parsedPerson.data.displayName,
    theme: parsedPerson.data.theme,
    worldName: parsedWorld.data.relationshipName,
    startedOn: parsedWorld.data.startedOn ?? null,
    topics: chosenTopics(fd),
  });
  if (!registered.ok) return { error: registered.error };

  await holdSession(registered.personId, registered.slug, registered.sessionVersion);
  return { ok: true, recoveryCode: registered.recoveryCode };
}

/** Finishes the Google first-run flow with the details Google cannot supply. */
export async function completeGoogleSignup(_: ActionState, fd: FormData): Promise<ActionState> {
  const jar = await cookies();
  const ticket = await verifyTicket(GOOGLE_SIGNUP_AUDIENCE, jar.get(GOOGLE_SIGNUP_COOKIE)?.value);
  const sub = typeof ticket?.sub === "string" ? ticket.sub : "";
  const email = typeof ticket?.email === "string" ? ticket.email : "";
  const suggestedName = typeof ticket?.name === "string" ? ticket.name : "";
  if (!sub || !email) return { error: "Your Google sign-in expired. Start again." };
  if (await getCtx()) {
    jar.delete(GOOGLE_SIGNUP_COOKIE);
    redirect("/");
  }

  const parsedPerson = z.object({ displayName: reqText(80), theme: z.enum(THEME_KEYS) }).safeParse(formObject(fd));
  const parsedWorld = z
    .object({ relationshipName: reqText(60), startedOn: isoDate.optional() })
    .safeParse(formObject(fd));
  if (!parsedPerson.success) return { error: parsedPerson.error.issues[0]?.message ?? "Check your details" };
  if (!parsedWorld.success) return { error: parsedWorld.error.issues[0]?.message ?? "Check your world details" };
  const topics = chosenTopics(fd);
  if (!topics.length) return { error: "Pick at least one interest." };

  const db = await getDb();
  const ip = clientIp(await headers());
  if (!(await consumeAttempt(db, "ip", `signup:${ip}`, 10, 60 * 60_000))) {
    return { error: "Too many sign-ups from this connection. Try again later." };
  }

  const profile = { providerAccountId: sub, email, emailVerified: true, displayName: suggestedName };
  const created = await createGoogleAccount(db, {
    profile,
    displayName: parsedPerson.data.displayName,
    theme: parsedPerson.data.theme,
    worldName: parsedWorld.data.relationshipName,
    startedOn: parsedWorld.data.startedOn ?? null,
    topics,
  });

  if (!created.ok) {
    // A parallel submission may have created the account while this form was open.
    const existing = await resolveGoogleAccount(db, profile);
    if (existing.ok && existing.kind === "existing") {
      jar.delete(GOOGLE_SIGNUP_COOKIE);
      await createSession({ personId: existing.personId, slug: existing.slug, version: existing.sessionVersion });
      revalidatePath("/", "layout");
      redirect("/");
    }
    return { error: created.error };
  }

  jar.delete(GOOGLE_SIGNUP_COOKIE);
  await createSession({ personId: created.personId, slug: created.slug, version: created.sessionVersion });
  revalidatePath("/", "layout");
  redirect("/");
}

/** Joins an existing couple through a single-use, hashed invitation. */
export async function joinWorld(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await getCtx()) return { error: "You are already signed in." };
  const token = String(fd.get("token") ?? "");
  const parsedPerson = personInput.safeParse(formObject(fd));
  if (!parsedPerson.success) return { error: parsedPerson.error.issues[0]?.message ?? "Check your details" };
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const problem = personProblem(fd, parsedPerson.data, password, confirm);
  if (problem) return { error: problem };

  const db = await getDb();
  const ip = clientIp(await headers());
  if (!(await consumeAttempt(db, "ip", `join:${ip}`, 20, 15 * 60_000))) return { error: "Too many attempts. Try again in a few minutes." };

  const invite = await findInvitation(db, token);
  if (!invite) return { error: "This invitation is invalid, used or expired. Ask your partner for a new link." };

  const recoveryCode = newRecoveryCode();
  const email = normalizeEmail(parsedPerson.data.email);
  const passwordHash = await hashPassword(password);
  const topics = chosenTopics(fd);

  let joined: { id: string; slug: string; sessionVersion: number };
  try {
    joined = await db.transaction(async (tx) => {
      // One lock per couple serialises two partners racing for the second slot.
      await tx.select({ id: couples.id }).from(couples).where(eq(couples.id, invite.coupleId)).for("update");
      const active = await tx
        .select({ personId: coupleMembers.personId, slot: coupleMembers.slot })
        .from(coupleMembers)
        .where(and(eq(coupleMembers.coupleId, invite.coupleId), eq(coupleMembers.status, "active")));
      if (active.length >= 2) throw new Error("full");
      const slot = active.some((member) => member.slot === 1) ? 2 : 1;

      const created = await insertCoupleMember(tx, invite.coupleId, slot, {
        displayName: parsedPerson.data.displayName.trim(),
        email,
        passwordHash,
        recoveryHash: hashRecoveryCode(recoveryCode),
        theme: parsedPerson.data.theme,
        topics,
      });
      if (!(await consumeInvitation(tx, invite.id, created.id))) throw new Error("used");
      return created;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "full" || message === "used") return { error: "This invitation has already been used." };
    const code = (error as { code?: string }).code ?? (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") return { error: "An account with this email already exists, or the invitation was just used." };
    throw error;
  }

  await holdSession(joined.id, joined.slug, joined.sessionVersion);
  return { ok: true, recoveryCode };
}
