import { auth } from "@/lib/auth";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";

export type SessionContext = {
  email: string;
  netId: string;
};

/**
 * Resolve the NextAuth session for an API route.
 * Returns null if unauthenticated or non-NYU email.
 * Returns a synthetic context in test environments.
 */
export async function requireSession(): Promise<SessionContext | null> {
  if (shouldBypassAuth()) {
    return { email: "test@nyu.edu", netId: "test" };
  }
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email || !email.endsWith("@nyu.edu")) {
    return null;
  }
  const sessionNetId = (session.user as unknown as Record<string, unknown>)
    .netId;
  const netId =
    typeof sessionNetId === "string" && sessionNetId.trim()
      ? sessionNetId.trim().toLowerCase()
      : email.split("@")[0];

  return { email, netId };
}
