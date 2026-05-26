import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- mocks ---------------------------------------------------------------

const mockCacheDocGet = vi.fn();
const mockCacheDocSet = vi.fn();
const mockDoc = vi.fn(() => ({
  get: mockCacheDocGet,
  set: mockCacheDocSet,
}));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockFirestore = vi.fn(() => ({ collection: mockCollection }));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => {
  class FakeTimestamp {
    constructor(public readonly seconds: number, public readonly nanoseconds: number) {}
    static now() {
      const ms = Date.now();
      return new FakeTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
    }
    static fromMillis(ms: number) {
      return new FakeTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
    }
    toMillis() {
      return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
    }
  }
  return {
    default: {
      firestore: Object.assign(mockFirestore, { Timestamp: FakeTimestamp }),
    },
  };
});

vi.mock("@/lib/server/nyuApiAuth", () => ({
  getNYUToken: vi.fn(),
  NYU_API_BASE: "https://api.test/identity-v2-sys",
}));

vi.mock("@/lib/utils/identityRecord", () => ({
  selectIdentityRecord: vi.fn((raw: unknown) => raw),
}));

// ---- imports under test (after mocks) -----------------------------------

const { fetchNYUIdentity } = await import("@/lib/server/nyuIdentity");
const { getNYUToken } = await import("@/lib/server/nyuApiAuth");
const admin = (await import("@/lib/firebase/server/firebaseAdmin")).default as any;
const FakeTimestamp = admin.firestore.Timestamp as any;

const mockGetNYUToken = vi.mocked(getNYUToken);

const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockGetNYUToken.mockResolvedValue("test-token");
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchNYUIdentity cache layer", () => {
  it("returns cached record without hitting NYU API when within 7 days", async () => {
    const cachedData = { netId: "abc123", dept_code: "ITP" };
    mockCacheDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        data: cachedData,
        cachedAt: FakeTimestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day old
      }),
    });

    const result = await fetchNYUIdentity("abc123");

    expect(result).toEqual(cachedData);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockGetNYUToken).not.toHaveBeenCalled();
    expect(mockCollection).toHaveBeenCalledWith("nyu_identity_cache");
    expect(mockDoc).toHaveBeenCalledWith("abc123");
  });

  it("ignores cache older than 7 days and falls through to live fetch", async () => {
    const staleData = { netId: "abc123", dept_code: "OLD" };
    const freshData = { netId: "abc123", dept_code: "ITP" };
    mockCacheDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        data: staleData,
        cachedAt: FakeTimestamp.fromMillis(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days old
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => freshData,
    } as Response);

    const result = await fetchNYUIdentity("abc123");

    expect(result).toEqual(freshData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Fresh result should be written back to cache
    expect(mockCacheDocSet).toHaveBeenCalled();
  });

  it("falls back to live fetch when cache document is missing", async () => {
    const freshData = { netId: "newuser", dept_code: "ITP" };
    mockCacheDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => freshData,
    } as Response);

    const result = await fetchNYUIdentity("newuser");

    expect(result).toEqual(freshData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockCacheDocSet).toHaveBeenCalled();
  });

  it("falls back to live fetch when cache read throws", async () => {
    const freshData = { netId: "abc", dept_code: "X" };
    mockCacheDocGet.mockRejectedValueOnce(new Error("firestore unavailable"));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => freshData,
    } as Response);

    const result = await fetchNYUIdentity("abc");

    expect(result).toEqual(freshData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not write to cache when upstream fetch fails", async () => {
    mockCacheDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const result = await fetchNYUIdentity("baduser");

    expect(result).toBeNull();
    expect(mockCacheDocSet).not.toHaveBeenCalled();
  });

  it("does not throw when cache write fails (write is fire-and-forget)", async () => {
    const freshData = { netId: "abc", dept_code: "X" };
    mockCacheDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => freshData,
    } as Response);
    mockCacheDocSet.mockRejectedValueOnce(new Error("write failed"));

    // Caller should still get the fresh record.
    const result = await fetchNYUIdentity("abc");
    expect(result).toEqual(freshData);
  });

  it("treats malformed cache documents as a miss", async () => {
    const freshData = { netId: "abc", dept_code: "X" };
    // missing cachedAt
    mockCacheDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ data: { netId: "abc" } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => freshData,
    } as Response);

    const result = await fetchNYUIdentity("abc");

    expect(result).toEqual(freshData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null without writing cache when token is missing", async () => {
    mockCacheDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    mockGetNYUToken.mockResolvedValueOnce(null);

    const result = await fetchNYUIdentity("abc");

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockCacheDocSet).not.toHaveBeenCalled();
  });

  it("coalesces concurrent cache misses into a single upstream call", async () => {
    const freshData = { netId: "abc", dept_code: "ITP" };
    // Both concurrent calls see a cache miss.
    mockCacheDocGet
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: false, data: () => undefined });
    // Upstream returns the same payload; we expect it to be called only once.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => freshData,
    } as Response);

    const [a, b] = await Promise.all([
      fetchNYUIdentity("abc"),
      fetchNYUIdentity("abc"),
    ]);

    expect(a).toEqual(freshData);
    expect(b).toEqual(freshData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("writes an expiresAt field so Firestore TTL can purge stale docs", async () => {
    const freshData = { netId: "abc", dept_code: "ITP" };
    mockCacheDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => freshData,
    } as Response);

    const before = Date.now();
    await fetchNYUIdentity("abc");
    // Allow the fire-and-forget write to flush.
    await new Promise((r) => setImmediate(r));
    const after = Date.now();

    expect(mockCacheDocSet).toHaveBeenCalledTimes(1);
    const written = mockCacheDocSet.mock.calls[0][0];
    expect(written.data).toEqual(freshData);
    expect(written.cachedAt).toBeDefined();
    expect(written.expiresAt).toBeDefined();
    const expiresMs = written.expiresAt.toMillis();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(before + SEVEN_DAYS);
    expect(expiresMs).toBeLessThanOrEqual(after + SEVEN_DAYS);
  });

  it("URL-encodes the uniqueId path segment", async () => {
    mockCacheDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await fetchNYUIdentity("ab/c?d");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/identity/unique-id/ab%2Fc%3Fd");
    expect(calledUrl).not.toContain("/identity/unique-id/ab/c?d");
  });
});
