# XState Approval Flow E2E Tests

This directory contains comprehensive end-to-end tests for the XState approval flow in the booking application.

## Test Coverage

### Core Flow Tests
- ✅ **Tenant-based Access - MC**: Access MC tenant (/mc/) → Dashboard accessible + Auto-approve scenarios
- ✅ **VIP without services**: VIP booking with servicesRequested=false → Reservation auto-approved  
- ✅ **VIP with services**: VIP booking with servicesRequested=true & shouldAutoApprove=false → Pre-approved → Services Request flow
- ✅ **Walk-in**: Make walk-in reservation → Reservation auto-approved
- ✅ **Standard Reservation**: Make reservation → Status = Requested until approved
- ✅ **Edit (Requested)**: User edits while status = Requested → Stays in Requested; no duplicate createCalendarEvent
- ✅ **Modification (Admin)**: Admin modifies reservation → Calendar updated; state rules unchanged
- ✅ **Cancel (User)**: User cancels booking → Canceled → (servicesRequested? Service Closeout : Closed)

### Legacy & State Management
- ✅ **Existing legacy reservations**: Import existing reservation into Xstate → State derived correctly
- ✅ **Checked out without services**: From Checked In send checkOut; servicesRequested=false → Goes directly to Closed

### User Role Access Tests  
- ✅ **General User**: Login with general user credentials → User can log in successfully
- ✅ **PA Access**: Login with PA account → Can view booking list/check-in/check-out/modify booking
- ✅ **Liaison Access**: Login with Liaison account → Can view assigned/approve/decline bookings
- ✅ **Admin Access**: Login with Admin account → Filters work correctly

### Service Management Tests
- ✅ **Individual Service Approvals**: Admin can approve Staffing/Equipment/Setup/Catering/Security Services
- ✅ **All services approved ⇒ Approved**: All 6 branches reach final in Services Request
- ✅ **Any service declined ⇒ Declined**: At least one branch ends in Declined
- ✅ **All closeouts complete ⇒ Closed**: All Service Closeout branches final

### Advanced Flow Tests
- ✅ **Priority**: auto-approve over VIP+services: shouldAutoApprove=true AND isVip AND servicesRequested=true → Goes to Approved
- ✅ **Cascade to Canceled**: From Approved send noShow → No Show entry actions then Canceled entry
- ✅ **Pre ban**: From Approved send noShow → Added history to pre ban
- ✅ **Selective closeouts**: Only approved branches require closeout
- ✅ **Idempotency**: Requested → Requested via edit → createCalendarEvent not fired twice

## File Structure

```
tests/e2e/
├── xstate-approval-flow.e2e.test.ts     # Main test suite
├── helpers/
│   ├── booking-test-helpers.ts          # Reusable test utilities and page objects
│   └── mock-services.ts                 # Mock implementations for external services
├── .env.test.example                    # Environment configuration template
└── README.md                           # This documentation
```

## Setup

### 1. Environment Configuration

Copy the environment template and configure test credentials:

```bash
cp .env.test.example .env.test.local
```

Edit `.env.test.local` with actual test user credentials:

```env
TEST_GENERAL_USER_EMAIL=your.test.user@nyu.edu
TEST_GENERAL_USER_PASSWORD=your_test_password

TEST_PA_USER_EMAIL=your.pa.test@nyu.edu
TEST_PA_USER_PASSWORD=your_test_password

TEST_LIAISON_USER_EMAIL=your.liaison.test@nyu.edu
TEST_LIAISON_USER_PASSWORD=your_test_password

TEST_ADMIN_USER_EMAIL=your.admin.test@nyu.edu
TEST_ADMIN_USER_PASSWORD=your_test_password
```

### 2. Test Database Setup

Ensure you have a dedicated test database to avoid conflicts with development data:

```env
TEST_DATABASE_URL=your_test_database_connection_string
```

### 3. Application Setup

Start the application in test mode:

```bash
npm run dev
```

Make sure the application is running on `http://localhost:3000` before running tests.

## Running Tests

### Run All XState Tests

```bash
npm run test:e2e -- tests/e2e/xstate-approval-flow.e2e.test.ts
```

### Run Specific Test Suites

```bash
# Test only VIP scenarios
npx playwright test --grep "VIP Scenarios"

# Test only service management
npx playwright test --grep "Service Management"

# Test only user role access
npx playwright test --grep "User Role Access"
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug tests/e2e/xstate-approval-flow.e2e.test.ts
```

### Run Tests in Headed Mode (see browser)

```bash
npx playwright test --headed tests/e2e/xstate-approval-flow.e2e.test.ts
```

## Test Architecture

### Helper Classes

#### `BookingTestHelper`
Main helper class that provides high-level booking operations:
- `loginUser(user)` - Authenticate with different user roles
- `createCompleteBooking(data, options)` - Create a full booking flow
- `approveBooking()` - Admin approve a booking
- `approveService(serviceType)` - Approve specific services
- `getBookingStatus()` - Get current booking status
- `assertBookingStatus(expected)` - Assert booking is in expected state

#### `TestDataFactory`
Factory for generating consistent test data:
- `createStandardBooking()` - Standard booking data
- `createVipBooking()` - VIP booking data  
- `createWalkInBooking()` - Walk-in booking data
- `createServicesRequested(services)` - Service request configuration

