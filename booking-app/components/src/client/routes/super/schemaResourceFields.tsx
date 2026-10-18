"use client";

import type { Resource } from "@/components/src/client/routes/components/schemaTypes";
import { Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

const IDENTITY_KEYS = [
  "name",
  "resourceId",
  "capacity",
  "parentResourceId",
  "calendarId",
  "calendarIdProd",
  "isEquipment",
  "isWalkIn",
  "isWalkInCanBookTwo",
] as const;

const SECTION_KEYS = [
  "training",
  "minHour",
  "maxHour",
  "requestLimits",
  "autoApproval",
  "staffingServices",
  "staffingSections",
  "services",
] as const;

const SERVICE_KEYS = [
  "annex",
  "setup",
  "staffing",
  "furnishings",
  "equipment",
  "catering",
  "cleaning",
  "security",
] as const;

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  resourceId: "Resource id",
  capacity: "Capacity",
  parentResourceId: "Parent resource id",
  calendarId: "Calendar id",
  calendarIdProd: "Production calendar id",
  isEquipment: "Equipment",
  isWalkIn: "Walk-in",
  isWalkInCanBookTwo: "Walk-in can book two",
  training: "Training",
  minHour: "Minimum hours",
  maxHour: "Maximum hours",
  requestLimits: "Request limits",
  autoApproval: "Auto approval",
  shouldAutoApprove: "Auto approve",
  staffingServices: "Staffing services",
  staffingSections: "Staffing sections",
  services: "Services",
  formId: "Form id",
  infoUrl: "Info URL",
  required: "Required",
  perDay: "Per day",
  perWeek: "Per week",
  perMonth: "Per month",
  perSemester: "Per semester",
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
  studentWalkIn: "Student walk-in",
  facultyWalkIn: "Faculty walk-in",
  adminWalkIn: "Admin walk-in",
  studentVIP: "Student VIP",
  facultyVIP: "Faculty VIP",
  adminVIP: "Admin VIP",
  conditions: "Conditions",
  setup: "Setup",
  equipment: "Equipment",
  staffing: "Staffing",
  catering: "Catering",
  cleaning: "Cleaning",
  security: "Security",
  furnishings: "Furnishings",
  annex: "Annex",
  auxiliarySpace: "Auxiliary space",
  showInOrigin: "Show in origin",
  user: "User",
  walkIn: "Walk-in",
  VIP: "VIP",
  label: "Label",
  descriptionHtml: "Description HTML",
  mode: "Mode",
  toggle: "Toggle",
  options: "Options",
  defaultValue: "Default value",
  chartField: "Chart field",
  validation: "Validation",
  forceCleaning: "Force cleaning",
  studentLoungeCheckbox: "Student lounge checkbox",
  showDetailsField: "Show details field",
  detailsLabel: "Details label",
  detailsDescriptionHtml: "Details description HTML",
  hideForUser: "Hide for user",
  hideForVIP: "Hide for VIP",
  hideForWalkIn: "Hide for walk-in",
  sections: "Sections",
  staffingOptions: "Staffing options",
  value: "Value",
  indexes: "Indexes",
  enabled: "Enabled",
  requiresChartField: "Requires chart field",
};

const ENUM_OPTIONS: Record<string, string[]> = {
  toggle: ["on", "off", "optional"],
  mode: ["radio", "select", "checkbox", "static", "hidden"],
};

const KNOWN_KEYS = new Set<string>([...IDENTITY_KEYS, ...SECTION_KEYS]);

function labelFor(fieldKey: string): string {
  return FIELD_LABELS[fieldKey] ?? fieldKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function blankLike(value: unknown): unknown {
  if (typeof value === "string") return "";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return [];
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, blankLike(child)]),
    );
  }
  return "";
}

function emptyArrayItem(fieldKey: string, existing: unknown[]): unknown {
  if (existing.length > 0) return blankLike(existing[0]);
  if (fieldKey === "indexes") return 0;
  if (fieldKey === "staffingSections") return { name: "", indexes: [] };
  if (fieldKey === "options") return { value: "", label: "" };
  return "";
}

function emptyServiceSection(fieldKey: string): Record<string, unknown> {
  const showInOrigin = { user: true, walkIn: true, VIP: true };
  if (fieldKey === "staffing") {
    return {
      label: "",
      descriptionHtml: "",
      toggle: "optional",
      showInOrigin,
      sections: {},
    };
  }
  return { label: "", descriptionHtml: "", showInOrigin };
}

