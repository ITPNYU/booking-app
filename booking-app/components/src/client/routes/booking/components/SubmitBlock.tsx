import { Button } from "@mui/material";
import React, { useContext, useState } from "react";

import { FormContextLevel } from "../../../../types";
import { getRequestOrigin } from "../../../../utils/serviceSections";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import { BookingFormAgreementCheckbox } from "./BookingFormInputs";
import { Section } from "./RequestFormShell";

/**
 * Whether the request is blocked from moving on or submitting: a ban, missing
 * safety training, or a blackout period. Gates Submit and the Details Next.
 */
export function useRequestBlocked(): boolean {
  const { isBanned, needsSafetyTraining, isInBlackoutPeriod } =
    useContext(BookingContext);
  return isBanned || needsSafetyTraining || isInBlackoutPeriod;
}

interface Props {
  formContext: FormContextLevel;
  /** Validity of the step's own fields; gates Submit for modifications. */
  isValid: boolean;
  isSubmitting: boolean;
}

/**
 * The Agreement attestations together with the Submit button. Rendered on
 * whichever step is last: Services, or Details when Services is skipped.
 */
export default function SubmitBlock({
  formContext,
  isValid,
  isSubmitting,
}: Props) {
  const { attestations } = useTenantSchema();
  const { formData } = useContext(BookingContext);
  const blocked = useRequestBlocked();
  const { isMod, isBooking, isWalkIn } = getRequestOrigin(
    formContext,
    formData?.origin,
  );

  // agreements, skip for walk-ins
  const [checkedAgreements, setCheckedAgreements] = useState<
    Record<string, boolean>
  >(Object.fromEntries(attestations.map((a) => [a.id, isWalkIn])));

  // The Agreement section is only rendered for the regular booking form. VIP
  // and walk-in flows never show the attestations, so they must not be
  // blocked by them (otherwise their Submit button could never enable).
  const showAgreement = !isMod && isBooking;
  const attestationsIncomplete =
    showAgreement &&
    attestations.length > 0 &&
    !attestations.every((a) => checkedAgreements[a.id]);

  const disabled = isMod
    ? !isValid
    : attestationsIncomplete || blocked || isSubmitting;

  return (
    <>
      {showAgreement && (
        <Section title="Agreement">
          {attestations.map((agreement) => (
            <BookingFormAgreementCheckbox
              key={agreement.id}
              id={agreement.id}
              checked={checkedAgreements[agreement.id]}
              onChange={(value) =>
                setCheckedAgreements({
                  ...checkedAgreements,
                  [agreement.id]: value,
                })
              }
              description={
                <div dangerouslySetInnerHTML={{ __html: agreement.html }} />
              }
            />
          ))}
        </Section>
      )}

      <Button type="submit" disabled={disabled} variant="contained">
        Submit
      </Button>
    </>
  );
}
