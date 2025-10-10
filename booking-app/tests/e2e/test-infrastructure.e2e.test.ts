import { test, expect } from '@playwright/test';
import { MockServices, MockDataGenerator } from './helpers/mock-services';

/**
 * Quick integration test to verify test infrastructure works
 */

test.describe('XState Test Infrastructure', () => {
  test('Mock services can be enabled', async ({ page }) => {
    const mockServices = new MockServices(page);
    
    // Should not throw errors when enabling mocks
    await mockServices.enableAllMocks();
    
    // Navigate to the app
    await page.goto('http://localhost:3000/');
    
    // Verify page loads
    await expect(page).toHaveTitle(/Media commons booking app/i);
  });

  test('Mock data generator works', () => {
    // Test data generation utilities
    const bookingId = MockDataGenerator.generateBookingId();
    expect(bookingId).toMatch(/^mock-booking-\d+-[a-z0-9]{6}$/);

    const calendarEventId = MockDataGenerator.generateCalendarEventId();
    expect(calendarEventId).toMatch(/^mock-calendar-event-\d+-[a-z0-9]{6}$/);

    const testDate = MockDataGenerator.generateTestDate(1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(testDate).toBe(tomorrow.toISOString().split('T')[0]);

    const timeSlot = MockDataGenerator.generateTimeSlot();
    expect(timeSlot).toHaveProperty('start');
    expect(timeSlot).toHaveProperty('end');
    expect(timeSlot.start).toMatch(/^\d{2}:\d{2}$/);
    expect(timeSlot.end).toMatch(/^\d{2}:\d{2}$/);

    const mockBooking = MockDataGenerator.generateMockBookingData();
    expect(mockBooking).toHaveProperty('title');
    expect(mockBooking).toHaveProperty('department');
    expect(mockBooking).toHaveProperty('role');
    expect(mockBooking.title).toBe('Mock Test Booking');
  });
});