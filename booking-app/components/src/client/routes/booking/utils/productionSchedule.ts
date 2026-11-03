/**
 * Whether a reservation length requires a production schedule.
 * Threshold is exclusive: duration must be strictly greater than requiredAboveHours.
 */
export function isProductionScheduleRequired(
  start: Date,
  end: Date,
  requiredAboveHours: number,
): boolean {
  if (
    !Number.isFinite(requiredAboveHours) ||
    requiredAboveHours < 0 ||
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return false;
  }
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return durationHours > requiredAboveHours;
}

export function getReservationDurationHours(
  start: Date | undefined | null,
  end: Date | undefined | null,
): number | null {
  if (
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export function parseBookingInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

const DEFAULT_REQUIRED_ABOVE_HOURS = 4;

export function resolveRequiredAboveHours(
  requiredAboveHours?: number,
): number {
  return Number.isFinite(requiredAboveHours) &&
    requiredAboveHours != null &&
    requiredAboveHours >= 0
    ? requiredAboveHours
    : DEFAULT_REQUIRED_ABOVE_HOURS;
}

/** API error copy that mirrors the tenant schema threshold. */
export function getProductionScheduleRequiredErrorMessage(
  requiredAboveHours?: number,
): string {
  const hours = resolveRequiredAboveHours(requiredAboveHours);
  const unit = hours === 1 ? "hour" : "hours";
  return `A production schedule is required for reservations longer than ${hours} ${unit}.`;
}

/**
 * True when schema requires a production schedule for this reservation and
 * the submitted value is blank. Safe to call with JSON-serialized calendar info.
 */
export function isProductionScheduleMissingWhenRequired(opts: {
  enabled?: boolean;
  requiredAboveHours?: number;
  start?: unknown;
  end?: unknown;
  productionSchedule?: string | null;
}): boolean {
  if (!opts.enabled) return false;
  const requiredAboveHours = resolveRequiredAboveHours(opts.requiredAboveHours);
  const start = parseBookingInstant(opts.start);
  const end = parseBookingInstant(opts.end);
  if (!start || !end) return false;
  if (!isProductionScheduleRequired(start, end, requiredAboveHours)) {
    return false;
  }
  return !(
    typeof opts.productionSchedule === "string" &&
    opts.productionSchedule.trim().length > 0
  );
}
