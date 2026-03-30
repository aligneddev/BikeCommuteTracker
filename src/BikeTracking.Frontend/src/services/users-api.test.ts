import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUserSettings,
  identifyUser,
  loginUser,
  saveUserSettings,
  signupUser,
} from "./users-api";

const fetchMock = vi.fn<typeof fetch>();
const url = "http://localhost:5436/api";

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

describe("users-api transport", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loginUser posts to identify endpoint with JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ userId: 1, userName: "Alice", authorized: true }, 200),
    );

    const payload = { name: "Alice", pin: "1234" };
    const result = await loginUser(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${url}/users/identify`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      userId: 1,
      userName: "Alice",
      authorized: true,
    });
  });

  it("identifyUser and loginUser both target identify endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ userId: 2, userName: "Bob", authorized: true }, 200),
      )
      .mockResolvedValueOnce(
        jsonResponse({ userId: 2, userName: "Bob", authorized: true }, 200),
      );

    await identifyUser({ name: "Bob", pin: "5678" });
    await loginUser({ name: "Bob", pin: "5678" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`${url}/users/identify`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${url}/users/identify`);
  });

  it("returns parsed error payload on non-success response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: "validation_failed",
          message: "Validation failed.",
          details: ["Name is required."],
        },
        400,
      ),
    );

    const result = await loginUser({ name: "", pin: "1234" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toEqual({
      code: "validation_failed",
      message: "Validation failed.",
      details: ["Name is required."],
    });
  });

  it("returns retry-after header and throttle payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: "throttled",
          message: "Too many attempts. Try again later.",
          retryAfterSeconds: 5,
        },
        429,
        { "Retry-After": "5" },
      ),
    );

    const result = await loginUser({ name: "Alice", pin: "0000" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.retryAfterSeconds).toBe(5);
    expect(result.error).toEqual({
      code: "throttled",
      message: "Too many attempts. Try again later.",
      retryAfterSeconds: 5,
    });
  });

  it("returns undefined error when response body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Service unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    const result = await signupUser({ name: "Alice", pin: "1234" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.error).toBeUndefined();
  });

  it("propagates fetch errors for caller-level handling", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(loginUser({ name: "Alice", pin: "1234" })).rejects.toThrow(
      "network down",
    );
  });

  it("getUserSettings sends GET request to the settings endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          hasSettings: true,
          settings: {
            averageCarMpg: 31.5,
            yearlyGoalMiles: 1800,
            oilChangePrice: 89.99,
            mileageRateCents: 67.5,
            locationLabel: null,
            latitude: null,
            longitude: null,
            updatedAtUtc: "2026-03-30T10:00:00Z",
          },
        },
        200,
      ),
    );

    const result = await getUserSettings();

    expect(fetchMock).toHaveBeenCalledWith(
      `${url}/users/me/settings`,
      expect.objectContaining({ headers: {} }),
    );
    expect(result.ok).toBe(true);
    expect(result.data?.hasSettings).toBe(true);
  });

  it("saveUserSettings sends PUT request with JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          hasSettings: true,
          settings: {
            averageCarMpg: 31.5,
            yearlyGoalMiles: 1800,
            oilChangePrice: 89.99,
            mileageRateCents: 67.5,
            locationLabel: null,
            latitude: null,
            longitude: null,
            updatedAtUtc: "2026-03-30T10:00:00Z",
          },
        },
        200,
      ),
    );

    const payload = {
      averageCarMpg: 31.5,
      yearlyGoalMiles: 1800,
      oilChangePrice: 89.99,
      mileageRateCents: 67.5,
    };

    const result = await saveUserSettings(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      `${url}/users/me/settings`,
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("settings requests include auth header when session user exists", async () => {
    sessionStorage.setItem(
      "bike_tracking_auth_session",
      JSON.stringify({ userId: 42, userName: "Alice" }),
    );

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            hasSettings: false,
            settings: {
              averageCarMpg: null,
              yearlyGoalMiles: null,
              oilChangePrice: null,
              mileageRateCents: null,
              locationLabel: null,
              latitude: null,
              longitude: null,
              updatedAtUtc: null,
            },
          },
          200,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            hasSettings: true,
            settings: {
              averageCarMpg: 30,
              yearlyGoalMiles: 1000,
              oilChangePrice: 50,
              mileageRateCents: 40,
              locationLabel: null,
              latitude: null,
              longitude: null,
              updatedAtUtc: "2026-03-30T10:00:00Z",
            },
          },
          200,
        ),
      );

    await getUserSettings();
    await saveUserSettings({ averageCarMpg: 30 });

    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: { "X-User-Id": "42" },
      }),
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "42",
        },
      }),
    );
  });
});
