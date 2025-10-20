import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { DatabaseProvider } from "@/components/src/client/routes/components/Provider";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/client/clientDb";

// Mock fetch
global.fetch = vi.fn();

// Mock Firebase client
vi.mock("@/lib/firebase/client/clientDb", () => ({
  clientFetchAllDataFromCollection: vi.fn(),
}));

describe("Safety Training Verification", () => {
  const mockFirestoreData = [
    {
      id: "1",
      email: "firestore1@nyu.edu",
      completedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "2",
      email: "firestore2@nyu.edu",
      completedAt: "2024-01-02T00:00:00.000Z",
    },
  ];

  const mockFormData = {
    emails: ["form1@nyu.edu", "form2@nyu.edu"],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock Firestore data
    (clientFetchAllDataFromCollection as any).mockResolvedValue(mockFirestoreData);
    
    // Mock fetch for form data
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFormData),
    });
  });

  it("should merge Firestore and Form data correctly", async () => {
    let safetyTrainedUsers;
    
    const TestComponent = () => {
      const context = useContext(DatabaseContext);
      safetyTrainedUsers = context.safetyTrainedUsers;
      return null;
    };

    render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>
    );

    await waitFor(() => {
      expect(safetyTrainedUsers).toHaveLength(4);
      expect(safetyTrainedUsers.map(user => user.email)).toEqual([
        "firestore1@nyu.edu",
        "firestore2@nyu.edu",
        "form1@nyu.edu",
        "form2@nyu.edu",
      ]);
    });
  });

  it("should handle Form API errors and fallback to Firestore data", async () => {
    let safetyTrainedUsers;
    
    // Mock fetch to simulate API error
    (global.fetch as any).mockRejectedValue(new Error("API Error"));

    const TestComponent = () => {
      const context = useContext(DatabaseContext);
      safetyTrainedUsers = context.safetyTrainedUsers;
      return null;
    };

    render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>
    );

    await waitFor(() => {
      expect(safetyTrainedUsers).toHaveLength(2);
      expect(safetyTrainedUsers.map(user => user.email)).toEqual([
        "firestore1@nyu.edu",
        "firestore2@nyu.edu",
      ]);
    });
  });

  it("should handle both Firestore and Form API errors", async () => {
    let safetyTrainedUsers;
    
    // Mock both Firestore and Form API errors
    (clientFetchAllDataFromCollection as any).mockRejectedValue(new Error("Firestore Error"));
    (global.fetch as any).mockRejectedValue(new Error("API Error"));

    const TestComponent = () => {
      const context = useContext(DatabaseContext);
      safetyTrainedUsers = context.safetyTrainedUsers;
      return null;
    };

    render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>
    );

    await waitFor(() => {
      expect(safetyTrainedUsers).toHaveLength(0);
    });
  });
});
