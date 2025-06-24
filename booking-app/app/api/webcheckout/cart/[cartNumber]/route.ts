import { NextRequest, NextResponse } from "next/server";

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

    // サーバーサイドでWebCheckout認証を処理
    const userid = process.env.WEBCHECKOUT_USERNAME;
    const password = process.env.WEBCHECKOUT_PASSWORD;
    const baseUrl = process.env.WEBCHECKOUT_API_BASE_URL;

    console.log("WebCheckout Environment Variables Check:");
    console.log("- WEBCHECKOUT_USERNAME:", userid ? "SET" : "NOT SET");
    console.log("- WEBCHECKOUT_PASSWORD:", password ? "SET" : "NOT SET");
    console.log("- WEBCHECKOUT_API_BASE_URL:", baseUrl ? baseUrl : "NOT SET");

    if (!userid || !password || !baseUrl) {
      console.error("WebCheckout credentials not configured properly");
      return NextResponse.json(
        { error: "WebCheckout credentials not configured" },
        { status: 500 },
      );
    }

    // WebCheckout認証
    console.log(
      `Attempting WebCheckout authentication to: ${baseUrl}/rest/session/start`,
    );

    // WebCheckout API v2.0では "Bearer Requested" ヘッダーが必要
    const authRequestBody = {
      userid: userid,
      password: password,
    };

    console.log("Auth request body:", JSON.stringify(authRequestBody, null, 2));

    const authResponse = await fetch(`${baseUrl}/rest/session/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Authorization: "Bearer Requested",
      },
      body: JSON.stringify(authRequestBody),
    });

    console.log(`WebCheckout auth response status: ${authResponse.status}`);
    console.log(
      `WebCheckout auth response headers:`,
      Object.fromEntries(authResponse.headers.entries()),
    );

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error(
        `WebCheckout authentication failed: ${authResponse.status} - ${errorText}`,
      );
      return NextResponse.json(
        { error: `WebCheckout authentication failed: ${authResponse.status}` },
        { status: 401 },
      );
    }

    const authData = await authResponse.json();
    console.log(
      `WebCheckout auth response:`,
      JSON.stringify(authData, null, 2),
    );

    // WebCheckout APIのレスポンス構造を確認
    console.log("Auth response keys:", Object.keys(authData));
    console.log("Auth status:", authData.status);
    console.log("Session token:", authData.sessionToken);
    console.log("Session ID:", authData.sessionid);
    console.log("Payload:", authData.payload);

    if (authData.status !== "ok") {
      console.error(
        "WebCheckout authentication failed - status not ok:",
        authData.status,
      );
      console.error("Auth payload:", authData.payload);

      // 開発環境では認証をスキップしてモックレスポンスを返す
      if (process.env.NODE_ENV === "development") {
        console.log("Development mode: returning mock WebCheckout data");
        const mockOid = cartNumber.replace(/^CK-?/, "") || "123456";
        return NextResponse.json({
          cartNumber: cartNumber,
          allocationId: mockOid,
          customer: {
            name: "Mock User",
            email: "mock@example.com",
            netId: "mockuser",
          },
          items: [
            {
              id: "1",
              name: "Mock Equipment",
              description: "Mock equipment for testing",
              quantity: 1,
              status: "checked_out",
              serialNumber: "MOCK001",
              resourceType: "Equipment",
            },
          ],
          totalItems: 1,
          checkoutDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "active",
          notes: "Mock data for development",
          webCheckoutUrl: `https://engineering-nyu.webcheckout.net/sso/wco/wco?method=show-entity&type=allocation&oid=${mockOid}`,
        });
      }

      return NextResponse.json(
        {
          error: `WebCheckout authentication failed - status: ${authData.status}`,
        },
        { status: 401 },
      );
    }

    // sessionTokenまたはsessionidを取得
    const sessionToken = authData.sessionToken || authData.sessionid;

    if (!sessionToken) {
      console.error("No session token found in response:", authData);
      return NextResponse.json(
        { error: "WebCheckout authentication failed - no session token" },
        { status: 401 },
      );
    }

    console.log("Using session token:", sessionToken);

    // セッションスコープを設定（必要に応じて）
    const organizationOid = process.env.WEBCHECKOUT_ORGANIZATION_OID;
    const checkoutCenterOid = process.env.WEBCHECKOUT_CHECKOUT_CENTER_OID;

    if (organizationOid || checkoutCenterOid) {
      const scopeBody: any = {};
      if (organizationOid) {
        scopeBody.organization = {
          _class: "organization",
          oid: parseInt(organizationOid),
        };
      }
      if (checkoutCenterOid) {
        scopeBody.checkoutCenter = {
          _class: "checkoutCenter",
          oid: parseInt(checkoutCenterOid),
        };
      }

      await fetch(`${baseUrl}/rest/session/setSessionScope`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(scopeBody),
      });
    }

    // カート情報を取得
    const webCheckoutAPIUrl = `${baseUrl}/rest/allocation/search`;

    const requestBody = {
      terms: [
        {
          term: "identity",
          value: cartNumber,
        },
      ],
      maxResults: 1,
    };

    const response = await fetch(webCheckoutAPIUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `WebCheckout API request failed: ${response.status}` },
        { status: response.status },
      );
    }

    const webCheckoutResponse = await response.json();

    if (webCheckoutResponse.status === "unauthenticated") {
      return NextResponse.json(
        { error: "WebCheckout session is invalid or expired" },
        { status: 401 },
      );
    }

    if (webCheckoutResponse.status !== "ok") {
      if (
        webCheckoutResponse.payload &&
        typeof webCheckoutResponse.payload === "object"
      ) {
        return NextResponse.json(
          {
            error:
              webCheckoutResponse.payload?.message || "WebCheckout API error",
            details: webCheckoutResponse.payload,
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: `WebCheckout API status: ${webCheckoutResponse.status}` },
        { status: 400 },
      );
    }

    // レスポンスからallocation情報を取得
    const allocations = webCheckoutResponse.payload?.results || [];

    if (allocations.length === 0) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    const allocationData = allocations[0];

    // WebCheckoutのallocation情報から必要なデータを抽出
    const formattedItems =
      allocationData.allocationItems?.map((item: any) => ({
        id: item.id || item.oid?.toString(),
        name: item.resourceName || item.name || "Unknown Item",
        description: item.description || "",
        quantity: item.quantity || 1,
        status: item.status || "unknown",
        serialNumber: item.serialNumber || item.barcode,
        resourceType: item.resourceType?.name || item.resourceTypeName,
        checkoutDate: item.pickupTime || allocationData.pickupTime,
        dueDate: item.returnTime || allocationData.returnTime,
        condition: item.condition,
      })) || [];

    const customerInfo = allocationData.patron
      ? {
          name: allocationData.patron.name,
          email: allocationData.patron.email,
          netId: allocationData.patron.userid,
        }
      : null;

    const allocationOid = allocationData.oid?.toString() || allocationData.id;

    return NextResponse.json({
      cartNumber: cartNumber,
      allocationId: allocationOid,
      customer: customerInfo,
      items: formattedItems,
      totalItems: formattedItems.length,
      checkoutDate: allocationData.pickupTime,
      dueDate: allocationData.returnTime,
      status: allocationData.state || allocationData.status,
      notes: allocationData.note || allocationData.notes,
      // WebCheckoutへの正しい直接リンク
      webCheckoutUrl: `https://engineering-nyu.webcheckout.net/sso/wco/wco?method=show-entity&type=allocation&oid=${allocationOid}`,
    });
  } catch (error) {
    console.error("WebCheckout API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
