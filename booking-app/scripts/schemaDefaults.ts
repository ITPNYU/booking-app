// @ts-nocheck
/**
 * Schema Defaults Extractor
 *
 * This module extracts default values from the type definitions
 * and provides utilities for recursive merging based on the schema structure.
 */

import type { SchemaContextType } from "../components/src/client/routes/components/SchemaProvider";
import { defaultScheme } from "../components/src/client/routes/components/SchemaProvider";

/**
 * Recursively merge defaults into an existing object
 * Works for any nested structure based on the default schema
 * This function automatically handles all field types without hardcoding field names
 *
 * IMPORTANT: Only keys that exist in the defaults template are kept.
 * Extra keys in the existing object that don't exist in defaults are removed.
 *
 * For arrays: If the default array has a __defaults__ property, use that to merge
 * each item. Otherwise, use the existing array value and skip merging.
 */
function deepMergeDefaults<T extends Record<string, any>>(
  existing: Partial<T>,
  defaults: T
): T {
  // Start with defaults - this ensures we only keep keys from the template
  const result: any = { ...defaults };

  // Only process keys that exist in defaults (removes extra keys from existing)
  for (const key in defaults) {
    const defaultValue = defaults[key];
    const existingValue = existing[key];

    // Skip if existing value is undefined or null
    if (existingValue === undefined || existingValue === null) {
      continue; // Keep default value
    }

    if (Array.isArray(existingValue)) {
      // Check if the default array has __defaults__ property
      if (Array.isArray(defaultValue) && (defaultValue as any).__defaults__) {
        const itemDefaults = (defaultValue as any).__defaults__;

        // If existing array has items and defaults is an object, merge each item
        if (
          existingValue.length > 0 &&
          typeof itemDefaults === "object" &&
          itemDefaults !== null
        ) {
          result[key] = existingValue.map((item: any) => {
            if (
              typeof item === "object" &&
              item !== null &&
              !Array.isArray(item)
            ) {
              // Recursively merge each array item, removing extra keys
              return deepMergeDefaults(item, itemDefaults);
            }
            return item;
          });
        } else {
          // Empty array or non-object items - use existing
          result[key] = existingValue;
        }
      } else {
        // No __defaults__ on default array - use existing value, skip merging
        result[key] = existingValue;
      }
    } else if (
      typeof existingValue === "object" &&
      existingValue !== null &&
      !Array.isArray(existingValue)
    ) {
      // Nested object - recurse if default is also an object
      if (
        typeof defaultValue === "object" &&
        defaultValue !== null &&
        !Array.isArray(defaultValue)
      ) {
        // Recursively merge nested object, removing extra keys
        result[key] = deepMergeDefaults(existingValue, defaultValue as any);
      } else {
        // Default is not an object - use existing
        result[key] = existingValue;
      }
    } else {
      // Primitive value - use existing (overrides default)
      result[key] = existingValue;
    }
  }

  return result as T;
}

/**
 * Merge default values into an existing schema
 * Preserves existing values, only adds missing keys with defaults
 * Removes extra keys that don't exist in the template
 */
export function mergeSchemaDefaults(
  existingSchema: Partial<SchemaContextType>,
  tenant: string
): SchemaContextType {
  // Start with default schema
  const defaultSchema: SchemaContextType = {
    tenant,
    ...defaultScheme,
  };

  // Recursively merge existing values
  // This will:
  // - Add missing keys with defaults
  // - Preserve existing values for keys in template
  // - Remove extra keys not in template
  const merged = deepMergeDefaults(existingSchema, defaultSchema);

  // Ensure tenant is set (use existing if available, otherwise use provided)
  merged.tenant = existingSchema.tenant || tenant;

  return merged;
}

/**
 * Generate default schema with tenant
 */
export function generateDefaultSchema(tenant: string): SchemaContextType {
  return {
    tenant,
    ...defaultScheme,
  };
}
