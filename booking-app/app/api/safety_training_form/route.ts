import { NextRequest, NextResponse } from "next/server";
import { getFormsClient, getLoggingClient } from "@/lib/googleClient";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";

// Cache responses for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
interface CacheEntry {
  emails: string[];
  timestamp: number;
}

// Cache by tenant and resource ID
const responseCache = new Map<string, CacheEntry>();

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

    // Get tenant schema
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

    // Check if tenant has safety training form configured
    if (!schema.safetyTrainingGoogleFormId) {
      return NextResponse.json(
        { error: "Safety training form not configured for this tenant" },
        { status: 404 },
      );
    }

    // If resourceId is provided, verify it requires safety training
    if (resourceId) {
      const resource = schema.resources.find(
        (r: any) => r.roomId.toString() === resourceId && r.needsSafetyTraining,
      );
      if (!resource) {
        return NextResponse.json(
          { error: "Resource not found or does not require safety training" },
          { status: 404 },
        );
      }
    }

    const currentTime = Date.now();
    const cacheKey = `${tenant}:${resourceId || "all"}`;

    // Return cached results if they're still valid
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry && currentTime - cachedEntry.timestamp < CACHE_DURATION) {
      const res = NextResponse.json({ emails: cachedEntry.emails });
      res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.headers.set("Expires", "0");
      return res;
    }

    const formsService = await getFormsClient();
    const logger = await getLoggingClient();
    const timestamp = currentTime;

    // Fetch form responses from tenant's form
    let emails: string[] = [];
    try {
      const response = await formsService.forms.responses.list({
        formId: schema.safetyTrainingGoogleFormId,
      });

      if (response.data.responses) {
        // Extract email addresses from form responses
        emails = response.data.responses
          .map(response => {
            const answers = response.answers || {};
            // Find the email question's answer
            const emailAnswer = Object.values(answers).find(answer =>
              answer.textAnswers?.answers?.[0]?.value?.includes("@"),
            );
            return emailAnswer?.textAnswers?.answers?.[0]?.value;
          })
          .filter((email): email is string => Boolean(email));
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

    // Update cache
    responseCache.set(cacheKey, {
      emails,
      timestamp: currentTime,
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

    if (error?.message?.includes("permission_denied")) {
      return NextResponse.json(
        { error: "Permission denied. Please check API access settings" },
        { status: 403 },
      );
    }

    // Return cached results if available during error
    const cacheKey = `${tenant}:${resourceId || "all"}`;
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry) {
      console.log("Returning cached results due to API error");
      const res = NextResponse.json({
        emails: cachedEntry.emails,
        warning: "Using cached data due to API error",
      });
      res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.headers.set("Expires", "0");
      return res;
    }

    // Generic error response
    return NextResponse.json(
      { error: "Failed to fetch form responses" },
      { status: 500 },
    );
  }
}
