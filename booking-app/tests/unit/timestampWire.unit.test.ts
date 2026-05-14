import { describe, expect, it } from "vitest";

import {
  extractSecondsNanos,
  isSerializedTimestamp,
  reviveSerializedTimestamps,
  serializedTimestampToMillis,
} from "@/lib/utils/timestampWire";

describe("isSerializedTimestamp", () => {
  it("accepts `{__ts}` wrapper", () => {
    expect(isSerializedTimestamp({ __ts: 1700000000000 })).toBe(true);
  });

  it("accepts client SDK `{seconds, nanoseconds}`", () => {
    expect(isSerializedTimestamp({ seconds: 1, nanoseconds: 2 })).toBe(true);
  });

  it("accepts client SDK `{type, seconds, nanoseconds}` discriminator", () => {
    expect(
      isSerializedTimestamp({
        type: "firestore/timestamp/1.0",
        seconds: 1,
        nanoseconds: 2,
      }),
    ).toBe(true);
  });

  it("accepts admin SDK `{_seconds, _nanoseconds}`", () => {
    expect(isSerializedTimestamp({ _seconds: 1, _nanoseconds: 2 })).toBe(true);
  });

  it("rejects ordinary 2-key object", () => {
    expect(isSerializedTimestamp({ firstName: "a", lastName: "b" })).toBe(
      false,
    );
  });

  it("rejects 3-key object without firestore discriminator", () => {
    expect(
      isSerializedTimestamp({
        type: "something/else/2.0",
        seconds: 1,
        nanoseconds: 2,
      }),
    ).toBe(false);
  });

  it("rejects 4+-key objects even with seconds/nanoseconds", () => {
    expect(
      isSerializedTimestamp({
        type: "firestore/timestamp/1.0",
        seconds: 1,
        nanoseconds: 2,
        extra: "no",
      }),
    ).toBe(false);
  });

  it("rejects null / non-object primitives", () => {
    expect(isSerializedTimestamp(null)).toBe(false);
    expect(isSerializedTimestamp(undefined)).toBe(false);
    expect(isSerializedTimestamp(42)).toBe(false);
    expect(isSerializedTimestamp("hello")).toBe(false);
  });
});

describe("extractSecondsNanos", () => {
  it("extracts from `{__ts}`", () => {
    expect(extractSecondsNanos({ __ts: 1500 })).toEqual({
      seconds: 1,
      nanoseconds: 500_000_000,
    });
  });

  it("extracts from `{seconds, nanoseconds}`", () => {
    expect(extractSecondsNanos({ seconds: 5, nanoseconds: 7 })).toEqual({
      seconds: 5,
      nanoseconds: 7,
    });
  });

  it("extracts from `{type, seconds, nanoseconds}`", () => {
    expect(
      extractSecondsNanos({
        type: "firestore/timestamp/1.0",
        seconds: 9,
        nanoseconds: 0,
      }),
    ).toEqual({ seconds: 9, nanoseconds: 0 });
  });

  it("extracts from `{_seconds, _nanoseconds}`", () => {
    expect(extractSecondsNanos({ _seconds: 11, _nanoseconds: 13 })).toEqual({
      seconds: 11,
      nanoseconds: 13,
    });
  });

  it("returns null for unrecognized objects", () => {
    expect(extractSecondsNanos({ foo: "bar" })).toBe(null);
    expect(extractSecondsNanos(null)).toBe(null);
    expect(extractSecondsNanos(42)).toBe(null);
  });
});

describe("serializedTimestampToMillis", () => {
  it("converts {seconds, nanoseconds} to millis", () => {
    expect(serializedTimestampToMillis({ seconds: 2, nanoseconds: 500_000_000 })).toBe(
      2500,
    );
  });

  it("returns null when shape is unrecognized", () => {
    expect(serializedTimestampToMillis({ foo: "bar" })).toBe(null);
  });
});

describe("reviveSerializedTimestamps", () => {
  const make = (s: number, n: number) => ({ kind: "ts" as const, s, n });

  it("revives a top-level timestamp", () => {
    expect(
      reviveSerializedTimestamps({ seconds: 5, nanoseconds: 6 }, make),
    ).toEqual({ kind: "ts", s: 5, n: 6 });
  });

  it("revives nested timestamps", () => {
    expect(
      reviveSerializedTimestamps(
        {
          name: "x",
          startDate: {
            type: "firestore/timestamp/1.0",
            seconds: 1,
            nanoseconds: 0,
          },
        },
        make,
      ),
    ).toEqual({ name: "x", startDate: { kind: "ts", s: 1, n: 0 } });
  });

  it("revives inside arrays", () => {
    expect(
      reviveSerializedTimestamps(
        [{ __ts: 1000 }, "noop", { _seconds: 2, _nanoseconds: 3 }],
        make,
      ),
    ).toEqual([
      { kind: "ts", s: 1, n: 0 },
      "noop",
      { kind: "ts", s: 2, n: 3 },
    ]);
  });

  it("does not misidentify ordinary objects", () => {
    expect(
      reviveSerializedTimestamps(
        { firstName: "a", lastName: "b" },
        make,
      ),
    ).toEqual({ firstName: "a", lastName: "b" });
  });

  it("passes primitives through", () => {
    expect(reviveSerializedTimestamps("hi", make)).toBe("hi");
    expect(reviveSerializedTimestamps(42, make)).toBe(42);
    expect(reviveSerializedTimestamps(null, make)).toBe(null);
    expect(reviveSerializedTimestamps(undefined, make)).toBe(undefined);
  });
});
