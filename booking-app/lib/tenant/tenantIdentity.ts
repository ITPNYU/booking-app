import type {
  BookingProfile,
  SchemaContextType,
  TenantAccess,
} from "@/components/src/client/routes/components/schemaTypes";

export type TenantIdentityInput = {
  tenantId: string;
  name: string;
  nameForPolicy: string;
  logo: string;
  resourceName: string;
  bookingProfile: BookingProfile;
  access: TenantAccess;
};

/** Copy a template schema and overwrite the fields that differ per tenant. */
export function applyTenantIdentity(
  template: SchemaContextType,
  identity: TenantIdentityInput,
): SchemaContextType {
  return {
    ...template,
    tenantId: identity.tenantId,
    tenant: {
      ...template.tenant,
      name: identity.name,
      nameForPolicy: identity.nameForPolicy,
      logo: identity.logo,
    },
    resourceName: identity.resourceName,
    bookingProfile: identity.bookingProfile,
    access: {
      allNyu: identity.access.allNyu,
      deptCodes: identity.access.deptCodes ?? [],
    },
  };
}

export function identityFieldError(
  schema: Record<string, unknown>,
): string | null {
  const profile = schema.bookingProfile;
  if (profile !== undefined && profile !== "itp" && profile !== "mc") {
    return "bookingProfile must be itp or mc";
  }

  if (schema.access === undefined) return null;
  const access = schema.access;
  if (!access || typeof access !== "object" || Array.isArray(access)) {
    return "access must be an object";
  }
  const record = access as Record<string, unknown>;
  if (typeof record.allNyu !== "boolean") {
    return "access.allNyu must be a boolean";
  }
  if (
    record.deptCodes !== undefined &&
    (!Array.isArray(record.deptCodes) ||
      record.deptCodes.some((code) => typeof code !== "string"))
  ) {
    return "access.deptCodes must be an array of strings";
  }
  return null;
}
