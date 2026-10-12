import type {
  BookingProfile,
  TenantAccess,
} from "@/components/src/client/routes/components/schemaTypes";
import { TableNames } from "@/components/src/policy";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export type TenantSchemaListItem = {
  id: string;
  tenant?: { name?: string; nameForPolicy?: string };
  access?: TenantAccess;
  bookingProfile?: BookingProfile;
};

export async function listTenantSchemaDocuments(): Promise<
  TenantSchemaListItem[]
> {
  return serverFetchAllDataFromCollection<TenantSchemaListItem>(
    TableNames.TENANT_SCHEMA,
  );
}
