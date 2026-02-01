import { NextRequest, NextResponse } from "next/server";
import { getFormsClient, getLoggingClient } from "@/lib/googleClient";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { extractGoogleFormId } from "@/components/src/utils/formUrlUtils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tenant = request.headers.get("x-tenant");
  const resourceId = request.headers.get("x-resource-id");

  try {
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant header is required" },
        { status: 400 },
      );
    }

    // Get tenant schema (includes training form URL per resource and tenant-level fallback)
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant,
    );
    if (!schema) {
      return NextResponse.json(
        { error: "Tenant schema not found" },
        { status: 404 },
      );
    }

    // Resolve training form from schema: resource by resourceId, then tenant-level fallback
    let formId: string | null = null;

    if (resourceId) {
      const resource = schema.resources?.find(
        (r: any) => r.roomId?.toString() === resourceId.toString(),
      );
      if (resource?.trainingFormUrl) {
        formId = extractGoogleFormId(resource.trainingFormUrl);
      }
    }

    if (!formId && (schema as any).safetyTrainingGoogleFormId) {
      formId = extractGoogleFormId((schema as any).safetyTrainingGoogleFormId);
    }

    // If no form found, return error
    if (!formId) {
      return NextResponse.json(
        { error: "No training form configured for this resource" },
        { status: 404 },
      );
    }

    const formsService = await getFormsClient();
    const logger = await getLoggingClient();
    const timestamp = Date.now();

    // Fetch form responses from the determined form
    let emails: string[] = [];
    try {
      const response = await formsService.forms.responses.list({
        formId: formId,
      });

      if (response.data.responses) {
        // Extract email addresses from form responses
        emails = response.data.responses
          .map(response => {
            return response.respondentEmail;
          })
          .filter(
            (email): email is string => Boolean(email) && email.includes("@"),
          );
      }
    } catch (error) {
      console.error("Error fetching form responses:", error);
      throw error;
    }

    // Log the operation
    const logEntry = {
      logName: process.env.NEXT_PUBLIC_GCP_LOG_NAME + "/safety-training",
      resource: { type: "global" },
      entries: [
        {
          jsonPayload: {
            message: "Fetched emails from form responses",
            tenant,
            resourceId: resourceId || "all",
            emails,
            number: emails.length,
            branchName: process.env.NEXT_PUBLIC_BRANCH_NAME,
            timestamp,
          },
          severity: "INFO",
        },
      ],
    };

    logger.entries.write({
      requestBody: logEntry,
    });

    const res = NextResponse.json({ emails });
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.headers.set("Expires", "0");
    return res;
  } catch (error: any) {
    console.error("Failed to fetch form responses:", error);

    if (error?.message?.includes("invalid_grant")) {
      return NextResponse.json(
        { error: "Authentication failed. Please check Google API credentials" },
        { status: 401 },
      );
    }

    if (error?.message?.includes("Form not found")) {
      return NextResponse.json(
        { error: "Specified Google Form not found" },
        { status: 404 },
      );
    }

    if (
      error?.message?.includes("permission_denied") ||
      error?.message?.includes("Insufficient Permission")
    ) {
      return NextResponse.json(
        {
          error:
            "Permission denied. Please share the form with the service account",
          details:
            "The service account needs at least Viewer access to the form",
          code: 403,
        },
        { status: 403 },
      );
    }

    // Log the actual error details
    console.error("Google Forms API error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      details: error.details,
    });

    // Generic error response with more details
    return NextResponse.json(
      {
        error: "Failed to fetch form responses",
        details: error.message,
        code: error.code || "UNKNOWN",
      },
      { status: 500 },
    );
  }
}
