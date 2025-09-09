import { test, expect } from '@playwright/test';
import { 
  BookingTestHelper, 
  TestDataFactory, 
  TestUsersFactory,
  type BookingOptions,
  type ServicesRequested
} from './helpers/booking-test-helpers';

/**
 * E2E Tests for XState Approval Flow
 * 
 * Tests the complete booking approval flow using XState machine logic
 * covering all states: Requested, Approved, Declined, Services Request, etc.
 */

// Test suites

test.describe('XState Approval Flow - Tenant Access', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('Access MC tenant dashboard', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    // Verify dashboard is accessible
    await expect(page).toHaveTitle(/Media commons booking app/i);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('Auto-approve booking with shouldAutoApprove=true', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    await helper.createCompleteBooking(TestDataFactory.createStandardBooking());
    await helper.assertSuccessMessage();
    
    // Check booking status is approved for auto-approval scenarios
    const status = await helper.getBookingStatus();
    expect(status).toContain('Approved');
  });
});

test.describe('XState Approval Flow - VIP Scenarios', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('VIP booking without services auto-approved', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    const vipBooking = TestDataFactory.createVipBooking();
    const vipOptions: BookingOptions = { 
      isVip: true,
      servicesRequested: TestDataFactory.createServicesRequested()
    };
    
    await helper.createCompleteBooking(vipBooking, vipOptions);
    await helper.assertSuccessMessage();
    
    // Verify auto-approval for VIP without services
    await helper.assertBookingStatus('Approved');
  });

  test('VIP booking with services goes to Services Request', async ({ page }) => {
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
    await helper.assertSuccessMessage();
    
    // Verify it goes to Services Request state
    await helper.assertBookingStatus('Services Request');
  });
});

test.describe('XState Approval Flow - Walk-in Scenarios', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('Walk-in reservation auto-approved', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getPAUser()); // PA can create walk-ins
    await helper.navigateToMCTenant();
    
    const walkInBooking = TestDataFactory.createWalkInBooking();
    const walkInOptions: BookingOptions = { isWalkIn: true };
    
    await helper.createCompleteBooking(walkInBooking, walkInOptions);
    await helper.assertSuccessMessage();
    
    // Verify auto-approval for walk-ins
    await helper.assertBookingStatus('Approved');
  });
});

test.describe('XState Approval Flow - Standard Reservations', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('Standard reservation stays in Requested until approved', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    await helper.createCompleteBooking(TestDataFactory.createStandardBooking());
    await helper.assertSuccessMessage();
    
    // Verify it stays in Requested state
    await helper.assertBookingStatus('Requested');
  });
});

test.describe('XState Approval Flow - Edit Scenarios', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('User edits while status = Requested stays in Requested', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    // Create initial booking
    await helper.createCompleteBooking(TestDataFactory.createStandardBooking());
    await helper.assertSuccessMessage();
    
    // Edit the booking
    await helper.editBooking(undefined, 'Updated Title');
    
    // Verify still in Requested state
    await helper.assertBookingStatus('Requested');
  });
});

test.describe('XState Approval Flow - User Role Access', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('General user can log in successfully', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    await expect(page.getByRole('button', { name: 'Request a Reservation' })).toBeVisible();
  });

  test('PA can view booking list', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getPAUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    await expect(page.getByRole('heading', { name: /bookings/i })).toBeVisible();
    await expect(page.locator('[data-testid="booking-list"]')).toBeVisible();
  });

  test('PA can view check-in booking', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getPAUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    await expect(page.getByRole('button', { name: /check.?in/i })).toBeVisible();
  });

  test('PA can view check-out booking', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getPAUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    await expect(page.getByRole('button', { name: /check.?out/i })).toBeVisible();
  });

  test('PA can view modify booking', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getPAUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    await expect(page.getByRole('button', { name: /modify/i })).toBeVisible();
  });

  test('Liaison can view assigned bookings', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getLiaisonUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    await expect(page.locator('[data-testid="assigned-bookings"]')).toBeVisible();
  });

  test('Liaison can view approve bookings', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getLiaisonUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    await expect(page.getByRole('button', { name: /approve/i })).toBeVisible();
  });

  test('Liaison can view decline bookings', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getLiaisonUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    await expect(page.getByRole('button', { name: /decline/i })).toBeVisible();
  });

  test('Admin filters work correctly', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.navigateToMCTenant();
    
    await page.goto('http://localhost:3000/mc/admin/');
    
    // Test status filter
    await page.getByRole('combobox', { name: /status/i }).click();
    await page.getByRole('option', { name: 'Approved' }).click();
    
    // Verify filter is applied
    await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible();
  });
});

