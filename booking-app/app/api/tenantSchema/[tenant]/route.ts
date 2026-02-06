import { NextRequest, NextResponse } from "next/server";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";

export async function GET(
  request: NextRequest,
  { params }: { params: { tenant: string } }
) {
  try {
    const tenant = params.tenant;
    
    // Fetch the specific schema document using tenant as document ID
    const schema = await serverGetDocumentById(TableNames.TENANT_SCHEMA, tenant);
    
    if (!schema) {
      return NextResponse.json(
        { error: `Schema not found for tenant: ${tenant}` },
        { status: 404 }
      );
    }
    
    // Apply environment-based calendar ID selection
    if (schema.resources && Array.isArray(schema.resources)) {
      schema.resources = applyEnvironmentCalendarIds(schema.resources);
    }
    
    return NextResponse.json(schema);
  } catch (error) {
    console.error("Error fetching tenant schema:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant schema" },
      { status: 500 }
    );
  }
} 