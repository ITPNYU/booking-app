/**
 * Simplified XState utilities for Services functionality
 */

import { Booking } from "../types";

// Re-export existing helper functions
export { getXStateContext, getXStateValue } from "./xstateHelpers";

/**
 * XState checker class
 */
export class XStateChecker {
  private booking: Booking;
  private currentValue: string | null;
  private parsedValue: any;

  constructor(booking: Booking) {
    this.booking = booking;
    this.currentValue = this.getXStateValue();
    this.parsedValue = this.parseXStateValue();
  }

  private getXStateValue(): string | null {
    try {
      const xstateHelpers = require("./xstateHelpers");
      return xstateHelpers.getXStateValue(this.booking);
    } catch (error) {
      console.error("Error getting XState value:", error);
      return null;
    }
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

/**
 * Utility functions for Services filtering
 */
export const XStateUtils = {
  getServicesRequestBookings<T extends Booking>(bookings: T[]): T[] {
    return bookings.filter((booking) => {
      if (!booking?.xstateData) return false;
      const checker = createXStateChecker(booking);
      return checker.isInServicesRequest();
    });
  },

  debugXState(booking: Booking, label: string = "XSTATE DEBUG"): void {
    const checker = createXStateChecker(booking);

    console.log(`🔍 ${label}:`, {
      calendarEventId: booking.calendarEventId,
      hasXStateData: !!booking?.xstateData,
      currentState: checker.getCurrentStateString(),
      isInServicesRequest: checker.isInServicesRequest(),
      title: booking.title,
    });
  },
};