function orderedKeys(value: Record<string, unknown>): string[] {
  const preferred = [
    ...IDENTITY_KEYS,
    ...SECTION_KEYS,
    "shouldAutoApprove",
    "minHour",
    "maxHour",
    "conditions",
    "required",
    "formId",
    "infoUrl",
    "perDay",
    "perWeek",
    "perMonth",
    "perSemester",
    "student",
    "faculty",
    "admin",
    "studentWalkIn",
    "facultyWalkIn",
    "adminWalkIn",
    "studentVIP",
    "facultyVIP",
    "adminVIP",
    ...SERVICE_KEYS,
    "auxiliarySpace",
    "showInOrigin",
    "label",
    "descriptionHtml",
    "mode",
    "toggle",
    "defaultValue",
    "required",
    "options",
    "sections",
    "chartField",
    "value",
    "name",
    "indexes",
  ];
  const rank = new Map(preferred.map((key, index) => [key, index]));
  return Object.keys(value).sort((a, b) => {
    const aRank = rank.get(a);
    const bRank = rank.get(b);
    if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
    if (aRank !== undefined) return -1;
    if (bRank !== undefined) return 1;
    return a.localeCompare(b);
  });
}

type FieldKind = "check" | "grid" | "wide";

function fieldKind(fieldKey: string, value: unknown): FieldKind {
  if (typeof value === "boolean") return "check";
  if (isRecord(value) || Array.isArray(value)) return "wide";
  if (typeof value === "string" && /html|description|message|policy/i.test(fieldKey)) {
    return "wide";
  }
  return "grid";
}

const INLINE_SECTIONS = new Set(["requestLimits", "autoApproval", "services"]);

