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
  return { email, netId: email.split("@")[0] };
}