test.describe('XState Approval Flow - Service Management', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  async function createBookingWithServices(services: ServicesRequested): Promise<void> {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    const vipBooking = TestDataFactory.createVipBooking();
    const vipOptions: BookingOptions = { 
      isVip: true,
      servicesRequested: services
    };
    
    await helper.createCompleteBooking(vipBooking, vipOptions);
    await helper.assertSuccessMessage();
  }

  test('Admin can approve Staffing Service', async ({ page }) => {
    await createBookingWithServices(TestDataFactory.createServicesRequested({ staff: true }));
    
    // Switch to admin view
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveService('staff');
    
    // Verify approval is reflected
    await expect(page.locator('[data-testid="staff-approved"]')).toBeVisible();
  });

  test('Admin can approve Equipment Service', async ({ page }) => {
    await createBookingWithServices(TestDataFactory.createServicesRequested({ equipment: true }));
    
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveService('equipment');
    
    await expect(page.locator('[data-testid="equipment-approved"]')).toBeVisible();
  });

  test('Admin can approve Setup Service', async ({ page }) => {
    await createBookingWithServices(TestDataFactory.createServicesRequested({ setup: true }));
    
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveService('setup');
    
    await expect(page.locator('[data-testid="setup-approved"]')).toBeVisible();
  });

  test('Admin can approve Catering Service', async ({ page }) => {
    await createBookingWithServices(TestDataFactory.createServicesRequested({ catering: true }));
    
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveService('catering');
    
    await expect(page.locator('[data-testid="catering-approved"]')).toBeVisible();
  });

  test('Admin can approve Security Service', async ({ page }) => {
    await createBookingWithServices(TestDataFactory.createServicesRequested({ security: true }));
    
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveService('security');
    
    await expect(page.locator('[data-testid="security-approved"]')).toBeVisible();
  });

  test('All services approved leads to Approved state', async ({ page }) => {
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

  test('Any service declined leads to Declined state', async ({ page }) => {
    await createBookingWithServices(TestDataFactory.createServicesRequested({ 
      staff: true, 
      equipment: true
    }));
    
    await helper.loginUser(TestUsersFactory.getAdminUser());
    
    // Approve staff, decline equipment
    await helper.approveService('staff');
    await helper.declineService('equipment', undefined, 'Not available');
    
    // Verify booking goes to Declined state
    await helper.assertBookingStatus('Declined');
  });
});

test.describe('XState Approval Flow - Advanced Scenarios', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('Priority: auto-approve over VIP+services', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    // Create VIP booking with services but shouldAutoApprove=true
    const vipBooking = TestDataFactory.createVipBooking();
    const vipOptions: BookingOptions = { 
      isVip: true,
      servicesRequested: TestDataFactory.createServicesRequested({ staff: true, equipment: true }),
      shouldAutoApprove: true
    };
    
    // Force auto-approval by simulating shouldAutoApprove=true context
    await page.evaluate(() => {
      // This would need to be implemented based on how the app handles this flag
      window.localStorage.setItem('forceAutoApprove', 'true');
    });
    
    await helper.createCompleteBooking(vipBooking, vipOptions);
    await helper.assertSuccessMessage();
    
    // Verify it goes to Approved (not Services Request)
    await helper.assertBookingStatus('Approved');
  });

  test('Cascade to Canceled with side-effects from noShow', async ({ page }) => {
    // First create and approve a booking
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    await helper.createCompleteBooking(TestDataFactory.createStandardBooking());
    await helper.assertSuccessMessage();
    
    // Admin approves it
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveBooking();
    
    // Mark as no show
    await helper.markNoShow();
    
    // Verify it cascades to Canceled with proper side effects
    await helper.assertBookingStatus('Canceled');
    
    // Verify no-show history was added
    const history = await helper.viewBookingHistory();
    expect(history.some(entry => entry.includes('No Show'))).toBe(true);
  });

  test('Only approved branches require closeout', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    const vipBooking = TestDataFactory.createVipBooking();
    const vipOptions: BookingOptions = { 
      isVip: true,
      servicesRequested: TestDataFactory.createServicesRequested({ 
        equipment: true, 
        staff: true,
        catering: true 
      })
    };
    
    await helper.createCompleteBooking(vipBooking, vipOptions);
    await helper.assertSuccessMessage();
    
    // Admin approves only equipment, declines others
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveService('equipment');
    await helper.declineService('staff', undefined, 'Not needed');
    await helper.declineService('catering', undefined, 'Not needed');
    
    // Verify only equipment enters closeout
    await expect(page.locator('[data-testid="equipment-closeout-pending"]')).toBeVisible();
    await expect(page.locator('[data-testid="staff-closeout-pending"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="catering-closeout-pending"]')).not.toBeVisible();
  });

  test('Idempotency of entry actions on self-transition', async ({ page }) => {
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    await helper.createCompleteBooking(TestDataFactory.createStandardBooking());
    await helper.assertSuccessMessage();
    
    // Edit the booking (self-transition from Requested to Requested)
    await helper.editBooking(undefined, 'Updated Title');
    
    // Verify calendar event was not created twice
    await page.goto('http://localhost:3000/mc/admin/');
    await page.locator('[data-testid="view-calendar-events"]').first().click();
    const eventCount = await page.locator('[data-testid="calendar-event"]').count();
    expect(eventCount).toBe(1);
  });
});

test.describe('XState Approval Flow - Checkout Scenarios', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('Checked out without services goes directly to Closed', async ({ page }) => {
    // Create approved booking without services
    await helper.loginUser(TestUsersFactory.getGeneralUser());
    await helper.navigateToMCTenant();
    
    await helper.createCompleteBooking(TestDataFactory.createStandardBooking());
    await helper.assertSuccessMessage();
    
    // Admin approves and checks in
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await helper.approveBooking();
    await helper.checkInBooking();
    
    // Check out
    await helper.checkOutBooking();
    
    // Verify it goes directly to Closed (not Service Closeout)
    await helper.assertBookingStatus('Closed');
  });
});

test.describe('XState Approval Flow - Legacy Integration', () => {
  let helper: BookingTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BookingTestHelper(page);
  });

  test('Import existing reservation into Xstate derives state correctly', async ({ page }) => {
    // This test would require setting up a legacy booking first
    // For now, we'll simulate the scenario
    
    await helper.loginUser(TestUsersFactory.getAdminUser());
    await page.goto('http://localhost:3000/mc/admin/');
    
    // Import legacy booking
    await page.locator('[data-testid="import-legacy-booking"]').click();
    await page.locator('input[name="legacyBookingId"]').fill('legacy-123');
    await page.getByRole('button', { name: 'Import' }).click();
    
    // Verify state is derived correctly without auto-approval
    const status = await helper.getBookingStatus();
    expect(status).not.toContain('Approved'); // Should not auto-approve legacy imports
    expect(status).toContain('Requested'); // Should require manual approval
  });
});