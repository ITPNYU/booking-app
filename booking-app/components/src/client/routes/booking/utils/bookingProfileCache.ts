/**
 * The requester's own details from their last successful booking, kept in
 * localStorage per tenant and user. They fill the request form only where
 * the identity API leaves a gap: it is often unavailable, and it never
 * returns a phone number or school.
 *
 * Only the requester's own details belong here. VIP and walk-in requests
 * describe someone else and must neither read nor write the profile.
 * Signing out removes every saved profile in this browser.
 */

const VERSION = 1;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export const BOOKING_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "phoneNumber",
  "school",
  "otherSchool",
  "department",
  "otherDepartment",
  "role",
] as const;

export type BookingProfile = Partial<
  Record<(typeof BOOKING_PROFILE_FIELDS)[number], string>
>;

interface StoredProfile {
  v: number;
  savedAt: number;
  profile: BookingProfile;
}

const KEY_PREFIX = "bookingProfile:";

function storageKey(tenant: string, email: string): string {
  return `${KEY_PREFIX}v${VERSION}:${tenant}:${email.trim().toLowerCase()}`;
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function pickProfile(values: Record<string, unknown>): BookingProfile {
  const profile: BookingProfile = {};
  for (const field of BOOKING_PROFILE_FIELDS) {
    const value = values[field];
    if (typeof value === "string" && value.trim() !== "") {
      profile[field] = value;
    }
  }
  return profile;
}

export function readBookingProfile(
  tenant: string | undefined,
  email: string | undefined,
): BookingProfile {
  const storage = getStorage();
  if (!storage || !tenant || !email) return {};
  const key = storageKey(tenant, email);
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const stored = JSON.parse(raw) as StoredProfile;
    if (
      stored?.v !== VERSION ||
      typeof stored.savedAt !== "number" ||
      Date.now() - stored.savedAt > MAX_AGE_MS
    ) {
      storage.removeItem(key);
      return {};
    }
    const storedProfile = stored.profile ?? {};
    const profile = pickProfile(storedProfile);
    // Older entries stored an N-number. Drop it the next time one is read.
    if ("nNumber" in storedProfile) {
      try {
        storage.setItem(key, JSON.stringify({ ...stored, profile }));
      } catch {
        // Leaving the old entry is no worse than before this read.
      }
    }
    return profile;
  } catch {
    return {};
  }
}

/**
 * Merges the given values into the stored profile. Blank values keep what
 * was stored, so a field a tenant hides does not erase an earlier answer.
 */
export function writeBookingProfile(
  tenant: string | undefined,
  email: string | undefined,
  values: Record<string, unknown>,
): void {
  const storage = getStorage();
  if (!storage || !tenant || !email) return;
  const stored: StoredProfile = {
    v: VERSION,
    savedAt: Date.now(),
    profile: { ...readBookingProfile(tenant, email), ...pickProfile(values) },
  };
  try {
    storage.setItem(storageKey(tenant, email), JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the profile is a convenience only.
  }
}

/** Removes every saved profile. Called on sign-out, for every tenant. */
export function clearBookingProfiles(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // The profile is a convenience only.
  }
}
