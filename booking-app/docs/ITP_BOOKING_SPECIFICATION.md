# ITP Room Booking System — Specification

> **Status:** Draft for PM review
> **Last Updated:** March 2026

---

## 1. System Overview

The ITP booking system allows ITP community members to reserve rooms through a web-based platform. It uses a **single-step approval** workflow with no service management (no staffing, catering, cleaning, security, or setup requests).

---

## 2. Rollout Phases

| Phase | Scope | Goal |
|-------|-------|------|
| **Phase 1** | Huddle Rooms only, auto-approval, no VIP/Walk-in | Simplest prototype — test how ITP uses the booking system |
| **Phase 2** | Add Walk-in and VIP support | Expand booking options based on Phase 1 feedback |
| **Phase 3** | Add remaining rooms (Doc Lab, Phone Booths, Assembly, Shops, etc.) | Full room coverage |

---

## 3. User Roles & Permissions

### Booking Roles (Determined by NYU Identity API)

| Role | Identity API Affiliation |
|------|-------------------------|
| Student | STUDENT |
| Faculty | FACULTY |
| Admin/Staff | STAFF |

### System Permission Levels

| Permission | What They Can Do |
|-----------|-----------------|
| **User** | Create bookings, view own bookings, cancel own bookings, edit bookings in Requested/Declined status |
| **PA** | All User capabilities + check guests in/out, mark no-shows |
| **Liaison** | All PA capabilities + approve/decline bookings |
| **Admin** | Full access to all bookings, all actions, and all settings |

---

## 4. Rooms

### Phase 1 — Huddle Rooms Only

| Room Name | Room ID | Capacity | Available Hours | Calendar |
|-----------|---------|----------|-----------------|----------|
| Huddle Room | 421 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 422 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 446 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 447 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 448 | 4 | 24 hours | ✅ Dev + Prod |

**Configuration:**
- Auto-approval: Enabled (Student ≤1h, Faculty/Admin ≤4h)
- Services: None
- Safety training: Not required
- Walk-in: Not enabled (Phase 2)
- VIP: Not supported (Phase 2)
- Slot unit: 15 minutes
- Booking policy: Generic agreement text

### Phase 3 — Additional Rooms (Future)

| Type | Rooms |
|------|-------|
| Room | Doc Lab (402), Room 404, Room 426, Room 450 |
| Phone Booth | 467, 469, 477 |
| Assembly | Red Square, Red Square North, Red Square South, South Patio |
| Shop | Soft Lab, Casting Tables, Shop Studio, Workshop, Popup Class, Woodshop, Basement Shop, Laser Cutters, Materials Kitchen |
| Workstation | Hyper Lab 01–04 |

---

## 5. Booking Flow

### 5.1 Standard Booking Flow

```
Step 1: Policy Acceptance
         │  Read and accept the ITP booking policy
         ▼
Step 2: Role & Affiliation
         │  Role auto-detected via NYU Identity API
         │  No N-Number, no Sponsor required
         ▼
Step 3: Room & Time Selection
         │  Select from available Huddle Rooms
         │  Visual calendar showing availability (24h)
         │  Click or drag to select time range
         │  Existing bookings visible on calendar
         ▼
Step 4: Booking Details
         │  Personal info: name, NetID, phone, email
         │  Event details: title, description, expected attendance
         │  No service options shown
         │  Accept booking policy agreement
         ▼
Step 5: Confirmation
         Submit → Auto-approved (if within limits) or Awaiting approval
```

### 5.2 Edit Booking Flow

Users can edit their booking when it is in **Requested** or **Declined** status.

```
Load Existing Booking Data
    ▼
Role Selection → Room Selection → Booking Details Form
    │  All fields pre-filled with existing data
    ▼
Submit → Booking returns to Requested status
```

### 5.3 Modification Flow (Admin/PA Only)

Available when booking is in **Approved** status.

```
Load Existing Booking Data → Modification Form → Submit
    Booking stays in current status (not reset)
```

---

## 6. Booking Lifecycle (State Machine)

### State Diagram

```
┌───────────┐
│ Requested  │ ← Initial state after submission
└─────┬─────┘
      │
      ├── Auto-approve conditions met ──────────────► Approved
      │                                                  │
      ├── Admin/Liaison approves ───────────────────► Approved
      │                                                  │
      ├── Approver declines ────────────────────────► Declined
      │                                                  │
      │                                    User edits within 24h
      │                                         → back to Requested
      │                                                  │
      │                                    Grace period expires
      │                                         → Canceled → Closed
      │
      └── User or system cancels ───────────────────► Canceled → Closed

┌───────────┐
│ Approved   │
└─────┬─────┘
      │
      ├── Guest checks in ─────────────────────────► Checked In
      │                                                  │
      │                                    Staff checks out guest
      │                                    (or auto-checkout after 30min)
      │                                                  │
      │                                                  ▼
      │                                            Checked Out
      │                                                  │
      │                                           (auto-close)
      │                                                  │
      │                                                  ▼
      │                                               Closed
      │
      ├── Guest doesn't show up ───────────────────► No Show → Canceled → Closed
      │
      └── User or system cancels ──────────────────► Canceled → Closed
```

