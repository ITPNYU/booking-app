/**
 * Auto-approval utility functions
 * 
 * This module handles the logic for determining if a booking can be auto-approved
 * based on the new autoApproval configuration in tenant schemas.
 */

import { RoomSetting } from "@/components/src/types";

export interface AutoApprovalContext {
  selectedRooms: RoomSetting[];
  role?: string;
  isWalkIn?: boolean;
  isVip?: boolean;
  durationHours?: number;
  servicesRequested?: {
    setup?: boolean;
    equipment?: boolean;
    staffing?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
  };
}

export interface AutoApprovalResult {
  canAutoApprove: boolean;
  reason?: string;
  details?: Record<string, any>;
}

/**
 * Normalizes role names to standard format
 */
function normalizeRole(role?: string): "admin" | "faculty" | "student" {
  if (!role) return "student";
  
  const lowerRole = role.toLowerCase();
  
  if (lowerRole.includes("admin") || lowerRole.includes("staff") || lowerRole.includes("chair") || lowerRole.includes("director")) {
    return "admin";
  }
  
  if (lowerRole.includes("faculty") || lowerRole.includes("fellow") || lowerRole.includes("resident")) {
    return "faculty";
  }
  
  return "student";
}

/**
 * Checks if a room has auto-approval enabled
 */
export function isRoomAutoApprovalEnabled(room: RoomSetting): boolean {
  // If autoApproval exists but is null or empty object, treat as disabled
  return room.autoApproval !== undefined && 
         room.autoApproval !== null && 
         Object.keys(room.autoApproval || {}).length > 0;
}

/**
 * Gets the min/max hour limits for a role from the room configuration
 */
function getHourLimits(
  room: RoomSetting,
  normalizedRole: "admin" | "faculty" | "student"
): { minHours: number; maxHours: number } {
  const minHours = room.autoApproval?.minHour?.[normalizedRole] ?? -1;
  const maxHours = room.autoApproval?.maxHour?.[normalizedRole] ?? -1;
  return { minHours, maxHours };
}

/**
 * Gets the combined hour limits from all selected rooms (uses most restrictive)
 */
export function getCombinedHourLimits(
  selectedRooms: RoomSetting[],
  role?: string
): { minHours: number; maxHours: number } {
  const normalizedRole = normalizeRole(role);
  
  let minHours = -1;
  let maxHours = -1;
  
  for (const room of selectedRooms) {
    const roomLimits = getHourLimits(room, normalizedRole);
    
    // For minimum: take the highest minimum (most restrictive)
    if (roomLimits.minHours > 0) {
      minHours = minHours < 0 ? roomLimits.minHours : Math.max(minHours, roomLimits.minHours);
    }
    
    // For maximum: take the lowest maximum (most restrictive)
    if (roomLimits.maxHours > 0) {
      maxHours = maxHours < 0 ? roomLimits.maxHours : Math.min(maxHours, roomLimits.maxHours);
    }
  }
  
  return { minHours, maxHours };
}

/**
 * Checks if a specific service is allowed for auto-approval based on room conditions
 */
function isServiceAllowedForAutoApproval(
  room: RoomSetting,
  service: keyof NonNullable<NonNullable<RoomSetting["autoApproval"]>["conditions"]>
): boolean {
  return room.autoApproval?.conditions?.[service] === true;
}

/**
 * Checks if all selected rooms allow a specific service for auto-approval
 */
function areServicesAllowedForAutoApproval(
  selectedRooms: RoomSetting[],
  servicesRequested?: {
    setup?: boolean;
    equipment?: boolean;
    staffing?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
  }
): { allowed: boolean; reason?: string } {
  if (!servicesRequested) {
    return { allowed: true };
  }
  
  const requestedServiceKeys = Object.keys(servicesRequested).filter(
    (key) => servicesRequested[key as keyof typeof servicesRequested]
  ) as Array<keyof NonNullable<NonNullable<RoomSetting["autoApproval"]>["conditions"]>>;
  
  if (requestedServiceKeys.length === 0) {
    return { allowed: true };
  }
  
  // Check each requested service
  for (const serviceKey of requestedServiceKeys) {
    // All rooms must allow this service for auto-approval
    const allRoomsAllowService = selectedRooms.every((room) => 
      isServiceAllowedForAutoApproval(room, serviceKey)
    );
    
    if (!allRoomsAllowService) {
      return {
        allowed: false,
        reason: `Service '${serviceKey}' is not allowed for auto-approval in one or more selected rooms`
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Main function to check if a booking can be auto-approved
 */
export function checkAutoApprovalEligibility(
  context: AutoApprovalContext
): AutoApprovalResult {
  const {
    selectedRooms,
    role,
    isWalkIn,
    isVip,
    durationHours,
    servicesRequested
  } = context;
  
  // VIP and Walk-in bookings have special auto-approval rules (always approved)
  if (isVip || isWalkIn) {
    return {
      canAutoApprove: true,
      reason: isVip ? "VIP booking" : "Walk-in booking"
    };
  }
  
  // Check if there are any rooms selected
  if (!selectedRooms || selectedRooms.length === 0) {
    return {
      canAutoApprove: false,
      reason: "No rooms selected"
    };
  }
  
  // Check if all rooms have auto-approval enabled
  const allRoomsEnabled = selectedRooms.every(isRoomAutoApprovalEnabled);
  if (!allRoomsEnabled) {
    return {
      canAutoApprove: false,
      reason: "One or more selected rooms do not have auto-approval enabled"
    };
  }
  
  // Check duration limits if provided
  if (durationHours !== undefined) {
    const { minHours, maxHours } = getCombinedHourLimits(selectedRooms, role);
    
    if (minHours > 0 && durationHours < minHours) {
      return {
        canAutoApprove: false,
        reason: `Booking duration (${durationHours.toFixed(1)}h) is below minimum (${minHours}h) for ${role || "student"}`,
        details: { minHours, maxHours, durationHours }
      };
    }
    
    if (maxHours > 0 && durationHours > maxHours) {
      return {
        canAutoApprove: false,
        reason: `Booking duration (${durationHours.toFixed(1)}h) exceeds maximum (${maxHours}h) for ${role || "student"}`,
        details: { minHours, maxHours, durationHours }
      };
    }
  }
  
  // Check service conditions
  const servicesCheck = areServicesAllowedForAutoApproval(selectedRooms, servicesRequested);
  if (!servicesCheck.allowed) {
    return {
      canAutoApprove: false,
      reason: servicesCheck.reason || "Requested services require manual approval"
    };
  }
  
  // All checks passed
  return {
    canAutoApprove: true,
    reason: "All auto-approval conditions met"
  };
}

