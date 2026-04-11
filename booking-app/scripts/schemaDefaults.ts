// @ts-nocheck
/**
 * Schema Defaults Extractor
 *
 * This module extracts default values from the type definitions
 * and provides utilities for recursive merging based on the schema structure.
 */

import type { SchemaContextType } from "../components/src/client/routes/components/SchemaProvider";
import { generateDefaultSchema as generateDefaultTenantSchema } from "../components/src/client/routes/components/SchemaProvider";

/**
 * Recursively add defaults into an existing object (ADD-ONLY).
 *
 * Guarantees:
 * - Never deletes existing keys (including nested map children)
 * - Never overwrites existing non-null/non-undefined values
 * - Only adds missing keys from the defaults template
 *
 * Arrays:
 * - If the defaults array defines an object `__defaults__`, apply add-only merge
 *   to each existing item (when item is an object). Never rewrites the array.
 * - Otherwise, leave the existing array as-is.
 */
function deepAddDefaults<T extends Record<string, any>>(
  existing: Partial<T>,
  defaults: T
): T {
  const result: any = { ...(existing as any) };

  for (const key in defaults) {
    const defaultValue = (defaults as any)[key];
    const existingValue = (existing as any)[key];

    // Missing on target: add template value
    if (existingValue === undefined || existingValue === null) {
      result[key] = defaultValue;
      continue;
    }

    // Present on target: never overwrite primitives
    if (Array.isArray(existingValue)) {
      // Apply per-item defaults only when template provides __defaults__
      if (Array.isArray(defaultValue) && (defaultValue as any).__defaults__) {
        const itemDefaults = (defaultValue as any).__defaults__;
        if (itemDefaults && typeof itemDefaults === "object") {
          result[key] = existingValue.map((item: any) => {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              return deepAddDefaults(item, itemDefaults);
            }
            return item;
          });
        } else {
          result[key] = existingValue;
        }
      } else {
        result[key] = existingValue;
      }
      continue;
    }

    if (
      existingValue &&
      typeof existingValue === "object" &&
      !Array.isArray(existingValue) &&
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      // Both are objects: add-only recurse (preserves any extra keys on target)
      result[key] = deepAddDefaults(existingValue, defaultValue);
      continue;
    }

    // Primitive (or type mismatch): preserve existing value
    result[key] = existingValue;
  }

  return result as T;
}

/**
 * Migrate resources[i].services from the old string[] format to
 * the new ResourceService[] format ({ type: string; approvers: string[] }[]).
 * Existing ResourceService entries are preserved as-is (approvers kept).
 * Mixed arrays (partially migrated) are handled gracefully.
 */
function migrateServicesFormat(schema: SchemaContextType): SchemaContextType {
  if (!Array.isArray(schema.resources)) return schema;

  const migratedResources = schema.resources.map((resource: any) => {
    if (!Array.isArray(resource.services)) return resource;

    const migratedServices = resource.services
      .map((svc: any) => {
        // Already in the new format
        if (svc && typeof svc === "object" && typeof svc.type === "string") {
          return {
            type: svc.type,
            approvers: Array.isArray(svc.approvers) ? svc.approvers : [],
          };
        }
        // Old string format — migrate to new shape with empty approvers
        if (typeof svc === "string") {
          return { type: svc, approvers: [] };
        }
        // null, undefined, number, or any other unexpected value — discard
        return null;
      })
      .filter((svc: any) => svc !== null);

    return { ...resource, services: migratedServices };
  });

  return { ...schema, resources: migratedResources };
}

/**
 * Merge default values into an existing schema
 * Preserves existing values, only adds missing keys with defaults
 * Non-destructive: preserves extra keys that don't exist in the template
 */
export function mergeSchemaDefaults(
  existingSchema: Partial<SchemaContextType>,
  tenant: string
): SchemaContextType {
  // Start with default schema
  const defaultSchema: SchemaContextType = generateDefaultTenantSchema(tenant);

  // Add-only merge:
  // - Adds missing keys with defaults
  // - Preserves all existing values and keys (even if not in template)
  const merged = deepAddDefaults(existingSchema, defaultSchema);

  // Ensure tenant is set (use existing if available, otherwise use provided)
  merged.tenant = existingSchema.tenant || tenant;

  // Migrate services from string[] to ResourceService[] if needed
  return migrateServicesFormat(merged);
}

/**
 * Generate default schema with tenant
 */
export function generateDefaultSchema(tenant: string): SchemaContextType {
  return generateDefaultTenantSchema(tenant);
}
