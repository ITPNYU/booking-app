import { expect, type Page, type TestInfo } from "@playwright/test";

/** Request counts keyed by `METHOD /api/path` (see `keyOf`). */
export type ApiCallCounts = Record<string, number>;

// NextAuth refetches the session on window focus, so its count depends on
// how the browser window is handled rather than on what the page asks for.
const IGNORED_PREFIXES = ["/api/auth/"];

// These proxy routes serve every collection through one path; the collection
// in the body is what tells a bookings read apart from a settings read.
const FIRESTORE_READ_ROUTES = new Set([
  "/api/firestore/list",
  "/api/firestore/paginated",
  "/api/firestore/getDoc",
]);

function keyOf(method: string, url: URL, postData: string | null): string {
  let key = `${method} ${url.pathname}`;
  if (FIRESTORE_READ_ROUTES.has(url.pathname) && postData) {
    try {
      const { collection } = JSON.parse(postData);
      if (typeof collection === "string") key += ` [${collection}]`;
    } catch {
      // Not JSON: count it under the bare path.
    }
  }
  return key;
}

/**
 * Count every request the page sends to this app's `/api/*` routes.
 *
 * Counting happens on the request event, so it sees a call whether a route
 * mock answers it or it reaches the dev server. Register it before the first
 * navigation.
 */
export function recordApiRequests(page: Page) {
  const counts: ApiCallCounts = {};
  let total = 0;

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return;
    if (IGNORED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return;
    }
    const key = keyOf(request.method(), url, request.postData());
    counts[key] = (counts[key] ?? 0) + 1;
    total += 1;
  });

  return {
    counts,
    /**
     * Resolve once the page has started calling the API and then stayed
     * quiet for `quietMs`. Waiting for the first call matters: a page that is
     * still compiling or hydrating looks quiet too, and would be measured as
     * making no calls at all.
     */
    async settle(quietMs = 3000, timeoutMs = 60000) {
      const deadline = Date.now() + timeoutMs;
      const expired = () => {
        if (Date.now() <= deadline) return false;
        throw new Error(
          `API requests did not settle within ${timeoutMs}ms: ${JSON.stringify(counts)}`,
        );
      };
      while (total === 0 && !expired()) {
        await page.waitForTimeout(250);
      }
      let seen = -1;
      while (seen !== total && !expired()) {
        seen = total;
        await page.waitForTimeout(quietMs);
      }
    },
  };
}

const sorted = (counts: ApiCallCounts) =>
  Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );

/**
 * Fail when the page made a call the budget does not list, or made a listed
 * call more often than the budget allows. Making fewer calls passes.
 */
export async function expectWithinApiBudget(
  testInfo: TestInfo,
  observed: ApiCallCounts,
  budget: ApiCallCounts,
) {
  await testInfo.attach("api-call-counts.json", {
    body: JSON.stringify(sorted(observed), null, 2),
    contentType: "application/json",
  });

  const overBudget = Object.entries(observed)
    .filter(([key, count]) => count > (budget[key] ?? 0))
    .map(
      ([key, count]) => `  ${key}: ${count} calls (budget ${budget[key] ?? 0})`,
    );

  expect(
    overBudget.length,
    [
      "This page now makes more API calls than its budget allows:",
      ...overBudget,
      "",
      "Every extra call is paid on each page load in production. Remove the",
      "call, or fetch it only where it is used. If the page really needs it,",
      "raise the budget in tests/e2e/api-call-budget.e2e.test.ts and say why",
      "in the PR.",
      "",
      `Observed: ${JSON.stringify(sorted(observed), null, 2)}`,
    ].join("\n"),
  ).toBe(0);
}
