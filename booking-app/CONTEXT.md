# Booking App

Multi-tenant room booking for NYU schools. A requester walks a stepped request form to reserve one or more resources for a time slot, optionally asking for services that approvers then handle.

## Language

### Request form

**Request form**:
The stepped flow a requester walks to create, edit, or modify a booking. Runs under five contexts: book, VIP, walk-in, modification, and edit.
_Avoid_: booking form (as a page name), wizard

**Step**:
One page of the request form with its own route and Stepper label. The set of steps is computed per context and per request; a step with nothing to show is skipped and its label hidden.
_Avoid_: page (when the route matters), stage

**Details**:
The step that collects contact information, sponsor, and reservation details for a request.
_Avoid_: form page, booking details (that term belongs to the bookings table modal)

**Services**:
The step that collects a request's service requests. Sits after Details and before Confirmation.
_Avoid_: service details, service details page, services form

**Service section**:
One offered service on the Services step: its toggle or choice plus the detail and chartfield fields that hang off it, shown per resource.
_Avoid_: service block, service group

**Service requests**:
The set of answers a request carries across its service sections.
_Avoid_: service details, selected services, service selections

**Submit block**:
The Agreement attestations together with the Submit button. Rendered on whichever step is last.
_Avoid_: agreement section

**Locked toggle**:
A service section whose answer is fixed for this request, either by the resource's schema lock or by a rule such as expected attendance forcing security. Shown disabled with its fixed value.
_Avoid_: forced service, disabled switch

**Service decision**:
An approver's answer for one requested service: approved, declined, or still pending. One per service for the whole booking, not per resource; Media Commons only. Carried on the booking as the per-service approval flags and in the machine context.
_Avoid_: service approval (as a noun for the state), service status, approval flag (in prose)

**Memo**:
A staff-only free-text note on a booking, such as a work order confirmation number. Shown directly under the WebCheckout section of the booking detail modal when the tenant schema enables `detail.showMemo`, to the roles listed in `detail.memoRoles` on their own pages. Stored as `memo` on the booking document and redacted server-side from booking reads for callers outside those roles.
_Avoid_: note (that word is the booking history column), comment, work order field

**Decision mark**:
The green check or red X shown on a service section in the edit and modification contexts to surface its service decision. Same icons as the bookings table Services column. A pending service shows no mark.
_Avoid_: approval badge, approved indicator, status chip