function gridSx(minColumn: number) {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(${minColumn}px, 1fr))`,
    gap: 1.5,
    alignItems: "start",
  } as const;
}

function groupFields(
  entries: { key: string; value: unknown }[],
  groupWide = false,
) {
  const groups: { kind: FieldKind; entries: { key: string; value: unknown }[] }[] = [];
  for (const entry of entries) {
    const kind = fieldKind(entry.key, entry.value);
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && (kind !== "wide" || groupWide)) {
      last.entries.push(entry);
    } else {
      groups.push({ kind, entries: [entry] });
    }
  }
  return groups;
}

function identityValue(resource: Resource, fieldKey: string): unknown {
  const value = (resource as unknown as Record<string, unknown>)[fieldKey];
  if (value !== undefined && value !== null) return value;
  if (
    fieldKey === "isEquipment" ||
    fieldKey === "isWalkIn" ||
    fieldKey === "isWalkInCanBookTwo"
  ) {
    return false;
  }
  if (fieldKey === "capacity") return 0;
  return "";
}

function Disclosure({
  title,
  defaultOpen = false,
  onRemove,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  onRemove?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
    >
      <Box display="flex" alignItems="center">
        <Button
          fullWidth
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          size="small"
          sx={{ justifyContent: "flex-start", textTransform: "none", py: 0.75 }}
        >
          {title}
        </Button>
        {onRemove && (
          <Button color="error" size="small" onClick={onRemove} sx={{ flexShrink: 0 }}>
            Remove
          </Button>
        )}
      </Box>
      {open ? <Box sx={{ px: 1.5, pb: 1.5 }}>{children}</Box> : null}
    </Box>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = useState(() => String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        if (text.trim() === "" || !Number.isFinite(Number(text))) {
          setText(String(value));
          return;
        }
        onChange(Number(text));
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        if (raw.trim() !== "" && Number.isFinite(Number(raw))) {
          onChange(Number(raw));
        }
      }}
      fullWidth
    />
  );
}

function ScalarField({
  fieldKey,
  label,
  value,
  onChange,
}: {
  fieldKey: string;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={value}
            onChange={(event) => onChange(event.target.checked)}
          />
        }
        label={label}
        sx={{ m: 0 }}
      />
    );
  }

  if (typeof value === "number") {
    return <NumberField label={label} value={value} onChange={onChange} />;
  }

  const text = value == null ? "" : String(value);
  const options = ENUM_OPTIONS[fieldKey];
  if (options && (text === "" || options.includes(text))) {
    return (
      <TextField
        select
        label={label}
        size="small"
        value={text}
        onChange={(event) => onChange(event.target.value)}
        fullWidth
      >
        {text === "" && <MenuItem value=""> </MenuItem>}
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const multiline = fieldKind(fieldKey, text) === "wide";
  return (
    <TextField
      label={label}
      size="small"
      value={text}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
    />
  );
}

function ArrayField({
  fieldKey,
  value,
  onChange,
  depth,
  columnMin,
}: {
  fieldKey: string;
  value: unknown[];
  onChange: (value: unknown[]) => void;
  depth: number;
  columnMin: number;
}) {
  return (
    <Stack spacing={1}>
      {value.length === 0 && (
        <Box component="p" sx={{ m: 0, color: "text.secondary", fontSize: 14 }}>
          No items yet.
        </Box>
      )}
      {value.length > 0 && value.every((item) => !isRecord(item) && !Array.isArray(item)) ? (
        <Box sx={gridSx(columnMin)}>
          {value.map((item, index) => {
            const remove = () => onChange(value.filter((_, itemIndex) => itemIndex !== index));
            const change = (next: unknown) =>
              onChange(value.map((current, itemIndex) => (itemIndex === index ? next : current)));
            return (
              <Box
                key={index}
                display="flex"
                gap={0.5}
                alignItems="flex-start"
                sx={fieldKind(fieldKey, item) === "wide" ? { gridColumn: "1 / -1" } : undefined}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <ScalarField
                    fieldKey={fieldKey}
                    label={`${labelFor(fieldKey)} ${index + 1}`}
                    value={item}
                    onChange={change}
                  />
                </Box>
                <Button color="error" size="small" onClick={remove} sx={{ mt: 0.5 }}>
                  Remove
                </Button>
              </Box>
            );
          })}
        </Box>
      ) : null}
      {value.map((item, index) => {
        if (!isRecord(item) && !Array.isArray(item)) return null;
        const title = arrayItemTitle(item, index);
        const remove = () => onChange(value.filter((_, itemIndex) => itemIndex !== index));
        const change = (next: unknown) =>
          onChange(value.map((current, itemIndex) => (itemIndex === index ? next : current)));
        return (
          <Disclosure key={index} title={title} onRemove={remove}>
            <ValueBody
              fieldKey={String(index)}
              value={item}
              onChange={change}
              depth={depth + 1}
              columnMin={columnMin}
            />
          </Disclosure>
        );
      })}
      <Button
        variant="outlined"
        size="small"
        onClick={() => onChange([...value, emptyArrayItem(fieldKey, value)])}
        sx={{ alignSelf: "flex-start" }}
      >
        Add {labelFor(fieldKey).toLowerCase()}
      </Button>
    </Stack>
  );
}

function arrayItemTitle(item: unknown, index: number): string {
  if (isRecord(item)) {
    const name = item.label ?? item.name ?? item.value;
    if (typeof name === "string" && name.trim()) return name;
  }
  return `Item ${index + 1}`;
}

function ObjectField({
  fieldKey,
  value,
  onChange,
  depth,
  columnMin,
}: {
  fieldKey: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  depth: number;
  columnMin: number;
}) {
  const keys = orderedKeys(value);
  const missingServices =
    fieldKey === "services"
      ? SERVICE_KEYS.filter((key) => !(key in value))
      : [];

  return (
    <Stack spacing={1}>
      <FieldGroups
        entries={keys.map((key) => ({ key, value: value[key] }))}
        groupWide={INLINE_SECTIONS.has(fieldKey)}
        columnMin={columnMin}
        render={(key) => {
          const remove =
            fieldKey === "services"
              ? () => {
                  const next = { ...value };
                  delete next[key];
                  onChange(next);
                }
              : undefined;
          return (
            <FieldNode
              fieldKey={key}
              value={value[key]}
              onChange={(next) => onChange({ ...value, [key]: next })}
              depth={depth}
              onRemove={remove}
              columnMin={INLINE_SECTIONS.has(fieldKey) ? 90 : columnMin}
            />
          );
        }}
      />
      {missingServices.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={1}>
          {missingServices.map((key) => (
            <Button
              key={key}
              size="small"
              variant="outlined"
              onClick={() => onChange({ ...value, [key]: emptyServiceSection(key) })}
            >
              Add {labelFor(key).toLowerCase()}
            </Button>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function FieldGroups({
  entries,
  render,
  groupWide = false,
  columnMin = 220,
}: {
  entries: { key: string; value: unknown }[];
  render: (key: string) => ReactNode;
  groupWide?: boolean;
  columnMin?: number;
}) {
  const groups = groupFields(entries, groupWide);
  return (
    <Stack spacing={1}>
      {groups.map((group, index) => {
        const content = group.entries.map((entry) => (
          <Fragment key={entry.key}>{render(entry.key)}</Fragment>
        ));
        if (group.kind === "grid" || (group.kind === "wide" && groupWide)) {
          return (
            <Box key={index} sx={gridSx(group.kind === "wide" ? 340 : columnMin)}>
              {content}
            </Box>
          );
        }
        if (group.kind === "check") {
          return (
            <Box key={index} display="flex" flexWrap="wrap" columnGap={2} rowGap={0}>
              {content}
            </Box>
          );
        }
        return <Stack key={index} spacing={1}>{content}</Stack>;
      })}
    </Stack>
  );
}

function FieldNode({
  fieldKey,
  value,
  onChange,
  depth,
  onRemove,
  columnMin = 220,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
  depth: number;
  onRemove?: () => void;
  columnMin?: number;
}) {
  const complex = isRecord(value) || Array.isArray(value);
  if (complex && depth > 0) {
    return (
      <Disclosure title={labelFor(fieldKey)} onRemove={onRemove}>
        <ValueBody
          fieldKey={fieldKey}
          value={value}
          onChange={onChange}
          depth={depth + 1}
          columnMin={columnMin}
        />
      </Disclosure>
    );
  }
  return (
    <ValueBody
      fieldKey={fieldKey}
      value={value}
      onChange={onChange}
      depth={depth}
      columnMin={columnMin}
    />
  );
}

function ValueBody({
  fieldKey,
  value,
  onChange,
  depth,
  columnMin = 220,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
  depth: number;
  columnMin?: number;
}) {
  if (Array.isArray(value)) {
    return (
      <Stack spacing={1}>
        {fieldKey === "services" && (
          <Box component="p" sx={{ m: 0, color: "text.secondary", fontSize: 14 }}>
            This resource stores services as a list of names.
          </Box>
        )}
        <ArrayField
          fieldKey={fieldKey}
          value={value}
          onChange={onChange}
          depth={depth}
          columnMin={columnMin}
        />
      </Stack>
    );
  }
  if (isRecord(value)) {
    return (
      <ObjectField
        fieldKey={fieldKey}
        value={value}
        onChange={onChange}
        depth={depth}
        columnMin={columnMin}
      />
    );
  }
  return (
    <ScalarField
      fieldKey={fieldKey}
      label={labelFor(fieldKey)}
      value={value}
      onChange={onChange}
    />
  );
}

export default function SchemaResourceFields({
  resource,
  onChange,
}: {
  resource: Resource;
  onChange: (resource: Resource) => void;
}) {
  const record = resource as unknown as Record<string, unknown>;
  const setKey = (fieldKey: string, value: unknown) => {
    onChange({ ...resource, [fieldKey]: value } as Resource);
  };
  const extraKeys = Object.keys(record)
    .filter((key) => !KNOWN_KEYS.has(key))
    .sort();

  return (
    <Stack spacing={1}>
      <FieldGroups
        entries={IDENTITY_KEYS.map((fieldKey) => ({
          key: fieldKey,
          value: identityValue(resource, fieldKey),
        }))}
        render={(fieldKey) => (
          <ScalarField
            fieldKey={fieldKey}
            label={labelFor(fieldKey)}
            value={identityValue(resource, fieldKey)}
            onChange={(value) => setKey(fieldKey, value)}
          />
        )}
      />
      {SECTION_KEYS.map((fieldKey) => (
        <Disclosure key={fieldKey} title={labelFor(fieldKey)} defaultOpen>
          <ValueBody
            fieldKey={fieldKey}
            value={record[fieldKey] ?? (fieldKey === "services" ? {} : undefined)}
            onChange={(value) => setKey(fieldKey, value)}
            depth={1}
            columnMin={220}
          />
        </Disclosure>
      ))}
      {extraKeys.length > 0 && (
        <Disclosure title="Other fields" defaultOpen>
          <FieldGroups
            entries={extraKeys.map((fieldKey) => ({
              key: fieldKey,
              value: record[fieldKey],
            }))}
            render={(fieldKey) => (
              <FieldNode
                fieldKey={fieldKey}
                value={record[fieldKey]}
                onChange={(value) => setKey(fieldKey, value)}
                depth={1}
              />
            )}
          />
        </Disclosure>
      )}
    </Stack>
  );
}
