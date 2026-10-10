import { TableNames } from "@/components/src/policy";
import {
  BanLike,
  findActiveBan,
} from "@/components/src/utils/banWindow";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export const BANNED_FROM_BOOKING_MESSAGE = "You are banned from booking";

/** True when this email has a permanent ban or a timed ban that is in effect now. */
export async function requesterIsBanned(
  email: unknown,
  tenant?: string,
): Promise<boolean> {
  if (typeof email !== "string" || !email.trim()) return false;
  const bans = await serverFetchAllDataFromCollection<BanLike>(
    TableNames.BANNED,
    [],
    tenant,
  );
  return findActiveBan(bans, email) != null;
}
