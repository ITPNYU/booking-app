// Inferred tenant-schema types. This file has no runtime values.

import type { z } from "zod";

import type {
  attestationSchema,
  bookingDetailRoleSchema,
  contextLabelsSchema,
  detailsModalSchema,
  emailNotificationsSchema,
  formAlertSchema,
  formAlertSeveritySchema,
  formAlertWhenSchema,
  formConfigSchema,
  formServicesSchema,
  mappingsSchema,
  originsSchema,
  productionScheduleSchema,
  requestLimitBucketKeySchema,
  requestLimitPeriodSchema,
  requestLimitsSchema,
  resourceChartFieldSchema,
  resourceFormOptionSchema,
  resourceFormSectionSchema,
  resourceSchema,
  resourceServicesObjectSchema,
  resourceStaffingConfigSchema,
  resourceStaffingSectionSchema,
  resourceStaffingServiceOptionSchema,
  resourceTrainingSchema,
  serviceToggleSchema,
  showInOriginSchema,
  staffingSectionSchema,
  tenantBrandingSchema,
  tenantSchema,
  termConfigSchema,
  termRangeSchema,
  timeSensitiveRequestWarningSchema,
  trainingConfigSchema,
} from "./schemas";

export type BookingDetailRole = z.infer<typeof bookingDetailRoleSchema>;

export type ShowInOrigin = z.infer<typeof showInOriginSchema>;

export type ResourceChartFieldConfig = z.infer<typeof resourceChartFieldSchema>;

export type ResourceFormOption = z.infer<typeof resourceFormOptionSchema>;

/** @deprecated Use ResourceFormOption */
export type ResourceFormSelectOption = ResourceFormOption;

export type ServiceToggle = z.infer<typeof serviceToggleSchema>;

export type ResourceFormSectionConfig = z.infer<
  typeof resourceFormSectionSchema
>;

export type ResourceStaffingServiceOption = z.infer<
  typeof resourceStaffingServiceOptionSchema
>;

export type ResourceStaffingSectionConfig = z.infer<
  typeof resourceStaffingSectionSchema
>;

export type ResourceStaffingConfig = z.infer<
  typeof resourceStaffingConfigSchema
>;

export type ResourceServicesConfig = z.infer<
  typeof resourceServicesObjectSchema
>;

export type ResourceServiceKey = keyof ResourceServicesConfig;

export type ResourceTraining = z.infer<typeof resourceTrainingSchema>;

export type RequestLimitPeriod = z.infer<typeof requestLimitPeriodSchema>;

export type RequestLimitBucketKey = z.infer<typeof requestLimitBucketKeySchema>;

export type RequestLimits = z.infer<typeof requestLimitsSchema>;

export type StaffingSection = z.infer<typeof staffingSectionSchema>;

export type Resource = z.infer<typeof resourceSchema>;

export type Attestation = z.infer<typeof attestationSchema>;

export type TimeSensitiveRequestWarning = z.infer<
  typeof timeSensitiveRequestWarningSchema
>;

export type TermRange = z.infer<typeof termRangeSchema>;

export type TermConfig = z.infer<typeof termConfigSchema>;

export type ContextLabels = z.infer<typeof contextLabelsSchema>;

export type TenantBranding = z.infer<typeof tenantBrandingSchema>;

export type FormServicesConfig = z.infer<typeof formServicesSchema>;

export type FormAlertSeverity = z.infer<typeof formAlertSeveritySchema>;

export type FormAlertWhen = z.infer<typeof formAlertWhenSchema>;

export type FormAlert = z.infer<typeof formAlertSchema>;

export type ProductionScheduleConfig = z.infer<typeof productionScheduleSchema>;

export type FormConfig = z.infer<typeof formConfigSchema>;

export type DetailsModalConfig = z.infer<typeof detailsModalSchema>;

export type OriginsConfig = z.infer<typeof originsSchema>;

export type MappingsConfig = z.infer<typeof mappingsSchema>;

export type TrainingConfig = z.infer<typeof trainingConfigSchema>;

export type EmailNotifications = z.infer<typeof emailNotificationsSchema>;

export type SchemaContextType = z.infer<typeof tenantSchema>;
