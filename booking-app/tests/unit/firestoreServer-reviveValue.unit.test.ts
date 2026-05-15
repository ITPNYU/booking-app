import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/server/firebaseAdmin", () => {
  class FakeAdminTimestamp {
    constructor(
      public readonly seconds: number,
      public readonly nanoseconds: number,
    ) {}
  }
  return {
    default: {
      firestore: Object.assign(() => ({}), {
        Timestamp: FakeAdminTimestamp,
      }),
    },
  };
});

const adminModule = await import("@/lib/firebase/server/firebaseAdmin");
const FakeAdminTimestamp = (adminModule.default as any).firestore
  .Timestamp as new (
  s: number,
  n: number,
) => { seconds: number; nanoseconds: number };

import { reviveValue } from "@/lib/api/firestoreServer";

describe("reviveValue", () => {
  it("revives `{__ts}` shape into admin Timestamp", () => {
    const result = reviveValue({ __ts: 1700000000500 });
    expect(result).toBeInstanceOf(FakeAdminTimestamp);
    expect((result as FakeAdminTimestamp).seconds).toBe(1700000000);
    expect((result as FakeAdminTimestamp).nanoseconds).toBe(500_000_000);
  });

  it("revives client-SDK `{seconds, nanoseconds}` shape", () => {
    const result = reviveValue({ seconds: 100, nanoseconds: 250 });
    expect(result).toBeInstanceOf(FakeAdminTimestamp);
    expect((result as FakeAdminTimestamp).seconds).toBe(100);
    expect((result as FakeAdminTimestamp).nanoseconds).toBe(250);
  });

  it("revives client-SDK `{type, seconds, nanoseconds}` shape (Timestamp.toJSON discriminator)", () => {
    const result = reviveValue({
      type: "firestore/timestamp/1.0",
      seconds: 1788235200,
      nanoseconds: 0,
    });
    expect(result).toBeInstanceOf(FakeAdminTimestamp);
    expect((result as FakeAdminTimestamp).seconds).toBe(1788235200);
    expect((result as FakeAdminTimestamp).nanoseconds).toBe(0);
  });

  it("revives admin-SDK `{_seconds, _nanoseconds}` shape", () => {
    const result = reviveValue({ _seconds: 200, _nanoseconds: 750 });
    expect(result).toBeInstanceOf(FakeAdminTimestamp);
    expect((result as FakeAdminTimestamp).seconds).toBe(200);
    expect((result as FakeAdminTimestamp).nanoseconds).toBe(750);
  });

  it("recurses into nested objects", () => {
    const result = reviveValue({
      title: "x",
      meta: { createdAt: { __ts: 5000 }, value: 7 },
    }) as {
      title: string;
      meta: { createdAt: InstanceType<typeof FakeAdminTimestamp>; value: number };
    };
    expect(result.title).toBe("x");
    expect(result.meta.createdAt).toBeInstanceOf(FakeAdminTimestamp);
    expect(result.meta.createdAt.seconds).toBe(5);
    expect(result.meta.value).toBe(7);
  });

  it("recurses into arrays", () => {
    const result = reviveValue([
      { __ts: 1000 },
      { __ts: 2000 },
      "noop",
    ]) as [
      InstanceType<typeof FakeAdminTimestamp>,
      InstanceType<typeof FakeAdminTimestamp>,
      string,
    ];
    expect(result[0]).toBeInstanceOf(FakeAdminTimestamp);
    expect(result[0].seconds).toBe(1);
    expect(result[1]).toBeInstanceOf(FakeAdminTimestamp);
    expect(result[1].seconds).toBe(2);
    expect(result[2]).toBe("noop");
  });

  it("passes primitives through unchanged", () => {
    expect(reviveValue("hello")).toBe("hello");
    expect(reviveValue(42)).toBe(42);
    expect(reviveValue(true)).toBe(true);
    expect(reviveValue(null)).toBe(null);
    expect(reviveValue(undefined)).toBe(undefined);
  });

  it("does not misidentify ordinary 2-key objects as timestamps", () => {
    const obj = { firstName: "Riho", lastName: "Hagi" };
    const result = reviveValue(obj);
    expect(result).toEqual(obj);
  });
});
