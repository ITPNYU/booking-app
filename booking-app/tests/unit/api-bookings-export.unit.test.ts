import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const stream = vi.fn();
  const orderBy = vi.fn(() => ({ stream }));
  const where = vi.fn(() => ({ where, orderBy }));
  const collection = vi.fn(() => ({ where }));
  const fromDate = vi.fn((date: Date) => date);

  return { stream, orderBy, where, collection, fromDate };
});

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: Object.assign(() => ({ collection: mocks.collection }), {
      Timestamp: { fromDate: mocks.fromDate },
    }),
  },
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  getServerTenantCollection: vi.fn(() => "bookings"),
  serverGetDocumentById: vi.fn(async () => ({ resources: [] })),
}));

import { GET } from "@/app/api/bookings/export/route";

/** Minimal quote-aware CSV line splitter for assertions. */
const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
};

const streamHandlers = () => {
  const handlers: Record<string, (arg?: any) => void> = {};
  mocks.stream.mockReturnValue({
    on: vi.fn((event: string, cb: (arg?: any) => void) => {
      handlers[event] = cb;
    }),
    destroy: vi.fn(),
  });
  return handlers;
};

const readRow = async (response: Response) => {
  const [header, row] = (await response.text()).trim().split("\n");
  const columns = splitCsvLine(header);
  const cells = splitCsvLine(row);
  return {
    columns,
    cells,
    cell: (name: string) => cells[columns.indexOf(name)],
  };
};

