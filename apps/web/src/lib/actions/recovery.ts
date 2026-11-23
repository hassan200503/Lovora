"use server";

import { cookies } from "next/headers";
import { resetPassword } from "@/lib/auth/accounts";
import { requestRecoveryOtp, verifyRecoveryOtp } from "@/lib/auth/otp";
import { holdSession } from "@/lib/auth/continue";
import { RESET_TICKET_AUDIENCE, RESET_TICKET_COOKIE, signTicket, ticketCookie, verifyTicket } from "@/lib/auth/tickets";
import { getDb } from "@/lib/db/client";
import { clientIp } from "./request-meta";
import type { ActionState } from "./util";

const TICKET_SECONDS = 10 * 60;

/**
 * Drives the email recovery flow one step at a time. The verified state lives in
 * a short-lived, version-bound signed cookie, never in the form itself.
 */
export async function recoveryStep(_: ActionState, fd: FormData): Promise<ActionState> {
  const step = String(fd.get("step") ?? "request");
  const db = await getDb();

  if (step === "request") {
    const email = String(fd.get("email") ?? "");
    const fromCode = fd.get("from") === "code";
    const result = await requestRecoveryOtp(db, { email, ip: await clientIp() });
    if (!result.ok) return { error: result.error, step: fromCode ? "code" : "request", email };
    return { ok: true, step: "code", email, message: result.message, cooldownSeconds: result.retryAfter, cooldownKey: Date.now() };
  }

  if (step === "verify") {
    const email = String(fd.get("email") ?? "");
    const code = String(fd.get("code") ?? "");
    const result = await verifyRecoveryOtp(db, { email, code, ip: await clientIp() });
    if (!result.ok) return { error: result.error, step: "code", email };

    const token = await signTicket(RESET_TICKET_AUDIENCE, { sub: result.personId, ver: result.sessionVersion }, TICKET_SECONDS);
    (await cookies()).set(RESET_TICKET_COOKIE, token, ticketCookie(TICKET_SECONDS));
    return { ok: true, step: "password", email, message: "Code confirmed. Choose a new password." };
  }

  if (step === "reset") {
    const ticket = await verifyTicket(RESET_TICKET_AUDIENCE, (await cookies()).get(RESET_TICKET_COOKIE)?.value);
    if (!ticket || typeof ticket.sub !== "string" || typeof ticket.ver !== "number") {
      return { error: "Your reset session expired. Start again.", step: "request" };
    }

    const next = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (next !== confirm) return { error: "The passwords do not match.", step: "password" };

    const result = await resetPassword(db, { personId: ticket.sub, expectedVersion: ticket.ver, newPassword: next });
    if (!result.ok) {
      (await cookies()).delete(RESET_TICKET_COOKIE);
      return { error: result.error, step: "request" };
    }

    (await cookies()).delete(RESET_TICKET_COOKIE);
    // Deferred like signup so this done screen (with the new recovery code)
    // survives the re-render; /recover redirects anyone already signed in.
    await holdSession(ticket.sub, result.slug, result.sessionVersion);
    return {
      ok: true,
      step: "done",
      message: "Password changed. Other devices were signed out.",
      recoveryCode: result.recoveryCode,
    };
  }

  return { error: "Something went wrong. Start again.", step: "request" };
}
