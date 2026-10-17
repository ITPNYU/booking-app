import type {
  FormAlert,
  FormAlertSeverity,
} from "@/components/src/client/routes/components/schemaTypes";
import { FormContextLevel } from "@/components/src/types";

export type FormAlertOrigin = "user" | "VIP" | "walkIn";

const SEVERITIES = new Set<FormAlertSeverity>([
  "success",
  "info",
  "warning",
  "error",
]);

export type FormAlertRuntime = {
  origin: FormAlertOrigin;
  isAutoApproval: boolean;
  /** Status alerts stay hidden on modification, matching the previous bar. */
  allowStatus: boolean;
};

export function formAlertOrigin(
  formContext: FormContextLevel,
): FormAlertOrigin {
  if (formContext === FormContextLevel.WALK_IN) return "walkIn";
  if (formContext === FormContextLevel.VIP) return "VIP";
  return "user";
}

function whenAllows(alert: FormAlert, isAutoApproval: boolean): boolean {
  const when = alert.when;
  if (when == null) return true;
  if (typeof when !== "object") return false;

  const record = when as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "autoApproval") return false;
  }

  const value = record.autoApproval;
  if (value == null) return true;
  if (value === "eligible") return isAutoApproval;
  if (value === "ineligible") return !isAutoApproval;
  return false;
}

export function formAlertMatches(
  alert: FormAlert,
  runtime: FormAlertRuntime,
): boolean {
  if (!alert || typeof alert !== "object") return false;
  if (alert.slot !== "status" && alert.slot !== "notice") return false;
  if (!SEVERITIES.has(alert.severity)) return false;
  if (typeof alert.message !== "string" || alert.message.trim() === "") {
    return false;
  }
  if (alert.slot === "status" && !runtime.allowStatus) return false;

  if (alert.showInOrigin != null) {
    if (typeof alert.showInOrigin !== "object") return false;
    if (alert.showInOrigin[runtime.origin] === false) return false;
  }

  return whenAllows(alert, runtime.isAutoApproval);
}

export function resolveFormAlerts(
  alerts: FormAlert[] | undefined,
  runtime: FormAlertRuntime,
): { status?: FormAlert; notices: FormAlert[] } {
  const matching = (Array.isArray(alerts) ? alerts : []).filter((alert) =>
    formAlertMatches(alert, runtime),
  );
  return {
    status: matching.find((alert) => alert.slot === "status"),
    notices: matching.filter((alert) => alert.slot === "notice"),
  };
}
