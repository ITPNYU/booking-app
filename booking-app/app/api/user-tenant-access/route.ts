import { TableNames } from "@/components/src/policy";
import { TenantAccess } from "@/components/src/types";
import { mapDepartmentCode } from "@/components/src/utils/tenantUtils";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

/**
 * User Tenant Access API
 *
 * Determines which tenants (ITP, Media Commons, etc.) a user has access to
 * based on their NYU Identity information and tenant programMapping.
 *
 * Usage:
 *   GET /api/user-tenant-access?netId={netId}
 *
 * Returns:
 *   - tenants: Array of tenant identifiers the user can access (e.g., ["itp", "mc"])
 *   - userInfo: Department and school information from NYU Identity API
 *   - error: Error message if the API call fails
 *
 * Access Rules:
 *   - MC access: All users who can be mapped to a department in MC's programMapping
 *   - ITP access: Only users who map to an ITP department in ITP's programMapping
 *   - Default: If Identity API fails or no mapping found, show both tenants
 */

export async function GET(request: NextRequest) {
  try {
    // Get netId from query parameter
    const { searchParams } = new URL(request.url);
    const netId = searchParams.get("netId");

    // Validate netId: only allow alphanumeric, underscore, dash, 2-32 chars
    if (!netId) {
      return NextResponse.json({ error: "NetID is required" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(netId)) {
      return NextResponse.json({ error: "Invalid NetID format" }, { status: 400 });
    }

    // Fetch tenant schemas for MC and ITP
    const [mcSchema, itpSchema] = await Promise.all([
      serverGetDocumentById(TableNames.TENANT_SCHEMA, "mc"),
      serverGetDocumentById(TableNames.TENANT_SCHEMA, "itp"),
    ]);

    if (!mcSchema || !itpSchema) {
      console.error("Failed to fetch tenant schemas");
      // If schemas are not available, show both tenants
      return NextResponse.json({
        tenants: ["mc", "itp"],
        error: "Tenant schemas not available",
      });
    }

    // Use existing NYU Identity API endpoint to fetch user information
    const baseUrl = request.nextUrl.origin;
    const identityUrl = `${baseUrl}/api/nyu/identity/${netId}`;

    const response = await fetch(identityUrl, {
      headers: {
        "x-tenant": "mc", // Set default tenant
      },
    });

    if (!response.ok) {
      console.error(`NYU Identity API call failed: ${response.status}`);
      // If Identity API fails, show both tenants
      return NextResponse.json({
        tenants: ["mc", "itp"],
        error: `NYU Identity API call failed: ${response.status}`,
      });
    }

    const userData = await response.json();
    const reportingDeptCode = userData.reporting_dept_code;

    // Determine which tenants the user has access to using programMapping
    const accessibleTenants: string[] = [];

    // Check MC access: if user can be mapped to any department in MC's programMapping
    const mcDepartment = mapDepartmentCode(
      mcSchema.programMapping,
      reportingDeptCode,
    );
    if (mcDepartment) {
      accessibleTenants.push("mc");
    }

    // Check ITP access: if user can be mapped to any department in ITP's programMapping
    const itpDepartment = mapDepartmentCode(
      itpSchema.programMapping,
      reportingDeptCode,
    );
    if (itpDepartment) {
      accessibleTenants.push("itp");
    }

    // If no mapping found, grant access to both tenants
    // This ensures users who don't have a department code can still access the system
    if (accessibleTenants.length === 0) {
      accessibleTenants.push("mc", "itp");
    }

    // Determine which programMapping to use for display
    // Prefer ITP's programMapping if user has ITP access, otherwise use MC's
    let mappedDepartment: string | undefined;
    if (itpDepartment) {
      mappedDepartment = itpDepartment;
    } else if (mcDepartment) {
      mappedDepartment = mcDepartment;
    }
    console.log("mappedDepartment", mappedDepartment);

    const result: TenantAccess = {
      tenants: accessibleTenants,
      userInfo: {
        dept_name: userData.dept_name,
        dept_code: userData.dept_code,
        reporting_dept_name: userData.reporting_dept_name,
        reporting_dept_code: userData.reporting_dept_code,
        school_name: userData.school_name,
        mapped_department: mappedDepartment,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Tenant access check error:", error);
    return NextResponse.json(
      {
        tenants: ["mc", "itp"], // Default to all tenants on error
        error: "Failed to determine tenant access",
      },
      { status: 500 },
    );
  }
}
