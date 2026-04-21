import { getNYUToken, NYU_API_BASE } from "@/lib/server/nyuApiAuth";
import { selectIdentityRecord } from "@/lib/utils/identityRecord";

/** Public API access ID — not a secret, safe to hardcode. */
const NYU_API_ACCESS_ID = "20201957";

/**
 * Fetch identity data for a given uniqueId from the NYU Identity API.
 * Returns the selected identity record, or null on failure.
 */
export async function fetchNYUIdentity(
  uniqueId: string,
): Promise<Record<string, unknown> | null> {
  const token = await getNYUToken();
  if (!token) {
    console.warn("Failed to fetch NYU identity: missing NYU API token", {
      uniqueId,
    });
    return null;
  }

  const url = new URL(`${NYU_API_BASE}/identity/unique-id/${uniqueId}`);
  url.searchParams.append("api_access_id", NYU_API_ACCESS_ID);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.warn("Failed to fetch NYU identity: upstream returned non-OK", {
      uniqueId,
      status: response.status,
    });
    return null;
  }

  const userData = await response.json();
  return selectIdentityRecord(userData);
}
