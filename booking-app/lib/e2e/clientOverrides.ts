/**
 * E2E-only escape hatch for client data fetchers.
 *
 * Playwright tests replace selected fetchers by assigning a function with the
 * same name onto `window` from an init script (see
 * tests/e2e/helpers/xstate-mocks.ts). The wrapped exports in
 * lib/firebase/firebase.ts consult this lookup on every call, which works
 * under any bundler runtime — unlike the previous approach of patching the
 * `webpackChunk_N_E` module cache, which Turbopack does not have.
 *
 * `NEXT_PUBLIC_IS_TEST_ENV` is inlined at build time, so in production
 * builds this function is a constant `undefined` and the wrappers collapse
 * to plain calls.
 */
export const getE2EOverride = (
  name: string,
): ((...args: any[]) => any) | undefined => {
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV !== "true") return undefined;
  if (typeof window === "undefined") return undefined;
  const override = (window as any)[name];
  return typeof override === "function" ? override : undefined;
};
