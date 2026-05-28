import { describe, expect, it, vi } from "vitest";

// Override the global firebase/firestore mock from setup.ts so we get a
// real-ish Timestamp class with the methods reviveTimestamps relies on.
vi.mock("firebase/firestore", () => {
  class FakeTimestamp {
    constructor(
      public readonly seconds: number,
      public readonly nanoseconds: number,
    ) {}
    static fromMillis(ms: number) {
      return new FakeTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
    }
    static fromDate(date: Date) {
      return FakeTimestamp.fromMillis(date.getTime());
    }
    static now() {
      return FakeTimestamp.fromMillis(Date.now());
    }
    toMillis() {
      return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
    }
    toDate() {
      return new Date(this.toMillis());
    }
  }
  return {
    getFirestore: vi.fn(() => ({})),
    Timestamp: FakeTimestamp,
  };
});

const firestoreModule = await import("firebase/firestore");
const FakeTimestamp = firestoreModule.Timestamp as new (
  s: number,
  n: number,
) => { seconds: number; nanoseconds: number; toMillis(): number };

const { reviveTimestamps } = await import("@/lib/firebase/firebase");

describe("reviveTimestamps", () => {
  it("revives `{__ts}` shape via Timestamp.fromMillis", () => {
    const result = reviveTimestamps({ __ts: 1700000000000 }) as InstanceType<
      typeof FakeTimestamp
    >;
    expect(result).toBeInstanceOf(FakeTimestamp);
    expect(result.toMillis()).toBe(1700000000000);
  });

  it("revives client-SDK `{seconds, nanoseconds}` shape", () => {
    const result = reviveTimestamps({
      seconds: 100,
      nanoseconds: 250,
    }) as InstanceType<typeof FakeTimestamp>;
    expect(result).toBeInstanceOf(FakeTimestamp);
    expect(result.seconds).toBe(100);
    expect(result.nanoseconds).toBe(250);
  });

  it("revives client-SDK `{type, seconds, nanoseconds}` shape (Timestamp.toJSON discriminator)", () => {
    const result = reviveTimestamps({
      type: "firestore/timestamp/1.0",
      seconds: 1788235200,
      nanoseconds: 0,
    }) as InstanceType<typeof FakeTimestamp>;
    expect(result).toBeInstanceOf(FakeTimestamp);
    expect(result.seconds).toBe(1788235200);
    expect(result.nanoseconds).toBe(0);
  });

  it("revives admin-SDK `{_seconds, _nanoseconds}` shape", () => {
    const result = reviveTimestamps({
      _seconds: 200,
      _nanoseconds: 750,
    }) as InstanceType<typeof FakeTimestamp>;
    expect(result).toBeInstanceOf(FakeTimestamp);
    expect(result.seconds).toBe(200);
    expect(result.nanoseconds).toBe(750);
  });

  it("recurses into nested objects", () => {
    const result = reviveTimestamps({
      title: "x",
      meta: { createdAt: { __ts: 5000 }, value: 7 },
    }) as {
      title: string;
      meta: { createdAt: InstanceType<typeof FakeTimestamp>; value: number };
    };
    expect(result.title).toBe("x");
    expect(result.meta.createdAt).toBeInstanceOf(FakeTimestamp);
    expect(result.meta.createdAt.toMillis()).toBe(5000);
    expect(result.meta.value).toBe(7);
  });

  it("recurses into arrays", () => {
    const result = reviveTimestamps([
      { __ts: 1000 },
      { type: "firestore/timestamp/1.0", seconds: 2, nanoseconds: 0 },
      "noop",
    ]) as [
      InstanceType<typeof FakeTimestamp>,
      InstanceType<typeof FakeTimestamp>,
      string,
    ];
    expect(result[0]).toBeInstanceOf(FakeTimestamp);
    expect(result[0].toMillis()).toBe(1000);
    expect(result[1]).toBeInstanceOf(FakeTimestamp);
    expect(result[1].seconds).toBe(2);
    expect(result[2]).toBe("noop");
  });

  it("passes primitives through unchanged", () => {
    expect(reviveTimestamps("hello")).toBe("hello");
    expect(reviveTimestamps(42)).toBe(42);
    expect(reviveTimestamps(true)).toBe(true);
    expect(reviveTimestamps(null)).toBe(null);
    expect(reviveTimestamps(undefined)).toBe(undefined);
  });

  it("does not misidentify ordinary 2-key objects as timestamps", () => {
    const obj = { firstName: "Riho", lastName: "Hagi" };
    const result = reviveTimestamps(obj);
    expect(result).toEqual(obj);
    expect(result).not.toBeInstanceOf(FakeTimestamp);
  });

  it("does not misidentify 3-key objects without the firestore type discriminator", () => {
    const obj = {
      type: "something/else/2.0",
      seconds: 100,
      nanoseconds: 0,
    };
    const result = reviveTimestamps(obj);
    expect(result).toEqual(obj);
    expect(result).not.toBeInstanceOf(FakeTimestamp);
  });
});
