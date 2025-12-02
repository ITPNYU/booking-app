import { NextRequest, NextResponse } from "next/server";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";

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
    
    // Transform resources to use environment-appropriate calendar IDs.
    // In production, use calendarProdId if available; in staging, use calendarStagingId if available.
    // This allows downstream code to simply use calendarId without environment checks.
    if (schema.resources) {
      const branchName = process.env.NEXT_PUBLIC_BRANCH_NAME;
      schema.resources = schema.resources.map((resource: any) => {
        let calendarId = resource.calendarId;
        
        // Use environment-specific calendar ID if available
        if (branchName === "production" && resource.calendarProdId) {
          calendarId = resource.calendarProdId;
        } else if (branchName === "staging" && resource.calendarStagingId) {
          calendarId = resource.calendarStagingId;
        }
        
        return {
          ...resource,
          calendarId,
        };
      });
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