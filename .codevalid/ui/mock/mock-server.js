import { authSession, emptyEvents } from "./mock-data.js";

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function setupMockRoutes(page, options = {}) {
  const events = options.events ?? emptyEvents;
  const session = options.session ?? authSession;
  const gasPriceResponse = options.gasPriceResponse ?? {
    date: "2026-08-18",
    pricePerGallon: null,
    isAvailable: false,
    dataSource: null,
  };
  const weatherResponse = options.weatherResponse ?? {
    rideDateTimeLocal: "2026-08-18T08:00",
    isAvailable: false,
  };
  const presets = options.presets ?? [];
  const recordRideResponse = options.recordRideResponse ?? {
    rideId: 101,
    riderId: 1,
    savedAtUtc: "2026-08-18T12:00:00Z",
    eventStatus: "recorded",
  };

  await page.route("**/api/auth/signin", async (route) =>
    json(route, 200, session)
  );
  await page.route("**/api/auth/signup", async (route) =>
    json(route, 201, session)
  );
  await page.route("**/api/events", async (route) =>
    json(route, 200, events)
  );
  await page.route("**/health", async (route) =>
    json(route, 200, { status: "ok" })
  );
  await page.route("**/api/rides/gas-price**", async (route) =>
    json(route, 200, gasPriceResponse)
  );
  await page.route("**/api/rides/weather**", async (route) => {
    const url = new URL(route.request().url());
    const rideDateTimeLocal =
      url.searchParams.get("rideDateTimeLocal") ?? weatherResponse.rideDateTimeLocal;
    return json(route, 200, {
      ...weatherResponse,
      rideDateTimeLocal,
    });
  });
  await page.route("**/api/rides/presets", async (route) =>
    json(route, 200, {
      presets,
      generatedAtUtc: "2026-08-18T12:00:00Z",
    })
  );
  await page.route("**/api/rides", async (route) => {
    if (route.request().method() === "POST") {
      return json(route, 201, recordRideResponse);
    }
    return route.fallback();
  });
}

export { json };
