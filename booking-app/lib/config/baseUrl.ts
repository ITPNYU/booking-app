/**
 * Get the base URL for API calls with proper validation
 * Throws an error if NEXT_PUBLIC_BASE_URL is not defined in production
 */
export function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // In test environment, allow localhost fallback
  if (process.env.NODE_ENV === "test") {
    return baseUrl || "http://localhost:3000";
  }

  // In production/staging, require the environment variable to be set
  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_BASE_URL environment variable is required but not defined. " +
        "Please set this variable in your deployment configuration."
    );
  }

  return baseUrl;
}

/**
 * Get the full API URL for a given endpoint
 * @param endpoint - The API endpoint (e.g., '/api/calendarEvents')
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Update calendar event via API
 * @param calendarEventId - The calendar event ID
 * @param newValues - Values to update (e.g., { statusPrefix: 'APPROVED' })
 * @param tenant - The tenant (defaults to 'mc')
 */
export async function updateCalendarEvent(
  calendarEventId: string,
  newValues: Record<string, any>,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(getApiUrl("/api/calendarEvents"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || "mc",
      },
      body: JSON.stringify({
        calendarEventId,
        newValues,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "MC"}]:`,
        {
          calendarEventId,
          status: response.status,
          error: errorText,
        }
      );
      return { success: false, error: errorText };
    }

    console.log(
      `📅 CALENDAR UPDATED [${tenant?.toUpperCase() || "MC"}]:`,
      {
        calendarEventId,
        newValues,
      }
    );
    return { success: true };
  } catch (error) {
    console.error(
      `❌ CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "MC"}]:`,
      {
        calendarEventId,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update calendar event status (convenience function)
 * @param calendarEventId - The calendar event ID
 * @param statusPrefix - The status to set (e.g., 'APPROVED', 'DECLINED')
 * @param tenant - The tenant (defaults to 'mc')
 */
export async function updateCalendarEventStatus(
  calendarEventId: string,
  statusPrefix: string,
  tenant?: string
): Promise<{ success: boolean; error?: string }> {
  return updateCalendarEvent(calendarEventId, { statusPrefix }, tenant);
}
