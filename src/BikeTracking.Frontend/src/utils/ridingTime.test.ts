import { describe, expect, it } from "vitest";
import { formatHoursMinutes } from "./ridingTime";

describe("formatHoursMinutes", () => {
  it.each([
    [0, "0h 0m"],
    [45, "0h 45m"],
    [120, "2h 0m"],
    [2535, "42h 15m"],
    [62550, "1,042h 30m"],
  ])("formats %i minutes as %s", (totalMinutes, expected) => {
    expect(formatHoursMinutes(totalMinutes)).toBe(expected);
  });
});
