/**
 * XState query utilities — read-only helpers for inspecting XState data on bookings.
 *
 * Consolidated from xstateHelpers.ts + xstateUnified.ts.
 */

import type { Booking } from "../types";

// Minimal interface for functions that don't need a full Booking
interface XStateBookingLike {
  calendarEventId?: string;
  xstateData?: {
    snapshot?: {
      value?: any;
      context?: any;
    };
    currentState?: any;
    value?: any;
    context?: any;
  };
}

/**
 * Extracts the current XState value from booking data.
 * Handles different XState data formats (v4 vs v5, snapshot vs legacy).
 */
export function getXStateValue(booking: XStateBookingLike): string | null {
  if (!booking?.xstateData) {
    return null;
  }

  const { xstateData } = booking;

  // Priority: snapshot.value (v5) -> currentState (legacy) -> value (direct)
  if (xstateData.snapshot?.value) {
    const { value } = xstateData.snapshot;
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  if (xstateData.currentState) {
    return typeof xstateData.currentState === "string"
      ? xstateData.currentState
      : JSON.stringify(xstateData.currentState);
  }

  if (xstateData.value) {
    return typeof xstateData.value === "string"
      ? xstateData.value
      : JSON.stringify(xstateData.value);
  }

  return null;
}

/**
 * Checks if a booking has a specific XState value.
 */
export function hasXStateValue(
  booking: XStateBookingLike,
  targetValue: string,
): boolean {
  const currentValue = getXStateValue(booking);
  return currentValue === targetValue;
}

/**
 * Gets XState context from booking data.
 */
export function getXStateContext(
  booking: XStateBookingLike,
): Record<string, any> | null {
  if (!booking?.xstateData) {
    return null;
  }

  const { xstateData } = booking;

  if (xstateData.snapshot?.context) {
    return xstateData.snapshot.context;
  }

  if (xstateData.context) {
    return xstateData.context;
  }

  return null;
}

/**
 * XState checker class for Services functionality.
 */
export class XStateChecker {
  private currentValue: string | null;
  private parsedValue: any;

  constructor(booking: Booking) {
    this.currentValue = getXStateValue(booking);
    this.parsedValue = this.parseXStateValue();
  }

  private parseXStateValue(): any {
    if (!this.currentValue) return null;

    try {
      return this.currentValue.startsWith("{")
        ? JSON.parse(this.currentValue)
        : this.currentValue;
    } catch {
      return this.currentValue;
    }
  }

  isInServicesRequest(): boolean {
    if (!this.parsedValue) return false;

    if (typeof this.parsedValue === "object" && this.parsedValue) {
      return !!(
        this.parsedValue["Services Request"] ||
        this.parsedValue["Service Request"] ||
        this.parsedValue["Service Requested"]
      );
    }

    if (typeof this.parsedValue === "string") {
      return (
        this.parsedValue.includes("Services Request") ||
        this.parsedValue.includes("Service Request") ||
        this.parsedValue.includes("Service Requested") ||
        this.parsedValue === "Services Request" ||
        this.parsedValue === "Service Request" ||
        this.parsedValue === "Service Requested"
      );
    }

    return false;
  }

  getCurrentStateString(): string {
    if (!this.currentValue) return "Unknown";

    if (typeof this.parsedValue === "string") {
      return this.parsedValue;
    }

    if (typeof this.parsedValue === "object" && this.parsedValue) {
      const keys = Object.keys(this.parsedValue);
      return keys.length > 0 ? keys.join(", ") : "Unknown";
    }

    return "Unknown";
  }
}

export function createXStateChecker(booking: Booking): XStateChecker {
  return new XStateChecker(booking);
}
