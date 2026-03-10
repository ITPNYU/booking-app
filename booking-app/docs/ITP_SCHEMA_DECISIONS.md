# ITP Booking System — Decisions Needed

This document lists configuration decisions required from the PM. Each section describes what the setting controls and indicates which rollout phase it applies to.

---

## Rollout Phases

| Phase | Scope | Goal |
|-------|-------|------|
| **Phase 1** | Huddle Rooms only, no VIP, no Walk-in, auto-approval | Simplest prototype — test how ITP uses the booking system |
| **Phase 2** | Add Walk-in and VIP support | Expand booking options based on Phase 1 feedback |
| **Phase 3** | Add remaining rooms (Doc Lab, Phone Booths, Assembly, Shops, etc.) | Full room coverage |

---

## Phase 1 Decisions (Huddle Room Prototype)

### 1. ~~Room Auto-Approval Rules~~ — DECIDED

Auto-approval enabled for all Huddle Rooms:

| Role | Max Duration for Auto-Approval |
|------|-------------------------------|
| Student | 1 hour |
| Faculty | 4 hours |
| Admin/Staff | 4 hours |

Bookings exceeding these durations require manual approval.

### 2. ~~User Roles and Mappings~~ — DECIDED

Roles determined by NYU Identity API (`affiliation_sub_type`):

| Role | Identity API Affiliation |
|------|-------------------------|
| Student | STUDENT |
| Faculty | FACULTY |
| Admin/Staff | STAFF |

### 3. ~~Email Notification Content~~ — DECIDED

Generic templates created (similar to Media Commons style). Can be customized later via the schema editor.

### 4. ~~ITP Operations Email~~ — DECIDED

`booking-app+itp@itp.nyu.edu`

### 5. ~~Booking Policy Agreement~~ — DECIDED

Keep current text: _"I have read the ITP booking policy and agree to follow all policies outlined."_

### 6. ~~Calendar & Scheduling Configuration~~ — DECIDED

- 24-hour availability
- 15-minute slot unit
- Same hours for all roles
- No minimum advance notice

### 7. ~~Booking Duration Limits~~ — DECIDED

Same as auto-approval limits (Student: 1h max, Faculty/Admin: 4h max).

---

## Phase 2 Decisions (Walk-in & VIP) — Future

### 8. Walk-In Booking Support

**Decisions needed:**
- Should walk-in booking be enabled for Huddle Rooms?
- Can walk-in users book two consecutive slots?

### 9. VIP Booking Support

**Decisions needed:**
- Should VIP booking be enabled for ITP?
- If yes, which roles qualify as VIP? (e.g., Faculty only)

---

## Phase 3 Decisions (Additional Rooms) — Future

Room-specific configuration will be decided when Phase 3 planning begins, based on lessons learned from Phases 1 and 2.
