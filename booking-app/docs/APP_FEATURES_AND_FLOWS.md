# Media Commons Booking App - Features & Flows

> **Last Updated:** March 2026
> **Application:** NYU Media Commons Booking System

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Booking Flows](#3-booking-flows)
4. [Booking Lifecycle](#4-booking-lifecycle)
5. [Auto-Approval](#5-auto-approval)
6. [Service Management](#6-service-management)
7. [Room & Resource Configuration](#7-room--resource-configuration)
8. [Admin Panel & Management](#8-admin-panel--management)
9. [Calendar Integration](#9-calendar-integration)
10. [Email Notifications](#10-email-notifications)
11. [Automated Processes](#11-automated-processes)
12. [Safety Training](#12-safety-training)
13. [Ban & Violation Tracking](#13-ban--violation-tracking)
14. [Blackout Periods](#14-blackout-periods)
15. [Equipment Checkout](#15-equipment-checkout)
16. [Authentication](#16-authentication)
17. [Page Map](#17-page-map)

---

## 1. System Overview

The Media Commons Booking App is a room and space reservation system for NYU Media Commons. It provides a complete booking lifecycle with multi-level approvals, parallel service management, and Google Calendar integration.

### Key Capabilities

- **Multi-step booking form** with role-based field display
- **Two-level approval workflow** (Liaison → Final Approver)
- **Auto-approval** for eligible bookings (based on role, duration, and services)
- **Walk-in and VIP booking flows** for on-the-spot and expedited reservations
- **Parallel service request management** — 6 service types (staff, equipment, catering, cleaning, security, setup) can be approved/declined independently
- **Google Calendar sync** — every booking creates and updates a calendar event
- **Equipment checkout tracking** via web checkout cart system
- **Safety training enforcement** — certain rooms require completed training
- **Automated email notifications** at every status change
- **Auto-checkout** and **auto-cancel** of stale bookings via scheduled jobs
- **Booking modification and editing**
- **Blackout period enforcement** — block bookings during closures
- **Ban/pre-ban system** — track violations and block repeat offenders
- **Full audit trail** — every status change is logged with timestamp and actor

---

## 2. User Roles & Permissions

### Booking Roles (Selected During Booking)

| Role | Category | Description |
|------|----------|-------------|
| Student | Student | NYU student |
| Resident/Fellow | Student | NYU resident or fellow |
| Faculty | Faculty | NYU faculty member |
| Admin/Staff | Admin | Administrative staff |
| Chair/Program Director | Admin | Department leadership |

The role category (Student, Faculty, Admin) determines booking hour limits and auto-approval eligibility.

### System Permission Levels

| Permission | What They Can Do |
|-----------|-----------------|
| **User** | Create bookings, view own bookings, cancel own bookings |
| **PA** | All User capabilities + check guests in/out, mark no-shows, manage day-of operations |
| **Liaison** | All PA capabilities + first-level approve/decline for their department's bookings |
| **Services** | All User capabilities + approve/decline/closeout individual services (catering, staffing, etc.) |
| **Admin** | Full access to all bookings across all departments, all actions, and all settings |

### Permission Hierarchy

```
Admin
  ├── Services Staff
        ├── Liaison
        │     └── PA
        │           └── User
        └── User
```

### Approver Levels

| Level | Role | Description |
|-------|------|-------------|
| First Approver (Liaison) | Department-level | Reviews and approves bookings for their department |
| Final Approver (Admin) | Organization-level | Gives final approval after liaison approval |
| Equipment Approver | Equipment-specific | Approves equipment checkout requests |

---

## 3. Booking Flows

### 3.1 Standard Booking Flow

The standard multi-step booking process:

```
Step 1: Policy Acceptance
         │  Read and accept the facility usage policy
         ▼
Step 2: Role & Affiliation
         │  Select School → Department (auto-mapped)
         │  Select Role (Student, Faculty, Admin/Staff, etc.)
         │  Fields auto-fill from NYU directory if available
         ▼
Step 3: Room & Time Selection
         │  Select one or more rooms from the list
         │  Visual calendar showing availability
         │  Click or drag to select time range
         │  Existing bookings and blackout periods are visible
         │  System validates: duration limits, blackout conflicts, overlaps
         ▼
Step 4: Booking Details
         │  Personal info: name, NetID, N-Number, phone, email
         │  Event details: title, description, booking type, expected attendance
         │  Services (shown based on room capabilities):
         │    • Room Setup + details
         │    • Equipment Services
         │    • Staffing Services (audio tech, lighting, etc.)
         │    • Catering (NYU Plated or Outside Catering)
         │    • Cleaning (CBS Cleaning)
         │    • Hire Security
         │  Sponsor info (optional)
         │  Accept required agreements
         │
         │  Real-time alerts shown for:
         │    ✓ Auto-approval eligibility (green indicator)
         │    ⚠ Safety training required
         │    ✗ User is banned
         │    ⚠ Blackout period conflict
         │    ✗ Duration limit exceeded
         │    ⚠ Time-sensitive booking (less than configured threshold)
         │    ⚠ Overlap with existing booking
         ▼
Step 5: Confirmation
         Submit → Success or Error display
         Link to "View My Bookings"
```

After submission, the booking enters the lifecycle as **Requested** (or **Approved** if auto-approval conditions are met).

### 3.2 Walk-In Booking Flow

Walk-in bookings are created by staff (PAs, Admins) on behalf of a visitor who is physically present.

```
Step 1: Walk-In Landing
         ▼
Step 2: Enter Walk-In Person's NetID
         │  Must be different from the staff member's own NetID
         │  The walk-in person's safety training and ban status are checked
         ▼
Step 3: Role & Affiliation (for the walk-in person)
         ▼
Step 4: Room Selection
         │  Only walk-in-eligible rooms are shown
         │  Walk-in-specific hour limits apply
         ▼
Step 5: Booking Details → Confirmation
```

**Key differences from standard flow:**
- Only rooms marked as walk-in-eligible are shown
- Some rooms allow up to 2 consecutive hours for walk-ins
- Walk-in bookings are **auto-approved** (skip the approval queue)
- Safety training and ban checks apply to the walk-in person, not the staff member creating the booking

### 3.3 VIP Booking Flow

VIP bookings are expedited bookings typically created by admins.

```
Step 1: VIP Landing
         ▼
Step 2: Role & Affiliation
         ▼
Step 3: Room & Time Selection → Booking Details → Confirmation
```

**Key differences from standard flow:**
- VIP-specific hour limits per role apply
- VIP bookings are **auto-approved** (skip the approval queue)
- Only available when VIP support is enabled in the configuration

### 3.4 Edit Booking Flow

For editing a previously submitted booking.

**Who can edit:**
- **Regular users** can edit their booking when it is in **Requested**, **Pre-approved**, or **Declined** status — i.e., any time before final approval, or after a decline (to fix and resubmit)
- **Admins** can edit bookings in additional statuses

```
Load Existing Booking Data
    ▼
Role Selection → Room Selection → Booking Details Form
    │  All fields pre-filled with existing data
    │  User modifies as needed
    ▼
Submit → Booking returns to Requested status
```

After an edit, the booking goes back to **Requested** status and re-enters the approval workflow.

### 3.5 Modification Flow (Admin/PA Only)

For making modifications to a booking that has already been approved or is in progress. This flow is only available to **Admins and PAs**, not regular users.

**Available when:**
- Booking is in **Approved** status
- Booking is in **Walk-In** status

```
Load Existing Booking Data
    ▼
Modification Form → Room Selection → Confirmation
    │  Pre-filled with existing data
    ▼
Submit → Booking updated (stays in current status)
```

Unlike editing, modification does not reset the booking to Requested status.

---

## 4. Booking Lifecycle

Every booking follows a state machine that controls which actions are available and what happens at each stage. The Media Commons lifecycle includes parallel service management.

### Status Flow Diagram

```
┌───────────┐
│ Requested  │ ← Initial state after submission
└─────┬─────┘
      │
      ├── Auto-approve conditions met ──────────────► Approved
      │
      ├── Liaison approves (1st approval) ─────────► Pre-approved
      │                                                   │
      │                                    Admin approves (2nd approval)
      │                                                   │
      │                              ┌── Has services? ───┤
      │                              │                     │
      │                    Services under review      No services
      │                    (each service approved/        │
      │                     declined independently)       │
      │                    (status stays Pre-approved)    │
      │                              │                     ▼
      │                     All approved? ────────────► Approved
      │                     Any declined? ────────────► Declined
      │
      ├── Approver declines ───────────────────────────► Declined
      │                                                     │
      │                                         User edits within
      │                                         grace period → Requested
      │                                                     │
      │                                         Grace period expires
      │                                              → Canceled
      │
      └── User or system cancels ──────────────────────► Canceled

┌───────────┐
│ Approved   │
└─────┬─────┘
      │
      ├── Guest checks in ────────────────────────────► Checked In
      │                                                     │
      │                                         Staff checks out guest
      │                                         (or auto-checkout after 30min)
      │                                                     │
      │                                                     ▼
      │                                               Checked Out
      │                                                     │
      │                                         ┌── Has services? ───┐
      │                                         │                     │
      │                                    Service Closeout      No services
      │                                    (close each service)       │
      │                                         │                     │
      │                                    All closed out             │
      │                                         │                     │
      │                                         ▼                     ▼
      │                                      Closed               Closed
      │
      ├── Guest doesn't show up ──────────────────────► No Show → Canceled
      │
      ├── User or system cancels ──────────────────────► Canceled
      │
      └── Approver declines (post-approval) ──────────► Declined
```

### Booking Statuses

| Status | Description |
|--------|-------------|
| **Requested** | Booking has been submitted and is awaiting review |
| **Pre-approved** | Liaison (first approver) has approved; awaiting final approval or services are being reviewed |
| **Approved** | Fully approved; the event is confirmed |
| **Checked In** | Guest has arrived and been checked in by staff |
| **Checked Out** | Guest has departed; event is complete |
| **Closed** | Final state; all operations and service closeouts are complete |
| **Declined** | Rejected by an approver (user has a grace period to edit and resubmit) |
| **Canceled** | Canceled by the user, admin, or system |
| **No Show** | Guest did not arrive for their booking |

### What Happens at Each Status Change

| Transition | Side Effects |
|-----------|-------------|
| → Requested | Google Calendar event created, confirmation email sent to requester |
| → Pre-approved | Email sent to final approver for review, calendar updated |
| → Approved | Approval email sent to requester and approver, calendar updated, guest invited to event |
| → Declined | Decline email sent (with reason and grace period), calendar updated |
| → Canceled | Cancellation email sent, calendar event deleted |
| → Checked In | Check-in email sent, calendar updated |
| → Checked Out | Checkout email sent, calendar updated |
| → Closed | Closure email sent, calendar updated |
| → No Show | No-show email sent to guest and admin (includes violation count), calendar updated |

### Booking Origins

| Origin | Description |
|--------|-------------|
| User | Created by end user through the standard booking form |
| Admin | Created by an administrator |
| Walk-in | Created through the walk-in flow |
| VIP | Created through the VIP flow |
| System | Created by an automated process |
| Pregame | Imported from pregame calendar sync |

---

## 5. Auto-Approval

Bookings can automatically skip the approval queue and be immediately approved when all conditions are met.

### Auto-Approval Rules

| Condition | Result |
|-----------|--------|
| VIP booking | Always auto-approved |
| Walk-in booking | Always auto-approved |
| No rooms selected | Cannot auto-approve |
| Any selected room does not have auto-approval enabled | Cannot auto-approve |
| Booking duration below the room's minimum hours for the user's role | Cannot auto-approve |
| Booking duration above the room's maximum hours for the user's role | Cannot auto-approve |
| Any requested service is not allowed for auto-approval on the room | Cannot auto-approve |
| All of the above checks pass | Auto-approved |

### Service Auto-Approval Conditions

Each room can be configured to allow or block auto-approval for each service type:
- Room Setup
- Equipment
- Staffing
- Catering
- Cleaning
- Security

If a user requests a service that is not allowed for auto-approval on the selected room, the booking goes through the normal approval queue instead.

### VIP with Services (Special Case)

VIP bookings that include service requests are routed to the **Services Request** parallel state (services must be individually approved), but the booking itself is treated as approved.

---

## 6. Service Management

Media Commons supports six service types that are managed independently alongside the main booking approval. Each requested service goes through its own lifecycle.

### Available Services

| Service | Options |
|---------|---------|
| **Staffing** | Audio technician (Garage 103), Audio technician (Audio Lab 230), Lighting technician (Garage 103), DMX lights (Rooms 220-224), Campus Media Services (Rooms 202/1201) |
| **Equipment** | Equipment Checkout |
| **Catering** | NYU Plated, Outside Catering |
| **Cleaning** | CBS Cleaning Services |
| **Security** | Hire Security |
| **Room Setup** | Custom setup with details |

Some services require a **chart field** (billing code) when selected:
- Catering, Cleaning, Security, and Room Setup each have a chart field input

### Service Approval Workflow

Each requested service is approved or declined independently and in parallel:

```
Service Requested
    │
    ├── Approved by services staff
    │
    └── Declined by services staff
```

**Resolution:**
- If **all** requested services are approved → the booking moves to **Approved**
- If **any** requested service is declined → the booking moves to **Declined**
  - The decline email lists which specific services were declined

### Service Closeout

After a booking is checked out (or canceled), each requested service must be individually closed out before the booking can reach the final **Closed** state:

```
Service Closeout Pending → Closed Out
```

All services must be closed out before the booking is fully closed.

### Pregame Bookings

Bookings imported from the pregame calendar sync automatically have all their requested services approved when the final approval is granted.

---

## 7. Room & Resource Configuration

Each room or space has configurable settings that control its behavior in the booking system.

### Room Properties

| Property | Description |
|----------|-------------|
| Name | Display name of the room |
| Capacity | Maximum occupancy |
| Calendar | Linked Google Calendar for event sync |
| Safety Training Required | Whether users must complete training before booking |
| Training Form URL | Link to the safety training Google Form |
| Walk-In Eligible | Whether the room appears in the walk-in flow |
| Walk-In 2-Hour Booking | Whether walk-ins can book up to 2 consecutive hours |
| Equipment Room | Whether the room involves equipment checkout |
| Available Services | Which services (staffing, catering, etc.) can be requested |
| Staffing Options | Available staffing types and sections |

### Booking Hour Limits

Each room has configurable minimum and maximum booking hours, broken down by:

| | Student | Faculty | Admin |
|---|---------|---------|-------|
| **Standard booking** | min/max hours | min/max hours | min/max hours |
| **Walk-in booking** | min/max hours | min/max hours | min/max hours |
| **VIP booking** | min/max hours | min/max hours | min/max hours |

### Auto-Approval Conditions (Per Room)

Each room can enable or disable auto-approval, and specify which services are allowed under auto-approval:

| Condition | Allowed? |
|-----------|----------|
| With Room Setup | Configurable |
| With Equipment | Configurable |
| With Staffing | Configurable |
| With Catering | Configurable |
| With Cleaning | Configurable |
| With Security | Configurable |

---

## 8. Admin Panel & Management

### Navigation

The navigation bar adapts based on the user's permission level:

| Role | Available Actions |
|------|------------------|
| User | "Book" button |
| PA | "Walk-In" button |
| Liaison | "Walk-In" button |
| Services | "Walk-In" button |
| Admin | "VIP" button + "Walk-In" button |

Users with multiple roles see a dropdown to switch between views.

### Admin Dashboard

Two main tabs:

**1. Bookings Tab**
- Full booking table with all bookings across departments
- Color-coded status indicators:

| Status | Color |
|--------|-------|
| Approved | Green |
| Requested | Orange |
| Pre-approved | Purple |
| Checked In | Purple |
| Checked Out | Light Purple |
| Equipment | Gold |
| No Show | Light Blue |
| Pending | Magenta |
| Declined | Red |
| Canceled / Closed | Gray |

- Filters: status, date range, origin, room, service type, text search
- Click any booking to see full details, contact info, services, and complete history timeline

**2. Settings Tab** — 11 configuration sections:

#### Safety Training
Manage users who have completed safety training. Add or remove users, track completion dates.

#### PA Users
Add or remove PA accounts by email.

#### Admin Users
Add or remove administrator accounts by email. Only users on this list can access the admin panel.

#### Approvers
- **Liaisons**: First-level approvers assigned to specific departments
- **Equipment Users**: Approvers for equipment checkout requests

#### Departments
Add or remove departments. Assign tier levels (Primary, Secondary, Tertiary) for categorization.

#### Pre-ban (Violation Tracking)
View users with warning flags for late cancellations or no-shows. See detailed incident history. Clear warnings when appropriate.

#### Ban
Manage permanently banned users. Banned users cannot create any bookings.

#### Booking Types
Configure the options available in the booking type dropdown.

#### Policy Settings
- **Blackout Periods**: Configure dates/times when bookings are blocked
- **Final Approver**: Designate the final approval authority

#### Export Database
One-click CSV export of all booking data.

#### Sync Calendars
- **Manual Import**: Import manually created Google Calendar events into the system
- **Pregame Import**: Import pre-event calendar entries with dry-run preview before committing

### Liaison Dashboard

- View and manage bookings for the liaison's assigned department
- First-level approve or decline actions
- Accessible to: Liaisons, Admins

### PA Dashboard

- Manage day-of operations: check-in, check-out, no-show
- Equipment tracking
- Accessible to: PAs, Admins

### Services Dashboard

- View only bookings that have service requests
- Approve, decline, or closeout individual services
- Accessible to: Services staff, Admins

---

## 9. Calendar Integration

### Synchronization with Google Calendar

Every booking creates a corresponding Google Calendar event:

- **Created** when a booking is first submitted
- **Updated** on every status change (approval, decline, check-in, etc.)
- **Deleted** when a booking is canceled

The calendar event description includes structured booking details:
- Request info (number, rooms, dates, status)
- Requester info (name, school, department, role, contact)
- Event details (title, description, type, attendance)
- Services requested

### Calendar Event Behavior by Status

- **Canceled** bookings: the Google Calendar event is **deleted**, so the booking no longer appears on the calendar
- **Declined** bookings: the Google Calendar event remains visible, but its title is updated with a `[DECLINED]` prefix
- **No Show** bookings: the Google Calendar event remains visible, but its title is updated with a `[NO_SHOW]` prefix
- **Checked Out** bookings: the Google Calendar event remains visible, but its title is updated with a `[CHECKED_OUT]` prefix

### Calendar UI (Room Selection)

The room selection page features an interactive calendar:
- Rooms displayed as vertical columns
- Time slots in 30-minute or 1-hour intervals (configurable)
- Click or drag to select a time range
- Existing bookings shown as colored blocks
- Blackout periods shown as grayed-out, unselectable zones
- Past times are disabled

---

## 10. Email Notifications

The system sends automated email notifications at every stage of the booking lifecycle.

### Email Types

| When | Who Receives It | What It Contains |
|------|----------------|-----------------|
| Booking submitted | Requester | Confirmation of request received |
| Needs liaison review | Liaison (first approver) | Request to review and approve/decline |
| Liaison approved | Final Approver | Request for final approval |
| Fully approved | Requester + Final Approver | Approval confirmation |
| Walk-in created | Walk-in guest | Booking confirmation |
| VIP created | VIP guest | Booking confirmation |
| Guest checked in | Guest | Check-in confirmation |
| Guest checked out | Guest | Checkout confirmation |
| Booking declined | Requester | Decline reason + grace period to edit |
| No-show recorded | Guest + Admin | No-show notification with violation count |
| Booking canceled | Guest | Cancellation confirmation |
| Late cancellation | Guest | Late cancellation notice |
| Services closed out | Guest | Closure confirmation |

### Decline Email Details

When a booking is declined, the email includes:
- The reason provided by the approver
- A list of specific services that were declined (if applicable)
- A grace period notice (e.g., "You have 24 hours to edit your request before it is automatically canceled")
- A link to edit and resubmit the booking

### Email Content

Every email includes:
- A status-specific header message (customizable per tenant)
- Complete booking details
- Full booking history timeline showing all status changes with timestamps

---

## 11. Automated Processes

### Auto-Cancel Declined Bookings

Bookings that remain in **Declined** status past the configured grace period (default: 24 hours) are automatically canceled by the system.

**How it works:**
1. System checks for declined bookings older than the grace period
2. Confirms the booking hasn't been edited or resubmitted in the meantime
3. Automatically transitions to Canceled
4. Standard cancellation side effects apply (email, calendar deletion)

### Auto-Checkout

Bookings where the guest remains checked in past the scheduled end time are automatically checked out.

**How it works:**
1. System looks for bookings in "Checked In" status with end times in the past
2. Waits 30 minutes after the scheduled end time as a buffer
3. Automatically transitions to Checked Out
4. Standard checkout side effects apply (email, calendar update)

Both automated processes support a **dry-run mode** for previewing what would be affected before execution.

---

## 12. Safety Training

### How It Works

1. Certain rooms are configured to require safety training
2. Users complete training via a Google Form (linked per room)
3. The system tracks which users have completed training
4. During booking, the system validates the user's training status

### Enforcement

- **Standard bookings**: The requester's training is checked
- **Walk-in bookings**: The walk-in person's training is checked (not the staff member creating the booking)
- If training is required but not completed:
  - A warning alert is shown on the booking form
  - A link to the training form is provided
  - The booking may be blocked until training is completed
- Admins can manually add or remove users from the trained list

---

## 13. Ban & Violation Tracking

### Pre-Ban (Warning System)

The system tracks two types of policy violations:

| Violation | Description |
|-----------|-------------|
| **Late Cancellation** | User canceled a booking too close to the event time |
| **No-Show** | User did not arrive for their booking |

Each violation is logged with a timestamp. Admins can:
- View the complete violation history per user
- See the count and dates of each violation type
- Clear warnings when appropriate
- Escalate to a full ban for repeat offenders

### Full Ban

- Banned users are completely blocked from creating bookings
- The booking form shows a red alert: "You are banned from making bookings"
- The submit button is disabled
- Admins manage bans through the Settings panel

---

## 14. Blackout Periods

Blackout periods are time ranges during which bookings are not allowed.

### Configuration Options

| Setting | Description |
|---------|-------------|
| Name | Descriptive label (e.g., "Winter Break", "Maintenance Window") |
| Start Date | When the blackout begins |
| End Date | When the blackout ends |
| Start Time | Optional daily start time (for partial-day blackouts) |
| End Time | Optional daily end time (for partial-day blackouts) |
| Active | Whether the blackout is currently enforced |
| Rooms | Specific rooms only, or all rooms |

### Enforcement

- Blackout periods appear as grayed-out zones on the booking calendar
- Users cannot select time slots within blackout periods
- A warning is displayed if a booking would overlap with a blackout period
- Admins configure blackout periods in Settings > Policy Settings

---

## 15. Equipment Checkout

### Features

- Equipment checkout is tracked via a web checkout cart system
- Each booking can have an associated cart number
- Equipment checkout status is tracked (checked out / returned)
- Cart details are viewable from the booking detail modal
- Authorized staff can update cart information

### Equipment Approval

- Equipment requests follow the standard service approval workflow
- Equipment-specific approvers can approve or decline requests
- Equipment checkout status is toggleable in the booking detail modal

---

## 16. Authentication

### Sign-In

- Users sign in with their **Google account** (NYU email required)
- Only `@nyu.edu` email addresses are permitted
- Non-NYU users see a "forbidden" page

### NYU Identity Integration

- The system looks up users in the NYU directory by NetID or N-Number
- User information (school, department, role) is auto-filled during booking
- This reduces manual data entry and improves accuracy

---

## 17. Page Map

### User Pages

| Page | Description |
|------|-------------|
| Home / My Bookings | View all of the user's current and past bookings |
| Book → Policy | Accept the facility usage policy |
| Book → Role | Select school, department, and role |
| Book → Select Room | Choose room(s) and time from the calendar |
| Book → Form | Fill in booking details, services, and agreements |
| Book → Confirmation | Submit and see success or error |

### Walk-In Pages

| Page | Description |
|------|-------------|
| Walk-In → Landing | Start the walk-in flow |
| Walk-In → NetID | Enter the walk-in person's NetID |
| Walk-In → Role | Select the walk-in person's affiliation |
| Walk-In → Select Room | Choose a walk-in-eligible room and time |
| Walk-In → Form | Fill in booking details |
| Walk-In → Confirmation | Submit and see success or error |

### VIP Pages

| Page | Description |
|------|-------------|
| VIP → Landing | Start the VIP flow |
| VIP → Role | Select affiliation |
| VIP → Select Room | Choose room and time |
| VIP → Form | Fill in booking details |
| VIP → Confirmation | Submit and see success or error |

### Edit Pages (Users, Admins)

| Page | Description |
|------|-------------|
| Edit → Landing | Load existing booking for editing |
| Edit → Role / Room / Form | Modify booking details, returns to Requested status |

### Modification Pages (Admin/PA Only)

| Page | Description |
|------|-------------|
| Modification → Landing | Load existing booking for modification |
| Modification → Form / Room / Confirmation | Modify and confirm changes |

### Approval Pages (Linked from Emails)

| Page | Description |
|------|-------------|
| Approve | One-click approval page (linked from approval emails) |
| Decline | Decline page with required reason field |

### Management Pages

| Page | Who Can Access | Description |
|------|---------------|-------------|
| Admin | Admin | Full booking management + system settings |
| Liaison | Liaison, Admin | Department booking approval |
| PA | PA, Admin | Day-of operations (check-in/out) |
| Services | Services, Admin | Service request management |
