import { BookingStatusLabel } from "@/components/src/types";
import {
  updateCalendarEvent,
  updateCalendarEventStatus,
} from "@/lib/config/baseUrl";

/**
 * Update calendar event for decline status
 */
export async function updateCalendarForDecline(
  calendarEventId: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEventStatus(
    calendarEventId,
    BookingStatusLabel.DECLINED,
    tenant
  );
}

/**
 * Update calendar event for closed status
 */
export async function updateCalendarForClosed(
  calendarEventId: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEventStatus(
    calendarEventId,
    BookingStatusLabel.CLOSED,
    tenant
  );
}

/**
 * Update calendar event for canceled status
 */
export async function updateCalendarForCanceled(
  calendarEventId: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEventStatus(
    calendarEventId,
    BookingStatusLabel.CANCELED,
    tenant
  );
}

/**
 * Update calendar event for checked in status
 */
export async function updateCalendarForCheckedIn(
  calendarEventId: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEventStatus(
    calendarEventId,
    BookingStatusLabel.CHECKED_IN,
    tenant
  );
}

/**
 * Update calendar event for checked out status with end time
 */
export async function updateCalendarForCheckedOut(
  calendarEventId: string,
  endTime: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEvent(
    calendarEventId,
    {
      statusPrefix: BookingStatusLabel.CHECKED_OUT,
      endTime: endTime,
    },
    tenant
  );
}

/**
 * Update calendar event for no show status
 */
export async function updateCalendarForNoShow(
  calendarEventId: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEventStatus(
    calendarEventId,
    BookingStatusLabel.NO_SHOW,
    tenant
  );
}

/**
 * Update calendar event for approved status
 */
export async function updateCalendarForApproved(
  calendarEventId: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEventStatus(
    calendarEventId,
    BookingStatusLabel.APPROVED,
    tenant
  );
}

/**
 * Update calendar event for pre-approved status
 */
export async function updateCalendarForPreApproved(
  calendarEventId: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEventStatus(
    calendarEventId,
    BookingStatusLabel.PRE_APPROVED,
    tenant
  );
}