#### `TestUsersFactory`
Factory for test user credentials:
- `getGeneralUser()` - General user credentials
- `getPAUser()` - PA user credentials
- `getLiaisonUser()` - Liaison user credentials
- `getAdminUser()` - Admin user credentials

### Mock Services

The `MockServices` class provides isolated testing by mocking external dependencies:

- **Calendar API Mocking**: Prevents actual calendar events from being created
- **Email Service Mocking**: Prevents actual emails from being sent
- **Database Mocking**: Provides predictable responses for testing
- **XState Context Mocking**: Allows testing specific XState scenarios

### XState Testing Utilities

The `XStateTestUtils` class provides XState-specific testing capabilities:

- **State Transition Verification**: Verify specific state transitions occurred
- **Guard Execution Verification**: Verify XState guards were executed
- **Action Execution Verification**: Verify XState actions were executed
- **State Waiting**: Wait for specific states to be reached

## Test Patterns

### 1. State Transition Testing

```typescript
test('VIP booking with services goes to Services Request', async ({ page }) => {
  const helper = new BookingTestHelper(page);
  
  await helper.loginUser(TestUsersFactory.getGeneralUser());
  await helper.navigateToMCTenant();
  
  const vipBooking = TestDataFactory.createVipBooking();
  const vipOptions: BookingOptions = { 
    isVip: true,
    servicesRequested: TestDataFactory.createServicesRequested({
      staff: true,
      equipment: true
    })
  };
  
  await helper.createCompleteBooking(vipBooking, vipOptions);
  
  // Verify it goes to Services Request state
  await helper.assertBookingStatus('Services Request');
});
```

### 2. Service Flow Testing

```typescript
test('All services approved leads to Approved state', async ({ page }) => {
  const helper = new BookingTestHelper(page);
  
  // Create booking with multiple services
  await createBookingWithServices(TestDataFactory.createServicesRequested({ 
    staff: true, 
    equipment: true, 
    setup: true, 
    catering: true, 
    security: true,
    cleaning: true
  }));
  
  await helper.loginUser(TestUsersFactory.getAdminUser());
  
  // Approve all services
  const services: Array<keyof ServicesRequested> = ['staff', 'equipment', 'setup', 'catering', 'security', 'cleaning'];
  for (const service of services) {
    await helper.approveService(service);
    await helper.waitForStateTransition(500);
  }
  
  // Verify booking goes to Approved state
  await helper.assertBookingStatus('Approved');
});
```

### 3. User Role Testing

```typescript
test('PA can view booking list', async ({ page }) => {
  const helper = new BookingTestHelper(page);
  
  await helper.loginUser(TestUsersFactory.getPAUser());
  await helper.navigateToMCTenant();
  
  await page.goto('http://localhost:3000/mc/admin/');
  await expect(page.getByRole('heading', { name: /bookings/i })).toBeVisible();
  await expect(page.locator('[data-testid="booking-list"]')).toBeVisible();
});
```

## XState Machine Integration

These tests validate the XState machine defined in `lib/stateMachines/mcBookingMachine.ts`:

### States Tested
- **Requested**: Initial state for standard bookings
- **Approved**: Auto-approved bookings and final approval state
- **Services Request**: Parallel state for VIP bookings with services
- **Pre-approved**: VIP bookings awaiting services processing
- **Declined**: Rejected bookings
- **Canceled**: User-canceled bookings
- **No Show**: Bookings marked as no-show
- **Checked In**: Active bookings
- **Closed**: Completed bookings
- **Service Closeout**: Service completion processing

### Guards Tested
- `shouldAutoApprove`: Auto-approval logic
- `isVip AND servicesRequested`: VIP with services logic
- `servicesRequested`: Services requirement check
- `servicesApproved`: All services approved check
- `servicesDeclined`: Any services declined check

### Actions Tested
- `sendHTMLEmail`: Email notifications (mocked)
- `createCalendarEvent`: Calendar creation (mocked)
- `updateCalendarEvent`: Calendar updates (mocked)
- `deleteCalendarEvent`: Calendar deletion (mocked)

## Troubleshooting

### Common Issues

1. **Authentication Failures**: Verify test user credentials in `.env.test.local`
2. **Timeout Issues**: Increase timeout values in test configuration
3. **State Transition Failures**: Check XState machine logs for debugging
4. **Mock Service Issues**: Verify mock routes are properly configured

### Debug Commands

```bash
# Run with debug logging
DEBUG=pw:api npx playwright test tests/e2e/xstate-approval-flow.e2e.test.ts

# Generate test report
npx playwright show-report

# Run specific test with trace
npx playwright test --trace on tests/e2e/xstate-approval-flow.e2e.test.ts --grep "specific test name"
```

### XState Debugging

Enable XState debugging in tests:

```typescript
const xstateUtils = new XStateTestUtils(page);
await xstateUtils.enableXStateDebugging();

// Run your test...

const logs = await xstateUtils.getXStateLogs();
console.log('XState logs:', logs);
```

## Contributing

When adding new tests:

1. Follow the established patterns using helper classes
2. Add appropriate mocking for external services
3. Verify XState state transitions where applicable
4. Include comprehensive assertions
5. Update this documentation with new test scenarios

## Future Enhancements

- **Visual Regression Testing**: Add screenshot comparisons for UI states
- **Performance Testing**: Measure XState transition performance
- **Cross-browser Testing**: Expand to Firefox and Safari
- **Mobile Testing**: Add mobile viewport testing
- **API Testing**: Add direct API endpoint testing alongside UI tests