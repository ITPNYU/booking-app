/**
 * Test utilities for XState approval flow e2e tests
 */

import { Page, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  role: 'GENERAL' | 'PA' | 'LIAISON' | 'ADMIN';
}

export interface BookingFormData {
  title: string;
  department: string;
  role: string;
  expectedAttendance: string;
  description: string;
  netId?: string; // For walk-in and VIP bookings
}

export interface ServicesRequested {
  staff?: boolean;
  equipment?: boolean;
  catering?: boolean;
  cleaning?: boolean;
  security?: boolean;
  setup?: boolean;
}

export interface BookingOptions {
  isVip?: boolean;
  isWalkIn?: boolean;
  isModification?: boolean;
  servicesRequested?: ServicesRequested;
  shouldAutoApprove?: boolean;
}

export class BookingTestHelper {
  constructor(private page: Page) {}

  async loginUser(user: TestUser): Promise<void> {
    await this.page.goto('http://localhost:3000/');
    
    // Handle potential popup auth flow
    let authUrl = null;
    this.page.on('popup', async popup => {
      try {
        authUrl = await popup.url();
        console.log('Captured auth URL:', authUrl);
      } catch (error) {
        console.error('Failed to capture URL:', error);
      }
    });

    await this.page.waitForTimeout(2000);

    if (authUrl) {
      await this.page.goto(authUrl);
    }

    // Fill login form
    await this.page.getByLabel('Email or phone').waitFor({ state: 'visible', timeout: 30000 });
    await this.page.getByLabel('Email or phone').fill(user.email);
    await this.page.getByRole('button', { name: 'Next' }).click();
    
    await this.page.getByLabel('Enter your password').waitFor({ state: 'visible', timeout: 30000 });
    await this.page.getByLabel('Enter your password').fill(user.password);
    await this.page.getByRole('button', { name: 'Next' }).click();

    // Wait for successful login and redirect
    await this.page.waitForURL('http://localhost:3000/**', { timeout: 30000 });
  }

