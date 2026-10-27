import { TableNames } from "@/components/src/policy";
import {
  BanLike,
  findActiveBan,
} from "@/components/src/utils/banWindow";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export const BANNED_FROM_BOOKING_MESSAGE = "You are banned from booking";

/**
 * True when this email has a permanent ban or a timed ban that is in effect now
 * in this tenant. Bans live in `{tenant}-usersBanned`. A missing tenant refuses
 * the check instead of reading the old shared `usersBanned` collection.
 */
export async function requesterIsBanned(
  email: unknown,
  tenant?: string,
): Promise<boolean> {
  if (typeof email !== "string" || !email.trim()) return false;
  if (typeof tenant !== "string" || !tenant.trim()) return true;
  const bans = await serverFetchAllDataFromCollection<BanLike>(
    TableNames.BANNED,
    [],
    tenant,
  );
  return findActiveBan(bans, email) != null;
}

/** True when any of these addresses has an active ban in this tenant. Duplicate addresses are checked once. */
export async function anyRequesterIsBanned(
  emails: unknown[],
  tenant?: string,
): Promise<boolean> {
  const seen = new Set<string>();
  for (const email of emails) {
    if (typeof email !== "string") continue;
    const key = email.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (await requesterIsBanned(email, tenant)) return true;
  }
  return false;
}
