/**
 * Common validation functions that can be used across the application
 */

/**
 * Net ID regex pattern
 * Format: 2-3 letters followed by 1-6 digits (e.g., abc123)
 */
export const NET_ID_REGEX = /^[a-zA-Z]{2,3}[0-9]{1,6}$/;

/**
 * NYU Email regex pattern
 * Format: any valid email ending with @nyu.edu (e.g., abc123@nyu.edu, john.doe@nyu.edu)
 */
export const NYU_EMAIL_REGEX = /^[^\s@]+@nyu\.edu$/i;

/**
 * NYU Net ID email regex pattern
 * Format: 2-3 letters followed by 1-6 digits, then @nyu.edu (e.g., abc123@nyu.edu)
 */
export const NET_ID_EMAIL_REGEX = /^[a-zA-Z]{2,3}[0-9]{1,6}@nyu\.edu$/i;

/**
 * ChartField regex pattern
 * Format: XXXXX-XX-XXXXX-XXXXX where X is alphanumeric (e.g., AB123-CD-EF456-GH789)
 */
export const CHARTFIELD_REGEX = /^[A-Z0-9]{5}-[A-Z0-9]{2}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;

export const CHARTFIELD_PATTERN_MESSAGE =
  "Invalid ChartField format (should be: XXXXX-XX-XXXXX-XXXXX where X is alphanumeric)";

/**
 * Validates if a string matches the NYU Net ID format
 * @param value - The string to validate
 * @returns true if the value matches Net ID format, false otherwise
 */
export const isValidNetIdFormat = (value: string): boolean => {
  return NET_ID_REGEX.test(value);
};

/**
 * Validates if a string matches the NYU email format (netid@nyu.edu)
 * @param value - The string to validate
 * @returns true if the value matches NYU email format, false otherwise
 */
export const isValidNyuEmailFormat = (value: string): boolean => {
  return NYU_EMAIL_REGEX.test(value);
};

/**
 * Validates if a string matches the NYU Net ID email format
 * @param value - The string to validate
 * @returns true if the value matches Net ID email format, false otherwise
 */
export const isValidNetIdEmailFormat = (value: string): boolean => {
  return NET_ID_EMAIL_REGEX.test(value);
};
