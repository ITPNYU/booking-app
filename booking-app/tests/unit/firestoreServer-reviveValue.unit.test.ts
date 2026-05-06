import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/server/firebaseAdmin", () => {
  const fromMillisMock = vi.fn(
    (ms: number) => ({ kind: "fromMillis", ms }) as const,
  );
  class FakeAdminTimestamp {
    constructor(
      public readonly seconds: number,
      public readonly nanoseconds: number,
    ) {}
    static fromMillis = fromMillisMock;
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
const fromMillisMock = (FakeAdminTimestamp as any).fromMillis as ReturnType<
  typeof vi.fn
>;

import { reviveValue } from "@/lib/api/firestoreServer";

describe("reviveValue", () => {
  it("revives `{__ts}` shape via Timestamp.fromMillis", () => {
    const result = reviveValue({ __ts: 1700000000000 });
    expect(fromMillisMock).toHaveBeenCalledWith(1700000000000);
    expect(result).toEqual({ kind: "fromMillis", ms: 1700000000000 });
  });

  it("revives client-SDK `{seconds, nanoseconds}` shape", () => {
    const result = reviveValue({ seconds: 100, nanoseconds: 250 });
    expect(result).toBeInstanceOf(FakeAdminTimestamp);
    expect((result as FakeAdminTimestamp).seconds).toBe(100);
    expect((result as FakeAdminTimestamp).nanoseconds).toBe(250);
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
      meta: { createdAt: { __ts: 5 }, value: 7 },
    });
    expect(result).toMatchObject({
      title: "x",
      meta: { createdAt: { kind: "fromMillis", ms: 5 }, value: 7 },
    });
  });

  it("recurses into arrays", () => {
    const result = reviveValue([{ __ts: 1 }, { __ts: 2 }, "noop"]);
    expect(result).toEqual([
      { kind: "fromMillis", ms: 1 },
      { kind: "fromMillis", ms: 2 },
      "noop",
    ]);
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
