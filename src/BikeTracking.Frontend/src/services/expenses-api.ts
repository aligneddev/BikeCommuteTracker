import type { ApiResult, ErrorResponse } from "./users-api";

export interface RecordExpenseResponse {
  expenseId: number;
  riderId: number;
  savedAtUtc: string;
  receiptAttached: boolean;
}

export async function recordExpense(
  _formData: FormData,
): Promise<ApiResult<RecordExpenseResponse, ErrorResponse>> {
  throw new Error("Not implemented.");
}
