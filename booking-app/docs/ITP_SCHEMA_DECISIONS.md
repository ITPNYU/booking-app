# ITP Booking System — Decisions Needed

This document lists configuration decisions required from the PM. Each section describes what the setting controls and indicates which rollout phase it applies to.

---

## Rollout Phases

| Phase | Scope | Goal |
|-------|-------|------|
| **Phase 1** | Huddle Rooms only, no VIP, no Walk-in, manual approval | Simplest prototype — test how ITP uses the booking system |
| **Phase 2** | Add Walk-in and VIP support | Expand booking options based on Phase 1 feedback |
| **Phase 3** | Add remaining rooms (Doc Lab, Phone Booths, Assembly, Shops, etc.) | Full room coverage |

---

## Phase 1 Decisions (Huddle Room Prototype)

### 1. Room Auto-Approval Rules

**What it controls:** Whether bookings are automatically approved based on the user's role and requested duration, or require manual admin approval.

**Current state:** All rooms require manual approval (auto-approval disabled).

**Decision needed:**
- Should Huddle Rooms have auto-approval? If so, per role:
  - Which roles can be auto-approved? (Student / Faculty / Admin/Staff / All / None)
  - Maximum booking duration for auto-approval (e.g., 1 hour, 4 hours, unlimited)

### 2. User Roles and Mappings

**What it controls:** How users are classified when they book a room. Roles determine auto-approval eligibility and booking duration limits.

**Current roles defined:** Student, Faculty, Admin/Staff

**Decisions needed:**
- Are these three roles correct, or do we need others?
- Should role mapping be tied to NYU department/program? If so, which programs map to which roles?
- Do we need `programMapping` / `schoolMapping` for reporting?

### 3. Email Notification Content

**What it controls:** The header/body text in emails sent to users at each stage of the booking lifecycle.

**Current state:** All email templates are empty (users would receive emails with no body text).

**Templates needed for Phase 1:**

| Template | When it's sent | Content needed |
|----------|---------------|----------------|
| `requestConfirmation` | User submits a booking request | Confirmation message, expected approval timeline |
| `firstApprovalRequest` | Sent to approvers when a new request comes in | Instructions for approver |
| `approvalNotice` | User's booking is approved | Approval details, next steps |
| `declined` | Booking is declined | Decline message, how to resubmit |
| `canceled` | Booking is canceled | Cancellation confirmation |
| `lateCancel` | Booking is canceled within 24h of start | Late cancellation warning |
| `noShow` | User didn't show up | No-show notification, any consequences |
| `checkinConfirmation` | User checks in | Check-in confirmation |
| `checkoutConfirmation` | User checks out | Checkout confirmation |
| `closed` | Booking is fully closed | Final summary |

**Note:** These are header messages that appear above the standard booking details. A sentence or two is typical.

### 4. ITP Operations Email

**What it controls:** The email address that receives CC on approval/cancellation notifications and admin alerts.

**Decision needed:**
- What email address should be used? (e.g., `itp.rooms@nyu.edu` or similar)

### 5. Booking Policy Agreement

**What it controls:** The policy text users must agree to before submitting a booking.

**Current state:** One generic agreement: _"I have read the ITP booking policy and agree to follow all policies outlined."_

**Decision needed:**
- Is this sufficient, or should the full policy text be included?
- Are there additional agreements needed? (e.g., equipment usage terms)

### 6. Calendar & Scheduling Configuration

**What it controls:** Available booking hours and time slot granularity.

**Current state:**
- All roles: 24 hours (start at 00:00)
- Slot unit: 15 minutes for all roles

**Decisions needed:**
- Are 24-hour availability and 15-minute slots correct?
- Should different roles have different available hours?
- Is there a minimum advance notice for booking? (e.g., must book 48h in advance)

### 7. Booking Duration Limits

**What it controls:** Minimum and maximum booking duration per role.

**Current state:** No limits set (unlimited).

**Decision needed:**

| Role | Min duration? | Max duration? |
|------|--------------|---------------|
| Student | | |
| Faculty | | |
| Admin/Staff | | |

---

## Phase 2 Decisions (Walk-in & VIP)

### 8. Walk-In Booking Support

**What it controls:** Whether PAs/admins can create instant bookings for walk-in users without going through the approval flow.

**Decisions needed:**
- Should walk-in booking be enabled for Huddle Rooms?
- Can walk-in users book two consecutive slots?

### 9. VIP Booking Support

**What it controls:** Whether certain users can make priority bookings that bypass the normal approval queue.

**Decisions needed:**
- Should VIP booking be enabled for ITP?
- If yes, which roles qualify as VIP? (e.g., Faculty only)

---

## Phase 3 Decisions (Additional Rooms)

Room-specific configuration (auto-approval rules, duration limits, walk-in support, etc.) will be decided when Phase 3 planning begins, based on lessons learned from Phases 1 and 2.

---

## Summary — What's Needed for Phase 1 Launch

| # | Decision | Blocking? |
|---|----------|-----------|
| 1 | Auto-approval rules (or confirm manual-only) | No — defaults to manual |
| 2 | Role/program mappings (or confirm current 3 roles are fine) | No — defaults work |
| 3 | Email template content | **Yes** — emails will be empty otherwise |
| 4 | ITP operations email address | **Yes** — needed for CC routing |
| 5 | Booking policy agreement text | No — generic text exists |
| 6 | Calendar/scheduling config | No — 24h/15min defaults work |
| 7 | Duration limits | No — defaults to unlimited |
