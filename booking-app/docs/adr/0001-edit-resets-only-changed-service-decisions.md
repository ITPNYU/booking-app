# ADR-0001: Editing a request resets only the service decisions of changed services

**Status:** accepted (2026-09-14, triage of #1596)

## Context

A requester may edit a REQUESTED or DECLINED booking. Media Commons bookings carry one service decision per service (approved, declined, pending). Before this decision, resubmitting a declined booking wiped every service decision, and the machine re-entered every requested service as pending, even when the requester had not touched it.

## Decision

- On edit, a service's decision is cleared only when its service request changed. A change is any field in that service's section on any room: toggle or choice, detail text, or chartfield, in per-room maps or legacy flat fields.
- Unchanged services keep their decision, approved or declined. An unchanged declined service therefore leads to the resubmitted booking being declined again; the requester must change that service to have it reviewed.
- When a booking re-enters the Services Request state, services that already hold a decision land directly in their approved or declined state; only pending services wait on approvers.
- The Services step shows a decision mark on decided sections in the edit and modification contexts so the requester can see what a change will reset.

## Consequences

- The edit endpoint must diff service requests per service key rather than clearing all flags.
- The machine's edit transition becomes selective and the Services Request regions gain already-decided branches.
- Modification does not yet follow this rule; it copies decisions forward unchanged and forces Approved. Tracked separately.
