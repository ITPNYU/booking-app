import { SERVICE_ORDER } from "@/components/src/client/utils/serviceOrder";
import {
  BookingStatusLabel,
  PageContextLevel,
  PagePermission,
} from "@/components/src/types";
import { DateRangeFilter } from "./hooks/getDateFilter";

const RETURN_KEY = "bookingDashboardReturnTo";
const CLEARED_STATUS = "__none__";

const DATE_RANGES = new Set<DateRangeFilter>([
  "Today",
  "This Week",
  "All Future",
  "Past 24 hours",
  "Past Week",
  "Past Month",
  "Past 6 Months",
  "Past 9 Months",
]);

const ORIGINS = new Set(["User", "Walk-In", "VIP", "Pregame"]);
const SERVICES = new Set<string>(SERVICE_ORDER);
const STATUSES = new Set<string>(Object.values(BookingStatusLabel));
const DASHBOARD_SEGMENTS = new Set([
  "admin",
  "pa",
  "liaison",
  "services",
  "my-bookings",
]);

const VIEW_KEYS = ["q", "range", "status", "origin", "room", "service"];

export type DashboardView = {
  searchQuery: string;
  dateRange: DateRangeFilter;
  statuses: BookingStatusLabel[];
  origins: string[];
  rooms: string[];
  services: string[];
};

type SearchParamSource = {
  get: (name: string) => string | null;
  getAll: (name: string) => string[];
  toString: () => string;
};

export function defaultDashboardView(
  pageContext: PageContextLevel,
): DashboardView {
  return {
    searchQuery: "",
    dateRange: pageContext === PageContextLevel.PA ? "Today" : "All Future",
    statuses:
      pageContext === PageContextLevel.LIAISON
        ? [BookingStatusLabel.REQUESTED]
        : [],
    origins: [],
    rooms: [],
    services: [],
  };
}

export function parseDashboardView(
  params: SearchParamSource,
  pageContext: PageContextLevel,
): DashboardView {
  const defaults = defaultDashboardView(pageContext);
  const rangeRaw = params.get("range");
  const dateRange =
    rangeRaw && DATE_RANGES.has(rangeRaw as DateRangeFilter)
      ? (rangeRaw as DateRangeFilter)
      : defaults.dateRange;

  const statusValues = readList(params, "status");
  let statuses = defaults.statuses;
  if (statusValues.includes(CLEARED_STATUS)) {
    statuses = [];
  } else if (statusValues.length > 0) {
    statuses = statusValues.filter((status): status is BookingStatusLabel =>
      STATUSES.has(status),
    );
  }

  return {
    searchQuery: params.get("q") ?? "",
    dateRange,
    statuses,
    origins: readList(params, "origin").filter((origin) => ORIGINS.has(origin)),
    rooms: readList(params, "room")
      .filter((room) => room.length > 0 && room.length <= 40)
      .slice(0, 40),
    services: readList(params, "service").filter((service) =>
      SERVICES.has(service),
    ),
  };
}

/** One param per filter. Comma-separated, and older repeated keys still parse. */
function readList(params: SearchParamSource, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function writeList(params: URLSearchParams, key: string, values: string[]) {
  if (values.length > 0) params.set(key, values.join(","));
}

function sameList(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function dashboardViewsEqual(
  left: DashboardView,
  right: DashboardView,
): boolean {
  return (
    left.searchQuery === right.searchQuery &&
    left.dateRange === right.dateRange &&
    sameList(left.statuses, right.statuses) &&
    sameList(left.origins, right.origins) &&
    sameList(left.rooms, right.rooms) &&
    sameList(left.services, right.services)
  );
}

/** Keep unrelated params (such as calendarEventId) and rewrite the view. */
export function applyDashboardView(
  current: SearchParamSource,
  view: DashboardView,
  pageContext: PageContextLevel,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  VIEW_KEYS.forEach((key) => next.delete(key));
  const defaults = defaultDashboardView(pageContext);

  if (view.searchQuery) next.set("q", view.searchQuery);
  if (view.dateRange !== defaults.dateRange) next.set("range", view.dateRange);

  if (!sameList(view.statuses, defaults.statuses)) {
    writeList(
      next,
      "status",
      view.statuses.length === 0 ? [CLEARED_STATUS] : view.statuses,
    );
  }

  writeList(next, "origin", view.origins);
  writeList(next, "room", view.rooms);
  writeList(next, "service", view.services);
  return next;
}

/**
 * Update the address bar without a Next.js navigation. router.replace refetches
 * the page on every filter change.
 */
export function syncDashboardViewUrl(
  view: DashboardView,
  pageContext: PageContextLevel,
): void {
  if (typeof window === "undefined") return;
  const current = new URLSearchParams(window.location.search);
  if (dashboardViewsEqual(parseDashboardView(current, pageContext), view)) {
    return;
  }
  const query = applyDashboardView(current, view, pageContext)
    .toString()
    .replace(/%2C/g, ",");
  const href = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", href);
}

type StoredReturn = {
  flow: "modification" | "edit";
  href: string;
};

export function isSafeDashboardReturn(tenant: string, href: string): boolean {
  if (!tenant || !href.startsWith("/") || href.startsWith("//")) return false;
  if (href.includes("\\") || href.includes("://")) return false;

  let url: URL;
  try {
    url = new URL(href, "http://localhost");
  } catch {
    return false;
  }
  if (url.origin !== "http://localhost") return false;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== tenant) return false;
  if (parts.length === 1) return true;
  return parts.length === 2 && DASHBOARD_SEGMENTS.has(parts[1]);
}

export function rememberDashboardReturn(flow: StoredReturn["flow"]): void {
  if (typeof window === "undefined") return;
  const href = `${window.location.pathname}${window.location.search}`;
  const tenant = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!isSafeDashboardReturn(tenant, href)) return;
  sessionStorage.setItem(RETURN_KEY, JSON.stringify({ flow, href }));
}

export function peekDashboardReturn(
  flow: StoredReturn["flow"],
  tenant: string,
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReturn;
    if (parsed.flow !== flow || !isSafeDashboardReturn(tenant, parsed.href)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function clearDashboardReturn(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RETURN_KEY);
}

export function staffBookingsPath(
  tenant: string,
  permission: PagePermission,
): string {
  switch (permission) {
    case PagePermission.PA:
      return `/${tenant}/pa`;
    case PagePermission.LIAISON:
      return `/${tenant}/liaison`;
    case PagePermission.SERVICES:
      return `/${tenant}/services`;
    case PagePermission.ADMIN:
    case PagePermission.SUPER_ADMIN:
      return `/${tenant}/admin`;
    default:
      return `/${tenant}/my-bookings`;
  }
}
