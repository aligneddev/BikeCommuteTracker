import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function setupAuthenticatedSession(page) {
  await page.addInitScript(() => {
    const now = new Date();
    window.localStorage.setItem("token", "mock-valid-token");
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        id: "user-1",
        username: "johndoe",
        email: "john@example.com",
        fullName: "John Doe",
      })
    );
    window.sessionStorage.setItem(
      "bike_tracking_auth_session",
      JSON.stringify({
        userId: 1,
        userName: "John Doe",
        lastActivityAtUtc: now.toISOString(),
        expiresAtUtc: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      })
    );
  });
}

async function setupRecordRidePageMocks(page) {
  await page.route("**/api/gas-price**", async (route) =>
    json(route, 200, {\n      isAvailable: true,\n      pricePerGallon: 3.45,\n      dataSource: \"Source: U.S. Energy Information Administration (EIA)\",\n    })\n  );\n\n  await page.route(\"**/api/ride-presets**\", async (route) =>\n    json(route, 200, { presets: [] })\n  );\n\n  await page.route(\"**/api/**\", async (route) => {\n    if (route.request().method() === \"GET\") {\n      return json(route, 200, {});\n    }\n    return json(route, 200, {});\n  });\n}\n\ntest(\"authenticated user navigates to Record Ride page\", async ({ page }, testInfo) => {\n  const recorder = new ExecutionRecorder({\n    testId: \"authenticated_user_navigates_to_record_ride\",\n    testTitle: \"Authenticated user navigates to Record Ride page\",\n  });\n\n  await recorder.step(\"Seed authenticated session\", async () => {\n    await setupAuthenticatedSession(page);\n  });\n\n  await recorder.step(\"Mock protected page APIs\", async () => {\n    await setupRecordRidePageMocks(page);\n  });\n\n  await recorder.step(\"Open dashboard with authenticated session\", async () => {\n    await page.goto(\"/dashboard\");\n    await expect(page.getByRole(\"heading", { name: \"Your riding story, one screen.\" })).toBeVisible();\n  });\n\n  await recorder.step(\"Click the Record Ride navigation link\", async () => {\n    await page.getByRole(\"link\", { name: \"Record Ride\" }).click();\n  });\n\n  await recorder.step(\"Verify redirect to protected Record Ride page\", async () => {\n    await expect(page).toHaveURL(/\\/rides\\/record$/);\n    await expect(page.getByRole(\"heading\", { name: \"Record a Ride\" })).toBeVisible();\n    await expect(page.getByRole(\"heading\", { name: \"Log in\" })).not.toBeVisible();\n  });\n\n  console.log(\"CODEVALID_TEST_ASSERTION_OK:authenticated_user_navigates_to_record_ride\");\n  await recorder.save(testInfo);\n});\n"
  },
  {
    "e2e_test_case_id": "unauthenticated_user_blocked_from_record_ride",
    "path": ".codevalid/ui/test/task_8716971322_20260817083829/unauthenticated_user_blocked_from_record_ride.spec.js",
    "content": "import { test, expect } from \"@playwright/test\";\nimport { ExecutionRecorder } from \"../../helpers/execution-recorder.js\";\n\nfunction json(route, status, body) {\n  return route.fulfill({\n    status,\n    contentType: \"application/json\",\n    body: JSON.stringify(body),\n  });\n}\n\nasync function setupUnauthenticatedSession(page) {\n  await page.addInitScript(() => {\n    window.localStorage.removeItem(\"token\");\n    window.localStorage.removeItem(\"user\");\n    window.sessionStorage.removeItem(\"bike_tracking_auth_session\");\n  });\n}\n\nasync function setupSafeApiFallbacks(page) {\n  await page.route(\"**/api/**\", async (route) => json(route, 200, {}));\n}\n\ntest(\"unauthenticated user is blocked from navigating to Record Ride page\", async ({ page }, testInfo) => {\n  const recorder = new ExecutionRecorder({\n    testId: \"unauthenticated_user_blocked_from_record_ride\",\n    testTitle: \"Unauthenticated user is blocked from navigating to Record Ride page\",\n  });\n\n  await recorder.step(\"Clear session state\", async () => {\n    await setupUnauthenticatedSession(page);\n  });\n\n  await recorder.step(\"Register API fallbacks to avoid live backend calls\", async () => {\n    await setupSafeApiFallbacks(page);\n  });\n\n  await recorder.step(\"Attempt direct navigation to protected route\", async () => {\n    await page.goto(\"/rides/record\");\n  });\n\n  await recorder.step(\"Verify redirect to login instead of Record Ride page\", async () => {\n    await expect(page).toHaveURL(/\\/login$/);\n    await expect(page.getByRole(\"heading\", { name: \"Log in\" })).toBeVisible();\n    await expect(page.getByRole(\"heading\", { name: \"Record a Ride\" })).not.toBeVisible();\n  });\n\n  console.log(\"CODEVALID_TEST_ASSERTION_OK:unauthenticated_user_blocked_from_record_ride\");\n  await recorder.save(testInfo);\n});\n"
  },
  {
    "e2e_test_case_id": "navigation_to_record_ride_preserves_auth_state",
    "path": ".codevalid/ui/test/task_8716971322_20260817083829/navigation_to_record_ride_preserves_auth_state.spec.js",
    "content": "import { test, expect } from \"@playwright/test\";\nimport { ExecutionRecorder } from \"../../helpers/execution-recorder.js\";\n\nfunction json(route, status, body) {\n  return route.fulfill({\n    status,\n    contentType: \"application/json\",\n    body: JSON.stringify(body),\n  });\n}\n\nasync function setupAuthenticatedSession(page) {\n  await page.addInitScript(() => {\n    const now = new Date();\n    window.localStorage.setItem(\"token\", \"mock-valid-token\");\n    window.localStorage.setItem(\n      \"user\",\n      JSON.stringify({\n        id: \"user-1\",\n        username: \"johndoe\",\n        email: \"john@example.com\",\n        fullName: \"John Doe\",\n      })\n    );\n    window.sessionStorage.setItem(\n      \"bike_tracking_auth_session\",\n      JSON.stringify({\n        userId: 1,\n        userName: \"John Doe\",\n        lastActivityAtUtc: now.toISOString(),\n        expiresAtUtc: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),\n      })\n    );\n  });\n}\n\nasync function setupRecordRidePageMocks(page) {\n  await page.route(\"**/api/gas-price**\", async (route) =>\n    json(route, 200, {\n      isAvailable: true,\n      pricePerGallon: 3.45,\n      dataSource: \"Source: U.S. Energy Information Administration (EIA)\",\n    })\n  );\n\n  await page.route(\"**/api/ride-presets**\", async (route) =>\n    json(route, 200, { presets: [] })\n  );\n\n  await page.route(\"**/api/**\", async (route) => {\n    if (route.request().method() === \"GET\") {\n      return json(route, 200, {});\n    }\n    return json(route, 200, {});\n  });\n}\n\ntest(\"navigation to Record Ride preserves authenticated session state\", async ({ page }, testInfo) => {\n  const recorder = new ExecutionRecorder({\n    testId: \"navigation_to_record_ride_preserves_auth_state\",\n    testTitle: \"Navigation to Record Ride preserves authenticated session state\",\n  });\n\n  await recorder.step(\"Seed authenticated session before app load\", async () => {\n    await setupAuthenticatedSession(page);\n  });\n\n  await recorder.step(\"Mock Record Ride page APIs\", async () => {\n    await setupRecordRidePageMocks(page);\n  });\n\n  await recorder.step(\"Open dashboard\", async () => {\n    await page.goto(\"/dashboard\");\n    await expect(page).toHaveURL(/\\/dashboard$/);\n    await expect(page.getByRole(\"heading\", { name: \"Your riding story, one screen.\" })).toBeVisible();\n  });\n\n  await recorder.step(\"Navigate using AppHeader Record Ride link\", async () => {\n    await page.getByRole(\"link\", { name: \"Record Ride\" }).click();\n  });\n\n  await recorder.step(\"Confirm authenticated session is still active on Record Ride page\", async () => {\n    await expect(page).toHaveURL(/\\/rides\\/record$/);\n    await expect(page.getByRole(\"heading\", { name: \"Record a Ride\" })).toBeVisible();\n    await expect(page.getByRole(\"button\", { name: \"John Doe\" })).toBeVisible();\n    await expect(page.getByRole(\"heading\", { name: \"Log in\" })).not.toBeVisible();\n  });\n\n  console.log(\"CODEVALID_TEST_ASSERTION_OK:navigation_to_record_ride_preserves_auth_state\");\n  await recorder.save(testInfo);\n});\n"
  }
