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
 * For arrays: If the default array has a __defaults__ property, use that to merge
 * each item. Otherwise, use the existing array value and skip merging.
 */
function deepMergeDefaults<T extends Record<string, any>>(
  existing: Partial<T>,
  defaults: T
): T {
  const result: any = { ...defaults };

  for (const [key, value] of Object.entries(existing)) {
    if (value === undefined || value === null) {
      continue;
    }

    const defaultValue = defaults[key as keyof T];

    if (Array.isArray(value)) {
      // Check if the default array has __defaults__ property
      if (Array.isArray(defaultValue) && (defaultValue as any).__defaults__) {
        const itemDefaults = (defaultValue as any).__defaults__;

        // If existing array has items and defaults is an object, merge each item
        if (
          value.length > 0 &&
          typeof itemDefaults === "object" &&
          itemDefaults !== null
        ) {
          result[key] = value.map((item: any) => {
            if (
              typeof item === "object" &&
              item !== null &&
              !Array.isArray(item)
            ) {
              return deepMergeDefaults(item, itemDefaults);
            }
            return item;
          });
        } else {
          // Empty array or non-object items - use existing
          result[key] = value;
        }
      } else {
        // No __defaults__ on default array - use existing value, skip merging
        result[key] = value;
      }
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      // Nested object - recurse if default is also an object
      if (
        typeof defaultValue === "object" &&
        defaultValue !== null &&
        !Array.isArray(defaultValue)
      ) {
        result[key] = deepMergeDefaults(value, defaultValue as any);
      } else {
        // Default is not an object - use existing
        result[key] = value;
      }
    } else {
      // Primitive value - use existing (overrides default)
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Merge default values into an existing schema
 * Preserves existing values, only adds missing keys with defaults
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
