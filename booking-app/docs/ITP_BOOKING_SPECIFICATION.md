# ITP Room Booking System — Specification

> **Status:** Draft for PM review
> **Last Updated:** March 2026

---

## 1. System Overview

The ITP booking system allows ITP community members to reserve rooms through a web-based platform. It uses a **single-step approval** workflow with no service management (no staffing, catering, cleaning, security, or setup requests).

---

## 2. User Roles & Permissions

### Booking Roles (Selected During Booking)

| Role | Description |
|------|-------------|
| Student | NYU student (ITP / IMA / Low Res) |
| Faculty | NYU faculty member |
| Admin/Staff | Administrative staff |

### System Permission Levels

| Permission | What They Can Do |
|-----------|-----------------|
| **User** | Create bookings, view own bookings, cancel own bookings, edit bookings in Requested/Declined status |
| **PA** | All User capabilities + check guests in/out, mark no-shows |
| **Liaison** | All PA capabilities + approve/decline bookings |
| **Admin** | Full access to all bookings, all actions, and all settings |

---

## 3. Rooms

### Phase 1 — Huddle Rooms Only

| Room Name | Room ID | Capacity | Available Hours | Calendar |
|-----------|---------|----------|-----------------|----------|
| Huddle Room | 421 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 422 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 446 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 447 | 4 | 24 hours | ✅ Dev + Prod |
| Huddle Room | 448 | 4 | 24 hours | ✅ Dev + Prod |

**Configuration:**
- Auto-approval: Disabled (all bookings require manual approval)
- Services: None
- Safety training: Not required
- Walk-in: Not enabled
- VIP: Not supported

### Phase 3 — Additional Rooms (Future)

| Type | Rooms |
|------|-------|
| Room | Doc Lab (402), Room 404, Room 426, Room 450 |
| Phone Booth | 467, 469, 477 |
| Assembly | Red Square, Red Square North, Red Square South, South Patio |
| Shop | Soft Lab, Casting Tables, Shop Studio, Workshop, Popup Class, Woodshop, Basement Shop, Laser Cutters, Materials Kitchen |
| Workstation | Hyper Lab 01–04 |

---

## 4. Booking Flow

### 4.1 Standard Booking Flow

```
Step 1: Policy Acceptance
         │  Read and accept the ITP booking policy
         ▼
Step 2: Role & Affiliation
         │  Select Role (Student, Faculty, Admin/Staff)
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
         Submit → Success or Error display
```

### 4.2 Edit Booking Flow

Users can edit their booking when it is in **Requested** or **Declined** status.

```
Load Existing Booking Data
    ▼
Role Selection → Room Selection → Booking Details Form
    │  All fields pre-filled with existing data
    ▼
Submit → Booking returns to Requested status
```

### 4.3 Modification Flow (Admin/PA Only)

Available when booking is in **Approved** status.

```
Load Existing Booking Data → Modification Form → Submit
    Booking stays in current status (not reset)
```

---

## 5. Booking Lifecycle (State Machine)

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

## 6. Auto-Approval (Currently Disabled)

Auto-approval is **disabled** for Phase 1. All bookings require manual approval.

> **PM Decision Needed:** Confirm auto-approval rules before enabling. See `docs/ITP_SCHEMA_DECISIONS.md` §1.

---

## 7. Admin Panel

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

## 8. Email Notifications

### Operations Email

| Environment | Email |
|-------------|-------|
| Development | `booking-app-devs+operation@itp.nyu.edu` |
| Staging | TBD (using dev placeholder) |
| Production | TBD (using dev placeholder) |

> **PM Decision Needed:** Confirm ITP operations email address. See `docs/ITP_SCHEMA_DECISIONS.md` §4.

### Email Templates

| Template | Trigger | Current Status |
|----------|---------|---------------|
| Request Confirmation | Booking submitted | **Empty — needs content** |
| Approval Notice | Booking approved | **Empty — needs content** |
| Declined | Booking declined | **Empty — needs content** |
| Canceled | Booking canceled | **Empty — needs content** |
| Late Cancel | Cancel within 24h of start | **Empty — needs content** |
| No Show | Guest didn't show up | **Empty — needs content** |
| Check-in Confirmation | Guest checked in | **Empty — needs content** |
| Checkout Confirmation | Guest checked out | **Empty — needs content** |
| Closed | Booking closed | **Empty — needs content** |

> **PM Decision Needed:** Email template content. See `docs/ITP_SCHEMA_DECISIONS.md` §3.

---

## 9. Automated Processes

| Process | Behavior | Schedule |
|---------|----------|----------|
| **Auto-checkout** | Bookings still in "Checked In" status 30 minutes after scheduled end → auto checkout | Every 30 minutes |
| **Auto-cancel declined** | Bookings in "Declined" status for 24 hours → auto cancel | Built into state machine (24h timer) |
| **Auto-close on checkout** | Checked Out → immediately transitions to Closed | Automatic (state machine `always` transition) |

---

## 10. Calendar Integration

- Every booking creates a Google Calendar event on the room's calendar
- Calendar IDs are configured per room (separate for dev and production)
- Calendar events are updated at each status change
- Calendar events are deleted on cancellation
- Users see room availability on the booking calendar view

---

## 11. Configuration Summary

### Tenant Schema Settings

| Setting | Value |
|---------|-------|
| `tenant` | `itp` |
| `name` | `ITP` |
| `logo` | `/nyuLogo.png` |
| `showNNumber` | false |
| `showSponsor` | false |
| `showSetup` | false |
| `showEquipment` | true |
| `showStaffing` | false |
| `showCatering` | false |
| `showHireSecurity` | false |
| `showBookingTypes` | false |
| `supportVIP` | false |
| `supportWalkIn` | false |
| `declinedGracePeriod` | 24 hours |
| `calendarConfig.startHour` | `00:00:00` (all roles, 24h) |
| `calendarConfig.slotUnit` | 15 minutes |
