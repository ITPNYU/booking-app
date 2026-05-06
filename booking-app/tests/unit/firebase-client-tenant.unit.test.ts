import { TableNames } from "@/components/src/policy";
import {
  clientDeleteDataFromFirestore,
  clientSaveDataToFirestore,
} from "@/lib/firebase/firebase";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/src/client/routes/components/SchemaProvider", () => ({}));

/**
 * After the SSO migration, client-side helpers POST to `/api/firestore/*`
 * instead of touching Firestore directly. The contract these tests guard:
 *   1. The request goes to the right endpoint
 *   2. The body's `collection` and `tenant` fields match the URL-derived /
 *      explicit tenant input
 *   3. Tenant prefixing happens server-side, so the helper just forwards the
 *      raw collection name + resolved tenant
 */

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ id: "new-doc-id" }),
}));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastBody() {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("clientDeleteDataFromFirestore — request contract", () => {
  it("forwards tenant derived from URL", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin/settings/policy" });

    await clientDeleteDataFromFirestore(TableNames.BLACKOUT_PERIODS, "p1");

    const call = fetchMock.mock.calls.at(-1)!;
    expect(call[0]).toBe("/api/firestore/mutate");
    expect(lastBody()).toMatchObject({
      op: "delete",
      collection: "blackoutPeriods",
      tenant: "mc",
      docId: "p1",
    });
  });

  it("omits tenant when the URL has none", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientDeleteDataFromFirestore(TableNames.BLACKOUT_PERIODS, "p1");

    expect(lastBody().tenant).toBeUndefined();
  });

  it("respects an explicit tenant argument over the URL", async () => {
    vi.stubGlobal("location", { pathname: "/other/path" });

    await clientDeleteDataFromFirestore(
      TableNames.BLACKOUT_PERIODS,
      "p1",
      "mc",
    );

    expect(lastBody().tenant).toBe("mc");
  });
});

describe("clientSaveDataToFirestore — request contract", () => {
  const sampleData = { name: "Winter Break", isActive: true };

  it("forwards tenant derived from URL", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin/settings/policy" });

    await clientSaveDataToFirestore(TableNames.BLACKOUT_PERIODS, sampleData);

    const call = fetchMock.mock.calls.at(-1)!;
    expect(call[0]).toBe("/api/firestore/mutate");
    expect(lastBody()).toMatchObject({
      op: "create",
      collection: "blackoutPeriods",
      tenant: "mc",
      data: sampleData,
    });
  });

  it("omits tenant when the URL has none", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientSaveDataToFirestore(TableNames.BLACKOUT_PERIODS, sampleData);

    expect(lastBody().tenant).toBeUndefined();
  });

  it("respects an explicit tenant argument over the URL", async () => {
    vi.stubGlobal("location", { pathname: "/other/path" });

    await clientSaveDataToFirestore(
      TableNames.BLACKOUT_PERIODS,
      sampleData,
      "mc",
    );

    expect(lastBody().tenant).toBe("mc");
  });
});
