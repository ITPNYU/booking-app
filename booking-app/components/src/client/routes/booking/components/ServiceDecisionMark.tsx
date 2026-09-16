import { Check, Close } from "@mui/icons-material";
import styled from "@emotion/styled";
import React from "react";
import type { MediaCommonsServiceKey } from "../../../../utils/serviceDecisions";

/** Same icons and colors as the bookings table Services column. */
const APPROVED_COLOR = "rgba(72, 196, 77, 1)";
const DECLINED_COLOR = "rgba(255, 26, 26, 1)";

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.75rem;
  line-height: 1.25rem;
  margin: 0 0 8px;
`;

interface Props {
  service: MediaCommonsServiceKey;
  /** The section's service decision: true approved, false declined, absent pending. */
  decision?: boolean;
}

/**
 * Decision mark: the green check or red X shown on a service section in the
 * edit and modification contexts, with a note on what changing the section
 * does to that decision (ADR-0001). A pending service renders nothing.
 */
export default function ServiceDecisionMark({ service, decision }: Props) {
  if (typeof decision !== "boolean") return null;
  const approved = decision;
  const Icon = approved ? Check : Close;
  const color = approved ? APPROVED_COLOR : DECLINED_COLOR;
  return (
    <Row
      data-testid="service-decision-mark"
      data-service={service}
      data-decision={approved ? "approved" : "declined"}
    >
      <Icon
        aria-hidden
        sx={{ fontSize: 16, color, stroke: color, strokeWidth: 1.4 }}
      />
      <span>
        <strong>{approved ? "Approved." : "Declined."}</strong>{" "}
        {approved
          ? "Changing this service sends it back for approval."
          : "Changing this service sends it back for review. If you leave it unchanged, it stays declined."}
      </span>
    </Row>
  );
}
