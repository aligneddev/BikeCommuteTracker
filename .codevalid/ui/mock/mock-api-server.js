/**
 * Lightweight mock API server for CodeValid seed tests.
 *
 * Listens on port 5436 (the default VITE_API_BASE_URL fallback).
 * Handles all endpoints the app polls at startup and during tests:
 *   GET  /health           → 200 { status: 'ok' }
 *   POST /api/users/identify → 200 { userId:1, userName, authorized:true }
 *   POST /api/users/signup  → 200 { userId:1, userName, createdAtUtc, eventStatus }
 *   GET  /api/users/me/settings → 200 { hasSettings:false, settings:{…} }
 *   GET  /api/rides*        → 200 []
 *   GET  /api/dashboard*    → 200 {}
 *   *    everything else    → 200 {}
 *
 * Started by playwright.config.js webServer block.
 */

import http from "http";

const PORT = parseInt(process.env.MOCK_API_PORT || "5436", 10);

const EMPTY_SETTINGS = {
  averageCarMpg: null,
  yearlyGoalMiles: null,
  oilChangePrice: null,
  mileageRateCents: null,
  locationLabel: null,
  latitude: null,
  longitude: null,
  dashboardGallonsAvoidedEnabled: false,
  dashboardGoalProgressEnabled: false,
  updatedAtUtc: null,
  weatherApiKey: null,
  eiaGasApiKey: null,
};

function json(res, body, status = 200) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-User-Id",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-User-Id",
    });
    return res.end();
  }

  // Health check (ApiStartupGuard polls this)
  if (url === "/health" || url === "/api/health") {
    return json(res, { status: "ok" });
  }

  // Login / identify
  if (url === "/api/users/identify" && method === "POST") {
    const body = await readBody(req);
    if (body.name && body.pin) {
      return json(res, { userId: 1, userName: body.name, authorized: true });
    }
    return json(res, { code: "unauthorized", message: "Name or PIN is incorrect." }, 401);
  }

  // Signup
  if (url === "/api/users/signup" && method === "POST") {
    const body = await readBody(req);
    return json(res, {
      userId: 1,
      userName: body.name || "test-user",
      createdAtUtc: new Date().toISOString(),
      eventStatus: "queued",
    });
  }

  // User settings
  if (url === "/api/users/me/settings") {
    if (method === "GET") {
      return json(res, { hasSettings: false, settings: EMPTY_SETTINGS });
    }
    if (method === "PUT") {
      return json(res, { hasSettings: true, settings: EMPTY_SETTINGS });
    }
  }

  // Rides
  if (url.startsWith("/api/rides")) {
    if (method === "GET") return json(res, []);
    return json(res, {});
  }

  // Dashboard
  if (url.startsWith("/api/dashboard") || url.startsWith("/api/stats")) {
    return json(res, {});
  }

  // Catch-all
  return json(res, {});
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mock API server listening on http://0.0.0.0:${PORT}`);
});

// Keep alive
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
