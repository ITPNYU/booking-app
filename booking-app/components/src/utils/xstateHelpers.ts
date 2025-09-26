/**
 * Utility functions for working with XState data across the application
 */

import { Booking } from "../types";

/**
 * Extracts the current XState value from booking data
 * Handles different XState data formats (v4 vs v5, snapshot vs legacy)
 */
export function getXStateValue(booking: Booking): string | null {
  if (!booking?.xstateData) {
    return null;
  }

  const { xstateData } = booking;

  // Try different possible locations for the current state
  // Priority order: snapshot.value (v5) -> currentState (legacy) -> value (direct)
  if (xstateData.snapshot?.value) {
    const value = xstateData.snapshot.value;
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
 * Checks if a booking has a specific XState value
 */
export function hasXStateValue(booking: Booking, targetValue: string): boolean {
  const currentValue = getXStateValue(booking);
  return currentValue === targetValue;
}

/**
 * Checks if a booking is in any of the specified XState values
 */
export function hasAnyXStateValue(
  booking: Booking,
  targetValues: string[]
): boolean {
  const currentValue = getXStateValue(booking);
  return currentValue ? targetValues.includes(currentValue) : false;
}

/**
 * Gets XState context from booking data
 */
export function getXStateContext(booking: Booking): Record<string, any> | null {
  if (!booking?.xstateData) {
    return null;
  }

  const { xstateData } = booking;

  // Try different possible locations for the context
  if (xstateData.snapshot?.context) {
    return xstateData.snapshot.context;
  }

  if (xstateData.context) {
    return xstateData.context;
  }

  return null;
}

/**
 * Debug helper to log XState information
 */
export function logXStateDebug(
  booking: Booking,
  label: string = "XSTATE DEBUG"
): void {
  const currentValue = getXStateValue(booking);
  const context = getXStateContext(booking);

  console.log(`🔍 ${label}:`, {
    calendarEventId: booking.calendarEventId,
    currentValue,
    hasXStateData: !!booking.xstateData,
    xstateDataKeys: booking.xstateData ? Object.keys(booking.xstateData) : [],
    contextKeys: context ? Object.keys(context) : [],
    rawXStateData: booking.xstateData,
  });
}