  async navigateToMCTenant(): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/');
    await this.page.waitForLoadState('networkidle');
  }

  async startBookingProcess(options: BookingOptions = {}): Promise<void> {
    if (options.isWalkIn) {
      await this.page.getByRole('button', { name: 'Walk-in Booking' }).waitFor({ state: 'visible' });
      await this.page.getByRole('button', { name: 'Walk-in Booking' }).click();
    } else if (options.isVip) {
      await this.page.getByRole('button', { name: 'VIP Booking' }).waitFor({ state: 'visible' });
      await this.page.getByRole('button', { name: 'VIP Booking' }).click();
    } else {
      await this.page.getByRole('button', { name: 'Request a Reservation' }).waitFor({ state: 'visible' });
      await this.page.getByRole('button', { name: 'Request a Reservation' }).click();
    }

    // Accept terms
    await this.page.getByRole('button', { name: 'I accept' }).waitFor({ state: 'visible' });
    await this.page.getByRole('button', { name: 'I accept' }).click();
  }

  async fillBasicBookingForm(formData: BookingFormData): Promise<void> {
    // Department selection
    await this.page.getByText('Choose a Department').waitFor({ state: 'visible' });
    await this.page.getByText('Choose a Department').click();
    await this.page.getByRole('option', { name: formData.department }).waitFor({ state: 'visible' });
    await this.page.getByRole('option', { name: formData.department }).click();

    // Role selection
    await this.page.getByText('Choose a Role').waitFor({ state: 'visible' });
    await this.page.getByText('Choose a Role').click();
    await this.page.getByRole('option', { name: formData.role }).waitFor({ state: 'visible' });
    await this.page.getByRole('option', { name: formData.role }).click();

    // Title
    await this.page.locator('input[name="title"]').waitFor({ state: 'visible' });
    await this.page.locator('input[name="title"]').fill(formData.title);

    // Description
    await this.page.locator('textarea[name="description"]').waitFor({ state: 'visible' });
    await this.page.locator('textarea[name="description"]').fill(formData.description);

    // NetId for walk-in/VIP bookings
    if (formData.netId) {
      await this.page.locator('input[name="netId"]').waitFor({ state: 'visible' });
      await this.page.locator('input[name="netId"]').fill(formData.netId);
    }
  }

  async selectRoomAndTime(): Promise<void> {
    // Select first available room
    const roomSelector = this.page.locator('[data-testid="room-option"]').first();
    if (await roomSelector.count() > 0) {
      await roomSelector.click();
    } else {
      // Fallback to generic room selection
      await this.page.locator('input[type="checkbox"][name*="room"]').first().check();
    }

    // Select tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    const dateInput = this.page.locator('input[type="date"]');
    if (await dateInput.count() > 0) {
      await dateInput.fill(dateStr);
    }

    // Select time slot (default to morning slot)
    const timeSlot = this.page.locator('[data-testid="time-slot"]').first();
    if (await timeSlot.count() > 0) {
      await timeSlot.click();
    }
  }

  async fillEventDetails(formData: BookingFormData): Promise<void> {
    // Expected attendance
    await this.page.locator('input[name="expectedAttendance"]').waitFor({ state: 'visible' });
    await this.page.locator('input[name="expectedAttendance"]').fill(formData.expectedAttendance);

    // Access type
    await this.page.getByLabel('Select an option').waitFor({ state: 'visible' });
    await this.page.getByLabel('Select an option').click();
    await this.page.getByRole('option', { name: 'NYU Members with an active' }).waitFor({ state: 'visible' });
    await this.page.getByRole('option', { name: 'NYU Members with an active' }).click();
  }

  async selectServices(services: ServicesRequested): Promise<void> {
    if (services.staff) {
      await this.page.locator('#services-staff, input[name*="staff"]').check();
    }
    if (services.equipment) {
      await this.page.locator('#services-equipment, input[name*="equipment"]').check();
    }
    if (services.catering) {
      await this.page.locator('#services-catering, input[name*="catering"]').check();
    }
    if (services.cleaning) {
      await this.page.locator('#services-cleaning, input[name*="cleaning"]').check();
    }
    if (services.security) {
      await this.page.locator('#services-security, input[name*="security"]').check();
    }
    if (services.setup) {
      await this.page.locator('#services-setup, input[name*="setup"]').check();
    }
  }

  async acceptRequiredTerms(): Promise<void> {
    // Accept all required checkboxes
    await this.page.locator('#checklist').check();
    await this.page.locator('#resetRoom').check();
    await this.page.locator('#bookingPolicy').check();
  }

  async submitBooking(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForSelector('h6', { timeout: 30000 });
  }

  async createCompleteBooking(
    formData: BookingFormData, 
    options: BookingOptions = {}
  ): Promise<void> {
    await this.startBookingProcess(options);
    await this.fillBasicBookingForm(formData);
    await this.selectRoomAndTime();
    await this.fillEventDetails(formData);
    
    if (options.servicesRequested) {
      await this.selectServices(options.servicesRequested);
    }
    
    await this.acceptRequiredTerms();
    await this.submitBooking();
  }

  async getBookingStatus(bookingId?: string): Promise<string> {
    // Navigate to admin panel
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    // Get status of the latest booking or specific booking
    let statusElement;
    if (bookingId) {
      statusElement = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="booking-status"]`);
    } else {
      statusElement = this.page.locator('[data-testid="booking-status"]').first();
    }
    
    if (await statusElement.count() > 0) {
      return await statusElement.textContent() || 'Unknown';
    }
    
    // Fallback: look for status in table
    const statusCell = this.page.locator('table td:has-text("Status")').first();
    if (await statusCell.count() > 0) {
      return await statusCell.textContent() || 'Unknown';
    }
    
    return 'Status not found';
  }

  async approveBooking(bookingId?: string): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let approveButton;
    if (bookingId) {
      approveButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="approve-booking"]`);
    } else {
      approveButton = this.page.locator('[data-testid="approve-booking"]').first();
    }
    
    await approveButton.click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async declineBooking(bookingId?: string, reason: string = 'Test decline'): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let declineButton;
    if (bookingId) {
      declineButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="decline-booking"]`);
    } else {
      declineButton = this.page.locator('[data-testid="decline-booking"]').first();
    }
    
    await declineButton.click();
    await this.page.locator('textarea[name="reason"]').fill(reason);
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async approveService(serviceType: keyof ServicesRequested, bookingId?: string): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let serviceButton;
    if (bookingId) {
      serviceButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="approve-${serviceType}-service"]`);
    } else {
      serviceButton = this.page.locator(`[data-testid="approve-${serviceType}-service"]`).first();
    }
    
    await serviceButton.click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async declineService(serviceType: keyof ServicesRequested, bookingId?: string, reason: string = 'Test decline'): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let serviceButton;
    if (bookingId) {
      serviceButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="decline-${serviceType}-service"]`);
    } else {
      serviceButton = this.page.locator(`[data-testid="decline-${serviceType}-service"]`).first();
    }
    
    await serviceButton.click();
    await this.page.locator('textarea[name="reason"]').fill(reason);
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async checkInBooking(bookingId?: string): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let checkInButton;
    if (bookingId) {
      checkInButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="check-in-booking"]`);
    } else {
      checkInButton = this.page.locator('[data-testid="check-in-booking"]').first();
    }
    
    await checkInButton.click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async checkOutBooking(bookingId?: string): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let checkOutButton;
    if (bookingId) {
      checkOutButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="check-out-booking"]`);
    } else {
      checkOutButton = this.page.locator('[data-testid="check-out-booking"]').first();
    }
    
    await checkOutButton.click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async markNoShow(bookingId?: string): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let noShowButton;
    if (bookingId) {
      noShowButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="no-show-booking"]`);
    } else {
      noShowButton = this.page.locator('[data-testid="no-show-booking"]').first();
    }
    
    await noShowButton.click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async cancelBooking(bookingId?: string): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let cancelButton;
    if (bookingId) {
      cancelButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="cancel-booking"]`);
    } else {
      cancelButton = this.page.locator('[data-testid="cancel-booking"]').first();
    }
    
    await cancelButton.click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async editBooking(bookingId?: string, newTitle?: string): Promise<void> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let editButton;
    if (bookingId) {
      editButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="edit-booking"]`);
    } else {
      editButton = this.page.locator('[data-testid="edit-booking"]').first();
    }
    
    await editButton.click();
    
    if (newTitle) {
      await this.page.locator('input[name="title"]').fill(newTitle);
    }
    
    await this.page.getByRole('button', { name: 'Update' }).click();
  }

  async viewBookingHistory(bookingId?: string): Promise<string[]> {
    await this.page.goto('http://localhost:3000/mc/admin/');
    await this.page.waitForLoadState('networkidle');
    
    let historyButton;
    if (bookingId) {
      historyButton = this.page.locator(`[data-booking-id="${bookingId}"] [data-testid="view-history"]`);
    } else {
      historyButton = this.page.locator('[data-testid="view-history"]').first();
    }
    
    await historyButton.click();
    
    const historyEntries = await this.page.locator('[data-testid="history-entry"]').allTextContents();
    return historyEntries;
  }

  async assertBookingStatus(expectedStatus: string, bookingId?: string): Promise<void> {
    const actualStatus = await this.getBookingStatus(bookingId);
    expect(actualStatus).toContain(expectedStatus);
  }

  async assertSuccessMessage(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Yay! We\'ve received your' })).toBeVisible();
  }

  async assertErrorMessage(): Promise<void> {
    await expect(this.page.getByRole('alert')).toBeVisible();
  }

  async waitForStateTransition(timeoutMs: number = 5000): Promise<void> {
    await this.page.waitForTimeout(timeoutMs);
  }
}

