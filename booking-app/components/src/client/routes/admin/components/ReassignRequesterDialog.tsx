import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { useParams } from "next/navigation";
import React, { cloneElement, useRef, useState } from "react";
import { reassignRequester } from "@/components/src/client/bookingActionClient";
import { UserApiData } from "@/components/src/types";
import {
  N_NUMBER_REGEX,
  PHONE_NUMBER_REGEX,
  requesterEmailForNetId,
} from "@/components/src/utils/reassignRequester";
import { NET_ID_REGEX } from "@/components/src/utils/validationHelpers";
import { mapAffiliationToRole } from "../../booking/formPages/UserRolePage";
import { useTenantSchema } from "../../components/SchemaProvider";

export type CurrentRequester = {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
};

export type ReassignResult = {
  name: string;
  email: string;
  warning?: string;
};

interface Props {
  calendarEventId: string;
  currentRequester?: CurrentRequester;
  onDone: (result: ReassignResult) => void;
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
}

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; affiliation?: string; suggestedRole?: string }
  | { kind: "notFound" };

const EMPTY_FORM = {
  netId: "",
  firstName: "",
  lastName: "",
  nNumber: "",
  phoneNumber: "",
};

/**
 * Lets an admin hand a booking to a different requester. The NetID fills in
 * the name and N-number from the NYU directory; the phone number is typed in
 * because the directory does not have one.
 */
