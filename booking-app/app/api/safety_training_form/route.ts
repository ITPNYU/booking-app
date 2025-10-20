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

// Helper function to get form ID from URL
function getFormIdFromUrl(url: string): string | null {
  try {
    const formUrl = new URL(url);
    const pathParts = formUrl.pathname.split('/');
    const formId = pathParts[pathParts.length - 1];
    return formId || null;
  } catch (error) {
    console.error("Error parsing form URL:", error);
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tenant = request.headers.get("x-tenant");
  const resourceId = request.headers.get("x-resource-id");

  try {

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant header is required" },
        { status: 400 }
      );
    }

    // Get tenant schema
    const schema = await serverGetDocumentById(TableNames.TENANT_SCHEMA, tenant);
    if (!schema) {
      return NextResponse.json(
        { error: "Tenant schema not found" },
        { status: 404 }
      );
    }

    // Get all resources that need safety training
    const safetyResources = schema.resources.filter(
      (resource: any) => resource.needsSafetyTraining && resource.safetyTrainingFormUrl
    );

    if (resourceId) {
      // If resourceId is provided, only get responses for that specific resource
      const resource = safetyResources.find(
        (r: any) => r.roomId.toString() === resourceId
      );
      if (!resource) {
        return NextResponse.json(
          { error: "Resource not found or does not require safety training" },
          { status: 404 }
        );
      }
      safetyResources.length = 0;
      safetyResources.push(resource);
    }

    const currentTime = Date.now();
    const cacheKey = `${tenant}:${resourceId || 'all'}`;
    
    // Return cached results if they're still valid
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry && currentTime - cachedEntry.timestamp < CACHE_DURATION) {
      const res = NextResponse.json({ emails: cachedEntry.emails });
      res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      res.headers.set("Expires", "0");
      return res;
    }

    const formsService = await getFormsClient();
    const logger = await getLoggingClient();
    const timestamp = currentTime;

    // Fetch form responses for each resource
    const allEmails = new Set<string>();
    
    for (const resource of safetyResources) {
      const formId = getFormIdFromUrl(resource.safetyTrainingFormUrl);
      if (!formId) {
        console.error(`Invalid form URL for resource ${resource.roomId}: ${resource.safetyTrainingFormUrl}`);
        continue;
      }

      try {
        const response = await formsService.forms.responses.list({
          formId,
        });

        if (response.data.responses) {
          // Extract email addresses from form responses
          const resourceEmails = response.data.responses
            .map(response => {
              const answers = response.answers || {};
              // Find the email question's answer
              const emailAnswer = Object.values(answers).find(
                answer => answer.textAnswers?.answers?.[0]?.value?.includes("@")
              );
              return emailAnswer?.textAnswers?.answers?.[0]?.value;
            })
            .filter((email): email is string => Boolean(email));

          // Add emails to the set
          resourceEmails.forEach(email => allEmails.add(email));
        }
      } catch (error) {
        console.error(`Error fetching responses for resource ${resource.roomId}:`, error);
      }
    }

    const emails = Array.from(allEmails);

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
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.headers.set("Expires", "0");
    return res;
  } catch (error: any) {
    console.error("Failed to fetch form responses:", error);
    
    if (error?.message?.includes("invalid_grant")) {
      return NextResponse.json(
        { error: "Authentication failed. Please check Google API credentials" },
        { status: 401 }
      );
    }

    if (error?.message?.includes("Form not found")) {
      return NextResponse.json(
        { error: "Specified Google Form not found" },
        { status: 404 }
      );
    }

    if (error?.message?.includes("permission_denied")) {
      return NextResponse.json(
        { error: "Permission denied. Please check API access settings" },
        { status: 403 }
      );
    }

    // Return cached results if available during error
    const cacheKey = `${tenant}:${resourceId || 'all'}`;
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry) {
      console.log("Returning cached results due to API error");
      const res = NextResponse.json({ 
        emails: cachedEntry.emails,
        warning: "Using cached data due to API error"
      });
      res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      res.headers.set("Expires", "0");
      return res;
    }

    // Generic error response
    return NextResponse.json(
      { error: "Failed to fetch form responses" },
      { status: 500 }
    );
  }
}
