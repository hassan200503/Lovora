import "server-only";
import { cookies } from "next/headers";
import { CONTINUE_AUDIENCE, CONTINUE_COOKIE, signTicket, ticketCookie } from "./tickets";

const MAX_AGE = 10 * 60;

/**
 * Defers sign-in until the visitor follows /api/auth/continue. Creating the
 * session inside the action that shows a one-time code would re-render the
 * page as signed-in and redirect away from the code before it can be saved.
 */
export async function holdSession(personId: string, slug: string, version: number): Promise<void> {
  const token = await signTicket(CONTINUE_AUDIENCE, { sub: personId, slug, ver: version }, MAX_AGE);
  (await cookies()).set(CONTINUE_COOKIE, token, ticketCookie(MAX_AGE));
}
