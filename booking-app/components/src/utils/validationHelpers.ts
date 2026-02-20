/**
 * Common validation functions that can be used across the application
 */

/**
 * Net ID regex pattern
 * Format: 2-3 letters followed by 1-6 digits (e.g., abc123)
 */
export const NET_ID_REGEX = /^[a-zA-Z]{2,3}[0-9]{1,6}$/;

/**
 * Validates if a string matches the NYU Net ID format
 * @param value - The string to validate
 * @returns true if the value matches Net ID format, false otherwise
 */
export const isValidNetIdFormat = (value: string): boolean => {
  return NET_ID_REGEX.test(value);
};