### Booking Statuses

| Status | Description |
|--------|-------------|
| **Requested** | Booking submitted, awaiting approval |
| **Approved** | Approved by admin/liaison or auto-approved |
| **Checked In** | Guest has arrived |
| **Checked Out** | Guest has departed (auto-transitions to Closed) |
| **Closed** | Final state — booking lifecycle complete |
| **Declined** | Rejected by approver (24-hour grace period to edit and resubmit) |
| **Canceled** | Canceled by user, admin, or system (auto-transitions to Closed) |
| **No Show** | Guest didn't arrive (auto-transitions to Canceled → Closed) |

### What Happens at Each Status Change

| Transition | Side Effects |
|-----------|-------------|
| → Requested | Google Calendar event created, confirmation email to requester |
| → Approved | Approval email to requester, calendar updated, guest invited |
| → Declined | Decline email (with reason + 24h grace period), calendar updated |
| → Canceled | Cancellation email, calendar event deleted |
| → Checked In | Check-in email, calendar updated |
| → Checked Out | Checkout email, calendar updated, auto-close to Closed |
| → Closed | Closure email, calendar updated |
| → No Show | No-show email to guest and admin (with violation count), calendar updated |

---

## 7. Auto-Approval

Auto-approval is **enabled** for all Huddle Rooms:

| Role | Max Duration |
|------|-------------|
| Student | 1 hour |
| Faculty | 4 hours |
| Admin/Staff | 4 hours |

Bookings within the duration limit are automatically approved. Bookings exceeding the limit require manual approval by a Liaison or Admin.

---

## 8. Admin Panel

### Available Actions by Status

| Status | Admin Actions | PA Actions | Liaison Actions | User Actions |
|--------|--------------|------------|-----------------|--------------|
| **Requested** | Approve, Cancel, Decline | — | Approve, Decline | Cancel, Edit |
| **Approved** | Check In, Modification, No Show*, Cancel, Decline | Check In, Modification | — | Cancel |
| **Checked In** | Check Out, Cancel, Decline | Check Out | — | — |
| **Checked Out** | (auto-closed) | — | — | — |
| **Closed** | (no actions) | — | — | — |
| **Declined** | (no actions) | — | — | Cancel, Edit |
| **Canceled** | (no actions) | — | — | — |
| **No Show** | Check In, Cancel, Decline | Check In | — | — |

\* No Show action available 30 minutes after scheduled start time.

---

## 9. Email Notifications

### Operations Email

| Environment | Email |
|-------------|-------|
| Development | `booking-app-devs+operation@itp.nyu.edu` |
| Staging | `booking-app+itp@itp.nyu.edu` |
| Production | `booking-app+itp@itp.nyu.edu` |

### Email Templates

Configured with generic content. Can be customized via the schema editor.

| Template | Trigger |
|----------|---------|
| Request Confirmation | Booking submitted |
| Approval Request | Sent to approvers for review |
| Approval Notice | Booking approved |
| Declined | Booking declined |
| Canceled | Booking canceled |
| Late Cancel | Cancel within 24h of start |
| No Show | Guest didn't show up |
| Check-in Confirmation | Guest checked in |
| Checkout Confirmation | Guest checked out |
| Closed | Booking closed |

---

## 10. Automated Processes

| Process | Behavior | Schedule |
|---------|----------|----------|
| **Auto-checkout** | Bookings still in "Checked In" status 30 minutes after scheduled end → auto checkout | Every 30 minutes |
| **Auto-cancel declined** | Bookings in "Declined" status for 24 hours → auto cancel | Built into state machine (24h timer) |
| **Auto-close on checkout** | Checked Out → immediately transitions to Closed | Automatic (state machine `always` transition) |

---

## 11. Calendar Integration

- Every booking creates a Google Calendar event on the room's calendar
- Calendar IDs are configured per room (separate for dev and production)
- Calendar events are updated at each status change
- Calendar events are deleted on cancellation
- Users see room availability on the booking calendar view

---

## 12. Future Decisions (Phase 2+)

| Decision | Phase | Notes |
|----------|-------|-------|
| Walk-in booking support | Phase 2 | Enable for Huddle Rooms? Consecutive slots? |
| VIP booking support | Phase 2 | Which roles qualify as VIP? |
| Additional room configuration | Phase 3 | Auto-approval rules, duration limits per room type |