describe("GET /api/bookings/export", () => {
  it("requires a complete, valid date range", async () => {
    const response = await GET(
      new Request("http://localhost/api/bookings/export") as any,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A valid startDate and endDate are required.",
    });
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("filters booking start dates inclusively in the tenant time zone", async () => {
    mocks.stream.mockReturnValue({ on: vi.fn(), destroy: vi.fn() });

    const response = await GET(
      new Request(
        "http://localhost/api/bookings/export?startDate=2026-04-01&endDate=2026-04-30",
      ) as any,
    );

    expect(response.status).toBe(200);
    expect(mocks.where).toHaveBeenNthCalledWith(
      1,
      "startDate",
      ">=",
      expect.any(Date),
    );
    expect(mocks.where).toHaveBeenNthCalledWith(
      2,
      "startDate",
      "<",
      expect.any(Date),
    );
    expect(mocks.orderBy).toHaveBeenCalledWith("startDate");
  });

  it("exports per-room catering, cleaning and security columns", async () => {
    const handlers = streamHandlers();

    const response = await GET(
      new Request(
        "http://localhost/api/bookings/export?startDate=2026-04-01&endDate=2026-04-30",
      ) as any,
    );

    handlers.data({
      id: "b1",
      data: () => ({
        requestNumber: 42,
        roomId: "103, 220",
        catering: "yes",
        cateringByRoom: { "103": "yes", "220": "no" },
        chartFieldForCateringByRoom: { "103": "CAT-103", "220": "ignored" },
        cleaningService: "yes",
        cleaningByRoom: { "103": "yes", "220": "yes" },
        chartFieldForCleaningByRoom: { "103": "CLN-103", "220": "  " },
        hireSecurity: "yes; willoughby",
        hireSecurityByRoom: { "103": "yes", "220": "willoughby" },
        chartFieldForSecurityByRoom: { "220": "SEC-220" },
      }),
    });
    handlers.end();

    const { columns, cells, cell } = await readRow(response);

    expect(cell("Catering (Y/N)")).toBe("Yes");
    expect(cell("Catering Rooms")).toBe("103");
    expect(cell("Catering Chart Field")).toBe("103: CAT-103");
    expect(cell("Cleaning Services (Y/N)")).toBe("Yes");
    expect(cell("Cleaning Rooms")).toBe("103; 220");
    expect(cell("Cleaning Chart Field")).toBe("103: CLN-103");
    expect(cell("Hire Security (Y/N)")).toBe("Yes");
    expect(cell("Hire Security Rooms")).toBe("103; 220: willoughby");
    expect(cell("Hire Security Chart Field")).toBe("220: SEC-220");
  });

  it("leaves per-room service columns empty for legacy bookings without maps", async () => {
    const handlers = streamHandlers();

    const response = await GET(
      new Request(
        "http://localhost/api/bookings/export?startDate=2026-04-01&endDate=2026-04-30",
      ) as any,
    );

    handlers.data({
      id: "b2",
      data: () => ({ requestNumber: 7, roomId: "103", catering: "yes" }),
    });
    handlers.end();

    const { columns, cells, cell } = await readRow(response);

    expect(cells).toHaveLength(columns.length);
    expect(cell("Catering (Y/N)")).toBe("Yes");
    expect(cell("Catering Rooms")).toBe("");
    expect(cell("Catering Chart Field")).toBe("");
    expect(cell("Hire Security Rooms")).toBe("");
  });
});

describe("GET /api/bookings/export — End Event Status", () => {
  const exportStatus = async (fields: Record<string, unknown>) => {
    const handlers = streamHandlers();
    const response = await GET(
      new Request(
        "http://localhost/api/bookings/export?startDate=2026-09-01&endDate=2026-10-31",
      ) as any,
    );
    handlers.data({
      id: "b1",
      data: () => ({ requestNumber: 7517, roomId: "1201", ...fields }),
    });
    handlers.end();
    return (await readRow(response)).cell("End Event Status");
  };

  it("reports a user cancellation after final approval as Canceled", async () => {
    // Prod #7517: approved 8/31, canceled by the requester 9/1, auto-closed.
    expect(
      await exportStatus({
        requestedAt: "2026-08-31T14:19:52Z",
        firstApprovedAt: "2026-08-31T18:01:58Z",
        finalApprovedAt: "2026-08-31T18:04:20Z",
        canceledAt: "2026-09-01T15:21:08Z",
        closedAt: "2026-09-01T15:21:13Z",
      }),
    ).toBe("Canceled");
  });

  it("reports a no-show as No Show even though auto-cancel stamps canceledAt afterwards", async () => {
    // Prod #7854: no-show stamped, then System cancel 0.2s later.
    expect(
      await exportStatus({
        finalApprovedAt: "2026-10-14T19:46:13Z",
        noShowedAt: "2026-10-14T20:42:51.244Z",
        canceledAt: "2026-10-14T20:42:51.435Z",
        closedAt: "2026-10-14T20:42:55Z",
      }),
    ).toBe("No Show");
  });

  it("reports a no-show without a follow-up cancel as No Show", async () => {
    expect(
      await exportStatus({
        finalApprovedAt: "2026-10-14T19:46:13Z",
        noShowedAt: "2026-10-14T20:42:51Z",
      }),
    ).toBe("No Show");
  });

  it("lets a later check-in/check-out override an earlier no-show", async () => {
    // Prod #7733: flagged no-show, arrived late, checked in and out.
    expect(
      await exportStatus({
        finalApprovedAt: "2026-10-01T13:16:40Z",
        noShowedAt: "2026-10-01T17:38:49Z",
        checkedInAt: "2026-10-01T18:43:25Z",
        checkedOutAt: "2026-10-01T23:05:44Z",
      }),
    ).toBe("Checked out");
  });

  it("reports a decline after pre-approval as Declined", async () => {
    expect(
      await exportStatus({
        requestedAt: "2026-10-01T10:00:00Z",
        firstApprovedAt: "2026-10-01T11:00:00Z",
        declinedAt: "2026-10-02T09:00:00Z",
      }),
    ).toBe("Declined");
  });

  it("still reports Approved when nothing happened after final approval", async () => {
    expect(
      await exportStatus({
        requestedAt: "2026-10-01T10:00:00Z",
        firstApprovedAt: "2026-10-01T11:00:00Z",
        finalApprovedAt: "2026-10-01T12:00:00Z",
      }),
    ).toBe("Approved");
  });

  it("breaks same-instant auto-approval stamps toward Approved", async () => {
    const t = "2026-10-01T10:00:00Z";
    expect(
      await exportStatus({
        requestedAt: t,
        firstApprovedAt: t,
        finalApprovedAt: t,
      }),
    ).toBe("Approved");
  });

  it("falls back to Requested when no lifecycle timestamps are set", async () => {
    expect(await exportStatus({})).toBe("Requested");
  });
});
