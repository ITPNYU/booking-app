# Test Suite

This project includes comprehensive unit tests and E2E tests focusing on form functionality.

## Test Types

### Unit Tests (`tests/unit/`)

**How to run:**

```bash
npm run test:unit
```

#### Test Files

1. **`sample.unit.test.tsx`** - Basic test examples

   - Number addition
   - String search

2. **`validation-utils.unit.test.tsx`** - Form validation functions

   - `validateExpectedAttendance`: Validates attendee count
   - `validateRequired`: Validates required fields
   - `validateEmail`: Validates email format
   - `validateNetId`: Validates NetID format

3. **`date-utils.unit.test.tsx`** - Date-related utilities

   - `formatBookingTime`: Time display format
   - `calculateDuration`: Booking duration calculation
   - `isWeekend`: Weekend detection

4. **`room-utils.unit.test.tsx`** - Room-related functionality

   - `calculateMaxCapacity`: Maximum room capacity calculation
   - `formatRoomName`: Room name display format
   - `selectedAutoApprovalRooms`: Auto-approval eligible rooms detection
   - `isRoomAvailable`: Room availability check

5. **`booking-form-inputs.unit.test.tsx`** - Form input components

   - `BookingFormTextField`: Text field rendering and validation
   - `BookingFormDropdown`: Dropdown selection behavior
   - `BookingFormSwitch`: Toggle functionality
   - `BookingFormAgreementCheckbox`: Checkbox interactions

6. **`booking-form-validation.unit.test.tsx`** - Form validation logic

   - Phone number validation (US format)
   - NYU email validation (@nyu.edu domain)
   - N-Number validation (N + 8 digits)
   - Net ID validation (letters + numbers)
   - Form completeness validation

7. **`booking-form-missing-data.unit.test.tsx`** - Navigation and data validation

   - Form data completeness checks
   - Affiliation data validation
   - Room selection data validation
   - Navigation path requirements
   - Path parsing utilities

8. **`form-utils.unit.test.tsx`** - Form utility functions

   - Form section formatting
   - Form context helpers
   - Form validation state management
   - Capacity calculations
   - Field dependencies

9. **`booking-form-integration.unit.test.tsx`** - Integration testing

   - Complete booking flow validation
   - Form submission validation
   - Auto-approval logic testing
   - Form state management

10. **`calendar-vertical-resource.unit.test.tsx`** - Calendar resource management
    - Resource scheduling and availability
    - Capacity validation
    - Resource display properties

### E2E Tests (`tests/e2e/`)

**How to run:**

```bash
npm run test:e2e
```

- Browser-based booking flow testing
- User interaction scenario validation

## Test Configuration

### Vitest Configuration (`vitest.config.mts`)

- JSDOM environment execution
- TypeScript & React support
- Testing Library integration

### Setup File (`tests/setup.ts`)

The following mocks are configured:

- Firebase authentication & Firestore
- Next.js navigation
- Browser APIs (matchMedia, IntersectionObserver, etc.)

## Test Coverage

### Form Functionality

- Validation functions
- Date & time processing
- Room selection logic
- Auto-approval determination

### Utility Functions

- String processing
- Numerical calculations
- Conditional logic
- Data transformation

### UI Components

- Form input components
- User interaction handling
- Component rendering
- State management

### Integration Testing

- Complete booking workflows
- Form data flow
- Navigation logic
- Business rule validation

## Test Results

Current test status:

- **Unit Tests**: 759 tests passing
- **Test Files**: 53 files
- **Success Rate**: 100%

## API and Server-Side Testing

### API Route Tests

The following API routes have comprehensive unit test coverage:

1. **`api-approve.unit.test.ts`** - Booking approval endpoint
   - XState transition handling
   - Fallback to traditional approval
   - Final approval flow
   - Pre-approval flow
   - Services request transitions

2. **`api-booking-logs.unit.test.ts`** - Booking history logging
   - GET endpoint: Retrieve booking logs by request number
   - POST endpoint: Create new booking log entries
   - Validation of required fields
   - Error handling for database operations

3. **`api-cancel-processing.unit.test.ts`** - Booking cancellation
   - Cancel booking with calendar deletion
   - Multiple room calendar handling
   - Error resilience for calendar API failures
   - Booking not found scenarios

4. **`api-checkout-processing.unit.test.ts`** - Checkout operations
   - Checkout timestamp recording
   - Email notifications to guests
   - Calendar event status updates
   - History logging
   - Error handling for missing bookings

5. **`api-close-processing.unit.test.ts`** - Booking closure
   - Close booking validation
   - Required field validation
   - Error handling

6. **`api-getData.unit.test.ts`** - Admin data fetching
   - Default tenant handling
   - Custom tenant from headers
   - Empty result sets
   - Firestore error handling

7. **`api-send-email.unit.test.ts`** - Email sending
   - Email template handling
   - Tenant-specific emails
   - Error handling

8. **`api-calendar-events.unit.test.ts`** - Calendar event management
   - Event creation and updates
   - Calendar integration

9. **`equipment-api.unit.test.ts`** - Equipment management
   - Equipment checkout operations
   - Timestamp handling
   - Request validation

10. **`webcheckout-api.unit.test.ts`** - Web checkout integration
    - Cart number lookups
    - Equipment allocation search
    - Error handling

### Server-Side Function Tests

1. **`server-admin.unit.test.ts`** - Administrative server functions
   - Booking content formatting
   - Approval workflows
   - Admin user management

2. **`server-calendars.unit.test.ts`** - Google Calendar operations
   - Calendar event patching
   - User invitations to events
   - Booking description generation
   - Missing value handling

3. **`calendar-description.unit.test.ts`** - Calendar description formatting
   - HTML description generation
   - Request information formatting
   - Requester details
   - Event details
   - Services information

### Coverage Areas

- **API Endpoints**: Core booking operations (approve, cancel, close, checkout)
- **Data Operations**: Booking logs, admin data retrieval
- **Calendar Integration**: Google Calendar event management
- **Email Notifications**: Booking status change notifications
- **Equipment Management**: Equipment checkout and tracking
- **Error Handling**: Comprehensive error scenarios for all operations

## Future Expansions

### Best Practices

- Each test runs independently
- Mocks improve test performance
- Tests mimic actual user behavior
- Comprehensive testing including error cases

## Troubleshooting

### Common Issues

1. **Firebase Errors**: Check that environment variables are properly configured
2. **Mock Errors**: Verify mocks are properly set up in `tests/setup.ts`
3. **TypeScript Errors**: Ensure type definitions are up-to-date and accurate

### Debugging Methods

```bash
# Run tests with detailed logging
npm run test:unit -- --reporter=verbose

# Run specific test file only
npm run test:unit tests/unit/validation-utils.unit.test.tsx

# Run tests in watch mode
npx vitest
```

## Test Architecture

### Mock Strategy

- **Global Mocks**: Set up in `tests/setup.ts` for common dependencies
- **Test-Specific Mocks**: Used within individual test files for specific scenarios
- **Context Mocking**: Flexible mock context system for React components

### Test Organization

- **Unit Tests**: Individual function and component testing
- **Integration Tests**: Multi-component interaction testing
- **Utility Tests**: Helper function validation
- **Form Tests**: Comprehensive form behavior testing

### Coverage Areas

- **Form Validation**: All validation rules and edge cases
- **User Interface**: Component rendering and interaction
- **Business Logic**: Booking rules and auto-approval logic
- **Navigation**: Page access control and redirection
- **Data Flow**: Context management and state transitions