// Test data factory
export class TestDataFactory {
  static createStandardBooking(): BookingFormData {
    return {
      title: 'Test Standard Booking',
      department: 'ITP / IMA / Low Res',
      role: 'Student',
      expectedAttendance: '15',
      description: 'Standard booking for testing XState flow'
    };
  }

  static createVipBooking(): BookingFormData {
    return {
      title: 'Test VIP Booking',
      department: 'ITP / IMA / Low Res',
      role: 'Faculty',
      expectedAttendance: '25',
      description: 'VIP booking for testing XState flow'
    };
  }

  static createWalkInBooking(): BookingFormData {
    return {
      title: 'Test Walk-in Booking',
      department: 'ITP / IMA / Low Res',
      role: 'Student',
      expectedAttendance: '10',
      description: 'Walk-in booking for testing XState flow',
      netId: 'testuser'
    };
  }

  static createServicesRequested(services: Partial<ServicesRequested> = {}): ServicesRequested {
    return {
      staff: false,
      equipment: false,
      catering: false,
      cleaning: false,
      security: false,
      setup: false,
      ...services
    };
  }
}

// Test users factory
export class TestUsersFactory {
  static getGeneralUser(): TestUser {
    return {
      email: process.env.TEST_GENERAL_USER_EMAIL || 'test@nyu.edu',
      password: process.env.TEST_GENERAL_USER_PASSWORD || 'password',
      role: 'GENERAL'
    };
  }

  static getPAUser(): TestUser {
    return {
      email: process.env.TEST_PA_USER_EMAIL || 'pa@nyu.edu',
      password: process.env.TEST_PA_USER_PASSWORD || 'password',
      role: 'PA'
    };
  }

  static getLiaisonUser(): TestUser {
    return {
      email: process.env.TEST_LIAISON_USER_EMAIL || 'liaison@nyu.edu',
      password: process.env.TEST_LIAISON_USER_PASSWORD || 'password',
      role: 'LIAISON'
    };
  }

  static getAdminUser(): TestUser {
    return {
      email: process.env.TEST_ADMIN_USER_EMAIL || 'admin@nyu.edu',
      password: process.env.TEST_ADMIN_USER_PASSWORD || 'password',
      role: 'ADMIN'
    };
  }
}