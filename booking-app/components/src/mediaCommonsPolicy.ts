/** ACTIVE master Google Sheet  */

export const MEDIA_COMMONS_EMAIL = "mediacommons.reservations@nyu.edu";
export const MEDIA_COMMONS_OPERATION_EMAIL = "mediacommons.operations@nyu.edu";

export const STORAGE_KEY_BOOKING = "mediaCommonsDevBooking";

/********** ROOMS ************/

export const SAFETY_TRAINING_REQUIRED_ROOM = [
  103, 220, 221, 222, 223, 224, 230,
];

export const INSTANT_APPROVAL_ROOMS = [221, 222, 223, 224, 233];

export const CHECKOUT_EQUIPMENT_ROOMS = [
  103, 220, 221, 222, 223, 224, 230, 233, 260,
];

export const CAMPUS_MEDIA_SERVICES_ROOMS = [202, 1201];
export const LIGHTING_DMX_ROOMS = [220, 221, 222, 223, 224];
export const MOCAP_ROOMS = [221, 222];

export const WALK_IN_ROOMS = [103, 220, 221, 222, 223, 224, 230, 233];
export const WALK_IN_CAN_BOOK_TWO = [221, 222, 223, 224];

// Base room categories for blackout periods
export const EVENT_ONLY_ROOMS = [1201, 202];
export const MULTI_ROOMS = [233, 103, 260]; // Both Production and Event

// Production-only rooms (not including multi-use rooms)
export const PRODUCTION_ONLY_ROOMS = SAFETY_TRAINING_REQUIRED_ROOM.filter(
  (id) => !MULTI_ROOMS.includes(id)
);

// Derived categories for blackout period selection
export const PRODUCTION_ROOMS = [...PRODUCTION_ONLY_ROOMS, ...MULTI_ROOMS];
export const EVENT_ROOMS = [...EVENT_ONLY_ROOMS, ...MULTI_ROOMS];
