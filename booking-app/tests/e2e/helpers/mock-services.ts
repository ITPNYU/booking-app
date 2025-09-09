/**
 * Mock implementations for XState e2e tests
 * These mocks help isolate the XState flow testing from external dependencies
 */

import { Page } from '@playwright/test';

export class MockServices {
  constructor(private page: Page) {}

  /**
   * Mock calendar API responses to avoid actual calendar operations during testing
   */
  async mockCalendarAPI(): Promise<void> {
    await this.page.route('**/api/calendarEvents', async route => {
      const method = route.request().method();
      
      if (method === 'POST') {
        // Mock calendar event creation
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            eventId: 'mock-calendar-event-' + Date.now(),
            message: 'Calendar event created successfully (mock)'
          })
        });
      } else if (method === 'PUT') {
        // Mock calendar event update
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Calendar event updated successfully (mock)'
          })
        });
      } else if (method === 'DELETE') {
        // Mock calendar event deletion
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Calendar event deleted successfully (mock)'
          })
        });
      }
    });
  }

  /**
   * Mock email service to avoid sending actual emails during testing
   */
  async mockEmailService(): Promise<void> {
    await this.page.route('**/api/sendEmail', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          messageId: 'mock-email-' + Date.now(),
          message: 'Email sent successfully (mock)'
        })
      });
    });
  }

  /**
   * Mock database operations to ensure test isolation
   */
  async mockDatabaseOperations(): Promise<void> {
    // Mock booking creation
    await this.page.route('**/api/bookings', async route => {
      const method = route.request().method();
      
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            bookingId: 'mock-booking-' + Date.now(),
            calendarEventId: 'mock-calendar-event-' + Date.now(),
            status: this.determineInitialStatus(body),
            data: body
          })
        });
      }
    });

    // Mock booking updates
    await this.page.route('**/api/bookings/**', async route => {
      const method = route.request().method();
      
      if (method === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Booking updated successfully (mock)'
          })
        });
      }
    });
  }

  /**
   * Mock XState machine context initialization for testing specific scenarios
   */
  async mockXStateContext(context: any): Promise<void> {
    await this.page.addInitScript((context) => {
      window.__MOCK_XSTATE_CONTEXT__ = context;
    }, context);
  }

  /**
   * Enable all mocking for comprehensive test isolation
   */
  async enableAllMocks(): Promise<void> {
    await this.mockCalendarAPI();
    await this.mockEmailService();
    await this.mockDatabaseOperations();
  }

  /**
   * Determine initial booking status based on booking data and XState rules
   */
  private determineInitialStatus(bookingData: any): string {
    // Implement XState auto-approval logic for mocking
    const isVip = bookingData.isVip || false;
    const isWalkIn = bookingData.isWalkIn || false;
    const hasServices = bookingData.servicesRequested && 
      Object.values(bookingData.servicesRequested).some(Boolean);
    const shouldAutoApprove = bookingData.shouldAutoApprove || false;

    // Auto-approval conditions (simplified for mocking)
    if (shouldAutoApprove || isWalkIn) {
      return 'Approved';
    }

    if (isVip && hasServices) {
      return 'Services Request';
    }

    if (isVip && !hasServices) {
      return 'Approved';
    }

    // Default to requested for standard bookings
    return 'Requested';
  }
}

/**
 * Test data generators for consistent test scenarios
 */
export class MockDataGenerator {
  static generateBookingId(): string {
    return 'mock-booking-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  }

  static generateCalendarEventId(): string {
    return 'mock-calendar-event-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  }

  static generateTestDate(daysFromNow: number = 1): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  static generateTimeSlot(): { start: string; end: string } {
    const startHour = Math.floor(Math.random() * 8) + 9; // 9 AM to 5 PM
    const endHour = startHour + 2; // 2-hour slots
    
    return {
      start: `${startHour.toString().padStart(2, '0')}:00`,
      end: `${endHour.toString().padStart(2, '0')}:00`
    };
  }

  static generateMockBookingData(overrides: any = {}) {
    return {
      title: 'Mock Test Booking',
      department: 'ITP / IMA / Low Res',
      role: 'Student',
      expectedAttendance: '15',
      description: 'Generated mock booking for testing',
      date: this.generateTestDate(),
      timeSlot: this.generateTimeSlot(),
      ...overrides
    };
  }
}

/**
 * XState-specific test utilities
 */
export class XStateTestUtils {
  constructor(private page: Page) {}

  /**
   * Inject XState debugging helpers into the page
   */
  async enableXStateDebugging(): Promise<void> {
    await this.page.addInitScript(() => {
      window.__XSTATE_DEBUG__ = true;
      window.__XSTATE_LOGS__ = [];
      
      // Capture XState logs for test verification
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('XSTATE')) {
          window.__XSTATE_LOGS__.push(args.join(' '));
        }
        originalConsoleLog.apply(console, args);
      };
    });
  }

  /**
   * Get XState logs from the page for verification
   */
  async getXStateLogs(): Promise<string[]> {
    return await this.page.evaluate(() => window.__XSTATE_LOGS__ || []);
  }

  /**
   * Verify specific XState transitions occurred
   */
  async verifyStateTransition(fromState: string, toState: string): Promise<boolean> {
    const logs = await this.getXStateLogs();
    const transitionPattern = new RegExp(`.*${fromState}.*→.*${toState}.*`);
    return logs.some(log => transitionPattern.test(log));
  }

  /**
   * Verify XState guard was executed
   */
  async verifyGuardExecution(guardName: string): Promise<boolean> {
    const logs = await this.getXStateLogs();
    return logs.some(log => log.includes(`GUARD: ${guardName}`));
  }

  /**
   * Verify XState action was executed
   */
  async verifyActionExecution(actionName: string): Promise<boolean> {
    const logs = await this.getXStateLogs();
    return logs.some(log => log.includes(`ACTION: ${actionName}`));
  }

  /**
   * Wait for specific XState state to be reached
   */
  async waitForState(stateName: string, timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const logs = await this.getXStateLogs();
      if (logs.some(log => log.includes(`Entered '${stateName}' state`))) {
        return;
      }
      await this.page.waitForTimeout(100);
    }
    
    throw new Error(`Timeout waiting for XState to reach '${stateName}' state`);
  }
}

// Type definitions for test window extensions
declare global {
  interface Window {
    __MOCK_XSTATE_CONTEXT__?: any;
    __XSTATE_DEBUG__?: boolean;
    __XSTATE_LOGS__?: string[];
  }
}