import { render, screen } from "@testing-library/react";
import { signIn } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SsoSignIn from "@/components/src/client/routes/components/SsoSignIn";
import { useAuth } from "@/components/src/client/routes/components/AuthProvider";

vi.mock("@/components/src/client/routes/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockSignIn = vi.mocked(signIn);
const mockUseAuth = vi.mocked(useAuth);
const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);

const setAuth = (isOnTestEnv: boolean) => {
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    error: null,
    isOnTestEnv,
  });
};

describe("SsoSignIn auto-redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as any);
  });

  it("auto-triggers signIn with default callback when not on a tenant route", () => {
    setAuth(false);
    mockUseParams.mockReturnValue({});

    render(<SsoSignIn />);

    expect(mockSignIn).toHaveBeenCalledWith("nyu-sso", { callbackUrl: "/" });
    expect(screen.getByText(/Redirecting to NYU sign-in/i)).toBeInTheDocument();
  });

  it("includes the tenant in the callback URL when on a tenant route", () => {
    setAuth(false);
    mockUseParams.mockReturnValue({ tenant: "itp" });

    render(<SsoSignIn />);

    expect(mockSignIn).toHaveBeenCalledWith("nyu-sso", { callbackUrl: "/itp" });
  });

  it("unwraps tenant when provided as an array (catch-all segments)", () => {
    setAuth(false);
    mockUseParams.mockReturnValue({ tenant: ["mc", "extra"] });

    render(<SsoSignIn />);

    expect(mockSignIn).toHaveBeenCalledWith("nyu-sso", { callbackUrl: "/mc" });
  });

  it("does not call signIn in test environment", () => {
    setAuth(true);
    mockUseParams.mockReturnValue({});

    render(<SsoSignIn />);

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Test environment detected/i),
    ).toBeInTheDocument();
  });
});
