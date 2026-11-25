import type { ApprovalFlow } from "@/components/src/client/routes/components/schemaTypes";
import { TENANTS } from "@/components/src/constants/tenants";
import { itpApprovalFlow } from "./itpApprovalFlow";
import { mcApprovalFlow } from "./mcApprovalFlow";

/** Checked-in graph for a tenant whose document does not store one yet. */
export function bundledApprovalFlow(tenant?: string): ApprovalFlow | undefined {
  if (tenant === TENANTS.MC) return mcApprovalFlow;
  if (tenant === TENANTS.ITP) return itpApprovalFlow;
  return undefined;
}
