import { TableNames } from "@/components/src/policy";
import {
  BanLike,
  findActiveBan,
} from "@/components/src/utils/banWindow";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export const BANNED_FROM_BOOKING_MESSAGE = "You are banned from booking";

/**
 * True when this email has a permanent ban or a timed ban that is in effect now.
 * `usersBanned` is one shared collection, so a ban applies in every tenant.
 */
export async function requesterIsBanned(email: unknown): Promise<boolean> {
  if (typeof email !== "string" || !email.trim()) return false;
  const bans = await serverFetchAllDataFromCollection<BanLike>(
    TableNames.BANNED,
  );
  return findActiveBan(bans, email) != null;
}
