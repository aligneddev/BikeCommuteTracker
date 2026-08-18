import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  mockSampleCsvDownload,
} from "../../helpers/mock-api.js";

test("download_sample_csv_provides_correct_structure", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "download_sample_csv_provides_correct_structure",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated monthly import session and shell mocks", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await mockSampleCsvDownload(page);
  });

  let download;
  await recorder.step("open monthly import page", async () => {
    await page.goto("/import/monthly");
    await expect(
      page.getByRole("heading", { name: "Monthly Summary Import" })
    ).toBeVisible();
  });

  await recorder.step("download sample csv", async () => {
    const downloadPromise = page.waitForDownload();
    await page.getByRole("link", { name: "Download Sample CSV" }).click();
    download = await downloadPromise;
    await expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  await recorder.step("inspect downloaded csv content", async () => {
    const filePath = await download.path();
    const content = await page.evaluate(async (path) => {
      const fs = await import("fs/promises");
      return fs.readFile(path, "utf-8");
    }, filePath);

    const lines = content.trim().split(/\r?\n/);
    expect(lines[0].startsWith("#")).toBeTruthy();
    expect(content).toContain("Difficulty");
    expect(content).toContain("PrimaryTravelDirection");
    expect(content).toContain("Notes");
    expect(content).toContain("1-5");
    expect(content).toContain("North");
    expect(content).toContain("NE");
    expect(content).toContain("max 500 characters");
    expect(content).toContain("2026-08-01,12.5,3,North,Morning commute");
    expect(content).toContain("2026-08-02,8.1,5,SE,Strong headwind but manageable");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:download_sample_csv_provides_correct_structure");
  await recorder.save(testInfo);
});
