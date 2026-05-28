/**
 * SDK-agnostic helpers for the serialized Timestamp shapes this codebase has
 * to read from the wire.
 *
 * Across `/api/firestore/list` responses, `/api/firestore/mutate` requests,
 * raw Firestore document snapshots reached over JSON, and historical data
 * already saved as plain maps, four shapes appear:
 *
 *   - `{ __ts: <epochMs> }`
 *     The explicit wrapper produced by `wrapTimestamp`.
 *   - `{ seconds, nanoseconds }`
 *     Client SDK `Timestamp.toJSON()` (newer).
 *   - `{ type: "firestore/timestamp/1.0", seconds, nanoseconds }`
 *     Client SDK `Timestamp.toJSON()` with the discriminator. Also the shape
 *     that ends up stored in Firestore when a JSON-serialized client
 *     Timestamp is written without being coerced back to a real Timestamp.
 *   - `{ _seconds, _nanoseconds }`
 *     Admin SDK `Timestamp` serialization.
 *
 * Consumers that take a value of unknown origin should call
 * `isSerializedTimestamp` before reading, and use `extractSecondsNanos` or
 * `serializedTimestampToMillis` to read it. Tree-walking callers can use
 * `reviveSerializedTimestamps` and pass an SDK-specific Timestamp factory.
 */

export type SerializedTimestamp =
  | { __ts: number }
  | { seconds: number; nanoseconds: number }
  | {
      type: "firestore/timestamp/1.0";
      seconds: number;
      nanoseconds: number;
    }
  | { _seconds: number; _nanoseconds: number };

const FIRESTORE_TIMESTAMP_TYPE = "firestore/timestamp/1.0";

/**
 * Strict predicate. Returns true only for the four documented shapes (exact
 * key count and types). The strictness matters when called inside a tree
 * walker so that ordinary 2-key objects (e.g. `{ firstName, lastName }`) are
 * not mistaken for a timestamp.
 */
export function isSerializedTimestamp(
  value: unknown,
): value is SerializedTimestamp {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 1 && typeof obj.__ts === "number") return true;

  if (
    keys.length === 2 &&
    typeof obj.seconds === "number" &&
    typeof obj.nanoseconds === "number"
  ) {
    return true;
  }

  if (
    keys.length === 3 &&
    obj.type === FIRESTORE_TIMESTAMP_TYPE &&
    typeof obj.seconds === "number" &&
    typeof obj.nanoseconds === "number"
  ) {
    return true;
  }

  if (
    keys.length === 2 &&
    typeof obj._seconds === "number" &&
    typeof obj._nanoseconds === "number"
  ) {
    return true;
  }

  return false;
}

/**
 * Read (seconds, nanoseconds) from any of the four serialized shapes. Returns
 * null if the value is not a recognised serialized timestamp.
 *
 * Permissive about exact key count (so `isSerializedTimestamp` is not a
 * prerequisite for ad-hoc callers) but strict about the `type` discriminator:
 * if a `type` key is present and is not the Firestore discriminator, the
 * value is rejected. This keeps the helper consistent with
 * `isSerializedTimestamp` for the "wrong discriminator" case so that
 * non-Firestore typed envelopes are not silently coerced.
 */
export function extractSecondsNanos(
  value: unknown,
): { seconds: number; nanoseconds: number } | null {
  if (value === null || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;

  if (typeof obj.__ts === "number") {
    return {
      seconds: Math.floor(obj.__ts / 1000),
      nanoseconds: (obj.__ts % 1000) * 1e6,
    };
  }

  if ("type" in obj && obj.type !== FIRESTORE_TIMESTAMP_TYPE) {
    return null;
  }

  const sec =
    typeof obj.seconds === "number"
      ? obj.seconds
      : typeof obj._seconds === "number"
        ? obj._seconds
        : null;
  if (sec === null) return null;

  const nanos =
    typeof obj.nanoseconds === "number"
      ? obj.nanoseconds
      : typeof obj._nanoseconds === "number"
        ? obj._nanoseconds
        : 0;
  return { seconds: sec, nanoseconds: nanos };
}

/**
 * Convert a serialized timestamp to epoch milliseconds. Returns null if the
 * input is not a recognized serialized timestamp shape.
 */
export function serializedTimestampToMillis(value: unknown): number | null {
  const sn = extractSecondsNanos(value);
  if (sn === null) return null;
  return sn.seconds * 1000 + Math.floor(sn.nanoseconds / 1e6);
}

/**
 * Walk a parsed JSON tree and replace every serialized timestamp with the
 * SDK-specific Timestamp produced by `fromSecondsNanos`. Strict matching is
 * used so ordinary objects whose key count happens to be 2 (or 3) are not
 * misidentified.
 */
export function reviveSerializedTimestamps<T>(
  value: unknown,
  fromSecondsNanos: (seconds: number, nanoseconds: number) => T,
): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => reviveSerializedTimestamps(v, fromSecondsNanos));
  }
  if (typeof value !== "object") return value;
  if (isSerializedTimestamp(value)) {
    const { seconds, nanoseconds } = extractSecondsNanos(value)!;
    return fromSecondsNanos(seconds, nanoseconds);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = reviveSerializedTimestamps(v, fromSecondsNanos);
  }
  return out;
}