export default function ReassignRequesterDialog({
  calendarEventId,
  currentRequester,
  onDone,
  children,
}: Props) {
  const { tenant } = useParams();
  const schema = useTenantSchema();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notifyNewRequester, setNotifyNewRequester] = useState(true);
  const [notifyPreviousRequester, setNotifyPreviousRequester] = useState(true);
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // NetID of the last lookup, so blur and the Look up button do not both fetch.
  const lookedUpNetId = useRef<string | null>(null);

  const reset = () => {
    setForm(EMPTY_FORM);
    setNotifyNewRequester(true);
    setNotifyPreviousRequester(true);
    setLookup({ kind: "idle" });
    setError(null);
    lookedUpNetId.current = null;
  };

  const trigger = cloneElement(children, {
    onClick: () => {
      reset();
      setOpen(true);
    },
  });

  const netId = form.netId.trim().toLowerCase();
  const netIdValid = NET_ID_REGEX.test(netId);
  const sameAsCurrent =
    netIdValid &&
    requesterEmailForNetId(netId) ===
      (currentRequester?.email ?? "").trim().toLowerCase();
  const phoneValid = PHONE_NUMBER_REGEX.test(form.phoneNumber.trim());
  const nNumberValid =
    form.nNumber.trim() === "" || N_NUMBER_REGEX.test(form.nNumber.trim());
  const canSubmit =
    netIdValid &&
    !sameAsCurrent &&
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    phoneValid &&
    nNumberValid &&
    !submitting;

  const setField =
    (field: keyof typeof EMPTY_FORM) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      if (field === "netId") {
        setLookup({ kind: "idle" });
        lookedUpNetId.current = null;
      }
    };

  const lookUpNetId = async () => {
    if (!netIdValid || lookedUpNetId.current === netId) return;
    lookedUpNetId.current = netId;
    setLookup({ kind: "loading" });
    try {
      const response = await fetch(`/api/nyu/identity/${netId}`);
      if (!response.ok) throw new Error(String(response.status));
      const identity = (await response.json()) as UserApiData;
      if (lookedUpNetId.current !== netId) return;
      setForm((prev) => ({
        ...prev,
        firstName: identity.preferred_first_name || prev.firstName,
        lastName: identity.preferred_last_name || prev.lastName,
        nNumber: identity.university_id || prev.nNumber,
      }));
      setLookup({
        kind: "found",
        affiliation: identity.affiliation_sub_type || identity.affiliation,
        suggestedRole: mapAffiliationToRole(
          schema.mappings?.role ?? {},
          identity.affiliation_sub_type,
        ),
      });
    } catch {
      if (lookedUpNetId.current === netId) setLookup({ kind: "notFound" });
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await reassignRequester(
        {
          calendarEventId,
          netId,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          nNumber: form.nNumber.trim(),
          phoneNumber: form.phoneNumber.trim(),
          notifyNewRequester,
          notifyPreviousRequester,
        },
        tenant as string,
      );
      setOpen(false);
      onDone({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: result.email,
        warning: result.warning,
      });
    } catch (ex) {
      setError(
        ex instanceof Error && ex.message
          ? ex.message
          : "Failed to reassign the booking",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentName = [currentRequester?.firstName, currentRequester?.lastName]
    .filter(Boolean)
    .join(" ");
  const roleDiffers =
    lookup.kind === "found" &&
    !!lookup.suggestedRole &&
    !!currentRequester?.role &&
    lookup.suggestedRole !== currentRequester.role;

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="reassign-requester-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="reassign-requester-title">
          Reassign Requester
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Currently held by <strong>{currentName || "unknown"}</strong>
            {currentRequester?.email ? ` (${currentRequester.email})` : ""}
          </DialogContentText>

          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <TextField
              label="New requester's NetID"
              value={form.netId}
              onChange={setField("netId")}
              onBlur={lookUpNetId}
              onKeyDown={(event) => {
                if (event.key === "Enter") lookUpNetId();
              }}
              error={form.netId !== "" && (!netIdValid || sameAsCurrent)}
              helperText={
                form.netId !== "" && !netIdValid
                  ? "Enter a NetID like abc123"
                  : sameAsCurrent
                    ? "This person already holds the booking"
                    : " "
              }
              fullWidth
              inputProps={{ "aria-label": "New requester's NetID" }}
            />
            <Button
              variant="outlined"
              onClick={lookUpNetId}
              disabled={!netIdValid || lookup.kind === "loading"}
              sx={{ mt: 1, whiteSpace: "nowrap" }}
            >
              {lookup.kind === "loading" ? (
                <CircularProgress size={20} />
              ) : (
                "Look up"
              )}
            </Button>
          </Box>

          {lookup.kind === "found" && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Found in the NYU directory
              {lookup.affiliation ? ` · ${lookup.affiliation}` : ""}
            </Typography>
          )}
          {lookup.kind === "notFound" && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Not found in the NYU directory.
            </Alert>
          )}
          {roleDiffers && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              Their NYU affiliation suggests the role{" "}
              <strong>{lookup.suggestedRole}</strong>, but this booking was made
              as <strong>{currentRequester?.role}</strong>. The booking keeps
              its role; use Modification or Edit to change it.
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
            <TextField
              label="First name"
              value={form.firstName}
              onChange={setField("firstName")}
              fullWidth
              required
            />
            <TextField
              label="Last name"
              value={form.lastName}
              onChange={setField("lastName")}
              fullWidth
              required
            />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <TextField
              label="N-Number"
              value={form.nNumber}
              onChange={setField("nNumber")}
              error={!nNumberValid}
              helperText={!nNumberValid ? "N followed by eight digits" : " "}
              fullWidth
            />
            <TextField
              label="Phone number"
              value={form.phoneNumber}
              onChange={setField("phoneNumber")}
              error={form.phoneNumber !== "" && !phoneValid}
              helperText={
                form.phoneNumber !== "" && !phoneValid
                  ? "Enter a 10 digit phone number"
                  : " "
              }
              fullWidth
              required
            />
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={notifyNewRequester}
                onChange={(event) =>
                  setNotifyNewRequester(event.target.checked)
                }
              />
            }
            label="Email the new requester"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={notifyPreviousRequester}
                onChange={(event) =>
                  setNotifyPreviousRequester(event.target.checked)
                }
              />
            }
            label="Email the previous requester"
          />

          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!canSubmit}
          >
            {submitting ? <CircularProgress size={20} /> : "Reassign"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
