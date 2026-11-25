import { NextRequest } from "next/server";
import { APP_ORIGIN, world } from "./world";

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

const routes = import.meta.glob<Record<string, Handler>>(
  "/app/api/**/route.ts",
);

const patterns = Object.keys(routes).map((file) => {
  const path = file.replace(/^\/app/, "").replace(/\/route\.ts$/, "");
  const names: string[] = [];
  const source = path.replace(/\[([^\]]+)\]/g, (_, name: string) => {
    names.push(name);
    return "([^/]+)";
  });
  return { file, names, regex: new RegExp(`^${source}$`) };
});

/**
 * fetch() for tests: a request to the application's own API runs the real
 * route handler in this process. Anything else is refused, so no test can
 * reach the network.
 */
export const inProcessFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  const url = new URL(
    String(input instanceof Request ? input.url : input),
    APP_ORIGIN,
  );
  if (url.origin !== APP_ORIGIN) {
    throw new Error(`invariant harness: refused network call to ${url.href}`);
  }
  const method = (init.method ?? "GET").toUpperCase();
  const body = typeof init.body === "string" ? init.body : undefined;
  const parsed = body ? JSON.parse(body) : undefined;
  const record = (status: number) =>
    world.requests.push({ method, path: url.pathname, body: parsed, status });

  // Sending mail is the boundary: record the request instead of rendering it.
  if (url.pathname === "/api/sendEmail") {
    world.emails.push(parsed ?? {});
    record(200);
    return Response.json({ success: true });
  }

  const match = patterns.find((p) => p.regex.test(url.pathname));
  if (!match) {
    record(404);
    return Response.json({ error: "No such route" }, { status: 404 });
  }
  const values = match.regex.exec(url.pathname)!.slice(1);
  const params = Object.fromEntries(match.names.map((n, i) => [n, values[i]]));
  const handler = (await routes[match.file]())[method];
  if (!handler) {
    record(405);
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const response = await handler(
    new NextRequest(url, { method, headers: init.headers, body }),
    { params: Promise.resolve(params) },
  );
  record(response.status);
  return response;
};
