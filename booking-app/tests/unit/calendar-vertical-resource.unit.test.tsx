import { describe, expect, it } from "vitest";

describe("Calendar Vertical Resource", () => {
  describe("Resource Scheduling", () => {
    interface Resource {
      id: string;
      title: string;
      capacity: number;
    }

    interface Event {
      id: string;
      title: string;
      start: Date;
      end: Date;
      resourceId: string;
    }

    const checkResourceAvailability = (
      resource: Resource,
      requestedStart: Date,
      requestedEnd: Date,
      existingEvents: Event[]
    ): boolean => {
      const overlappingEvents = existingEvents.filter(
        (event) =>
          event.resourceId === resource.id &&
          ((requestedStart >= event.start && requestedStart < event.end) ||
            (requestedEnd > event.start && requestedEnd <= event.end) ||
            (requestedStart <= event.start && requestedEnd >= event.end))
      );

      return overlappingEvents.length === 0;
    };

    it("identifies available resource", () => {
      const resource: Resource = { id: "room1", title: "Room 1", capacity: 20 };
      const requestStart = new Date("2024-01-01T09:00:00");
      const requestEnd = new Date("2024-01-01T10:00:00");
      const existingEvents: Event[] = [];

      const isAvailable = checkResourceAvailability(
        resource,
        requestStart,
        requestEnd,
        existingEvents
      );
      expect(isAvailable).toBe(true);
    });

    it("identifies conflicting resource", () => {
      const resource: Resource = { id: "room1", title: "Room 1", capacity: 20 };
      const requestStart = new Date("2024-01-01T09:30:00");
      const requestEnd = new Date("2024-01-01T10:30:00");
      const existingEvents: Event[] = [
        {
          id: "event1",
          title: "Existing Meeting",
          start: new Date("2024-01-01T09:00:00"),
          end: new Date("2024-01-01T10:00:00"),
          resourceId: "room1",
        },
      ];

      const isAvailable = checkResourceAvailability(
        resource,
        requestStart,
        requestEnd,
        existingEvents
      );
      expect(isAvailable).toBe(false);
    });

    it("allows consecutive bookings", () => {
      const resource: Resource = { id: "room1", title: "Room 1", capacity: 20 };
      const requestStart = new Date("2024-01-01T10:00:00");
      const requestEnd = new Date("2024-01-01T11:00:00");
      const existingEvents: Event[] = [
        {
          id: "event1",
          title: "Previous Meeting",
          start: new Date("2024-01-01T09:00:00"),
          end: new Date("2024-01-01T10:00:00"),
          resourceId: "room1",
        },
      ];

      const isAvailable = checkResourceAvailability(
        resource,
        requestStart,
        requestEnd,
        existingEvents
      );
      expect(isAvailable).toBe(true);
    });
  });

  describe("Resource Capacity Management", () => {
    interface Resource {
      id: string;
      title: string;
      capacity: number;
    }

    const validateCapacity = (
      resource: Resource,
      requestedCapacity: number
    ): boolean => {
      return requestedCapacity <= resource.capacity;
    };

    it("validates within capacity", () => {
      const resource: Resource = { id: "room1", title: "Room 1", capacity: 20 };
      expect(validateCapacity(resource, 15)).toBe(true);
      expect(validateCapacity(resource, 20)).toBe(true);
    });

    it("rejects over capacity", () => {
      const resource: Resource = { id: "room1", title: "Room 1", capacity: 20 };
      expect(validateCapacity(resource, 25)).toBe(false);
    });
  });

  describe("Resource Display Properties", () => {
    interface Resource {
      id: string;
      title: string;
      capacity: number;
      color?: string;
      textColor?: string;
    }

    const getResourceDisplayProps = (resource: Resource) => {
      return {
        backgroundColor: resource.color || "#3788d8",
        textColor: resource.textColor || "#ffffff",
        title: `${resource.title} (${resource.capacity})`,
      };
    };

    it("generates display properties with defaults", () => {
      const resource: Resource = { id: "room1", title: "Room 1", capacity: 20 };
      const props = getResourceDisplayProps(resource);

      expect(props.backgroundColor).toBe("#3788d8");
      expect(props.textColor).toBe("#ffffff");
      expect(props.title).toBe("Room 1 (20)");
    });

    it("uses custom colors when provided", () => {
      const resource: Resource = {
        id: "room1",
        title: "Room 1",
        capacity: 20,
        color: "#ff5722",
        textColor: "#000000",
      };
      const props = getResourceDisplayProps(resource);

      expect(props.backgroundColor).toBe("#ff5722");
      expect(props.textColor).toBe("#000000");
      expect(props.title).toBe("Room 1 (20)");
    });
  });
});
