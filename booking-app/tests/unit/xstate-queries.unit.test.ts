import {
  getXStateValue,
  hasXStateValue,
  getXStateContext,
  XStateChecker,
  createXStateChecker,
} from "@/components/src/utils/xstateQueries";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// getXStateValue
// ---------------------------------------------------------------------------
describe("getXStateValue", () => {
  it("returns null when booking has no xstateData", () => {
    expect(getXStateValue({})).toBeNull();
    expect(getXStateValue({ xstateData: undefined })).toBeNull();
  });

  it("reads v5 snapshot.value (string)", () => {
    const booking = { xstateData: { snapshot: { value: "Approved" } } };
    expect(getXStateValue(booking)).toBe("Approved");
  });

  it("stringifies v5 snapshot.value (object — parallel states)", () => {
    const booking = {
      xstateData: {
        snapshot: {
          value: { "Services Request": { "Staff Request": "Staff Requested" } },
        },
      },
    };
    const result = getXStateValue(booking);
    expect(result).toBe(
      JSON.stringify({
        "Services Request": { "Staff Request": "Staff Requested" },
      }),
    );
  });

  it("falls back to currentState (legacy v4)", () => {
    const booking = { xstateData: { currentState: "Pre-approved" } };
    expect(getXStateValue(booking)).toBe("Pre-approved");
  });

  it("falls back to value (direct)", () => {
    const booking = { xstateData: { value: "Requested" } };
    expect(getXStateValue(booking)).toBe("Requested");
  });

  it("prefers snapshot.value over currentState and value", () => {
    const booking = {
      xstateData: {
        snapshot: { value: "Approved" },
        currentState: "Requested",
        value: "Declined",
      },
    };
    expect(getXStateValue(booking)).toBe("Approved");
  });
});

// ---------------------------------------------------------------------------
// hasXStateValue
// ---------------------------------------------------------------------------
describe("hasXStateValue", () => {
  it("returns true when value matches", () => {
    const booking = { xstateData: { snapshot: { value: "Approved" } } };
    expect(hasXStateValue(booking, "Approved")).toBe(true);
  });

  it("returns false when value does not match", () => {
    const booking = { xstateData: { snapshot: { value: "Approved" } } };
    expect(hasXStateValue(booking, "Declined")).toBe(false);
  });

  it("returns false when no xstateData", () => {
    expect(hasXStateValue({}, "Approved")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getXStateContext
// ---------------------------------------------------------------------------
describe("getXStateContext", () => {
  it("returns null when booking has no xstateData", () => {
    expect(getXStateContext({})).toBeNull();
  });

  it("reads context from snapshot.context", () => {
    const ctx = { tenant: "itp", email: "test@nyu.edu" };
    const booking = { xstateData: { snapshot: { context: ctx } } };
    expect(getXStateContext(booking)).toEqual(ctx);
  });

  it("falls back to xstateData.context", () => {
    const ctx = { tenant: "mc" };
    const booking = { xstateData: { context: ctx } };
    expect(getXStateContext(booking)).toEqual(ctx);
  });

  it("prefers snapshot.context over xstateData.context", () => {
    const booking = {
      xstateData: {
        snapshot: { context: { tenant: "itp" } },
        context: { tenant: "mc" },
      },
    };
    expect(getXStateContext(booking)).toEqual({ tenant: "itp" });
  });
});

// ---------------------------------------------------------------------------
// XStateChecker / createXStateChecker
// ---------------------------------------------------------------------------
describe("XStateChecker", () => {
  const makeBooking = (value: any) =>
    ({ xstateData: { snapshot: { value } } }) as any;

  it("detects Services Request from object value", () => {
    const booking = makeBooking({
      "Services Request": { "Staff Request": "Staff Requested" },
    });
    const checker = createXStateChecker(booking);
    expect(checker.isInServicesRequest()).toBe(true);
  });

  it("detects Services Request from string value", () => {
    const booking = makeBooking("Services Request");
    // getXStateValue returns "Services Request" as string
    const checker = new XStateChecker({
      xstateData: { snapshot: { value: "Services Request" } },
    } as any);
    expect(checker.isInServicesRequest()).toBe(true);
  });

  it("returns false for non-services states", () => {
    const checker = createXStateChecker(makeBooking("Approved"));
    expect(checker.isInServicesRequest()).toBe(false);
  });

  it("returns false when no xstateData", () => {
    const checker = createXStateChecker({} as any);
    expect(checker.isInServicesRequest()).toBe(false);
  });

  it("getCurrentStateString returns state name", () => {
    const checker = createXStateChecker(makeBooking("Approved"));
    expect(checker.getCurrentStateString()).toBe("Approved");
  });

  it("getCurrentStateString returns keys for object value", () => {
    const checker = createXStateChecker(
      makeBooking({
        "Services Request": {},
        "Service Closeout": {},
      }),
    );
    expect(checker.getCurrentStateString()).toBe(
      "Services Request, Service Closeout",
    );
  });

  it("getCurrentStateString returns Unknown when no data", () => {
    const checker = createXStateChecker({} as any);
    expect(checker.getCurrentStateString()).toBe("Unknown");
  });
});
