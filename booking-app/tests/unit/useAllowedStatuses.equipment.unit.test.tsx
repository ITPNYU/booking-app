import useAllowedStatuses from "@/components/src/client/routes/components/bookingTable/hooks/useAllowedStatuses";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("useAllowedStatuses Hook - Equipment Context", () => {
  // For SERVICES page we expect the full set of displayable statuses (exclude WALK_IN)
  const expectedServiceStatuses = Object.values(BookingStatusLabel).filter(
    (status) => status !== BookingStatusLabel.WALK_IN
  );

  describe("PageContextLevel.SERVICES", () => {
    it("should return only EQUIPMENT status for equipment context", () => {
      const { result } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );

      const allowedStatuses = result.current;

      // Services now shows all displayable statuses
      expect(allowedStatuses).toEqual(expectedServiceStatuses);
    });

    it("should not include other statuses for equipment context", () => {
      const { result } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );

      const allowedStatuses = result.current;

      // Services should include all displayable statuses (excluding WALK_IN)
      expect(allowedStatuses).toEqual(expectedServiceStatuses);
      expect(allowedStatuses).toContain(BookingStatusLabel.EQUIPMENT);
      expect(allowedStatuses).not.toContain(BookingStatusLabel.WALK_IN);
    });

    it("should be consistent across multiple hook calls", () => {
      const { result: result1 } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );
      const { result: result2 } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );

      expect(result1.current).toEqual(result2.current);
    });
  });

  describe("Comparison with other contexts", () => {
    it("should return different statuses for PA context", () => {
      const { result: equipmentResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );
      const { result: paResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.PA)
      );

      expect(equipmentResult.current).not.toEqual(paResult.current);
      expect(equipmentResult.current).toEqual(expectedServiceStatuses);
      expect(paResult.current).toEqual([
        BookingStatusLabel.APPROVED,
        BookingStatusLabel.CHECKED_IN,
        BookingStatusLabel.CHECKED_OUT,
        BookingStatusLabel.NO_SHOW,
        BookingStatusLabel.CLOSED,
      ]);
    });

    it("should return different statuses for USER context", () => {
      const { result: equipmentResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.USER)
      );
      const { result: userResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.USER)
      );

      // USER context should return all displayable statuses (excluding WALK_IN)
      const expectedUserStatuses = Object.values(BookingStatusLabel).filter(
        (status) => status !== BookingStatusLabel.WALK_IN
      );

      expect(userResult.current).toEqual(expectedUserStatuses);
      expect(equipmentResult.current).toEqual(expectedUserStatuses);
    });

    it("should return different statuses for ADMIN context", () => {
      const { result: equipmentResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );
      const { result: adminResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.ADMIN)
      );

  expect(equipmentResult.current).toEqual(expectedServiceStatuses);

      // Admin should have all displayable statuses
      const expectedAdminStatuses = Object.values(BookingStatusLabel).filter(
        (status) => status !== BookingStatusLabel.WALK_IN
      );
      expect(adminResult.current).toEqual(expectedAdminStatuses);
    });

    it("should return different statuses for LIAISON context", () => {
      const { result: equipmentResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );
      const { result: liaisonResult } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.LIAISON)
      );

  expect(equipmentResult.current).toEqual(expectedServiceStatuses);

      // Liaison should have all displayable statuses
      const expectedLiaisonStatuses = Object.values(BookingStatusLabel).filter(
        (status) => status !== BookingStatusLabel.WALK_IN
      );
      expect(liaisonResult.current).toEqual(expectedLiaisonStatuses);
    });
  });

  describe("Hook behavior", () => {
    it("should memoize the result", () => {
      const { result, rerender } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );

      const firstResult = result.current;

      // Re-render with same context
      rerender();

      const secondResult = result.current;

      // Should be the same reference due to memoization
      expect(firstResult).toBe(secondResult);
    });

    it("should update when context changes", () => {
      let pageContext = PageContextLevel.SERVICES;
      const { result, rerender } = renderHook(() =>
        useAllowedStatuses(pageContext)
      );

      const equipmentResult = result.current;
      expect(equipmentResult).toEqual(expectedServiceStatuses);

      // Change context to PA
      pageContext = PageContextLevel.PA;
      rerender();

      const paResult = result.current;
      expect(paResult).not.toEqual(equipmentResult);
      expect(paResult).toEqual([
        BookingStatusLabel.APPROVED,
        BookingStatusLabel.CHECKED_IN,
        BookingStatusLabel.CHECKED_OUT,
        BookingStatusLabel.NO_SHOW,
        BookingStatusLabel.CLOSED,
      ]);
    });
  });

  describe("Edge cases", () => {
    it("should handle numeric enum values correctly", () => {
      // PageContextLevel.SERVICES is now the correct enum value
      const { result } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );

      expect(result.current).toEqual(expectedServiceStatuses);
    });

    it("should return equipment statuses regardless of case sensitivity", () => {
      const { result } = renderHook(() =>
        useAllowedStatuses(PageContextLevel.SERVICES)
      );

      const allowedStatuses = result.current;
      expect(allowedStatuses).toContain(BookingStatusLabel.EQUIPMENT);
      expect(BookingStatusLabel.EQUIPMENT).toBe("EQUIPMENT");
    });
  });
});
