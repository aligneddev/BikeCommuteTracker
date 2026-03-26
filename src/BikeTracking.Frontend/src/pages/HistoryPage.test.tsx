import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactElement } from "react";
import * as ridesService from "../../services/ridesService";

// Placeholder component - will be implemented in T019
function HistoryPage(): ReactElement {
  return <div>History Page Placeholder</div>;
}

describe("HistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render summary tiles for thisMonth, thisYear, and allTime", async () => {
    // PLACEHOLDER: This test will fail until HistoryPage is properly implemented
    // Expected behavior: Three summary cards visible with periods: thisMonth, thisYear, allTime
    render(<HistoryPage />);
    
    // These assertions will fail until implementation
    expect(screen.queryByText(/this month/i)).toBeInTheDocument();
    expect(screen.queryByText(/this year/i)).toBeInTheDocument();
    expect(screen.queryByText(/all.time|all-time|all time/i)).toBeInTheDocument();
  });

  it("should render ride grid with ride data", async () => {
    // PLACEHOLDER: Will fail until grid is implemented
    // Expected: Table with ride rows showing date and miles
    render(<HistoryPage />);
    
    // These assertions will fail until implementation
    const rideRows = screen.queryAllByRole("row");
    expect(rideRows.length).toBeGreaterThan(1); // At least header + 1 data row
  });

  it("should show empty state when no rides exist", async () => {
    // PLACEHOLDER: Will fail until empty state is implemented
    // Expected: Empty message appears when rides list is empty
    render(<HistoryPage />);
    
    // This assertion will fail until implementation
    expect(screen.queryByText(/no rides|empty/i)).toBeInTheDocument();
  });

  it("should call getRideHistory on mount", async () => {
    // PLACEHOLDER: Will fail until effect is implemented
    const spy = vi.spyOn(ridesService, "getRideHistory");
    
    render(<HistoryPage />);
    
    // This assertion will fail until implementation
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({}));
  });
});
