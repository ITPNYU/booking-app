import { NextRequest, NextResponse } from "next/server";

// Helper function to authenticate with WebCheckout API
async function authenticateWebCheckout(
  baseUrl: string,
  userid: string,
  password: string,
): Promise<{ success: boolean; sessionToken?: string; error?: any }> {
  const authResponse = await fetch(`${baseUrl}/rest/session/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Authorization: "Bearer Requested",
    },
    body: JSON.stringify({
      userid: userid,
      password: password,
    }),
  });

  if (!authResponse.ok) {
    return {
      success: false,
      error: {
        message: `WebCheckout authentication failed: ${authResponse.status}`,
        details: await authResponse.text(),
        status: 401,
      },
    };
  }

  let authData;
  try {
    authData = await authResponse.json();
  } catch (parseError) {
    console.error("WebCheckout auth response parsing error:", parseError);
    return {
      success: false,
      error: {
        message: "WebCheckout authentication failed - invalid JSON response",
        details: `Response content type: ${authResponse.headers.get("content-type")}`,
        status: 502,
      },
    };
  }

  if (authData.status !== "ok") {
    return {
      success: false,
      error: {
        message: `WebCheckout authentication failed - status: ${authData.status}`,
        status: 401,
      },
    };
  }

  const sessionToken =
    authData.sessionToken ||
    authData.sessionid ||
    authData.payload?.sessionToken;

  if (!sessionToken) {
    return {
      success: false,
      error: {
        message: "WebCheckout authentication failed - no session token",
        status: 401,
      },
    };
  }

  return { success: true, sessionToken };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cartNumber: string } },
) {
  try {
    const cartNumber = params.cartNumber;

    if (!cartNumber) {
      return NextResponse.json(
        { error: "Cart number is required" },
        { status: 400 },
      );
    }

    const userid = process.env.WEBCHECKOUT_USERNAME;
    const password = process.env.WEBCHECKOUT_PASSWORD;
    const baseUrl = process.env.WEBCHECKOUT_API_BASE_URL;

    if (!userid || !password || !baseUrl) {
      return NextResponse.json(
        { error: "WebCheckout credentials not configured" },
        { status: 500 },
      );
    }

    // Authenticate with WebCheckout API
    const authResult = await authenticateWebCheckout(baseUrl, userid, password);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error.message, details: authResult.error.details },
        { status: authResult.error.status },
      );
    }

    let sessionToken = authResult.sessionToken!;

    // Search for allocation using cart number
    const webCheckoutAPIUrl = `${baseUrl}/rest/allocation/search`;
    const requestBody = {
      query: { name: cartNumber },
      properties: ["oid", "name", "state", "pickupTime", "returnTime"],
    };

    let response = await fetch(webCheckoutAPIUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `WebCheckout API request failed: ${response.status}`,
          details: errorText,
        },
        { status: response.status },
      );
    }

    let webCheckoutResponse;
    try {
      webCheckoutResponse = await response.json();
    } catch (parseError) {
      console.error("WebCheckout search response parsing error:", parseError);
      return NextResponse.json(
        {
          error: "WebCheckout API response failed - invalid JSON response",
          details: `Response content type: ${response.headers.get("content-type")}`,
        },
        { status: 502 },
      );
    }

    // If session is invalid or expired, re-authenticate and retry
    if (webCheckoutResponse.status === "unauthenticated") {
      console.log("WebCheckout session expired, re-authenticating...");
      
      const reAuthResult = await authenticateWebCheckout(baseUrl, userid, password);
      if (!reAuthResult.success) {
        return NextResponse.json(
          { error: reAuthResult.error.message, details: reAuthResult.error.details },
          { status: reAuthResult.error.status },
        );
      }

      sessionToken = reAuthResult.sessionToken!;

      // Retry the allocation search with new session token
      response = await fetch(webCheckoutAPIUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          {
            error: `WebCheckout API request failed after re-authentication: ${response.status}`,
            details: errorText,
          },
          { status: response.status },
        );
      }

      try {
        webCheckoutResponse = await response.json();
      } catch (parseError) {
        console.error("WebCheckout search response parsing error after retry:", parseError);
        return NextResponse.json(
          {
            error: "WebCheckout API response failed - invalid JSON response",
            details: `Response content type: ${response.headers.get("content-type")}`,
          },
          { status: 502 },
        );
      }

      // If still unauthenticated after retry, return error
      if (webCheckoutResponse.status === "unauthenticated") {
        return NextResponse.json(
          { error: "WebCheckout session is invalid or expired even after re-authentication" },
          { status: 401 },
        );
      }
    }

    if (webCheckoutResponse.status !== "ok") {
      return NextResponse.json(
        {
          error:
            webCheckoutResponse.payload?.message || "WebCheckout API error",
        },
        { status: 500 },
      );
    }

    const allocations = Array.isArray(webCheckoutResponse.payload)
      ? webCheckoutResponse.payload
      : [webCheckoutResponse.payload].filter(Boolean);

    if (allocations.length === 0) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    const targetAllocation = allocations[0].result[0];
    const allocationOid = targetAllocation.oid;

    if (!allocationOid) {
      return NextResponse.json(
        { error: "Invalid allocation data - missing OID" },
        { status: 500 },
      );
    }

    // Get detailed allocation information
    const allocationGetUrl = `${baseUrl}/rest/allocation/get`;
    const allocationGetBody = {
      oid: allocationOid,
      properties: [
        "state",
        "pickupTime",
        "returnTime",
        "allocationContentsSummary",
        {
          property: "allocationItems",
          subProperties: [
            "quantity",
            "state",
            {
              property: "resource",
              subProperties: ["oid", "name", "barcode"],
            },
          ],
        },
      ],
    };

    let allocationGetResponse = await fetch(allocationGetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(allocationGetBody),
    });

    if (!allocationGetResponse.ok) {
      const errorText = await allocationGetResponse.text();
      return NextResponse.json(
        {
          error: `WebCheckout allocation/get failed: ${allocationGetResponse.status}`,
          details: errorText,
        },
        { status: allocationGetResponse.status },
      );
    }

    let allocationData;
    try {
      allocationData = await allocationGetResponse.json();
    } catch (parseError) {
      console.error(
        "WebCheckout allocation response parsing error:",
        parseError,
      );
      return NextResponse.json(
        {
          error: "WebCheckout allocation/get failed - invalid JSON response",
          details: `Response content type: ${allocationGetResponse.headers.get("content-type")}`,
        },
        { status: 502 },
      );
    }

    // If session is invalid or expired during allocation/get, re-authenticate and retry
    if (allocationData.status === "unauthenticated") {
      console.log("WebCheckout session expired during allocation/get, re-authenticating...");
      
      const reAuthResult = await authenticateWebCheckout(baseUrl, userid, password);
      if (!reAuthResult.success) {
        return NextResponse.json(
          { error: reAuthResult.error.message, details: reAuthResult.error.details },
          { status: reAuthResult.error.status },
        );
      }

      sessionToken = reAuthResult.sessionToken!;

      // Retry the allocation/get with new session token
      allocationGetResponse = await fetch(allocationGetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(allocationGetBody),
      });

      if (!allocationGetResponse.ok) {
        const errorText = await allocationGetResponse.text();
        return NextResponse.json(
          {
            error: `WebCheckout allocation/get failed after re-authentication: ${allocationGetResponse.status}`,
            details: errorText,
          },
          { status: allocationGetResponse.status },
        );
      }

      try {
        allocationData = await allocationGetResponse.json();
      } catch (parseError) {
        console.error(
          "WebCheckout allocation response parsing error after retry:",
          parseError,
        );
        return NextResponse.json(
          {
            error: "WebCheckout allocation/get failed - invalid JSON response",
            details: `Response content type: ${allocationGetResponse.headers.get("content-type")}`,
          },
          { status: 502 },
        );
      }

      // If still unauthenticated after retry, return error
      if (allocationData.status === "unauthenticated") {
        return NextResponse.json(
          { error: "WebCheckout session is invalid or expired even after re-authentication" },
          { status: 401 },
        );
      }
    }

    if (allocationData.status !== "ok") {
      return NextResponse.json(
        {
          error:
            allocationData.payload?.message ||
            "WebCheckout allocation/get error",
        },
        { status: 500 },
      );
    }

    const detailedAllocation = allocationData.payload;
    const allocationContentsSummary =
      detailedAllocation?.allocationContentsSummary;

    // Generate WebCheckout URL
    const webCheckoutUrl = `https://engineering-nyu.webcheckout.net/sso/wco?method=show-entity&type=allocation&oid=${allocationOid}`;

    // Extract equipment groups and items
    const equipmentGroups = allocationContentsSummary?.groups || [];

    // Calculate total item count
    const totalItems = equipmentGroups.reduce((total: number, group: any) => {
      return (
        total +
        group.items.reduce((groupTotal: number, item: any) => {
          return groupTotal + (item.subitems?.length || 0);
        }, 0)
      );
    }, 0);

    // Build response data
    const responseData = {
      cartNumber: detailedAllocation.name || cartNumber,
      customer: detailedAllocation.patron?.name || "Unknown",
      status: detailedAllocation.state || "Unknown",
      checkoutTime: detailedAllocation.pickupTime,
      dueTime: detailedAllocation.returnTime,
      totalItems: totalItems,
      webCheckoutUrl: webCheckoutUrl,
      equipmentGroups: equipmentGroups.map((group: any) => ({
        label: group.label,
        items: group.items.map((item: any) => ({
          name: item.label,
          subitems:
            item.subitems?.map((subitem: any) => ({
              label: subitem.label,
              due: subitem.due,
            })) || [],
        })),
      })),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("WebCheckout API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },

      { status: 500 },
    );
  }
}
