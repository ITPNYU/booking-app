// Server-safe tenant-schema types and defaults.
//
// Zod objects are the source of the types and the values copied into a new
// tenant or room. This module has no React, so API routes and scripts can
// import it. `SchemaProvider.tsx` re-exports everything here for client code.

export { defaultSafetyTrainingInfoUrl } from "@/components/src/constants/safetyTraining";

export {
  bookingDetailRoleSchema,
  formAlertSeveritySchema,
  requestLimitBucketKeySchema,
  requestLimitPeriodSchema,
  resourceSchema,
  resourceServicesSchema,
  resourcesArraySchema,
  serviceToggleSchema,
  tenantResourceSchema,
  tenantSchema,
} from "./schemas";

export type {
  Attestation,
  BookingDetailRole,
  ContextLabels,
  DetailsModalConfig,
  EmailNotifications,
  FormAlert,
  FormAlertSeverity,
  FormAlertWhen,
  FormConfig,
  FormServicesConfig,
  MappingsConfig,
  OriginsConfig,
  ProductionScheduleConfig,
  RequestLimitBucketKey,
  RequestLimitPeriod,
  RequestLimits,
  Resource,
  ResourceChartFieldConfig,
  ResourceFormOption,
  ResourceFormSectionConfig,
  ResourceFormSelectOption,
  ResourceServiceKey,
  ResourceServicesConfig,
  ResourceStaffingConfig,
  ResourceStaffingSectionConfig,
  ResourceStaffingServiceOption,
  ResourceTraining,
  SchemaContextType,
  ServiceToggle,
  ShowInOrigin,
  StaffingSection,
  TenantBranding,
  TermConfig,
  TermRange,
  TimeSensitiveRequestWarning,
  TrainingConfig,
} from "./types";

export {
  BOOKING_DETAIL_ROLES,
  DEFAULT_MEMO_ROLES,
  DEFAULT_WEBCHECKOUT_ROLES,
  defaultAttestation,
  defaultFormAlerts,
  defaultProductionSchedule,
  defaultResource,
  defaultScheme,
  defaultStaffingSection,
  generateDefaultSchema,
  normalizeMemoRoles,
  normalizeWebCheckoutRoles,
} from "./helpers";
