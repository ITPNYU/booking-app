import { describe, expect, it } from "vitest";
import {
  parseBookingUrl,
  buildBookingUrl,
  getAffiliationStep,
} from "../../components/src/client/routes/booking/utils/bookingUrlParser";

describe("bookingUrlParser", () => {
  describe("parseBookingUrl", () => {
    it("parses standard booking URL without ID", () => {
      const result = parseBookingUrl("/test-tenant/book/selectRoom");
      expect(result).toEqual({
        tenant: "test-tenant",
        flowType: "book",
        step: "selectRoom",
        id: null,
      });
    });

    it("parses edit booking URL with ID", () => {
      const result = parseBookingUrl("/test-tenant/edit/form/abc123");
      expect(result).toEqual({
        tenant: "test-tenant",
        flowType: "edit",
        step: "form",
        id: "abc123",
      });
    });

    it("parses walk-in URL", () => {
      const result = parseBookingUrl("/test-tenant/walk-in/netid");
      expect(result).toEqual({
        tenant: "test-tenant",
        flowType: "walk-in",
        step: "netid",
        id: null,
      });
    });

    it("parses URL without step", () => {
      const result = parseBookingUrl("/test-tenant/book");
      expect(result).toEqual({
        tenant: "test-tenant",
        flowType: "book",
        step: null,
        id: null,
      });
    });
  });

  describe("buildBookingUrl", () => {
    it("builds standard booking URL without ID", () => {
      const url = buildBookingUrl("test-tenant", "book", "selectRoom");
      expect(url).toBe("/test-tenant/book/selectRoom");
    });

    it("builds edit booking URL with ID", () => {
      const url = buildBookingUrl("test-tenant", "edit", "form", "abc123");
      expect(url).toBe("/test-tenant/edit/form/abc123");
    });

    it("ignores null ID", () => {
      const url = buildBookingUrl("test-tenant", "book", "form", null);
      expect(url).toBe("/test-tenant/book/form");
    });
  });

  describe("getAffiliationStep", () => {
    it("returns 'netid' for walk-in flow", () => {
      expect(getAffiliationStep("walk-in")).toBe("netid");
    });

    it("returns 'role' for other flows", () => {
      expect(getAffiliationStep("book")).toBe("role");
      expect(getAffiliationStep("edit")).toBe("role");
      expect(getAffiliationStep("vip")).toBe("role");
    });
  });
});
