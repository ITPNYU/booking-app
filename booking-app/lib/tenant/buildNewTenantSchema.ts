import {
  generateDefaultSchema,
  type SchemaContextType,
} from "@/components/src/client/routes/components/schemaTypes";

export type NewTenantIdentity = {
  tenantId: string;
  name: string;
  nameForPolicy: string;
  logo: string;
  resourceName: string;
};

/**
 * A new schema starts from the code defaults, with this tenant's identity
 * applied and no rooms. Rooms are added later from the stored resource default.
 * `JSON` serialization drops array `__defaults__`, which Firestore cannot store.
 */
export function buildNewTenantSchema(
  identity: NewTenantIdentity,
): SchemaContextType {
  const tenantId = identity.tenantId.trim();
  const schema = JSON.parse(
    JSON.stringify(generateDefaultSchema(tenantId)),
  ) as SchemaContextType;
  schema.tenantId = tenantId;
  schema.tenant = {
    ...schema.tenant,
    name: identity.name.trim(),
    nameForPolicy: identity.nameForPolicy.trim(),
    logo: identity.logo.trim(),
  };
  schema.resourceName = identity.resourceName.trim() || "Room";
  schema.resources = [];
  return schema;
}
