# ITP Booking System — Decisions Needed

This document lists configuration decisions required from the PM before ITP room booking can go live. Each section describes what the setting controls and provides the current default or Media Commons equivalent for reference.

---

## 1. Room Auto-Approval Rules

**What it controls:** Whether bookings are automatically approved based on the user's role and requested duration, or require manual admin approval.

**Current state:** All rooms require manual approval (auto-approval disabled).

**Decisions needed (Huddle Rooms only for initial launch):**

| Room | Room ID | Question |
|------|---------|----------|
| Huddle Room | 421 | Should any roles get auto-approval? If so, max duration? |
| Huddle Room | 422 | (same as above) |
| Huddle Room | 446 | (same as above) |
| Huddle Room | 447 | (same as above) |
| Huddle Room | 448 | (same as above) |

**Example (Media Commons):** Huddle rooms in MC auto-approve for all roles up to 4 hours. Studios require manual approval.

**Format for each room:**
- Which roles can be auto-approved? (Student / Faculty / Admin/Staff / All / None)
- Maximum booking duration for auto-approval (e.g., 2 hours, 4 hours, unlimited)

---

## 2. User Roles and Mappings

**What it controls:** How users are classified when they book a room. Roles determine what time slots they can see, auto-approval eligibility, and booking duration limits.

**Current roles defined:** Student, Faculty, Admin/Staff

**Decisions needed:**
- Are these three roles correct, or do we need others?
- Should role mapping be tied to NYU department/program? If so, which programs map to which roles?
  - e.g., "ITP" → Student, "IMA" → Student, "Low Res" → Student
- Do we need `programMapping`? (Media Commons uses this to categorize users by their NYU program for reporting)
- Do we need `schoolMapping`? (Maps NYU schools for filtering/reporting)

---

## 3. Email Notification Content

**What it controls:** The header/body text in emails sent to users at each stage of the booking lifecycle.

**Current state:** All email templates are empty (users would receive emails with no body text).

**Templates needed:**

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
| `walkInConfirmation` | Walk-in booking created (if walk-ins enabled) | Walk-in confirmation |
| `vipConfirmation` | VIP booking created (if VIP enabled) | VIP confirmation |

**Note:** These are header messages that appear above the standard booking details. They don't need to be long — a sentence or two is typical.

---

## 4. ITP Operations Email

**What it controls:** The email address that receives CC on approval/cancellation notifications and admin alerts.

**Decision needed:**
- What email address should be used? (e.g., `itp.rooms@nyu.edu` or similar)

**Reference:** Media Commons uses `mediacommons.reservations@nyu.edu` and `mediacommons.operations@nyu.edu`.

---

## 5. Walk-In Booking Support

**What it controls:** Whether PAs/admins can create instant bookings for walk-in users without going through the approval flow.

**Current state:** Disabled (`supportWalkIn: false`)

**Decisions needed:**
- Should walk-in booking be enabled for ITP Huddle Rooms?
- Can walk-in users book two consecutive slots? (MC allows this for some rooms)

---

## 6. VIP Booking Support

**What it controls:** Whether certain users can make priority bookings that bypass the normal approval queue.

**Current state:** Disabled (`supportVIP: false`)

**Decisions needed:**
- Should VIP booking be enabled for ITP?
- If yes, which roles qualify as VIP? (e.g., Faculty only)

---

## 7. Booking Policy Agreement

**What it controls:** The policy text users must agree to before submitting a booking.

**Current state:** One generic agreement: _"I have read the ITP booking policy and agree to follow all policies outlined."_

**Decision needed:**
- Is this sufficient, or should the full policy text be included?
- Are there additional agreements needed? (e.g., equipment usage terms, safety acknowledgment)

---

## 8. Calendar & Scheduling Configuration

**What it controls:** Available booking hours and time slot granularity.

**Current state:**
- All roles: start at 9:00 AM (VIP roles: 6:00 AM)
- Slot unit: 15 minutes for all roles

**Decisions needed:**
- What are ITP's operating hours? (earliest/latest booking times)
- Should slot granularity be 15 min, 30 min, or 1 hour?
- Should different roles have different available hours?
- Is there a minimum advance notice for booking? (e.g., must book 48h in advance)

---

## 9. Booking Duration Limits

**What it controls:** Minimum and maximum booking duration per room and role.

**Current state:** No limits set (all `-1`, meaning unlimited).

**Decisions needed (Huddle Rooms only for initial launch):**

| Room Type | Min duration? | Max duration? | Varies by role? |
|-----------|--------------|---------------|-----------------|
| Huddle Room | | | |

---

## 10. ~~Missing Production Calendar ID~~ — RESOLVED

Room 448's production calendar ID has been found in the spreadsheet and will be updated.

---

## Summary of Minimum Required Decisions

To get ITP booking functional end-to-end, at minimum we need:

1. **ITP operations email address** (Phase 1 blocker)
2. **Email template content** — at least `requestConfirmation`, `approvalNotice`, `declined`, `canceled` (users will get empty emails otherwise)
3. **Auto-approval rules** — or confirmation that all bookings require manual approval
4. **Role/program mappings** — or confirmation that current roles are sufficient without mappings

Everything else (walk-in, VIP, duration limits, policy text) can be configured later.
